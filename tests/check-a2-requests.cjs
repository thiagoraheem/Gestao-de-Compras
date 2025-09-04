// Script para verificar solicitações com status A2 via API
const API_BASE = 'http://localhost:5201';
let fetch;

// Inicializar fetch
async function initFetch() {
  if (!fetch) {
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
  }
}

// Função para fazer login
async function login() {
  // Fazendo login como admin...
  
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const cookies = response.headers.get('set-cookie');
  // Login realizado com sucesso
  return cookies;
}

// Função para fazer requisições autenticadas
async function makeRequest(endpoint, cookies) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Cookie': cookies
    }
  });
  
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  
  return await response.json();
}

async function checkA2Requests() {
  try {
    await initFetch();
    console.log('Verificando solicitações com status A2...');
    
    // Fazer login
    const cookies = await login();
    
    // Buscar todas as solicitações
    const allRequests = await makeRequest('/api/purchase-requests', cookies);
    
    // Filtrar por status A2
    const a2Requests = allRequests.filter(r => r.status === 'A2');
    console.log(`Total de solicitações com status A2: ${a2Requests.length}`);
    
    if (a2Requests.length > 0) {
      console.log('Lista de solicitações A2:');
      a2Requests.forEach(r => {
        console.log(`${r.requestNumber} (ID: ${r.id}) - Criada em: ${r.createdAt}`);
      });
    }
    
    // Verificar também solicitações concluídas
    const completedRequests = allRequests.filter(r => r.status === 'concluida');
    console.log(`Total de solicitações concluídas: ${completedRequests.length}`);
    
    if (completedRequests.length > 0) {
      console.log('Primeiras 5 solicitações concluídas:');
      completedRequests.slice(0, 5).forEach(r => {
        console.log(`${r.requestNumber} (ID: ${r.id}) - Criada em: ${r.createdAt}`);
      });
    }
    
    // Verificar se existem purchase orders
    try {
      const purchaseOrders = await makeRequest('/api/purchase-orders', cookies);
      console.log(`Total de Purchase Orders existentes: ${purchaseOrders.length}`);
      
      if (purchaseOrders.length > 0) {
        console.log('Primeiras 3 Purchase Orders:');
        purchaseOrders.slice(0, 3).forEach(po => {
          console.log(`${po.orderNumber} (ID: ${po.id}) - Request ID: ${po.purchaseRequestId}`);
        });
      }
    } catch (error) {
      console.log('Não foi possível buscar Purchase Orders:', error.message);
    }
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkA2Requests();