const { Pool } = require('pg');

console.log('🚀 Iniciando script de verificação do banco...');

const pool = new Pool({
  connectionString: "postgres://compras:Compras2025@54.232.194.197:5432/locador_compras"
});

async function checkDatabase() {
  try {
    console.log('🔍 Conectando ao banco de dados...\n');
    
    // Teste de conexão simples
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida:', testResult.rows[0].now);
    
    // Verificar as solicitações específicas
    console.log('\n🔍 Buscando solicitações SOL-2025-330 e SOL-2025-329...');
    const result = await pool.query(`
      SELECT 
        id,
        request_number,
        current_phase,
        category,
        urgency,
        approved_a1,
        approved_a2
      FROM purchase_requests 
      WHERE request_number IN ('SOL-2025-330', 'SOL-2025-329')
      ORDER BY request_number
    `);
    
    console.log(`📊 Encontradas ${result.rows.length} solicitações:\n`);
    
    result.rows.forEach(row => {
      console.log(`🔍 ${row.request_number}:`);
      console.log(`   - ID: ${row.id}`);
      console.log(`   - Current Phase: ${row.current_phase}`);
      console.log(`   - Category: ${row.category}`);
      console.log(`   - Urgency: ${row.urgency}`);
      console.log(`   - Approved A1: ${row.approved_a1}`);
      console.log(`   - Approved A2: ${row.approved_a2}`);
      console.log('');
    });
    
    // Verificar todas as solicitações em aprovacao_a1
    console.log('🔍 Buscando todas as solicitações em aprovacao_a1...');
    const aprovacaoA1Result = await pool.query(`
      SELECT 
        request_number,
        current_phase,
        category,
        urgency
      FROM purchase_requests 
      WHERE current_phase = 'aprovacao_a1'
      ORDER BY request_number
    `);
    
    console.log(`📋 Todas as solicitações em aprovacao_a1 (${aprovacaoA1Result.rows.length}):`);
    aprovacaoA1Result.rows.forEach(row => {
      console.log(`   - ${row.request_number}: ${row.current_phase} (${row.category}, ${row.urgency})`);
    });
    
    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    console.error('❌ Erro ao consultar banco:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('🔌 Conexão fechada.');
  }
}

checkDatabase().catch(console.error);