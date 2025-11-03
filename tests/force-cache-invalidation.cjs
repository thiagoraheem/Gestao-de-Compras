const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5201';

async function forceCacheInvalidation() {
  console.log('🔄 Forçando invalidação completa do cache...\n');
  
  try {
    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Erro no login:', loginResponse.status);
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso');
    
    // 2. Fazer múltiplas requisições com headers de cache-busting
    console.log('\n🔄 Invalidando cache com múltiplas estratégias...');
    
    const cacheHeaders = [
      { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      { 'Pragma': 'no-cache' },
      { 'Expires': '0' },
      { 'Cache-Control': 'max-age=0' },
      { 'If-None-Match': '*' },
      { 'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT' }
    ];
    
    for (let i = 0; i < cacheHeaders.length; i++) {
      const headers = {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        ...cacheHeaders[i]
      };
      
      console.log(`   Tentativa ${i + 1}/${cacheHeaders.length}...`);
      
      const response = await fetch(`${API_BASE}/api/purchase-requests?_t=${Date.now()}`, {
        method: 'GET',
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        const sol329 = data.find(req => req.requestNumber === 'SOL-2025-329');
        
        if (sol329) {
          console.log(`     SOL-2025-329 currentPhase: ${sol329.currentPhase}`);
          
          if (sol329.currentPhase === 'cotacao') {
            console.log('✅ Cache invalidado com sucesso! Fase correta retornada.');
            break;
          }
        }
      }
      
      // Aguardar um pouco entre as tentativas
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 3. Verificação final
    console.log('\n🔍 Verificação final da API...');
    const finalResponse = await fetch(`${API_BASE}/api/purchase-requests?_bust=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (finalResponse.ok) {
      const data = await finalResponse.json();
      const sol329 = data.find(req => req.requestNumber === 'SOL-2025-329');
      
      if (sol329) {
        console.log('📊 Estado final da SOL-2025-329 via API:');
        console.log('   currentPhase:', sol329.currentPhase);
        console.log('   approvedA1:', sol329.approvedA1);
        console.log('   updatedAt:', sol329.updatedAt);
        
        if (sol329.currentPhase === 'cotacao') {
          console.log('\n🎯 SUCESSO! A API agora retorna a fase correta!');
        } else {
          console.log('\n❌ A API ainda retorna a fase incorreta. Pode ser necessário reiniciar o servidor.');
        }
      } else {
        console.log('❌ SOL-2025-329 não encontrada na resposta da API');
      }
    } else {
      console.log('❌ Erro na verificação final:', finalResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Erro durante invalidação de cache:', error);
  }
}

forceCacheInvalidation();