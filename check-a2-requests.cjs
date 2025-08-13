// Script para verificar solicitações A2 aprovadas e purchase orders
let fetch;

const API_BASE = 'http://localhost:5201';

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
    // Extrair cookie de sessão
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      sessionCookie = setCookieHeader.split(';')[0];
    }
    console.log('✅ Login realizado com sucesso!');
    return true;
  } else {
    console.log('❌ Falha no login:', await response.text());
    return false;
  }
}

async function checkA2Requests() {
  try {
    // Inicializar fetch
    await initFetch();
    
    // Fazer login
    const loginSuccess = await login();
    if (!loginSuccess) {
      return;
    }

    // Verificar purchase requests existentes (incluindo companyId=1)
    console.log('\n🔍 Verificando purchase requests existentes...');
    const purchaseRequestsResponse = await makeRequest('/api/purchase-requests?companyId=1');
    
    if (Array.isArray(purchaseRequestsResponse)) {
      const a2StatusRequests = purchaseRequestsResponse.filter(req => req.currentPhase === 'aprovacao_a2');
      const completedRequests = purchaseRequestsResponse.filter(req => req.currentPhase === 'conclusao_compra');
      const a2ApprovedRequests = purchaseRequestsResponse.filter(req => req.approvedA2 === true);
      
      console.log(`📊 Total de solicitações: ${purchaseRequestsResponse.length}`);
      console.log(`📊 Solicitações com status A2: ${a2StatusRequests.length}`);
      console.log(`✅ Solicitações concluídas: ${completedRequests.length}`);
      console.log(`✅ Solicitações aprovadas A2: ${a2ApprovedRequests.length}`);
      
      if (a2ApprovedRequests.length > 0) {
        console.log('\n📋 Lista de solicitações aprovadas A2:');
        a2ApprovedRequests.forEach(req => {
          console.log(`- ID: ${req.id}, Número: ${req.requestNumber}, Fase: ${req.currentPhase}, Aprovação A2: ${req.approvalDateA2}`);
        });
        
        // Verificar quais têm purchase orders
        console.log('\n🔍 Verificando purchase orders para solicitações A2 aprovadas...');
        for (const req of a2ApprovedRequests) {
          try {
            const poResponse = await makeRequest(`/api/purchase-orders/by-request/${req.id}`);
            if (poResponse && poResponse.id) {
              console.log(`✅ Solicitação ${req.requestNumber} (ID: ${req.id}) TEM purchase order (PO ID: ${poResponse.id})`);
            } else {
              console.log(`❌ Solicitação ${req.requestNumber} (ID: ${req.id}) NÃO TEM purchase order`);
            }
          } catch (error) {
            console.log(`❌ Erro ao verificar PO para solicitação ${req.requestNumber}: ${error.message}`);
          }
        }
      }
    } else {
      console.log('❌ Erro ao buscar purchase requests:', purchaseRequestsResponse);
    }

    // Verificar purchase orders existentes
    console.log('\n📦 Verificando purchase orders existentes...');
    try {
      const purchaseOrdersResponse = await makeRequest('/api/purchase-orders');
      if (Array.isArray(purchaseOrdersResponse)) {
        console.log(`📦 Total de purchase orders: ${purchaseOrdersResponse.length}`);
        if (purchaseOrdersResponse.length > 0) {
          console.log('\n📋 Lista de purchase orders:');
          purchaseOrdersResponse.forEach(po => {
            console.log(`- PO ID: ${po.id}, Request ID: ${po.purchaseRequestId}, Número: ${po.orderNumber}`);
          });
        }
      } else {
        console.log('❌ Erro ao buscar purchase orders:', purchaseOrdersResponse);
      }
    } catch (error) {
      console.log('❌ Erro ao buscar purchase orders:', error.message);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkA2Requests();