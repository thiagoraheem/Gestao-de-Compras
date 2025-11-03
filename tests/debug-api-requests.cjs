// Script para testar diretamente a API /api/purchase-requests
const fetch = require('node-fetch');
const API_BASE = 'http://localhost:5201';

async function testAPI() {
  try {
    console.log('🔍 Testando API /api/purchase-requests...\n');
    
    // Fazer login primeiro
    console.log('🔐 Fazendo login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Erro no login:', loginResponse.status, loginResponse.statusText);
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso\n');
    
    // Testar a API com autenticação
    const response = await fetch(`${API_BASE}/api/purchase-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    });
    
    if (!response.ok) {
      console.error('❌ Erro na API:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Resposta:', errorText);
      return;
    }
    
    const requests = await response.json();
    console.log(`📊 Total de solicitações retornadas: ${requests.length}\n`);
    
    // Procurar pelas solicitações específicas
    const sol330 = requests.find(r => r.requestNumber === 'SOL-2025-330');
    const sol329 = requests.find(r => r.requestNumber === 'SOL-2025-329');
    
    console.log('🔍 Verificando SOL-2025-330:');
    if (sol330) {
      console.log('✅ SOL-2025-330 ENCONTRADA na API!');
      console.log('   - ID:', sol330.id);
      console.log('   - Fase atual:', sol330.currentPhase);
      console.log('   - Categoria:', sol330.category);
      console.log('   - Urgência:', sol330.urgency);
      console.log('   - Solicitante ID:', sol330.requesterId);
      console.log('   - Centro de custo ID:', sol330.costCenterId);
    } else {
      console.log('❌ SOL-2025-330 NÃO ENCONTRADA na API!');
    }
    
    console.log('\n🔍 Verificando SOL-2025-329:');
    if (sol329) {
      console.log('✅ SOL-2025-329 ENCONTRADA na API!');
      console.log('   - ID:', sol329.id);
      console.log('   - Fase atual:', sol329.currentPhase);
      console.log('   - Categoria:', sol329.category);
      console.log('   - Urgência:', sol329.urgency);
      console.log('   - Solicitante ID:', sol329.requesterId);
      console.log('   - Centro de custo ID:', sol329.costCenterId);
    } else {
      console.log('❌ SOL-2025-329 NÃO ENCONTRADA na API!');
    }
    
    // Mostrar todas as solicitações que começam com SOL-2025
    console.log('\n📋 Todas as solicitações SOL-2025 na API:');
    const sol2025Requests = requests.filter(r => r.requestNumber && r.requestNumber.startsWith('SOL-2025'));
    sol2025Requests.forEach(req => {
      console.log(`   - ${req.requestNumber}: Fase=${req.currentPhase}, ID=${req.id}`);
    });
    
    if (sol2025Requests.length === 0) {
      console.log('   Nenhuma solicitação SOL-2025 encontrada na API');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
  }
}

testAPI();