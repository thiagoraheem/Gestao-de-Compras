const fetch = require('node-fetch');

async function testPOCreation() {
  try {
    console.log('🧪 Testando criação de Purchase Order...\n');
    
    // Login
    const loginResponse = await fetch('http://localhost:5201/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Erro no login');
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso');
    
    // 1. Criar uma solicitação de teste
    console.log('\n1. Criando solicitação de teste...');
    const requestData = {
      requestNumber: `SOL-TEST-${Date.now()}`,
      requesterId: 1,
      companyId: 1,
      costCenterId: 1,
      justification: "Teste de criação de Purchase Order",
      urgency: "Media",
      totalValue: "1000.00",
      currentPhase: "solicitacao"
    };
    
    const createRequestResponse = await fetch('http://localhost:5201/api/purchase-requests', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies 
      },
      body: JSON.stringify(requestData)
    });
    
    if (!createRequestResponse.ok) {
      console.log('❌ Erro ao criar solicitação');
      return;
    }
    
    const request = await createRequestResponse.json();
    console.log(`✅ Solicitação criada: ${request.requestNumber} (ID: ${request.id})`);
    
    // 2. Adicionar itens à solicitação
    console.log('\n2. Adicionando itens à solicitação...');
    const items = [
      {
        description: "Chave Liga/Desliga Bipolar 20a 15cv Ch-10 Margirius",
        requestedQuantity: "15",
        unit: "UN",
        estimatedUnitPrice: "100.00",
        productCode: "ITEM-1336"
      },
      {
        description: "514665 6 ROTOR COMPL 220V (policorte)",
        requestedQuantity: "4", 
        unit: "UN",
        estimatedUnitPrice: "100.00",
        productCode: "ITEM-1336"
      },
      {
        description: "599906 14 ESTATOR COMPL 220V (policorte)",
        requestedQuantity: "4",
        unit: "UN", 
        estimatedUnitPrice: "100.00",
        productCode: "ITEM-1337"
      }
    ];
    
    for (const item of items) {
      const itemData = {
        ...item,
        purchaseRequestId: request.id,
        costCenterId: 1
      };
      
      const createItemResponse = await fetch('http://localhost:5201/api/purchase-request-items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': cookies 
        },
        body: JSON.stringify(itemData)
      });
      
      if (createItemResponse.ok) {
        console.log(`   ✅ Item adicionado: ${item.description}`);
      }
    }
    
    // 3. Aprovar A1
    console.log('\n3. Aprovando A1...');
    const approveA1Response = await fetch(`http://localhost:5201/api/approval-rules/approve-a1/${request.id}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies 
      },
      body: JSON.stringify({
        approverId: 1,
        approved: true
      })
    });
    
    if (approveA1Response.ok) {
      console.log('✅ Aprovação A1 realizada');
    }
    
    // 4. Criar cotação
    console.log('\n4. Criando cotação...');
    const quotationData = {
      quotationNumber: `COT-TEST-${Date.now()}`,
      purchaseRequestId: request.id,
      deliveryLocationId: 1,
      requestedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    const createQuotationResponse = await fetch('http://localhost:5201/api/quotations', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies 
      },
      body: JSON.stringify(quotationData)
    });
    
    if (!createQuotationResponse.ok) {
      console.log('❌ Erro ao criar cotação');
      return;
    }
    
    const quotation = await createQuotationResponse.json();
    console.log(`✅ Cotação criada: ${quotation.quotationNumber} (ID: ${quotation.id})`);
    
    // 5. Adicionar itens à cotação
    console.log('\n5. Adicionando itens à cotação...');
    const requestItems = await fetch(`http://localhost:5201/api/purchase-request-items/request/${request.id}`, {
      headers: { 'Cookie': cookies }
    });
    const requestItemsData = await requestItems.json();
    
    for (const requestItem of requestItemsData) {
      const quotationItemData = {
        quotationId: quotation.id,
        purchaseRequestItemId: requestItem.id,
        description: requestItem.description,
        quantity: requestItem.requestedQuantity,
        unit: requestItem.unit,
        itemCode: requestItem.productCode
      };
      
      const createQuotationItemResponse = await fetch('http://localhost:5201/api/quotation-items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': cookies 
        },
        body: JSON.stringify(quotationItemData)
      });
      
      if (createQuotationItemResponse.ok) {
        console.log(`   ✅ Item da cotação adicionado: ${requestItem.description}`);
      }
    }
    
    console.log(`\n📋 Solicitação de teste criada: ${request.requestNumber}`);
    console.log(`   ID: ${request.id}`);
    console.log(`   Use este ID para testar a aprovação A2 e criação do PO`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testPOCreation();