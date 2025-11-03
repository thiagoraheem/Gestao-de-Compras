const fetch = require('node-fetch');
const WebSocket = require('ws');

const API_BASE = 'http://localhost:5201';
const WS_BASE = 'ws://localhost:5201';

async function testFrontendSync() {
  console.log('🔄 Testando sincronização completa frontend-backend...\n');
  
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
    
    // 2. Testar API REST
    console.log('\n📡 Testando API REST...');
    const apiResponse = await fetch(`${API_BASE}/api/purchase-requests?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      const sol329 = data.find(req => req.requestNumber === 'SOL-2025-329');
      
      if (sol329) {
        console.log('✅ SOL-2025-329 encontrada via API REST:');
        console.log('   currentPhase:', sol329.currentPhase);
        console.log('   approvedA1:', sol329.approvedA1);
        console.log('   updatedAt:', sol329.updatedAt);
        
        if (sol329.currentPhase === 'cotacao') {
          console.log('✅ Fase correta na API REST!');
        } else {
          console.log('❌ Fase incorreta na API REST!');
        }
      } else {
        console.log('❌ SOL-2025-329 não encontrada na API REST');
      }
    } else {
      console.log('❌ Erro na API REST:', apiResponse.status);
    }
    
    // 3. Testar WebSocket
    console.log('\n🔌 Testando WebSocket...');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(`${WS_BASE}?userId=3`);
      let wsTimeout;
      
      ws.on('open', () => {
        console.log('✅ WebSocket conectado');
        
        // Subscrever para purchase_requests
        ws.send(JSON.stringify({
          type: 'subscribe',
          resource: 'purchase_requests'
        }));
        
        console.log('📡 Subscrito para purchase_requests via WebSocket');
        
        // Aguardar mensagens por 5 segundos
        wsTimeout = setTimeout(() => {
          console.log('⏰ Timeout do WebSocket - fechando conexão');
          ws.close();
          resolve();
        }, 5000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 Mensagem WebSocket recebida:', message.type);
          
          if (message.type === 'data' && message.resource === 'purchase_requests') {
            const sol329 = message.data.find(req => req.requestNumber === 'SOL-2025-329');
            
            if (sol329) {
              console.log('✅ SOL-2025-329 encontrada via WebSocket:');
              console.log('   currentPhase:', sol329.currentPhase);
              console.log('   approvedA1:', sol329.approvedA1);
              
              if (sol329.currentPhase === 'cotacao') {
                console.log('✅ Fase correta no WebSocket!');
              } else {
                console.log('❌ Fase incorreta no WebSocket!');
              }
            }
          }
        } catch (error) {
          console.log('❌ Erro ao processar mensagem WebSocket:', error.message);
        }
      });
      
      ws.on('error', (error) => {
        console.log('❌ Erro no WebSocket:', error.message);
        clearTimeout(wsTimeout);
        resolve();
      });
      
      ws.on('close', () => {
        console.log('🔌 WebSocket desconectado');
        clearTimeout(wsTimeout);
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ Erro durante teste de sincronização:', error);
  }
}

testFrontendSync().then(() => {
  console.log('\n🏁 Teste de sincronização concluído');
  process.exit(0);
});