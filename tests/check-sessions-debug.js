import { pool } from './server/db.ts';

async function checkSessionsTable() {
  try {
    console.log('🔍 Verificando estrutura da tabela sessions...');
    
    const result = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura da tabela sessions:');
    console.table(result.rows);
    
    const count = await pool.query('SELECT COUNT(*) FROM sessions');
    console.log(`\n📊 Número de sessões ativas: ${count.rows[0].count}`);
    
    const recent = await pool.query('SELECT sid, expire, sess FROM sessions ORDER BY expire DESC LIMIT 5');
    console.log('\n🕒 Sessões recentes:');
    recent.rows.forEach((row, index) => {
      console.log(`${index + 1}. SID: ${row.sid?.substring(0, 20)}...`);
      console.log(`   Expira: ${row.expire}`);
      console.log(`   Dados: ${typeof row.sess} (${JSON.stringify(row.sess).length} chars)`);
      console.log('');
    });
    
    // Verificar se há sessões expiradas
    const expired = await pool.query('SELECT COUNT(*) FROM sessions WHERE expire < NOW()');
    console.log(`⏰ Sessões expiradas: ${expired.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela sessions:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkSessionsTable();