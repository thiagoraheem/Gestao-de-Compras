const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'gestao_compras',
  password: 'admin',
  port: 5432,
});

async function debugPhaseUpdate() {
  try {
    console.log('🔍 Verificando histórico de atualizações da SOL-2025-329...');
    
    // Verificar estado atual no banco
    const currentState = await pool.query(`
      SELECT 
        id,
        request_number,
        current_phase,
        approved_a1,
        approver_a1_id,
        approval_date_a1,
        updated_at,
        created_at
      FROM purchase_requests 
      WHERE request_number = 'SOL-2025-329'
    `);
    
    if (currentState.rows.length > 0) {
      const request = currentState.rows[0];
      console.log('\n📊 Estado atual no banco:');
      console.log('ID:', request.id);
      console.log('Request Number:', request.request_number);
      console.log('Current Phase:', request.current_phase);
      console.log('Approved A1:', request.approved_a1);
      console.log('Approver A1 ID:', request.approver_a1_id);
      console.log('Approval Date A1:', request.approval_date_a1);
      console.log('Updated At:', request.updated_at);
      console.log('Created At:', request.created_at);
    }
    
    // Verificar histórico de aprovações
    const approvalHistory = await pool.query(`
      SELECT 
        id,
        purchase_request_id,
        approver_type,
        approver_id,
        approved,
        rejection_reason,
        created_at
      FROM approval_history 
      WHERE purchase_request_id = 368
      ORDER BY created_at DESC
    `);
    
    console.log('\n📋 Histórico de aprovações:');
    if (approvalHistory.rows.length > 0) {
      approvalHistory.rows.forEach((approval, index) => {
        console.log(`${index + 1}. Tipo: ${approval.approver_type}, Aprovador: ${approval.approver_id}, Aprovado: ${approval.approved}, Data: ${approval.created_at}`);
        if (approval.rejection_reason) {
          console.log(`   Motivo rejeição: ${approval.rejection_reason}`);
        }
      });
    } else {
      console.log('Nenhum histórico de aprovação encontrado');
    }
    
    // Verificar se há alguma inconsistência
    if (currentState.rows.length > 0) {
      const request = currentState.rows[0];
      if (request.approved_a1 === true && request.current_phase !== 'cotacao') {
        console.log('\n⚠️  INCONSISTÊNCIA DETECTADA:');
        console.log('   - approved_a1 = true');
        console.log(`   - current_phase = '${request.current_phase}' (deveria ser 'cotacao')`);
        
        // Tentar corrigir a inconsistência
        console.log('\n🔧 Tentando corrigir a inconsistência...');
        const updateResult = await pool.query(`
          UPDATE purchase_requests 
          SET current_phase = 'cotacao', updated_at = NOW()
          WHERE id = $1 AND approved_a1 = true
          RETURNING id, current_phase, updated_at
        `, [request.id]);
        
        if (updateResult.rows.length > 0) {
          console.log('✅ Fase corrigida com sucesso!');
          console.log('Nova fase:', updateResult.rows[0].current_phase);
          console.log('Atualizada em:', updateResult.rows[0].updated_at);
        }
      } else {
        console.log('\n✅ Dados consistentes no banco de dados');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar fase:', error.message);
  } finally {
    await pool.end();
  }
}

debugPhaseUpdate();