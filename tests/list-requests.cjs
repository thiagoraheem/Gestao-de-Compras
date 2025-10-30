const fetch = require('node-fetch');

async function listRequests() {
  try {
    console.log('🔍 Listando todas as solicitações...\n');
    
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
    console.log(`\n📋 Total de solicitações encontradas: ${requests.length}\n`);
    
    requests.forEach((request, index) => {
      console.log(`${index + 1}. ${request.requestNumber}`);
      console.log(`   ID: ${request.id}`);
      console.log(`   Fase: ${request.currentPhase}`);
      console.log(`   Aprovado A2: ${request.approvedA2}`);
      console.log(`   Valor: R$ ${request.totalValue || 'N/A'}`);
      console.log('');
    });
    
    // Buscar solicitações com Purchase Orders
    console.log('\n🔍 Verificando quais têm Purchase Orders...\n');
    
    for (const request of requests) {
      try {
        const poResponse = await fetch(`http://localhost:5201/api/purchase-orders/by-request/${request.id}`, {
          headers: { 'Cookie': cookies }
        });
        
        if (poResponse.ok) {
          const po = await poResponse.json();
          console.log(`✅ ${request.requestNumber} tem PO: ${po.orderNumber}`);
          
          // Buscar itens do PO
          const poItemsResponse = await fetch(`http://localhost:5201/api/purchase-orders/${po.id}/items`, {
            headers: { 'Cookie': cookies }
          });
          
          if (poItemsResponse.ok) {
            const poItems = await poItemsResponse.json();
            console.log(`   Itens do PO (${poItems.length}):`);
            poItems.forEach((item, idx) => {
              console.log(`     ${idx + 1}. ${item.description} - Qtd: ${item.quantity} ${item.unit}`);
            });
          }
          console.log('');
        }
      } catch (error) {
        // Ignorar erros de PO não encontrado
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

listRequests();