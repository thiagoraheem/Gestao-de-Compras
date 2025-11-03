const fetch = require('node-fetch');

// Simular as constantes do frontend
const PURCHASE_PHASES = {
  SOLICITACAO: 'solicitacao',
  APROVACAO_A1: 'aprovacao_a1',
  COTACAO: 'cotacao',
  APROVACAO_A2: 'aprovacao_a2',
  PEDIDO_COMPRA: 'pedido_compra',
  RECEBIMENTO: 'recebimento',
  CONCLUSAO_COMPRA: 'conclusao_compra',
  ARQUIVADO: 'arquivado',
};

async function testFrontendGrouping() {
  try {
    console.log('🔍 Testando agrupamento por fase no frontend...\n');

    // 1. Fazer login
    const loginResponse = await fetch('http://localhost:5201/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso');

    // 2. Buscar solicitações
    const response = await fetch('http://localhost:5201/api/purchase-requests', {
      headers: {
        'Cookie': cookies
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const purchaseRequests = await response.json();
    console.log(`📊 Total de solicitações recebidas: ${purchaseRequests.length}\n`);

    // 3. Encontrar as solicitações específicas
    const sol330 = purchaseRequests.find(r => r.requestNumber === 'SOL-2025-330');
    const sol329 = purchaseRequests.find(r => r.requestNumber === 'SOL-2025-329');

    console.log('🔍 Dados das solicitações específicas:');
    if (sol330) {
      console.log(`SOL-2025-330:`, {
        id: sol330.id,
        requestNumber: sol330.requestNumber,
        currentPhase: sol330.currentPhase,
        phaseType: typeof sol330.currentPhase,
        isAprovacaoA1: sol330.currentPhase === 'aprovacao_a1',
        isConstantAprovacaoA1: sol330.currentPhase === PURCHASE_PHASES.APROVACAO_A1
      });
    } else {
      console.log('❌ SOL-2025-330 não encontrada');
    }

    if (sol329) {
      console.log(`SOL-2025-329:`, {
        id: sol329.id,
        requestNumber: sol329.requestNumber,
        currentPhase: sol329.currentPhase,
        phaseType: typeof sol329.currentPhase,
        isAprovacaoA1: sol329.currentPhase === 'aprovacao_a1',
        isConstantAprovacaoA1: sol329.currentPhase === PURCHASE_PHASES.APROVACAO_A1
      });
    } else {
      console.log('❌ SOL-2025-329 não encontrada');
    }

    console.log('\n🔄 Simulando agrupamento por fase (como no kanban-board.tsx):');

    // 4. Simular o agrupamento por fase exatamente como no frontend
    const requestsByPhase = purchaseRequests.reduce((acc, request) => {
      const phase = request.currentPhase || PURCHASE_PHASES.SOLICITACAO;
      
      // Log para as solicitações específicas
      if (request.requestNumber === 'SOL-2025-330' || request.requestNumber === 'SOL-2025-329') {
        console.log(`[AGRUPAMENTO] ${request.requestNumber}: currentPhase="${request.currentPhase}", será agrupado em="${phase}"`);
      }
      
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(request);
      return acc;
    }, {});

    // 5. Mostrar resultado do agrupamento
    console.log('\n📋 Resultado do agrupamento por fase:');
    Object.keys(requestsByPhase).forEach(phase => {
      const requests = requestsByPhase[phase];
      console.log(`${phase}: ${requests.length} solicitações`);
      
      // Mostrar as solicitações específicas se estiverem nesta fase
      const targetRequests = requests.filter(r => r.requestNumber === 'SOL-2025-330' || r.requestNumber === 'SOL-2025-329');
      if (targetRequests.length > 0) {
        console.log(`  └─ Solicitações alvo: ${targetRequests.map(r => r.requestNumber).join(', ')}`);
      }
    });

    // 6. Verificar especificamente a fase aprovacao_a1
    console.log('\n🎯 Verificação específica da fase aprovacao_a1:');
    const aprovacaoA1Requests = requestsByPhase[PURCHASE_PHASES.APROVACAO_A1] || [];
    console.log(`Total em aprovacao_a1: ${aprovacaoA1Requests.length}`);
    
    const targetInAprovacaoA1 = aprovacaoA1Requests.filter(r => 
      r.requestNumber === 'SOL-2025-330' || r.requestNumber === 'SOL-2025-329'
    );
    
    console.log(`Solicitações alvo em aprovacao_a1: ${targetInAprovacaoA1.map(r => r.requestNumber).join(', ')}`);

    // 7. Verificar se há alguma inconsistência
    console.log('\n🔍 Análise de inconsistências:');
    if (sol330 && sol330.currentPhase === 'aprovacao_a1') {
      const isInCorrectPhase = requestsByPhase[PURCHASE_PHASES.APROVACAO_A1]?.some(r => r.id === sol330.id);
      console.log(`SOL-2025-330 está na fase correta no agrupamento: ${isInCorrectPhase ? '✅ SIM' : '❌ NÃO'}`);
    }

    if (sol329 && sol329.currentPhase === 'aprovacao_a1') {
      const isInCorrectPhase = requestsByPhase[PURCHASE_PHASES.APROVACAO_A1]?.some(r => r.id === sol329.id);
      console.log(`SOL-2025-329 está na fase correta no agrupamento: ${isInCorrectPhase ? '✅ SIM' : '❌ NÃO'}`);
    }

  } catch (error) {
    console.error('❌ Erro ao testar agrupamento:', error);
  }
}

testFrontendGrouping();