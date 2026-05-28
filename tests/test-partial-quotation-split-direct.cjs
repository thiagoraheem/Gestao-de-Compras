const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5201';
const API_BASE = `${BASE_URL}/api`;
const LOGIN_DATA = { username: 'admin', password: 'admin123' };

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, options = {}, cookies = '') {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies,
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const setCookieHeader = response.headers.get('set-cookie');
  const responseData = await response.json();
  
  return {
    data: responseData,
    cookies: setCookieHeader || cookies
  };
}

async function runTest() {
  console.log('--- INICIANDO TESTE DE COTAÇÃO PARCIAL E DIVISÃO DE SOLICITAÇÃO ---');
  let cookies = '';
  
  // 1. Login
  const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(LOGIN_DATA)
  });
  cookies = loginResponse.cookies;
  const user = loginResponse.data.data || loginResponse.data;
  console.log('✓ Autenticado como:', user.username);

  // 1.5. Garantir que exista um fornecedor no banco
  const suppliersRes = await makeRequest(`${API_BASE}/suppliers`, {}, cookies);
  const suppliersList = suppliersRes.data.data || suppliersRes.data;
  let testSupplierId;
  
  if (suppliersList && suppliersList.length > 0) {
    testSupplierId = suppliersList[0].id;
    console.log('✓ Usando fornecedor existente:', suppliersList[0].name, '(ID:', testSupplierId, ')');
  } else {
    console.log('Nenhum fornecedor encontrado, criando um fornecedor de teste...');
    const newSupplierRes = await makeRequest(`${API_BASE}/suppliers`, {
      method: 'POST',
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
    }, cookies);
    const newSupplier = newSupplierRes.data.data || newSupplierRes.data;
    testSupplierId = newSupplier.id;
    console.log('✓ Fornecedor criado:', newSupplier.name, '(ID:', testSupplierId, ')');
  }

  // 2. Criar Solicitação com 3 itens
  const testItems = [
    { description: 'Cabo HDMI (Selecionado)', requestedQuantity: 2, unit: 'UN', estimatedUnitPrice: '50.00' },
    { description: 'Mouse USB (Selecionado)', requestedQuantity: 3, unit: 'UN', estimatedUnitPrice: '20.00' },
    { description: 'Teclado USB (Restante - Transferir)', requestedQuantity: 1, unit: 'UN', estimatedUnitPrice: '80.00' }
  ];

  const prRes = await makeRequest(`${API_BASE}/purchase-requests`, {
    method: 'POST',
    body: JSON.stringify({
      requesterId: user.id,
      companyId: 1,
      costCenterId: 1,
      category: 'material',
      urgency: 'medio',
      justification: 'Teste de divisao de cotacao parcial ' + Date.now(),
      idealDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availableBudget: '5000.00',
      items: testItems
    })
  }, cookies);
  const pr = prRes.data.data || prRes.data;
  console.log('✓ Solicitação criada:', pr.requestNumber);

  // Buscar itens criados para obter seus IDs
  const itemsRes = await makeRequest(`${API_BASE}/purchase-requests/${pr.id}/items`, {}, cookies);
  const addedItems = itemsRes.data.data || itemsRes.data;
  console.log('✓ 3 itens adicionados à solicitação');

  // Enviar para aprovação A1 e aprovar A1
  await makeRequest(`${API_BASE}/purchase-requests/${pr.id}/send-to-approval`, { method: 'POST' }, cookies);
  await makeRequest(`${API_BASE}/purchase-requests/${pr.id}/approve-a1`, {
    method: 'POST',
    body: JSON.stringify({ approved: true, rejectionReason: '', approverId: user.id })
  }, cookies);
  console.log('✓ Aprovado A1');

  // 3. Criar Cotação (RFQ)
  const quoteRes = await makeRequest(`${API_BASE}/quotations`, {
    method: 'POST',
    body: JSON.stringify({
      purchaseRequestId: pr.id,
      quotationDeadline: new Date(Date.now() + 86400000).toISOString(),
      deliveryLocationId: 1,
      technicalSpecs: 'Especificações técnicas de teste'
    })
  }, cookies);
  const quote = quoteRes.data.data || quoteRes.data;
  console.log('✓ RFQ Criada:', quote.quotationNumber);

  // Associar os itens à RFQ
  const quotationItemIds = [];
  for (const item of addedItems) {
    const qItemRes = await makeRequest(`${API_BASE}/quotations/${quote.id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        quotationId: quote.id,
        purchaseRequestItemId: item.id,
        itemCode: `ITEM-${item.id}`,
        description: item.description,
        quantity: item.requestedQuantity.toString(),
        unit: item.unit
      })
    }, cookies);
    quotationItemIds.push((qItemRes.data.data || qItemRes.data).id);
  }
  console.log('✓ Itens associados à RFQ');

  // 4. Criar cotação do fornecedor
  const sqCreateRes = await makeRequest(`${API_BASE}/quotations/${quote.id}/send-rfq`, {
    method: 'POST',
    body: JSON.stringify({
      suppliers: [testSupplierId],
      releaseWithoutEmail: true
    })
  }, cookies);
  console.log('✓ Fornecedor associado à cotação');

  // Obter cotação do fornecedor para preencher preços
  const sqsRes = await makeRequest(`${API_BASE}/quotations/${quote.id}/supplier-quotations`, {}, cookies);
  const supplierQuotations = sqsRes.data.data || sqsRes.data;
  const sq = supplierQuotations[0];

  const sqItemsRes = await makeRequest(`${API_BASE}/supplier-quotations/${sq.id}/items`, {}, cookies);
  const sqItems = sqItemsRes.data.data || sqItemsRes.data;

  // Preencher preços dos itens (simular resposta do fornecedor)
  const itemsPrices = [
    { quotationItemId: quotationItemIds[0], unitPrice: '45.00', availableQuantity: '2', isAvailable: true },
    { quotationItemId: quotationItemIds[1], unitPrice: '18.00', availableQuantity: '3', isAvailable: true },
    { quotationItemId: quotationItemIds[2], unitPrice: '75.00', availableQuantity: '1', isAvailable: true }
  ];

  await makeRequest(`${API_BASE}/quotations/${quote.id}/update-supplier-quotation`, {
    method: 'POST',
    body: JSON.stringify({
      supplierId: testSupplierId,
      items: itemsPrices,
      totalValue: '235.00',
      paymentTerms: '30 dias',
      deliveryTerms: '5 dias',
      warrantyPeriod: '12 meses'
    })
  }, cookies);
  console.log('✓ Preços dos itens preenchidos pelo fornecedor');

  // 5. Selecionar fornecedor com SELEÇÃO PARCIAL (Excluir o terceiro item e criar nova solicitação)
  // Item 1 e Item 2 são selecionados. Item 3 é desmarcado.
  const selectedItemsData = [
    { quotationItemId: quotationItemIds[0] },
    { quotationItemId: quotationItemIds[1] }
  ];
  const nonSelectedItemsData = [
    { quotationItemId: quotationItemIds[2] }
  ];

  console.log('Selecionando fornecedor com cotação parcial (Teclado desmarcado)...');
  const selectRes = await makeRequest(`${API_BASE}/quotations/${quote.id}/select-supplier`, {
    method: 'POST',
    body: JSON.stringify({
      selectedSupplierId: testSupplierId,
      totalValue: '144.00', // (45*2) + (18*3) = 90 + 54 = 144
      observations: 'Seleção parcial de teste',
      selectedItems: selectedItemsData,
      nonSelectedItems: nonSelectedItemsData,
      nonSelectedItemsOption: 'separate-quotation',
      unavailableItemsOption: 'none'
    })
  }, cookies);

  const selectData = selectRes.data.data || selectRes.data;
  console.log('Resultado da seleção:', JSON.stringify(selectData));

  // Verificar se criou a nova solicitação
  if (selectData.nonSelectedRequestId) {
    console.log('✓ SUCESSO: Nova solicitação criada:', selectData.nonSelectedRequestId);
  } else {
    throw new Error('FALHA: Nenhuma solicitação criada para os itens restantes!');
  }

  // 6. Verificar a solicitação original na fase A2
  const updatedPrRes = await makeRequest(`${API_BASE}/purchase-requests/${pr.id}`, {}, cookies);
  const updatedPr = updatedPrRes.data.data || updatedPrRes.data;
  console.log('✓ Solicitação original está na fase:', updatedPr.currentPhase);
  console.log('✓ Valor total atualizado da solicitação:', updatedPr.totalValue);

  if (Math.abs(parseFloat(updatedPr.totalValue) - 144.00) > 0.01) {
    throw new Error(`FALHA: Valor total da solicitação original deveria ser 144.00, mas é ${updatedPr.totalValue}`);
  }

  // Verificar itens ativos da solicitação original (deve conter apenas 2 itens)
  const originalItemsRes = await makeRequest(`${API_BASE}/purchase-requests/${pr.id}/items`, {}, cookies);
  const originalItems = originalItemsRes.data.data || originalItemsRes.data;
  console.log(`✓ Itens ativos na solicitação original: ${originalItems.length}`);
  
  if (originalItems.length !== 2) {
    throw new Error(`FALHA: Solicitação original deveria ter 2 itens ativos, mas tem ${originalItems.length}`);
  }
  
  // Verificar se o item transferido foi marcado corretamente como isTransferred
  const allOriginalItemsRes = await makeRequest(`${API_BASE}/purchase-requests/${pr.id}/items?includeTransferred=true`, {}, cookies);
  const allOriginalItems = allOriginalItemsRes.data.data || allOriginalItemsRes.data;
  const transferredItem = allOriginalItems.find(i => i.isTransferred);
  
  if (transferredItem && transferredItem.transferredToRequestId === selectData.nonSelectedRequestId) {
    console.log('✓ SUCESSO: Item restante marcado como transferido para a nova solicitação');
  } else {
    throw new Error('FALHA: Item restante não foi marcado como transferido corretamente!');
  }

  // 7. Simular carregamento de dados do fornecedor selecionado para A2 e validar
  const selectedSupplierRes = await makeRequest(`${API_BASE}/purchase-requests/${pr.id}/selected-supplier`, {}, cookies);
  const selectedSupplierData = selectedSupplierRes.data.data || selectedSupplierRes.data;
  console.log('✓ Snapshot de itens aprovados:', JSON.stringify(selectedSupplierData.approvedItems));
  
  if (selectedSupplierData.approvedItems && selectedSupplierData.approvedItems.length === 2) {
    console.log('✓ SUCESSO: O endpoint retorna exatamente 2 itens aprovados');
  } else {
    throw new Error('FALHA: Snapshot de itens aprovados incorreto!');
  }

  // 8. Aprovar A2 para verificar criação do Pedido de Compra
  console.log('Aprovando A2...');
  await makeRequest(`${API_BASE}/approval-rules/${pr.id}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      approved: true,
      approverId: user.id
    })
  }, cookies);

  // Obter Pedido de Compra gerado e verificar quantidade de itens
  await sleep(1000);
  const poRes = await makeRequest(`${API_BASE}/purchase-orders/by-request/${pr.id}`, {}, cookies);
  const po = poRes.data.data || poRes.data;
  
  if (po) {
    console.log('✓ Pedido de Compra criado:', po.orderNumber);
    console.log('✓ Valor total do Pedido de Compra:', po.totalValue);
    
    // Buscar itens do Pedido de Compra
    const poItemsRes = await fetch(`${API_BASE}/purchase-orders/${po.id}/items`, {
      headers: { 'Cookie': cookies }
    });
    const poItemsJson = await poItemsRes.json();
    const poItems = poItemsJson.data || poItemsJson;
    console.log(`✓ Quantidade de itens no Pedido de Compra: ${poItems.length}`);
    
    if (poItems.length === 2) {
      console.log('✓ SUCESSO: Pedido de compra contém exatamente os 2 itens selecionados');
    } else {
      throw new Error(`FALHA: Pedido de compra deveria ter 2 itens, mas tem ${poItems.length}`);
    }
  } else {
    throw new Error('FALHA: Pedido de compra não foi gerado automaticamente!');
  }

  // 9. Verificar a nova solicitação na fase de cotação
  const newPrRes = await makeRequest(`${API_BASE}/purchase-requests/${selectData.nonSelectedRequestId}`, {}, cookies);
  const newPr = newPrRes.data.data || newPrRes.data;
  console.log('✓ Nova solicitação fase:', newPr.currentPhase);
  
  if (newPr.currentPhase !== 'cotacao') {
    throw new Error(`FALHA: Nova solicitação deveria estar na fase 'cotacao', mas está em '${newPr.currentPhase}'`);
  }

  // Verificar Rastreabilidade
  console.log('✓ Título/Justificativa da nova solicitação:', newPr.justification);
  console.log('✓ Descrição/Informações adicionais da nova solicitação:', newPr.additionalInfo);
  if (!newPr.justification.includes(pr.requestNumber)) {
    throw new Error(`FALHA: Justificativa da nova solicitação não contém o número da original (${pr.requestNumber})`);
  }
  if (!newPr.additionalInfo.includes(pr.requestNumber)) {
    throw new Error(`FALHA: Informações adicionais da nova solicitação não contêm o número da original (${pr.requestNumber})`);
  }
  console.log('✓ SUCESSO: Rastreabilidade validada (número da solicitação original presente no título e na descrição)');

  const newPrItemsRes = await makeRequest(`${API_BASE}/purchase-requests/${selectData.nonSelectedRequestId}/items`, {}, cookies);
  const newPrItems = newPrItemsRes.data.data || newPrItemsRes.data;
  console.log(`✓ Itens na nova solicitação: ${newPrItems.length}`);
  
  if (newPrItems.length === 1 && newPrItems[0].description.includes('Teclado')) {
    console.log('✓ SUCESSO: Nova solicitação contém exatamente o item restante (Teclado)');
  } else {
    throw new Error('FALHA: Nova solicitação não contém os itens corretos!');
  }

  // 10. Verificar se a RFQ correspondente foi gerada automaticamente e está correta
  console.log('Verificando RFQ gerada para a nova solicitação...');
  const newQuotationRes = await makeRequest(`${API_BASE}/quotations/purchase-request/${selectData.nonSelectedRequestId}`, {}, cookies);
  const newQuotation = newQuotationRes.data.data || newQuotationRes.data;

  if (!newQuotation) {
    throw new Error('FALHA: RFQ não foi criada automaticamente para a nova solicitação!');
  }

  console.log('✓ RFQ Criada Automaticamente:', newQuotation.quotationNumber, 'status:', newQuotation.status);
  if (newQuotation.status !== 'draft') {
    throw new Error(`FALHA: Nova RFQ deveria estar com status 'draft', mas está com '${newQuotation.status}'`);
  }

  // Verificar itens da nova RFQ
  const newQuotationItemsRes = await makeRequest(`${API_BASE}/quotations/${newQuotation.id}/items`, {}, cookies);
  const newQuotationItems = newQuotationItemsRes.data.data || newQuotationItemsRes.data;
  console.log(`✓ Itens na nova RFQ: ${newQuotationItems.length}`);

  if (newQuotationItems.length !== 1 || !newQuotationItems[0].description.includes('Teclado')) {
    throw new Error('FALHA: Itens da nova RFQ estão incorretos!');
  }
  console.log('✓ SUCESSO: Itens da nova RFQ correspondem ao item restante');

  console.log('--- TESTE CONCLUÍDO COM SUCESSO ---');
}

runTest().catch(err => {
  console.error('💥 ERRO NO TESTE:', err);
  process.exit(1);
});
