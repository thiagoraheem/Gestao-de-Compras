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

async function debugSessionSignature() {
  try {
    console.log('=== DEBUG DE ASSINATURA DE SESSÃO ===\n');
    
    // 1. Fazer login real para obter cookie válido
    console.log('1. Fazendo login para obter cookie válido:');
    
    const loginData = JSON.stringify({
      username: 'thiago.raheem',
      password: 'senha123' // Assumindo uma senha padrão
    });
    
    const loginOptions = {
      hostname: 'localhost',
      port: 5201,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    try {
      const loginResponse = await makeRequest(loginOptions, loginData);
      console.log(`   Status do login: ${loginResponse.statusCode}`);
      
      if (loginResponse.statusCode === 200) {
        const setCookieHeader = loginResponse.headers['set-cookie'];
        console.log(`   ✓ Login bem-sucedido!`);
        console.log(`   Set-Cookie header: ${setCookieHeader}`);
        
        if (setCookieHeader && setCookieHeader.length > 0) {
          // Extrair o cookie da resposta
          const cookieString = setCookieHeader[0].split(';')[0];
          console.log(`   Cookie extraído: ${cookieString}`);
          
          // Testar o cookie
          await testWithValidCookie(cookieString);
        } else {
          console.log('   ❌ Nenhum cookie retornado no login');
        }
      } else {
        console.log(`   ❌ Login falhou: ${loginResponse.body}`);
        
        // Tentar com senha padrão alternativa
        console.log('\n   Tentando com senha padrão alternativa...');
        await tryAlternativeLogin();
      }
    } catch (error) {
      console.log(`   ❌ Erro no login: ${error.message}`);
      await tryAlternativeLogin();
    }
    
  } catch (error) {
    console.error('Erro no debug:', error);
  } finally {
    await pool.end();
  }
}

async function tryAlternativeLogin() {
  const alternatives = [
    { username: 'thiago.raheem', password: '123456' },
    { username: 'thiago.raheem', password: 'password' },
    { username: 'admin', password: 'admin123' },
    { username: 'admin', password: '123456' }
  ];
  
  for (const cred of alternatives) {
    console.log(`   Tentando: ${cred.username} / ${cred.password}`);
    
    const loginData = JSON.stringify(cred);
    const loginOptions = {
      hostname: 'localhost',
      port: 5201,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    try {
      const response = await makeRequest(loginOptions, loginData);
      console.log(`   Status: ${response.statusCode}`);
      
      if (response.statusCode === 200) {
        const setCookieHeader = response.headers['set-cookie'];
        console.log(`   ✓ Login bem-sucedido com ${cred.username}!`);
        
        if (setCookieHeader && setCookieHeader.length > 0) {
          const cookieString = setCookieHeader[0].split(';')[0];
          console.log(`   Cookie: ${cookieString}`);
          await testWithValidCookie(cookieString);
          return;
        }
      }
    } catch (error) {
      console.log(`   Erro: ${error.message}`);
    }
  }
  
  console.log('   ❌ Nenhuma credencial funcionou');
}

async function testWithValidCookie(cookieString) {
  console.log('\n2. Testando rotas com cookie válido:');
  
  const routes = [
    '/api/auth/check',
    '/api/approval-rules/config',
    '/api/purchase-requests'
  ];
  
  for (const route of routes) {
    console.log(`\n   Testando: ${route}`);
    
    const options = {
      hostname: 'localhost',
      port: 5201,
      path: route,
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'Content-Type': 'application/json'
      }
    };
    
    try {
      const response = await makeRequest(options);
      console.log(`   Status: ${response.statusCode}`);
      
      if (response.statusCode === 200) {
        console.log(`   ✓ Sucesso!`);
        if (route === '/api/auth/check') {
          const userData = JSON.parse(response.body);
          console.log(`   Usuário: ${userData.username} (ID: ${userData.id})`);
        }
      } else {
        console.log(`   ❌ Falhou: ${response.body.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

debugSessionSignature();