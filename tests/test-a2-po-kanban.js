const API = process.env.BASE_API_URL || 'http://localhost:5201/api';

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

async function run() {
  console.log('Iniciando teste de Aprovação A2 → Pedido de Compra e retorno no Kanban...');

  // 1. Criar solicitação
  const pr = await req('/purchase-requests', {
    method: 'POST',
    body: {
      requesterId: 1,
      costCenterId: 1,
      category: 'servico',
      justification: 'Teste fluxo A2/PO',
      items: [
        { description: 'Item A', unit: 'UN', requestedQuantity: '2' },
        { description: 'Item B', unit: 'UN', requestedQuantity: '1' },
      ],
    },
  });
  console.log('Solicitação criada:', pr.requestNumber);

  // 2. Avançar para cotação
  await req(`/purchase-requests/${pr.id}/update-phase`, { method: 'PATCH', body: { newPhase: 'cotacao' } });

  // 3. Criar cotação e propostas
  const quotation = await req('/quotations', { method: 'POST', body: { purchaseRequestId: pr.id } });
  const qi = await req(`/quotations/${quotation.id}/items`, { method: 'POST', body: {
    items: [
      { description: 'Item A', unit: 'UN', quantity: '2', purchaseRequestItemId: pr.items?.[0]?.id },
      { description: 'Consolidado', unit: 'UN', quantity: '3' }
    ]
  }});

  const supplierQuotation = await req(`/quotations/${quotation.id}/supplier-quotations`, { method: 'POST', body: {
    supplierId: 1,
    isChosen: true,
    totalValue: '100',
    paymentTerms: '30/60 dias',
    discountType: 'none'
  }});

  await req(`/supplier-quotations/${supplierQuotation.id}/items/bulk`, { method: 'POST', body: {
    items: [
      { quotationItemId: qi.items?.[1]?.id, description: 'Consolidado', confirmedUnit: 'UN', availableQuantity: '3', unitPrice: '10', discountPercentage: 0 },
    ]
  }});

  // 4. Aprovar A2
  const a2 = await req(`/approval-rules/${pr.id}/approve`, { method: 'POST', body: { approved: true, approverId: 1 } });
  console.log('A2 aprovado, fase:', a2.currentPhase);

  // 5. Validar PO
  const po = await req(`/purchase-requests/${pr.id}/purchase-order`);
  const items = await req(`/purchase-orders/${po.id}/items`);
  if (items.length !== 1 || items[0].quantity !== '3') throw new Error('Itens do PO não refletem a cotação vencedora');
  console.log('PO criado com itens corretos');

  // 6. Mover de Pedido de Compra para Aprovação A2
  const back = await req(`/purchase-requests/${pr.id}/update-phase`, { method: 'PATCH', body: { newPhase: 'aprovacao_a2' } });
  console.log('Movido para A2, fase:', back.currentPhase);

  // 7. Validar que PO foi removido
  let poExists = true;
  try { await req(`/purchase-requests/${pr.id}/purchase-order`); } catch { poExists = false; }
  if (poExists) throw new Error('PO deveria ter sido removido ao mover para A2');
  console.log('PO removido com sucesso ao retornar para A2');

  // 8. Aprovar A2 novamente e validar novo PO
  await req(`/approval-rules/${pr.id}/approve`, { method: 'POST', body: { approved: true, approverId: 1 } });
  const po2 = await req(`/purchase-requests/${pr.id}/purchase-order`);
  const items2 = await req(`/purchase-orders/${po2.id}/items`);
  if (items2.length !== 1 || items2[0].quantity !== '3') throw new Error('Novo PO não reflete a cotação vencedora');
  console.log('Novo PO criado corretamente após reaprovação A2');
}

run().catch(err => {
  console.error('Falha no teste:', err.message);
  process.exit(1);
});
