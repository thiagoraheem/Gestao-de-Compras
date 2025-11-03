const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras',
  ssl: false
});

async function checkSOL329Direct() {
  console.log('🔍 Verificando SOL-2025-329 diretamente no banco de dados...\n');
  
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        request_number, 
        current_phase, 
        approved_a1, 
        approval_date_a1,
        approver_a1_id,
        updated_at
      FROM purchase_requests 
      WHERE request_number = 'SOL-2025-329'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ SOL-2025-329 não encontrada no banco de dados');
      return;
    }
    
    const req = result.rows[0];
    console.log('📊 Dados da SOL-2025-329 no banco de dados:');
    console.log('   ID:', req.id);
    console.log('   Número:', req.request_number);
    console.log('   current_phase:', req.current_phase);
    console.log('   approved_a1:', req.approved_a1);
    console.log('   approval_date_a1:', req.approval_date_a1);
    console.log('   approver_a1_id:', req.approver_a1_id);
    console.log('   updated_at:', req.updated_at);
    
    // Verificar se há inconsistência
    if (req.current_phase === 'aprovacao_a1' && req.approved_a1 === true) {
      console.log('\n❌ INCONSISTÊNCIA DETECTADA!');
      console.log('   A solicitação está aprovada (approved_a1=true) mas ainda na fase aprovacao_a1');
      console.log('   Deveria estar na fase "cotacao"');
      
      // Corrigir novamente
      console.log('\n🔧 Corrigindo novamente...');
      await pool.query(
        'UPDATE purchase_requests SET current_phase = $1, updated_at = NOW() WHERE id = $2',
        ['cotacao', req.id]
      );
      
      // Verificar se a correção funcionou
      const checkResult = await pool.query(
        'SELECT current_phase, updated_at FROM purchase_requests WHERE id = $1',
        [req.id]
      );
      
      if (checkResult.rows[0].current_phase === 'cotacao') {
        console.log('✅ Correção aplicada com sucesso!');
        console.log('   Nova fase:', checkResult.rows[0].current_phase);
        console.log('   Atualizado em:', checkResult.rows[0].updated_at);
      } else {
        console.log('❌ Falha na correção');
      }
    } else {
      console.log('\n✅ Dados consistentes no banco de dados');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error);
  } finally {
    await pool.end();
  }
}

checkSOL329Direct();