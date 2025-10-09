const { db } = require('./server/db.ts');
const { purchaseRequests, approvalHistory, users } = require('./shared/schema.ts');
const { eq, desc } = require('drizzle-orm');

async function debugApprovalIssue() {
  try {
    console.log('🔍 Investigando problema de aprovação A2...\n');

    // Buscar solicitações em fase de aprovação A2
    const a2Requests = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.currentPhase, 'aprovacao_a2'))
      .orderBy(desc(purchaseRequests.createdAt));

    console.log(`📋 Encontradas ${a2Requests.length} solicitações em Aprovação A2:\n`);

    for (const request of a2Requests) {
      console.log(`🔸 Solicitação ID: ${request.id} | Número: ${request.requestNumber}`);
      console.log(`   Valor Total: R$ ${request.totalValue}`);
      console.log(`   Fase Atual: ${request.currentPhase}`);
      console.log(`   Aprovado A2: ${request.approvedA2}`);
      console.log(`   Aprovador A2 ID: ${request.approverA2Id}`);
      console.log(`   Data Aprovação A2: ${request.approvalDateA2}`);
      console.log(`   Primeiro Aprovador A2 ID: ${request.firstApproverA2Id}`);
      console.log(`   Data Primeira Aprovação: ${request.firstApprovalDate}`);
      console.log(`   Aprovador Final ID: ${request.finalApproverId}`);
      console.log(`   Data Aprovação Final: ${request.finalApprovalDate}\n`);

      // Buscar histórico de aprovações
      const history = await db
        .select({
          id: approvalHistory.id,
          approverType: approvalHistory.approverType,
          approverId: approvalHistory.approverId,
          approved: approvalHistory.approved,
          approvalStep: approvalHistory.approvalStep,
          requiresDualApproval: approvalHistory.requiresDualApproval,
          approvalValue: approvalHistory.approvalValue,
          createdAt: approvalHistory.createdAt,
          rejectionReason: approvalHistory.rejectionReason,
          userName: users.firstName,
          userLastName: users.lastName,
          isCEO: users.isCEO,
          isDirector: users.isDirector
        })
        .from(approvalHistory)
        .leftJoin(users, eq(approvalHistory.approverId, users.id))
        .where(eq(approvalHistory.purchaseRequestId, request.id))
        .orderBy(desc(approvalHistory.createdAt));

      console.log(`   📜 Histórico de Aprovações (${history.length} entradas):`);
      
      for (const h of history) {
        const userName = h.userName && h.userLastName ? `${h.userName} ${h.userLastName}` : 'N/A';
        const userRole = h.isCEO ? ' (CEO)' : h.isDirector ? ' (Diretor)' : '';
        console.log(`      - ${h.approverType} | Passo: ${h.approvalStep} | Aprovado: ${h.approved} | ${userName}${userRole}`);
        console.log(`        Dupla Aprovação: ${h.requiresDualApproval} | Valor: R$ ${h.approvalValue}`);
        console.log(`        Data: ${h.createdAt}`);
        if (h.rejectionReason) {
          console.log(`        Motivo Rejeição: ${h.rejectionReason}`);
        }
      }

      // Análise da lógica
      const a2Approvals = history.filter(h => h.approverType === 'A2');
      const firstApproval = a2Approvals.find(h => h.approvalStep === 1);
      const finalApproval = a2Approvals.find(h => h.approvalStep === 2);

      console.log(`\n   🔍 Análise da Lógica:`);
      console.log(`      Primeira Aprovação: ${firstApproval ? 'SIM' : 'NÃO'}`);
      if (firstApproval) {
        console.log(`        - Aprovador: ${firstApproval.userName} ${firstApproval.userLastName}`);
        console.log(`        - É CEO: ${firstApproval.isCEO}`);
        console.log(`        - Aprovado: ${firstApproval.approved}`);
      }
      
      console.log(`      Aprovação Final: ${finalApproval ? 'SIM' : 'NÃO'}`);
      if (finalApproval) {
        console.log(`        - Aprovador: ${finalApproval.userName} ${finalApproval.userLastName}`);
        console.log(`        - É CEO: ${finalApproval.isCEO}`);
        console.log(`        - Aprovado: ${finalApproval.approved}`);
      }

      // Verificar se deveria ter avançado para pedido_compra
      const shouldAdvance = finalApproval && finalApproval.approved;
      console.log(`      Deveria ter avançado para Pedido de Compra: ${shouldAdvance ? 'SIM' : 'NÃO'}`);
      
      if (shouldAdvance && request.currentPhase === 'aprovacao_a2') {
        console.log(`      ⚠️  PROBLEMA IDENTIFICADO: Solicitação deveria estar em 'pedido_compra' mas está em '${request.currentPhase}'`);
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('❌ Erro ao investigar problema de aprovação:', error);
  } finally {
    process.exit(0);
  }
}

debugApprovalIssue();