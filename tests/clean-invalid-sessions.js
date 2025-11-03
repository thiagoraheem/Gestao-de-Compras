import { config } from 'dotenv';
import { Pool } from 'pg';

// Carregar variáveis de ambiente
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanInvalidSessions() {
  try {
    console.log('=== LIMPEZA DE SESSÕES INVÁLIDAS ===\n');
    
    // 1. Verificar sessões atuais
    console.log('1. Verificando sessões atuais:');
    const currentSessionsQuery = `
      SELECT sid, sess, expire, 
             CASE WHEN expire > NOW() THEN 'válida' ELSE 'expirada' END as status
      FROM sessions 
      ORDER BY expire DESC
    `;
    const currentSessions = await pool.query(currentSessionsQuery);
    
    console.log(`   Total de sessões: ${currentSessions.rows.length}`);
    
    currentSessions.rows.forEach((session, index) => {
      console.log(`   ${index + 1}. SID: ${session.sid.substring(0, 20)}... | Status: ${session.status} | User: ${session.sess.userId || 'N/A'}`);
    });
    
    // 2. Remover sessões expiradas
    console.log('\n2. Removendo sessões expiradas:');
    const deleteExpiredQuery = `
      DELETE FROM sessions 
      WHERE expire <= NOW()
    `;
    const deleteExpiredResult = await pool.query(deleteExpiredQuery);
    console.log(`   ✓ ${deleteExpiredResult.rowCount} sessões expiradas removidas`);
    
    // 3. Verificar sessões válidas restantes
    console.log('\n3. Verificando sessões válidas restantes:');
    const validSessionsQuery = `
      SELECT sid, sess, expire
      FROM sessions 
      WHERE expire > NOW()
      ORDER BY expire DESC
    `;
    const validSessions = await pool.query(validSessionsQuery);
    
    if (validSessions.rows.length === 0) {
      console.log('   ✓ Nenhuma sessão válida restante - todas foram limpas');
    } else {
      console.log(`   ${validSessions.rows.length} sessão(ões) válida(s) restante(s):`);
      validSessions.rows.forEach((session, index) => {
        console.log(`   ${index + 1}. SID: ${session.sid.substring(0, 20)}... | User: ${session.sess.userId} | Expira: ${session.expire}`);
      });
    }
    
    // 4. Opcional: Remover TODAS as sessões para forçar novo login
    console.log('\n4. Opção: Remover todas as sessões para forçar novo login?');
    console.log('   (Isso forçará todos os usuários a fazer login novamente)');
    
    // Para este script, vamos remover todas as sessões para garantir um estado limpo
    const deleteAllQuery = `DELETE FROM sessions`;
    const deleteAllResult = await pool.query(deleteAllQuery);
    console.log(`   ✓ ${deleteAllResult.rowCount} sessão(ões) removida(s) - estado limpo`);
    
    console.log('\n✅ Limpeza concluída! Todos os usuários precisarão fazer login novamente.');
    
  } catch (error) {
    console.error('Erro na limpeza:', error);
  } finally {
    await pool.end();
  }
}

cleanInvalidSessions();