
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5201';
const LOGIN_DATA = { username: 'usuario', password: 'admin123' };

async function login() {
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
  return { user, headers };
}

async function createPR(user, headers, scenarioName) {
  const prRes = await fetch(`${BASE_URL}/api/purchase-requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requesterId: user.id,
      companyId: 1,
      costCenterId: 1,
      category: 'material',
      urgency: 'alta',
      justification: `Test Scenario: ${scenarioName}`,
      items: [
        { description: 'Item Teste 1 Available', quantity: '10', unit: 'UN' },
        { description: 'Item Teste 2 Unavailable', quantity: '5', unit: 'UN' }
      ]
    })
  });
  const pr = await prRes.json();
  // console.log('PR Response:', JSON.stringify(pr, null, 2));
  if (!pr.id) {
    console.error('PR Creation Failed:', JSON.stringify(pr, null, 2));
    throw new Error('PR ID missing');
  }
  console.log(`[${scenarioName}] Created PR:`, pr.id);
  
  // Approve A1
  await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/approve-a1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ approved: true, approverId: user.id })
  });
  
  return pr;
}

async function createQuotationFlow(pr, headers, scenarioName) {
  // Create Quotation
  const quoteRes = await fetch(`${BASE_URL}/api/quotations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      purchaseRequestId: pr.id,
      quotationDeadline: new Date(Date.now() + 86400000).toISOString(),
      deliveryLocationId: 1,
      technicalSpecs: 'Specs'
    })
  });
  const quote = await quoteRes.json();
  
  // Create Items
  const prItemsRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/items`, { headers });
  const prItems = await prItemsRes.json();
  
  for (const item of prItems) {
    await fetch(`${BASE_URL}/api/quotations/${quote.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        purchaseRequestItemId: item.id,
        itemCode: item.productCode || 'ITEM',
        description: item.description,
        quantity: String(item.requestedQuantity),
        unit: item.unit,
        specifications: 'Spec'
      })
    });
  }

  // Add Supplier
  await fetch(`${BASE_URL}/api/quotations/${quote.id}/supplier-quotations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ supplierId: 20 })
  });

  // Get Supplier Quotation
  const sqRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/supplier-quotations`, { headers });
  const supplierQuotations = await sqRes.json();
  const sq = supplierQuotations[0];
  
  // Simulate Supplier Response (fill items)
  const sqItemsRes = await fetch(`${BASE_URL}/api/supplier-quotations/${sq.id}/items`, { headers });
  const sqItems = await sqItemsRes.json();
  
  for (const item of sqItems) {
    await fetch(`${BASE_URL}/api/supplier-quotation-items/${item.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        unitPrice: '10.00',
        isAvailable: true 
      })
    });
  }
  
  return { quote, sq, sqItems };
}

async function runScenario(scenarioName, unavailableItemIndices) {
  console.log(`\n--- Running Scenario: ${scenarioName} ---`);
  const { user, headers } = await login();
  const pr = await createPR(user, headers, scenarioName);
  const { quote, sq, sqItems } = await createQuotationFlow(pr, headers, scenarioName);
  
  // Prepare unavailability payload
  const unavailableItemsPayload = [];
  for (const index of unavailableItemIndices) {
    if (sqItems[index]) {
      unavailableItemsPayload.push({
        quotationItemId: sqItems[index].quotationItemId,
        reason: 'Test Unavailable'
      });
      console.log(`Marking item ${index} (ID: ${sqItems[index].id}) as unavailable`);
    }
  }

  // Select Supplier
  const selectRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/select-supplier`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      selectedSupplierId: sq.supplierId,
      totalValue: '100.00',
      observations: `Selected for ${scenarioName}`,
      unavailableItems: unavailableItemsPayload
    })
  });
  
  const resultText = await selectRes.text();
  console.log(`Select result: ${selectRes.status}`);
  if (!selectRes.ok) console.log(resultText);

  // Verify
  // Check New PR
  const allPrsRes = await fetch(`${BASE_URL}/api/purchase-requests`, { headers });
  const allPrs = await allPrsRes.json();
  const newPr = allPrs.find(p => 
    p.justification && p.justification.includes(`[Item Indisponível] Derivado da solicitação ${pr.requestNumber}`)
  );
  
  if (newPr) {
    console.log('SUCCESS: New PR created:', newPr.id);
  } else {
    if (unavailableItemIndices.length > 0) {
      console.log('FAILURE: No new PR created for unavailable items');
    } else {
      console.log('SUCCESS: No new PR created (as expected)');
    }
  }

  // Check Original PR
  const updatedPrRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}`, { headers });
  const updatedPr = await updatedPrRes.json();
  console.log('Original PR Phase:', updatedPr.currentPhase);
  
  // Check Original PR Items
  const finalItemsRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/items`, { headers });
  const finalItems = await finalItemsRes.json();
  console.log(`Original PR has ${finalItems.length} items remaining (visible via API)`);
}

async function runAll() {
  try {
    await runScenario('Partial Availability', [1]); // Item index 1 unavailable
    await runScenario('All Unavailable', [0, 1]); // Both items unavailable
    await runScenario('All Available', []); // No unavailable items
  } catch (err) {
    console.error('Test Suite Failed:', err);
  }
}

runAll();
