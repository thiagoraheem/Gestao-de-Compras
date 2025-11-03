import { db } from './server/db.ts';
import { purchaseRequests } from './shared/schema.ts';
import { desc, eq } from 'drizzle-orm';

async function checkRequests() {
  console.log('🔍 Verificando solicitações recentes...');
  
  try {
    const requests = await db.select().from(purchaseRequests)
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(10);
    
    console.log('\n📋 Últimas 10 solicitações:');
    requests.forEach(req => {
      console.log(`ID: ${req.id}, Número: ${req.requestNumber}, Fase: ${req.currentPhase}, Criado: ${req.createdAt}`);
    });
    
    // Verificar se há solicitações em estados específicos
    const inApprovalA1 = await db.select().from(purchaseRequests)
      .where(eq(purchaseRequests.currentPhase, 'aprovacao_a1'))
      .limit(5);
      
    const inSolicitation = await db.select().from(purchaseRequests)
      .where(eq(purchaseRequests.currentPhase, 'solicitacao'))
      .limit(5);
    
    console.log('\n🔄 Solicitações em Aprovação A1:');
    inApprovalA1.forEach(req => {
      console.log(`ID: ${req.id}, Número: ${req.requestNumber}, Fase: ${req.currentPhase}`);
    });
    
    console.log('\n📝 Solicitações em Solicitação:');
    inSolicitation.forEach(req => {
      console.log(`ID: ${req.id}, Número: ${req.requestNumber}, Fase: ${req.currentPhase}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error);
  }
  
  process.exit(0);
}

checkRequests();