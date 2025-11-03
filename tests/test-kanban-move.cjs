const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testKanbanMove() {
  try {
    console.log('🧪 Testando movimentação no Kanban...\n');

    // 1. Verificar estado atual da SOL-2025-329
    console.log('📋 1. Estado atual da SOL-2025-329:');
    const currentResponse = await axios.get(`${BASE_URL}/api/purchase-requests`);
    const currentRequest = currentResponse.data.find(req => req.requestNumber === 'SOL-2025-329');
    
    if (!currentRequest) {
      console.log('❌ SOL-2025-329 não encontrada');
      return;
    }
    
    console.log(`   currentPhase: ${currentRequest.currentPhase}`);
    console.log(`   approvedA1: ${currentRequest.approvedA1}`);
    console.log(`   updatedAt: ${currentRequest.updatedAt}\n`);

    // 2. Simular movimentação de "aprovacao_a1" para "cotacao"
    console.log('🔄 2. Simulando movimentação de "aprovacao_a1" para "cotacao"...');
    
    // Primeiro, vamos garantir que está em aprovacao_a1
    if (currentRequest.currentPhase !== 'aprovacao_a1') {
      console.log('⚠️  Movendo primeiro para aprovacao_a1...');
      await axios.patch(`${BASE_URL}/api/purchase-requests/${currentRequest.id}/update-phase`, {
        newPhase: 'aprovacao_a1'
      });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo
    }

    // Agora mover para cotacao
    const moveResponse = await axios.patch(`${BASE_URL}/api/purchase-requests/${currentRequest.id}/update-phase`, {
      newPhase: 'cotacao'
    });
    
    console.log('✅ Movimentação realizada com sucesso!');
    console.log(`   Nova fase: ${moveResponse.data.currentPhase}`);
    console.log(`   approvedA1: ${moveResponse.data.approvedA1}`);
    console.log(`   updatedAt: ${moveResponse.data.updatedAt}\n`);

    // 3. Aguardar um pouco e verificar se o cache foi invalidado
    console.log('⏳ 3. Aguardando 2 segundos e verificando cache...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const afterResponse = await axios.get(`${BASE_URL}/api/purchase-requests`);
    const afterRequest = afterResponse.data.find(req => req.requestNumber === 'SOL-2025-329');
    
    console.log('📋 Estado após movimentação:');
    console.log(`   currentPhase: ${afterRequest.currentPhase}`);
    console.log(`   approvedA1: ${afterRequest.approvedA1}`);
    console.log(`   updatedAt: ${afterRequest.updatedAt}\n`);

    // 4. Verificar se a mudança persistiu
    if (afterRequest.currentPhase === 'cotacao' && afterRequest.approvedA1 === true) {
      console.log('🎉 SUCESSO! A movimentação funcionou corretamente:');
      console.log('   ✅ Fase atualizada para "cotacao"');
      console.log('   ✅ approvedA1 definido como true');
      console.log('   ✅ Cache invalidado corretamente');
    } else {
      console.log('❌ PROBLEMA! A movimentação não funcionou como esperado:');
      console.log(`   Fase esperada: cotacao, atual: ${afterRequest.currentPhase}`);
      console.log(`   approvedA1 esperado: true, atual: ${afterRequest.approvedA1}`);
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.response?.data || error.message);
  }
}

testKanbanMove();