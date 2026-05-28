
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5201';
const LOGIN_DATA = { username: 'admin', password: 'admin123' };

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
  const userJson = await loginRes.json();
  const user = userJson.data || userJson;
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
  const prJson = await prRes.json();
  const pr = prJson.data || prJson;
  // console.log('PR Response:', JSON.stringify(pr, null, 2));
  if (!pr.id) {
    console.error('PR Creation Failed:', JSON.stringify(prJson, null, 2));
    throw new Error('PR ID missing');
  }
  console.log(`[${scenarioName}] Created PR:`, pr.id);

  // Send to approval and approve A1
  await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/send-to-approval`, {
    method: 'POST',
    headers
  });

  await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/approve-a1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ approved: true, approverId: user.id })
  });

  return pr;
}

async function createQuotationFlow(pr, headers, scenarioName, supplierId, unavailableItemIndices) {
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
  const quoteJson = await quoteRes.json();
  const quote = quoteJson.data || quoteJson;

  // Create Items
  const prItemsRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/items`, { headers });
  const prItemsJson = await prItemsRes.json();
  const prItems = prItemsJson.data || prItemsJson;

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
  await fetch(`${BASE_URL}/api/quotations/${quote.id}/send-rfq`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ suppliers: [supplierId], releaseWithoutEmail: true })
  });

  // Get Supplier Quotation
  const sqRes = await fetch(`${BASE_URL}/api/quotations/${quote.id}/supplier-quotations`, { headers });
  const supplierQuotationsJson = await sqRes.json();
  const supplierQuotations = supplierQuotationsJson.data || supplierQuotationsJson;
  const sq = supplierQuotations[0];

  // Simulate Supplier Response (fill items)
  const sqItemsRes = await fetch(`${BASE_URL}/api/supplier-quotations/${sq.id}/items`, { headers });
  const sqItemsJson = await sqItemsRes.json();
  const sqItems = sqItemsJson.data || sqItemsJson;

  const items = sqItems.map((item, index) => {
    const isAvailable = !unavailableItemIndices.includes(index);
    return {
      quotationItemId: item.quotationItemId,
      unitPrice: '10.00',
      isAvailable: isAvailable,
      availableQuantity: isAvailable ? '10' : '0',
      unavailabilityReason: isAvailable ? null : 'Sem estoque'
    };
  });

  await fetch(`${BASE_URL}/api/quotations/${quote.id}/update-supplier-quotation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      supplierId: supplierId,
      items: items,
      totalValue: '100.00',
      paymentTerms: '30 dias',
      deliveryTerms: '5 dias',
      warrantyPeriod: '12 meses'
    })
  });
  
  return { quote, sq, sqItems };
}

async function runScenario(scenarioName, unavailableItemIndices) {
  console.log(`\n--- Running Scenario: ${scenarioName} ---`);
  const { user, headers } = await login();

  // Garantir fornecedor
  const suppliersRes = await fetch(`${BASE_URL}/api/suppliers`, { headers });
  const suppliersJson = await suppliersRes.json();
  const suppliersList = suppliersJson.data || suppliersJson;
  let testSupplierId;
  if (suppliersList && suppliersList.length > 0) {
    testSupplierId = suppliersList[0].id;
  } else {
    const newSupplierRes = await fetch(`${BASE_URL}/api/suppliers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Fornecedor Teste Ltda',
        type: 0,
        cnpj: '11.444.777/0001-61',
        contact: 'Contato Teste',
        email: 'fornecedor@teste.com',
        phone: '11999999999',
        address: 'Rua do Teste, 123',
        paymentTerms: '30 dias',
        productsServices: 'Geral',
        companyId: 1
      })
    });
    const newSupplierJson = await newSupplierRes.json();
    const newSupplier = newSupplierJson.data || newSupplierJson;
    testSupplierId = newSupplier.id;
  }

  const pr = await createPR(user, headers, scenarioName);
  const { quote, sq, sqItems } = await createQuotationFlow(pr, headers, scenarioName, testSupplierId, unavailableItemIndices);

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
      unavailableItems: unavailableItemsPayload,
      unavailableItemsOption: 'with-rfq'
    })
  });

  const resultText = await selectRes.text();
  console.log(`Select result: ${selectRes.status}`);
  if (!selectRes.ok) console.log(resultText);

  // Verify
  // Check New PR
  const allPrsRes = await fetch(`${BASE_URL}/api/purchase-requests`, { headers });
  const allPrsJson = await allPrsRes.json();
  const allPrs = allPrsJson.data || allPrsJson;
  console.log(`Searching for new PR containing: Derivado da solicitação ${pr.requestNumber}`);
  console.log('Recent justifications:', allPrs.slice(0, 5).map(p => `[${p.id}]: ${p.justification}`).join(', '));
  const newPr = allPrs.find(p => 
    p.justification && p.justification.includes(`Derivado da solicitação ${pr.requestNumber}`)
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
  const updatedPrJson = await updatedPrRes.json();
  const updatedPr = updatedPrJson.data || updatedPrJson;
  console.log('Original PR Phase:', updatedPr.currentPhase);

  // Check Original PR Items
  const finalItemsRes = await fetch(`${BASE_URL}/api/purchase-requests/${pr.id}/items`, { headers });
  const finalItemsJson = await finalItemsRes.json();
  const finalItems = finalItemsJson.data || finalItemsJson;
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
