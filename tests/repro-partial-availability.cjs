
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5201';
const LOGIN_DATA = { username: 'usuario', password: 'admin123' };

async function run() {
  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN_DATA)
  });
  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login failed: ${loginRes.status} ${text}`);
  }
  const user = await loginRes.json();
  const cookie = loginRes.headers.get('set-cookie');
  const headers = { 'Content-Type': 'application/json', 'Cookie': cookie };

  console.log('Logged in as', user.username);

  // 2. Create Purchase Request
  const prRes = await fetch(`${BASE_URL}/api/purchase-requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requesterId: user.id,
      companyId: 1,
      costCenterId: 1,
      category: 'material',
      urgency: 'alta',
      justification: 'Repro Partial Availability',
      items: [
        { description: 'Item Available', quantity: '10', unit: 'UN' },
        { description: 'Item Unavailable', quantity: '5', unit: 'UN' }
      ]
    })
  });
  const pr = await prRes.json();
  console.log('PR Response:', JSON.stringify(pr, null, 2));
  if (!pr.id) throw new Error('PR ID missing');
  console.log('Created PR:', pr.id);

  // 3. Approve A1
  await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/approve-a1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ approved: true, approverId: user.id })
  });
  console.log('Approved A1');

  // 4. Create Quotation (RFQ)
  console.log('Creating Quotation...');
  const quoteRes = await fetch(`${BASE_URL}/api/quotations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      purchaseRequestId: pr.id,
      quotationDeadline: new Date(Date.now() + 86400000).toISOString(),
      deliveryLocationId: 1, // Assuming location 1 exists
      technicalSpecs: 'Specs'
    })
  });
  
  if (!quoteRes.ok) {
    const text = await quoteRes.text();
    throw new Error(`Create Quotation failed: ${quoteRes.status} ${text}`);
  }
  
  const quote = await quoteRes.json();
  console.log('Created Quotation:', quote.id);

  // 4.1 Create Quotation Items (Link to PR items)
  // First fetch PR items
  const prItemsRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/items`, { headers });
  const prItems = await prItemsRes.json();
  
  for (const item of prItems) {
    await fetch(`${BASE_URL}/api/quotations/${quote.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        purchaseRequestItemId: item.id,
        itemCode: item.productCode || 'ITEM-001',
        description: item.description,
        quantity: String(item.requestedQuantity),
        unit: item.unit,
        specifications: item.technicalSpecification || 'Spec'
      })
    });
  }
  console.log('Created Quotation Items');

  // 4.2 Add Suppliers
  const sqCreateRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/supplier-quotations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      supplierId: 20
    })
  });
  if (!sqCreateRes.ok) {
    console.error('Failed to add supplier:', await sqCreateRes.text());
    return;
  }
  console.log('Added Supplier 20');

  // 5. Get Supplier Quotations
  const sqRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/supplier-quotations`, { headers });
  if (!sqRes.ok) {
    console.error('Failed to get supplier quotations:', await sqRes.text());
    return;
  }
  const supplierQuotations = await sqRes.json();
  if (supplierQuotations.length === 0) {
    console.error('No supplier quotations found');
    return;
  }
  const sq = supplierQuotations[0];
  console.log('Supplier Quotation ID:', sq.id);

  // 6. Simulate Supplier Response (Populate items)
  // We need to fetch items first to get IDs
  const sqItemsRes = await fetch(`${BASE_URL}/api/supplier-quotations/${sq.id}/items`, { headers });
  const sqItems = await sqItemsRes.json();
  console.log('Supplier Quotation Items:', JSON.stringify(sqItems, null, 2));
  
  // Update items with prices (simulate supplier filling it out)
  for (const item of sqItems) {
    await fetch(`${BASE_URL}/api/supplier-quotation-items/${item.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        unitPrice: '10.00',
        isAvailable: true // Supplier says available initially
      })
    });
  }
  console.log('Updated Supplier Quotation Items');

  // 7. Select Supplier with Unavailable Item
  // We mark the 2nd item as unavailable in the SELECTION request
  const unavailableItem = sqItems.find(i => i.quantity === '5' || i.quotationItem?.quantity === '5' || i.availableQuantity === '5'); 
  // Note: sqItems structure depends on backend. usually it has quotationItemId.
  // Let's assume the second one is the one we want to mark unavailable.
  const itemToMarkUnavailable = sqItems[1]; 

  console.log('Marking item unavailable:', itemToMarkUnavailable.id);

  const selectRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/select-supplier`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      selectedSupplierId: sq.supplierId,
      totalValue: '100.00', // Dummy
      observations: 'Selected with partial availability',
      unavailableItems: [
        { quotationItemId: itemToMarkUnavailable.quotationItemId, reason: 'Out of stock' }
      ],
      // We do NOT send nonSelectedItemsOption here to test the default behavior (or lack thereof)
      // Or we can try to force it if we implement the fix.
    })
  });

  if (!selectRes.ok) {
    console.log('Select Supplier Failed:', await selectRes.text());
  } else {
    console.log('Select Supplier Success');
  }

  // 8. Verify Result
  // Check if a new PR was created
  const allPrsRes = await fetch(`${BASE_URL}/api/purchase-requests`, { headers });
  const allPrs = await allPrsRes.json();
  const newPr = allPrs.find(p => 
    p.justification && (
      p.justification.includes(`Itens não selecionados da solicitação ${pr.requestNumber}`) || 
      p.justification.includes(`Itens indisponíveis da solicitação ${pr.requestNumber}`) ||
      p.justification.includes(`[Item Indisponível] Derivado da solicitação ${pr.requestNumber}`)
    )
  );
  
  if (newPr) {
    console.log('SUCCESS: New PR created for unavailable items:', newPr.id);

    // Verify Transferred Status of original items
    const originalItemsRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/items`, { headers });
    const originalItems = await originalItemsRes.json();
    
    const transferredItem = originalItems.find(i => i.isTransferred);
    if (transferredItem) {
      console.log('SUCCESS: Item marked as transferred:', transferredItem.id, 'to PR:', transferredItem.transferredToRequestId);
    } else {
      console.log('FAILURE: No items marked as transferred in original PR');
    }

    // Verify Snapshot (Approved Items)
    // Get updated original PR
    const updatedPrRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}`, { headers });
    const updatedPr = await updatedPrRes.json();
    
    console.log('Original PR Phase:', updatedPr.currentPhase);
    console.log('Original PR Total Value:', updatedPr.totalValue);

  } else {
    console.log('FAILURE: No new PR created for unavailable items.');
    const updatedPrRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}`, { headers });
    const updatedPr = await updatedPrRes.json();
    console.log('Original PR Phase:', updatedPr.currentPhase);
  }
}

run().catch(console.error);
