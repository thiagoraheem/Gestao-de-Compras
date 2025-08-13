// Script para migrar dados históricos para as tabelas purchase_orders e purchase_order_items
// Este script identifica solicitações aprovadas A2 que não possuem pedidos de compra
// e cria os registros necessários baseado nos dados existentes

const API_BASE = 'http://localhost:5201';
let fetch;

// Importar fetch dinamicamente
async function initFetch() {
  if (!fetch) {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
  }
}

// Configuração de autenticação
let sessionCookie = '';

// Função para fazer requisições autenticadas
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (options.method !== 'HEAD' && response.headers.get('content-type')?.includes('application/json')) {
    return response.json();
  }
  return response;
}

// Função para fazer login
async function login() {
  console.log('🔐 Fazendo login como admin...');
  
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123'
    })
  });

  if (response.ok) {
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      sessionCookie = cookies.split(';')[0];
    }
    console.log('✅ Login realizado com sucesso');
    return true;
  } else {
    console.error('❌ Erro no login');
    return false;
  }
}

// Função para buscar solicitações aprovadas A2 sem pedidos de compra
async function findRequestsWithoutPurchaseOrders() {
  console.log('🔍 Buscando solicitações aprovadas A2 sem pedidos de compra...');
  
  try {
    // Buscar todas as solicitações (incluindo companyId=1)
    const allRequests = await makeRequest('/api/purchase-requests?companyId=1');
    
    const requestsNeedingPO = [];
    
    for (const request of allRequests) {
      // Verificar se tem aprovação A2 (verificar tanto o campo direto quanto o histórico)
      const hasA2Approval = request.approvedA2 === true;
      
      if (hasA2Approval) {
        console.log(`🔍 Verificando solicitação ${request.requestNumber} (ID: ${request.id}) - Aprovada A2: ${request.approvedA2}`);
        // Verificar se já tem purchase order
        try {
          const purchaseOrders = await makeRequest(`/api/purchase-orders/by-request/${request.id}`);
          console.log(`   📦 Purchase Orders para ${request.requestNumber}:`, purchaseOrders);
          
          // Verificar se realmente tem purchase order (não é uma mensagem de erro)
          const hasPurchaseOrder = purchaseOrders && !purchaseOrders.message && purchaseOrders.id;
          
          if (!hasPurchaseOrder) {
            requestsNeedingPO.push(request);
            console.log(`   ✅ Adicionada à lista: ${request.requestNumber} (ID: ${request.id})`);
          } else {
            console.log(`   ⚠️ Já tem PO: ${request.requestNumber}`);
          }
        } catch (error) {
          console.log(`   ❌ Erro ao verificar PO para ${request.requestNumber}:`, error.message);
          // Se der erro 404, significa que não tem purchase order
          if (error.message?.includes('404')) {
            requestsNeedingPO.push(request);
            console.log(`   ✅ Adicionada à lista (404): ${request.requestNumber} (ID: ${request.id})`);
          }
        }
      }
    }
    
    console.log(`\n📊 Total de solicitações que precisam de PO: ${requestsNeedingPO.length}`);
    return requestsNeedingPO;
    
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações:', error);
    return [];
  }
}

// Função para criar purchase order para uma solicitação
async function createPurchaseOrderForRequest(request) {
  console.log(`\n🔄 Processando ${request.requestNumber}...`);
  
  try {
    // Buscar cotação da solicitação
    const quotation = await makeRequest(`/api/quotations/purchase-request/${request.id}`);
    if (!quotation) {
      console.log(`⚠️ Nenhuma cotação encontrada para ${request.requestNumber}`);
      return false;
    }
    
    // Buscar cotações de fornecedores
    const supplierQuotations = await makeRequest(`/api/quotations/${quotation.id}/supplier-quotations`);
    const chosenQuotation = supplierQuotations.find(sq => sq.isChosen === true);
    
    if (!chosenQuotation) {
      console.log(`⚠️ Nenhum fornecedor escolhido para ${request.requestNumber}`);
      return false;
    }
    
    // Buscar itens da cotação do fornecedor escolhido
    const supplierQuotationItems = await makeRequest(`/api/supplier-quotations/${chosenQuotation.id}/items`);
    if (!supplierQuotationItems || supplierQuotationItems.length === 0) {
      console.log(`⚠️ Nenhum item encontrado na cotação do fornecedor para ${request.requestNumber}`);
      return false;
    }
    
    // Buscar aprovação A2 para obter o aprovador
    const approvalHistory = await makeRequest(`/api/purchase-requests/${request.id}/approval-history`);
    const a2Approval = approvalHistory.find(h => h.approverType === 'A2' && h.approved === true);
    
    if (!a2Approval) {
      console.log(`⚠️ Aprovação A2 não encontrada para ${request.requestNumber}`);
      return false;
    }
    
    if (!a2Approval.approver?.id) {
      console.log(`⚠️ ApproverId não encontrado na aprovação A2 para ${request.requestNumber}`);
      return false;
    }
    
    // Gerar número do pedido baseado no ID da solicitação
    const orderNumber = `PO-${new Date().getFullYear()}-${String(request.id).padStart(3, '0')}`;
    
    // Dados do purchase order
    const purchaseOrderData = {
      orderNumber,
      purchaseRequestId: request.id,
      supplierId: chosenQuotation.supplierId,
      quotationId: quotation.id,
      status: 'confirmed',
      totalValue: chosenQuotation.totalValue || '0',
      paymentTerms: chosenQuotation.paymentTerms,
      deliveryTerms: chosenQuotation.deliveryTerms,
      deliveryAddress: null,
      contactPerson: null,
      contactPhone: null,
      observations: chosenQuotation.observations,
      approvedBy: a2Approval.approver.id,
      approvedAt: new Date(a2Approval.createdAt),
      createdBy: a2Approval.approver.id,
    };
    
    console.log(`📦 Criando PO: ${orderNumber}`);
    
    // Criar purchase order
    const purchaseOrder = await makeRequest('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(purchaseOrderData)
    });
    
    console.log(`✅ PO criado com ID: ${purchaseOrder?.id || 'UNDEFINED'}`);
    
    // Criar itens do purchase order
    let itemsCreated = 0;
    for (const item of supplierQuotationItems) {
      const itemData = {
        purchaseOrderId: purchaseOrder.id,
        itemCode: item.itemCode || `ITEM-${item.id}`,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        costCenterId: request.costCenterId,
        specifications: item.specifications
      };
      
      await makeRequest('/api/purchase-order-items', {
        method: 'POST',
        body: JSON.stringify(itemData)
      });
      
      itemsCreated++;
    }
    
    console.log(`✅ ${itemsCreated} itens criados para o PO`);
    console.log(`💰 Valor total: R$ ${parseFloat(chosenQuotation.totalValue || 0).toFixed(2)}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${request.requestNumber}:`, error);
    return false;
  }
}

// Função principal
async function runMigration() {
  console.log('🚀 Iniciando migração de Purchase Orders...');
  console.log('=' .repeat(60));
  
  // Inicializar fetch
  await initFetch();
  
  // Fazer login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('❌ Falha no login. Encerrando migração.');
    return;
  }
  
  // Buscar solicitações que precisam de PO
  const requestsNeedingPO = await findRequestsWithoutPurchaseOrders();
  
  if (requestsNeedingPO.length === 0) {
    console.log('\n✅ Nenhuma solicitação encontrada que precise de Purchase Order.');
    console.log('🎉 Migração concluída!');
    return;
  }
  
  console.log('\n🔄 Iniciando criação dos Purchase Orders...');
  console.log('=' .repeat(60));
  
  let successCount = 0;
  let errorCount = 0;
  
  // Processar cada solicitação
  for (const request of requestsNeedingPO) {
    const success = await createPurchaseOrderForRequest(request);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Pequena pausa entre processamentos
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMO DA MIGRAÇÃO:');
  console.log(`✅ Purchase Orders criados com sucesso: ${successCount}`);
  console.log(`❌ Erros encontrados: ${errorCount}`);
  console.log(`📋 Total processado: ${requestsNeedingPO.length}`);
  
  if (successCount > 0) {
    console.log('\n🎉 Migração concluída com sucesso!');
    console.log('💡 Os Purchase Orders foram criados com status "confirmed"');
    console.log('💡 Verifique o sistema para confirmar os dados migrados');
  } else {
    console.log('\n⚠️ Nenhum Purchase Order foi criado.');
    console.log('💡 Verifique os logs acima para identificar possíveis problemas');
  }
}

// Executar migração
if (require.main === module) {
  runMigration().catch(error => {
    console.error('❌ Erro fatal na migração:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };