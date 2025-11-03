// Script para debugar os endpoints de autenticação
import http from 'http';

const PORT = 5201;
const HOST = 'localhost';

function makeRequest(path, method = 'GET', data = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    };

    if (data && method !== 'GET') {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    console.log(`\n🔍 Testing ${method} ${path}`);
    console.log(`Headers:`, options.headers);

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        console.log(`✅ Response: ${res.statusCode} ${res.statusMessage}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body:`, responseData);
        
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          data: responseData,
          headers: res.headers,
          cookies: cookies
        });
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Request error:`, error);
      reject(error);
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testAuthEndpoints() {
  console.log('🚀 Iniciando testes dos endpoints de autenticação...\n');

  try {
    // 1. Testar /api/auth/check sem autenticação
    console.log('='.repeat(50));
    console.log('1. Testando /api/auth/check sem autenticação');
    const checkResponse1 = await makeRequest('/api/auth/check');
    
    // 2. Testar /api/auth/login com credenciais válidas
    console.log('='.repeat(50));
    console.log('2. Testando /api/auth/login com credenciais');
    const loginData = {
      email: 'admin@blomaq.com.br',
      password: 'admin123'
    };
    const loginResponse = await makeRequest('/api/auth/login', 'POST', loginData);
    
    // Extrair cookie de sessão se o login foi bem-sucedido
    let sessionCookie = '';
    if (loginResponse.cookies && loginResponse.cookies.length > 0) {
      sessionCookie = loginResponse.cookies.find(cookie => cookie.includes('sessionId'));
      if (sessionCookie) {
        sessionCookie = sessionCookie.split(';')[0]; // Pegar apenas a parte sessionId=valor
        console.log(`🍪 Session cookie extraído: ${sessionCookie}`);
      }
    }
    
    // 3. Testar /api/auth/check com autenticação
    if (sessionCookie) {
      console.log('='.repeat(50));
      console.log('3. Testando /api/auth/check com autenticação');
      const checkResponse2 = await makeRequest('/api/auth/check', 'GET', null, sessionCookie);
    }
    
    // 4. Testar /api/auth/logout
    if (sessionCookie) {
      console.log('='.repeat(50));
      console.log('4. Testando /api/auth/logout');
      const logoutResponse = await makeRequest('/api/auth/logout', 'POST', null, sessionCookie);
    }
    
    // 5. Testar /api/auth/check após logout
    if (sessionCookie) {
      console.log('='.repeat(50));
      console.log('5. Testando /api/auth/check após logout');
      const checkResponse3 = await makeRequest('/api/auth/check', 'GET', null, sessionCookie);
    }
    
    console.log('\n✅ Testes concluídos!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Executar os testes
testAuthEndpoints();
const API_BASE = 'http://localhost:5201';

async function debugAuthCheck() {
  console.log('🔍 DEBUGANDO ENDPOINT /api/auth/check');
  console.log('='.repeat(50));

  try {
    // 1. Fazer login primeiro
    console.log('\n1. Fazendo login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    console.log(`📊 Login status: ${loginResponse.status}`);
    
    if (loginResponse.status !== 200) {
      const loginError = await loginResponse.text();
      console.log('❌ Erro no login:', loginError);
      return;
    }

    // Capturar cookies do login
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log(`🍪 Set-Cookie recebido: ${setCookieHeader}`);

    if (!setCookieHeader) {
      console.log('❌ Nenhum cookie recebido no login!');
      return;
    }

    // Extrair cookies
    const cookies = new Map();
    setCookieHeader.split(',').forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookies.set(name.trim(), value.trim());
      }
    });

    console.log('🍪 Cookies extraídos:');
    cookies.forEach((value, name) => {
      console.log(`   ${name}: ${value.substring(0, 50)}...`);
    });

    // 2. Testar /api/auth/check com os cookies
    console.log('\n2. Testando /api/auth/check com cookies válidos...');
    
    const cookieHeader = Array.from(cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    console.log(`🍪 Enviando cookies: ${cookieHeader.substring(0, 100)}...`);

    const checkResponse = await fetch(`${API_BASE}/api/auth/check`, {
      headers: {
        'Cookie': cookieHeader
      }
    });

    console.log(`📊 Auth check status: ${checkResponse.status}`);

    if (checkResponse.status === 200) {
      const userData = await checkResponse.json();
      console.log('✅ Usuário autenticado:', {
        id: userData.id,
        username: userData.username,
        email: userData.email
      });
    } else {
      const errorText = await checkResponse.text();
      console.log('❌ Erro na verificação:', errorText);
    }

    // 3. Testar sem cookies
    console.log('\n3. Testando /api/auth/check sem cookies...');
    
    const noCookieResponse = await fetch(`${API_BASE}/api/auth/check`);
    console.log(`📊 Status sem cookies: ${noCookieResponse.status}`);

    // 4. Testar com cookies inválidos
    console.log('\n4. Testando /api/auth/check com cookies inválidos...');
    
    const invalidResponse = await fetch(`${API_BASE}/api/auth/check`, {
      headers: {
        'Cookie': 'sessionId=s%3Ainvalid_session.fake_signature'
      }
    });
    console.log(`📊 Status com cookies inválidos: ${invalidResponse.status}`);

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

debugAuthCheck();