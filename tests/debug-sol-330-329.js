const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { purchaseRequests } = require('./shared/schema');
const { eq, or } = require('drizzle-orm');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/gestao_compras';
const sql = postgres(connectionString);
const db = drizzle(sql);

async function debugSolicitacoes() {
  try {
    console.log('🔍 Verificando estado das solicitações SOL-2025-330 e SOL-2025-329...\n');
    
    // Buscar as duas solicitações específicas
    const requests = await db
      .select()
      .from(purchaseRequests)
      .where(or(
        eq(purchaseRequests.requestNumber, 'SOL-2025-330'),
        eq(purchaseRequests.requestNumber, 'SOL-2025-329')
      ));
    
    if (requests.length === 0) {
      console.log('❌ Nenhuma solicitação encontrada');
      return;
    }
    
    console.log(`✅ Encontradas ${requests.length} solicitações:\n`);
    
    requests.forEach(request => {
      console.log(`📋 ${request.requestNumber}:`);
      console.log(`   - ID: ${request.id}`);
      console.log(`   - Status: ${request.status}`);
      console.log(`   - Current Phase: ${request.currentPhase}`);
      console.log(`   - Created At: ${request.createdAt}`);
      console.log(`   - Updated At: ${request.updatedAt}`);
      console.log(`   - Requester ID: ${request.requesterId}`);
      console.log(`   - Department ID: ${request.departmentId}`);
      console.log(`   - Category: ${request.category}`);
      console.log(`   - Urgency: ${request.urgency}`);
      console.log('');
    });
    
    // Verificar se há diferenças entre as duas
    if (requests.length === 2) {
      const [req1, req2] = requests;
      console.log('🔄 Comparação entre as solicitações:');
      console.log(`   - Status: ${req1.status} vs ${req2.status}`);
      console.log(`   - Current Phase: ${req1.currentPhase} vs ${req2.currentPhase}`);
      console.log(`   - Ambas deveriam estar em 'aprovacao_a1'`);
      
      if (req1.currentPhase !== req2.currentPhase) {
        console.log('⚠️  INCONSISTÊNCIA DETECTADA: Fases diferentes!');
      }
      
      if (req1.currentPhase !== 'aprovacao_a1' || req2.currentPhase !== 'aprovacao_a1') {
        console.log('⚠️  PROBLEMA: Uma ou ambas não estão na fase aprovacao_a1');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar solicitações:', error);
  } finally {
    await sql.end();
  }
}

debugSolicitacoes();