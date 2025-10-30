const fetch = require('node-fetch');

async function checkSOL2025321() {
  try {
    console.log('🔍 Verificando SOL-2025-321 via API...\n');
    
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
    
    // Buscar todas as solicitações
    const requestsResponse = await fetch('http://localhost:5201/api/purchase-requests?companyId=1', {
      headers: { 'Cookie': cookies }
    });
    
    const requests = await requestsResponse.json();
    const sol321 = requests.find(r => r.requestNumber === 'SOL-2025-321');
    
    if (!sol321) {
      console.log('❌ SOL-2025-321 não encontrada');
      return;
    }
    
    console.log('✅ SOL-2025-321 encontrada:');
    console.log('   ID:', sol321.id);
    console.log('   Fase atual:', sol321.currentPhase);
    console.log('   Aprovado A2:', sol321.approvedA2);
    
    // Buscar cotação
    const quotationResponse = await fetch(`http://localhost:5201/api/quotations/purchase-request/${sol321.id}`, {
      headers: { 'Cookie': cookies }
    });
    
    if (!quotationResponse.ok) {
      console.log('❌ Cotação não encontrada');
      return;
    }
    
    const quotation = await quotationResponse.json();
    console.log('\n📋 Cotação encontrada:', quotation.quotationNumber);
    
    // Buscar cotações de fornecedores
    const supplierQuotationsResponse = await fetch(`http://localhost:5201/api/quotations/${quotation.id}/supplier-quotations`, {
      headers: { 'Cookie': cookies }
    });
    
    const supplierQuotations = await supplierQuotationsResponse.json();
    const chosenSupplier = supplierQuotations.find(sq => sq.isChosen);
    
    if (chosenSupplier) {
      console.log('✅ Fornecedor escolhido:', chosenSupplier.supplier.name);
      
      // Buscar itens da cotação do fornecedor
      const supplierItemsResponse = await fetch(`http://localhost:5201/api/supplier-quotations/${chosenSupplier.id}/items`, {
        headers: { 'Cookie': cookies }
      });
      
      const supplierItems = await supplierItemsResponse.json();
      console.log('\n📦 Itens da cotação do fornecedor:');
      supplierItems.forEach((item, index) => {
        console.log(`   Item ${index + 1}:`);
        console.log(`     Quantidade disponível: ${item.availableQuantity || 'N/A'}`);
        console.log(`     Unidade confirmada: ${item.confirmedUnit || 'N/A'}`);
        console.log(`     Preço unitário: R$ ${item.unitPrice || 'N/A'}`);
        console.log(`     Disponível: ${item.isAvailable ? 'Sim' : 'Não'}`);
      });
    }
    
    // Buscar Purchase Order
    const poResponse = await fetch(`http://localhost:5201/api/purchase-orders/by-request/${sol321.id}`, {
      headers: { 'Cookie': cookies }
    });
    
    if (!poResponse.ok) {
      console.log('\n❌ Purchase Order não encontrado');
      return;
    }
    
    const po = await poResponse.json();
    console.log('\n✅ Purchase Order encontrado:', po.orderNumber);
    
    // Buscar itens do Purchase Order
    const poItemsResponse = await fetch(`http://localhost:5201/api/purchase-orders/${po.id}/items`, {
      headers: { 'Cookie': cookies }
    });
    
    const poItems = await poItemsResponse.json();
    console.log('\n📋 Itens do Purchase Order:');
    poItems.forEach((item, index) => {
      console.log(`   Item ${index + 1}:`);
      console.log(`     Descrição: ${item.description}`);
      console.log(`     Quantidade: ${item.quantity}`);
      console.log(`     Unidade: ${item.unit}`);
      console.log(`     Preço Unitário: R$ ${item.unitPrice}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkSOL2025321();