// Script para investigar problema de sincronização da SOL-2025-329
const { Pool } = require('pg');

async function investigateSOL329() {
  console.log('🔍 Investigando problema de sincronização da SOL-2025-329');
  
  const pool = new Pool({
    user: 'compras',
    host: '54.232.194.197',
    database: 'locador_compras',
    password: 'Compras2025',
    port: 5432,
  });

  try {
    // Verificar estado atual da SOL-2025-329
    const result = await pool.query(`
      SELECT 
        id,
        request_number,
        current_phase,
        approved_a1,
        approval_date_a1,
        approver_a1_id,
        updated_at,
        created_at
      FROM purchase_requests 
      WHERE request_number = 'SOL-2025-329'
    `);

    if (result.rows.length === 0) {
      console.log('❌ SOL-2025-329 não encontrada no banco de dados');
      return;
    }

    const request = result.rows[0];
    console.log('\n📊 Estado atual da SOL-2025-329 no banco:');
    console.log(`   ID: ${request.id}`);
    console.log(`   Número: ${request.request_number}`);
    console.log(`   Fase atual: ${request.current_phase}`);
    console.log(`   Aprovada A1: ${request.approved_a1}`);
    console.log(`   Data aprovação A1: ${request.approval_date_a1}`);
    console.log(`   Aprovador A1 ID: ${request.approver_a1_id}`);
    console.log(`   Atualizada em: ${request.updated_at}`);
    console.log(`   Criada em: ${request.created_at}`);
    
    // Verificar se há inconsistência
    if (request.approved_a1 === true && request.current_phase !== 'cotacao') {
      console.log('\n⚠️  INCONSISTÊNCIA DETECTADA:');
      console.log('   - approved_a1 = true');
      console.log(`   - current_phase = '${request.current_phase}' (deveria ser 'cotacao')`);
      
      // Tentar corrigir a inconsistência
      console.log('\n🔧 Corrigindo a inconsistência...');
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
    
    // Forçar notificação via WebSocket
    console.log('\n📡 Enviando notificação WebSocket...');
    // Simular uma atualização para forçar o WebSocket a notificar
    const wsUpdateResult = await pool.query(`
      UPDATE purchase_requests 
      SET updated_at = NOW()
      WHERE id = $1
      RETURNING id, current_phase, updated_at
    `, [request.id]);
    
    if (wsUpdateResult.rows.length > 0) {
      console.log('✅ Timestamp atualizado para forçar sincronização WebSocket');
      console.log('Nova data de atualização:', wsUpdateResult.rows[0].updated_at);
    }

  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
  } finally {
    await pool.end();
  }
}

investigateSOL329();