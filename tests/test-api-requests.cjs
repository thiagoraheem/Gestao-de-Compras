const http = require('http');

// Função para fazer requisição HTTP
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Simular uma sessão autenticada (pode precisar ajustar)
        'Cookie': 'connect.sid=s%3A...' // Placeholder - pode precisar de uma sessão real
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          resolve(data); // Retorna como string se não for JSON
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testAPI() {
  try {
    console.log('🔍 Testando API /api/purchase-requests...\n');
    
    // Buscar todas as solicitações
    const requests = await makeRequest('/api/purchase-requests?companyId=1');
    
    if (Array.isArray(requests)) {
      console.log(`📊 Total de solicitações encontradas: ${requests.length}\n`);
      
      // Filtrar as solicitações específicas
      const sol330 = requests.find(r => r.requestNumber === 'SOL-2025-330');
      const sol329 = requests.find(r => r.requestNumber === 'SOL-2025-329');
      
      console.log('🔍 SOL-2025-330:');
      if (sol330) {
        console.log(`   - ID: ${sol330.id}`);
        console.log(`   - Current Phase: ${sol330.currentPhase}`);
        console.log(`   - Approved A1: ${sol330.approvedA1}`);
        console.log(`   - Category: ${sol330.category}`);
        console.log(`   - Urgency: ${sol330.urgency}`);
      } else {
        console.log('   ❌ Não encontrada');
      }
      
      console.log('\n🔍 SOL-2025-329:');
      if (sol329) {
        console.log(`   - ID: ${sol329.id}`);
        console.log(`   - Current Phase: ${sol329.currentPhase}`);
        console.log(`   - Approved A1: ${sol329.approvedA1}`);
        console.log(`   - Category: ${sol329.category}`);
        console.log(`   - Urgency: ${sol329.urgency}`);
      } else {
        console.log('   ❌ Não encontrada');
      }
      
      // Verificar todas as solicitações em aprovacao_a1
      console.log('\n📋 Todas as solicitações em aprovacao_a1:');
      const aprovacaoA1Requests = requests.filter(r => r.currentPhase === 'aprovacao_a1');
      aprovacaoA1Requests.forEach(req => {
        console.log(`   - ${req.requestNumber}: ${req.currentPhase} (${req.category}, ${req.urgency})`);
      });
      
    } else {
      console.log('❌ Resposta da API não é um array:', requests);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
  }
}

testAPI();