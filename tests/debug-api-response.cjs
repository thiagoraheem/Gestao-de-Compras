const axios = require('axios');

async function debugApiResponse() {
  try {
    console.log('🔍 Testando API /api/purchase-requests...');
    
    // Fazer login primeiro
    const loginResponse = await axios.post('http://localhost:5201/api/auth/login', {
      email: 'admin@locador.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');
    
    // Buscar dados das purchase requests
    const response = await axios.get('http://localhost:5201/api/purchase-requests', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`📊 Total de solicitações encontradas: ${response.data.length}`);
    
    // Procurar especificamente pela SOL-2025-329
    const sol329 = response.data.find(req => req.requestNumber === 'SOL-2025-329');
    const sol330 = response.data.find(req => req.requestNumber === 'SOL-2025-330');
    
    if (sol329) {
      console.log('\n🎯 SOL-2025-329 encontrada na API:');
      console.log('ID:', sol329.id);
      console.log('Request Number:', sol329.requestNumber);
      console.log('Current Phase:', sol329.currentPhase);
      console.log('Approved A1:', sol329.approvedA1);
      console.log('Approver A1 ID:', sol329.approverA1Id);
      console.log('Updated At:', sol329.updatedAt);
      console.log('Full object:', JSON.stringify(sol329, null, 2));
    } else {
      console.log('❌ SOL-2025-329 não encontrada na API');
    }
    
    if (sol330) {
      console.log('\n🎯 SOL-2025-330 encontrada na API (para comparação):');
      console.log('ID:', sol330.id);
      console.log('Request Number:', sol330.requestNumber);
      console.log('Current Phase:', sol330.currentPhase);
      console.log('Approved A1:', sol330.approvedA1);
      console.log('Approver A1 ID:', sol330.approverA1Id);
      console.log('Updated At:', sol330.updatedAt);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

debugApiResponse();