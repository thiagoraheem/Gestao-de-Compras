import { config } from 'dotenv';
import { Pool } from 'pg';
import http from 'http';

// Carregar variáveis de ambiente
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function debugAuthDetailed() {
  try {
    console.log('=== DEBUG DETALHADO DE AUTENTICAÇÃO ===\n');
    
    // 1. Verificar sessão no banco
    console.log('1. Verificando sessões no banco de dados:');
    const sessionsQuery = `
      SELECT sid, sess, expire 
      FROM sessions 
      WHERE expire > NOW() 
      ORDER BY expire DESC 
      LIMIT 3
    `;
    const sessionsResult = await pool.query(sessionsQuery);
    
    if (sessionsResult.rows.length === 0) {
      console.log('❌ Nenhuma sessão válida encontrada no banco');
      return;
    }
    
    console.log(`✓ ${sessionsResult.rows.length} sessão(ões) válida(s) encontrada(s)`);
    
    const session = sessionsResult.rows[0];
    console.log(`   Session ID: ${session.sid}`);
    console.log(`   Expira em: ${session.expire}`);
    console.log(`   User ID: ${session.sess.userId}`);
    
    // 2. Testar /api/auth/check com diferentes formatos de cookie
    console.log('\n2. Testando /api/auth/check com diferentes formatos de cookie:');
    
    const testCookies = [
      `sessionId=${session.sid}`,
      `connect.sid=${session.sid}`,
      `sessionId=s%3A${session.sid}`,
      `connect.sid=s%3A${session.sid}`,
    ];
    
    for (const cookie of testCookies) {
      console.log(`\n   Testando cookie: ${cookie}`);
      
      const options = {
        hostname: 'localhost',
        port: 5201,
        path: '/api/auth/check',
        method: 'GET',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/json'
        }
      };
      
      try {
        const response = await makeRequest(options);
        console.log(`   Status: ${response.statusCode}`);
        
        if (response.statusCode === 200) {
          const userData = JSON.parse(response.body);
          console.log(`   ✓ Sucesso! Usuário: ${userData.username} (ID: ${userData.id})`);
          console.log(`   Permissões: Admin=${userData.isAdmin}, ApproverA1=${userData.isApproverA1}`);
          
          // Se funcionou, testar outras rotas
          await testOtherRoutes(cookie);
          break;
        } else {
          console.log(`   ❌ Falhou: ${response.body}`);
        }
      } catch (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Erro no debug:', error);
  } finally {
    await pool.end();
  }
}

async function testOtherRoutes(workingCookie) {
  console.log('\n3. Testando outras rotas com cookie funcionando:');
  
  const routes = [
    '/api/approval-rules/config',
    '/api/purchase-requests',
    '/api/users'
  ];
  
  for (const route of routes) {
    console.log(`\n   Testando: ${route}`);
    
    const options = {
      hostname: 'localhost',
      port: 5201,
      path: route,
      method: 'GET',
      headers: {
        'Cookie': workingCookie,
        'Content-Type': 'application/json'
      }
    };
    
    try {
      const response = await makeRequest(options);
      console.log(`   Status: ${response.statusCode}`);
      
      if (response.statusCode === 200) {
        console.log(`   ✓ Sucesso!`);
      } else {
        console.log(`   ❌ Falhou: ${response.body.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

debugAuthDetailed();