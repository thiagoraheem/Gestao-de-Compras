const WebSocket = require('ws');

// Teste de conexão WebSocket
async function testWebSocketConnection() {
  console.log('🔧 Iniciando teste de conexão WebSocket...');
  
  const ws = new WebSocket('ws://localhost:5201/ws');
  
  ws.on('open', function open() {
    console.log('✅ WebSocket conectado com sucesso!');
    
    // Enviar mensagem de autenticação (simulada)
    ws.send(JSON.stringify({
      type: 'auth',
      token: 'test-token'
    }));
    
    // Inscrever-se em purchase_requests
    ws.send(JSON.stringify({
      type: 'subscribe',
      resource: 'purchase_requests'
    }));
    
    console.log('📡 Inscrito em purchase_requests');
  });
  
  ws.on('message', function message(data) {
    try {
      const parsed = JSON.parse(data.toString());
      console.log('📨 Mensagem recebida:', parsed);
    } catch (error) {
      console.log('📨 Mensagem recebida (raw):', data.toString());
    }
  });
  
  ws.on('close', function close(code, reason) {
    console.log('❌ WebSocket desconectado:', code, reason.toString());
  });
  
  ws.on('error', function error(err) {
    console.error('🚨 Erro WebSocket:', err);
  });
  
  // Manter conexão por 10 segundos
  setTimeout(() => {
    console.log('🔚 Fechando conexão de teste...');
    ws.close();
  }, 10000);
}

testWebSocketConnection().catch(console.error);