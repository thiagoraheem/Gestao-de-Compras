const { Client } = require('pg');

async function debugSolicitacoes() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');
    
    console.log('🔍 Verificando estado das solicitações SOL-2025-330 e SOL-2025-329...\n');
    
    // Buscar as duas solicitações específicas
    const result = await client.query(`
      SELECT 
        id,
        request_number,
        status,
        current_phase,
        created_at,
        updated_at,
        requester_id,
        department_id,
        category,
        urgency
      FROM purchase_requests 
      WHERE request_number IN ('SOL-2025-330', 'SOL-2025-329')
      ORDER BY request_number;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Nenhuma solicitação encontrada');
      return;
    }
    
    console.log(`✅ Encontradas ${result.rows.length} solicitações:\n`);
    
    result.rows.forEach(request => {
      console.log(`📋 ${request.request_number}:`);
      console.log(`   - ID: ${request.id}`);
      console.log(`   - Status: ${request.status}`);
      console.log(`   - Current Phase: ${request.current_phase}`);
      console.log(`   - Created At: ${request.created_at}`);
      console.log(`   - Updated At: ${request.updated_at}`);
      console.log(`   - Requester ID: ${request.requester_id}`);
      console.log(`   - Department ID: ${request.department_id}`);
      console.log(`   - Category: ${request.category}`);
      console.log(`   - Urgency: ${request.urgency}`);
      console.log('');
    });
    
    // Verificar se há diferenças entre as duas
    if (result.rows.length === 2) {
      const [req1, req2] = result.rows;
      console.log('🔄 Comparação entre as solicitações:');
      console.log(`   - Status: ${req1.status} vs ${req2.status}`);
      console.log(`   - Current Phase: ${req1.current_phase} vs ${req2.current_phase}`);
      console.log(`   - Ambas deveriam estar em 'aprovacao_a1'`);
      
      if (req1.current_phase !== req2.current_phase) {
        console.log('⚠️  INCONSISTÊNCIA DETECTADA: Fases diferentes!');
        console.log(`   - SOL-2025-330: ${req1.current_phase}`);
        console.log(`   - SOL-2025-329: ${req2.current_phase}`);
      }
      
      if (req1.current_phase !== 'aprovacao_a1' || req2.current_phase !== 'aprovacao_a1') {
        console.log('⚠️  PROBLEMA: Uma ou ambas não estão na fase aprovacao_a1');
        
        // Corrigir se necessário
        if (req1.current_phase !== 'aprovacao_a1') {
          console.log(`🔧 Corrigindo SOL-2025-330 para aprovacao_a1...`);
          await client.query(`
            UPDATE purchase_requests 
            SET current_phase = 'aprovacao_a1', updated_at = NOW()
            WHERE id = $1
          `, [req1.id]);
          console.log('✅ SOL-2025-330 corrigida');
        }
        
        if (req2.current_phase !== 'aprovacao_a1') {
          console.log(`🔧 Corrigindo SOL-2025-329 para aprovacao_a1...`);
          await client.query(`
            UPDATE purchase_requests 
            SET current_phase = 'aprovacao_a1', updated_at = NOW()
            WHERE id = $2
          `, [req2.id]);
          console.log('✅ SOL-2025-329 corrigida');
        }
      } else {
        console.log('✅ Ambas estão na fase correta no banco de dados');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar solicitações:', error);
  } finally {
    await client.end();
  }
}

debugSolicitacoes();