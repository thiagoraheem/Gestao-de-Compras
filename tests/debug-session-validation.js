import http from 'http';
import { URL } from 'url';

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

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function debugSessionValidation() {
  console.log('🔍 Debugando validação de sessão...\n');

  try {
    // 1. Fazer login para obter uma sessão válida
    console.log('1️⃣ Fazendo login...');
    const loginData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });

    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 5201,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);

    console.log(`Status: ${loginResponse.statusCode}`);
    console.log(`Response: ${loginResponse.body}`);

    // Extrair cookie de sessão
    const setCookieHeader = loginResponse.headers['set-cookie'];
    if (!setCookieHeader) {
      console.log('❌ Nenhum cookie de sessão recebido!');
      return;
    }

    const sessionCookie = setCookieHeader[0].split(';')[0];
    console.log(`🍪 Cookie de sessão: ${sessionCookie}\n`);

    // 2. Testar /api/auth/check com o cookie
    console.log('2️⃣ Testando /api/auth/check com cookie...');
    const checkResponse = await makeRequest({
      hostname: 'localhost',
      port: 5201,
      path: '/api/auth/check',
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    });

    console.log(`Status: ${checkResponse.statusCode}`);
    console.log(`Response: ${checkResponse.body}\n`);

    // 3. Testar múltiplas vezes para verificar consistência
    console.log('3️⃣ Testando múltiplas vezes para verificar consistência...');
    for (let i = 1; i <= 3; i++) {
      console.log(`Teste ${i}:`);
      const testResponse = await makeRequest({
        hostname: 'localhost',
        port: 5201,
        path: '/api/auth/check',
        method: 'GET',
        headers: {
          'Cookie': sessionCookie
        }
      });
      console.log(`  Status: ${testResponse.statusCode}`);
      console.log(`  Response: ${testResponse.body.substring(0, 100)}...`);
    }

    // 4. Testar com cookie inválido
    console.log('\n4️⃣ Testando com cookie inválido...');
    const invalidResponse = await makeRequest({
      hostname: 'localhost',
      port: 5201,
      path: '/api/auth/check',
      method: 'GET',
      headers: {
        'Cookie': 'sessionId=invalid-session-id'
      }
    });

    console.log(`Status: ${invalidResponse.statusCode}`);
    console.log(`Response: ${invalidResponse.body}`);

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

debugSessionValidation();