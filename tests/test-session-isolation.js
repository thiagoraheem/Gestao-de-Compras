// Script para testar isolamento de sessões entre navegadores
const API_BASE = 'http://localhost:5201';

class BrowserSession {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  async makeRequest(endpoint, options = {}) {
    const cookieHeader = Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    console.log(`🔍 ${this.name}: Fazendo request para ${endpoint}`);
    console.log(`🍪 ${this.name}: Enviando cookies: ${cookieHeader || 'Nenhum'}`);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { 'Cookie': cookieHeader }),
        ...options.headers
      }
    });

    // Capturar cookies de resposta
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      console.log(`🍪 ${this.name}: Recebeu Set-Cookie: ${setCookieHeader}`);
      const cookies = setCookieHeader.split(',');
      cookies.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name && value) {
          this.cookies.set(name.trim(), value.trim());
        }
      });
    }

    console.log(`📊 ${this.name}: Response status: ${response.status}`);
    return response;
  }

  async login(username, password) {
    console.log(`\n🔐 ${this.name}: Login com ${username}...`);
    
    const response = await this.makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const userData = await response.json();
      console.log(`✅ ${this.name}: Login OK! Usuário: ${userData.username}`);
      console.log(`🍪 ${this.name}: Cookies após login:`, Array.from(this.cookies.entries()));
      return userData;
    } else {
      const errorText = await response.text();
      console.log(`❌ ${this.name}: Login falhou - Status: ${response.status}, Error: ${errorText}`);
      return null;
    }
  }

  async checkAuth() {
    console.log(`\n🔍 ${this.name}: Verificando autenticação...`);
    
    const response = await this.makeRequest('/api/auth/check');
    
    if (response.ok) {
      const userData = await response.json();
      console.log(`✅ ${this.name}: Autenticado como ${userData.username} (ID: ${userData.id})`);
      return userData;
    } else {
      const errorText = await response.text();
      console.log(`❌ ${this.name}: Não autenticado - Status: ${response.status}, Error: ${errorText}`);
      return null;
    }
  }
}

async function testSessionIsolation() {
  console.log('=== TESTE DE ISOLAMENTO DE SESSÕES ===\n');
  
  const browser1 = new BrowserSession('Navegador 1 (Chrome)');
  const browser2 = new BrowserSession('Navegador 2 (Firefox)');
  const browser3 = new BrowserSession('Navegador 3 (Anônimo)');

  try {
    // Teste 1: Estado inicial
    console.log('📋 TESTE 1: Estado inicial - todos devem estar deslogados');
    await browser1.checkAuth();
    await browser2.checkAuth();
    await browser3.checkAuth();

    // Teste 2: Login no navegador 1
    console.log('\n📋 TESTE 2: Login no Navegador 1');
    const loginResult = await browser1.login('admin', 'admin123');
    
    if (!loginResult) {
      console.log('❌ Não foi possível fazer login. Verifique se o servidor está rodando e se as credenciais estão corretas.');
      return;
    }

    // Teste 3: Verificar se outros navegadores continuam deslogados
    console.log('\n📋 TESTE 3: Outros navegadores devem continuar deslogados');
    const user2Before = await browser2.checkAuth();
    const user3Before = await browser3.checkAuth();

    // Teste 4: Verificar se navegador 1 ainda está logado
    console.log('\n📋 TESTE 4: Navegador 1 deve continuar logado');
    const user1After = await browser1.checkAuth();

    // Teste 5: Simular cookies inválidos - TESTE MAIS DETALHADO
    console.log('\n📋 TESTE 5: Testando com cookies inválidos (DETALHADO)');
    const browser4 = new BrowserSession('Navegador 4 (Cookies Inválidos)');
    
    // Testar diferentes tipos de cookies inválidos
    console.log('\n   5a. Testando com sessionId completamente inválido:');
    browser4.cookies.clear();
    browser4.cookies.set('sessionId', 'cookie_completamente_invalido_123');
    const user4a = await browser4.checkAuth();

    console.log('\n   5b. Testando com connect.sid inválido:');
    browser4.cookies.clear();
    browser4.cookies.set('connect.sid', 's%3Asessao_falsa_456.hash_invalido');
    const user4b = await browser4.checkAuth();

    console.log('\n   5c. Testando com sessionId de outro usuário (simulado):');
    browser4.cookies.clear();
    browser4.cookies.set('sessionId', 's%3Aoutra_sessao_123.hash_diferente');
    const user4c = await browser4.checkAuth();

    console.log('\n   5d. Testando sem cookies:');
    browser4.cookies.clear();
    const user4d = await browser4.checkAuth();

    // Análise dos resultados
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANÁLISE DETALHADA DOS RESULTADOS');
    console.log('='.repeat(60));
    
    let problemasEncontrados = [];
    
    if (user1After && !user2Before && !user3Before && !user4a && !user4b && !user4c && !user4d) {
      console.log('✅ SUCESSO: Sessões isoladas corretamente!');
      console.log('   ✓ Navegador 1: Logado (correto)');
      console.log('   ✓ Navegador 2: Deslogado (correto)');
      console.log('   ✓ Navegador 3: Deslogado (correto)');
      console.log('   ✓ Cookies inválidos rejeitados (correto)');
    } else {
      console.log('❌ PROBLEMAS DE SEGURANÇA DETECTADOS:');
      
      if (!user1After) {
        problemasEncontrados.push('Navegador 1 perdeu a sessão inesperadamente');
      }
      
      if (user2Before) {
        problemasEncontrados.push('🚨 CRÍTICO: Navegador 2 aparece logado sem fazer login!');
      }
      
      if (user3Before) {
        problemasEncontrados.push('🚨 CRÍTICO: Navegador 3 (anônimo) aparece logado sem fazer login!');
      }
      
      if (user4a) {
        problemasEncontrados.push('🚨 CRÍTICO: Cookie sessionId inválido foi aceito!');
      }
      
      if (user4b) {
        problemasEncontrados.push('🚨 CRÍTICO: Cookie connect.sid inválido foi aceito!');
      }
      
      if (user4c) {
        problemasEncontrados.push('🚨 CRÍTICO: Cookie de outra sessão foi aceito!');
      }
      
      problemasEncontrados.forEach((problema, index) => {
        console.log(`   ${index + 1}. ${problema}`);
      });
    }

    if (problemasEncontrados.length > 0) {
      console.log('\n🔧 POSSÍVEIS CAUSAS:');
      console.log('   - Validação de sessão não está funcionando corretamente');
      console.log('   - Middleware de autenticação com falhas');
      console.log('   - Configuração inadequada de cookies');
      console.log('   - Cache de autenticação inadequado');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar o teste
testSessionIsolation().catch(console.error);