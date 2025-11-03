const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5201';

async function debugSOL329API() {
  console.log('🔍 Verificando dados da SOL-2025-329 via API...\n');
  
  try {
    // Primeiro fazer login para obter autenticação
    console.log('🔐 Fazendo login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Erro no login:', loginResponse.status, loginResponse.statusText);
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso\n');
    
    // Fazer requisição para a API com autenticação
    const response = await fetch(`${API_BASE}/api/purchase-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    });
    
    if (!response.ok) {
      console.log('❌ Erro na requisição:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    
    // Encontrar a SOL-2025-329
    const sol329 = data.find(req => req.requestNumber === 'SOL-2025-329');
    
    if (!sol329) {
      console.log('❌ SOL-2025-329 não encontrada na resposta da API');
      return;
    }
    
    console.log('📊 Dados da SOL-2025-329 retornados pela API:');
    console.log('   ID:', sol329.id);
    console.log('   Número:', sol329.requestNumber);
    console.log('   currentPhase:', sol329.currentPhase);
    console.log('   approvedA1:', sol329.approvedA1);
    console.log('   approvalDateA1:', sol329.approvalDateA1);
    console.log('   approverA1Id:', sol329.approverA1Id);
    console.log('   updatedAt:', sol329.updatedAt);
    console.log('   createdAt:', sol329.createdAt);
    
    console.log('\n🔍 Objeto completo da SOL-2025-329:');
    console.log(JSON.stringify(sol329, null, 2));
    
    // Verificar também a SOL-2025-330 para comparação
    const sol330 = data.find(req => req.requestNumber === 'SOL-2025-330');
    if (sol330) {
      console.log('\n📊 Para comparação - SOL-2025-330:');
      console.log('   currentPhase:', sol330.currentPhase);
      console.log('   approvedA1:', sol330.approvedA1);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar API:', error);
  }
}

debugSOL329API();