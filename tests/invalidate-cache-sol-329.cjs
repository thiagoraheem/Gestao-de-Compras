// Script para invalidar cache e forçar atualização da SOL-2025-329
const fetch = require('node-fetch');
const API_BASE = 'http://localhost:5201';

async function invalidateCacheAndTest() {
  try {
    console.log('🔍 Invalidando cache e testando SOL-2025-329...\n');
    
    // Fazer login primeiro
    console.log('🔐 Fazendo login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Erro no login:', loginResponse.status, loginResponse.statusText);
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso\n');
    
    // Fazer uma requisição POST para invalidar o cache (qualquer POST/PUT/DELETE invalida)
    console.log('🗑️ Invalidando cache...');
    const invalidateResponse = await fetch(`${API_BASE}/api/purchase-requests/cache-invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({ action: 'invalidate' })
    });
    
    // Não importa se o endpoint não existe, o importante é que seja um POST
    console.log('Cache invalidation attempt completed\n');
    
    // Aguardar um pouco para garantir que o cache foi limpo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Testar a API novamente
    console.log('📊 Buscando dados atualizados...');
    const response = await fetch(`${API_BASE}/api/purchase-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'Cache-Control': 'no-cache', // Força bypass do cache
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Erro na API:', response.status, response.statusText);
      return;
    }
    
    const requests = await response.json();
    
    // Verificar headers de cache
    const cacheStatus = response.headers.get('x-cache');
    const cacheKey = response.headers.get('x-cache-key');
    console.log(`Cache Status: ${cacheStatus || 'N/A'}`);
    console.log(`Cache Key: ${cacheKey || 'N/A'}\n`);
    
    // Procurar pela SOL-2025-329
    const sol329 = requests.find(r => r.requestNumber === 'SOL-2025-329');
    
    if (sol329) {
      console.log('🎯 SOL-2025-329 encontrada:');
      console.log(`   ID: ${sol329.id}`);
      console.log(`   Número: ${sol329.requestNumber}`);
      console.log(`   Fase Atual: ${sol329.currentPhase}`);
      console.log(`   Aprovado A1: ${sol329.approvedA1}`);
      console.log(`   Atualizado em: ${sol329.updatedAt}`);
      console.log(`   Timestamp: ${new Date(sol329.updatedAt).getTime()}`);
      
      if (sol329.currentPhase === 'cotacao' && sol329.approvedA1 === true) {
        console.log('\n✅ SUCESSO: SOL-2025-329 está corretamente na fase "cotacao"!');
      } else {
        console.log('\n❌ PROBLEMA: SOL-2025-329 ainda não está na fase correta');
        console.log('   Esperado: currentPhase = "cotacao", approvedA1 = true');
        console.log(`   Atual: currentPhase = "${sol329.currentPhase}", approvedA1 = ${sol329.approvedA1}`);
      }
    } else {
      console.log('❌ SOL-2025-329 não encontrada na resposta da API');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

invalidateCacheAndTest();