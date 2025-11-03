const { storage } = require('./server/storage');

async function testDirectAPI() {
  try {
    console.log('🔍 Testando getAllPurchaseRequests diretamente...\n');
    
    const requests = await storage.getAllPurchaseRequests(1);
    
    console.log(`📊 Total de solicitações: ${requests.length}\n`);
    
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
    
  } catch (error) {
    console.error('❌ Erro ao testar API:', error.message);
  }
}

testDirectAPI();