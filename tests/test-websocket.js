const WebSocket = require('ws');

console.log('🔌 Testando conexão WebSocket...');

const ws = new WebSocket('ws://localhost:5201/ws');

ws.on('open', function open() {
  console.log('✅ WebSocket conectado com sucesso!');
  
  // Testar envio de mensagem
  const testMessage = {
    type: 'subscribe',
    resource: 'purchase-requests',
    timestamp: new Date().toISOString()
  };
  
  console.log('📤 Enviando mensagem de teste:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  console.log('📥 Mensagem recebida:', data.toString());
  try {
    const parsed = JSON.parse(data.toString());
    console.log('📋 Mensagem parseada:', parsed);
  } catch (e) {
    console.log('⚠️ Erro ao parsear mensagem:', e.message);
  }
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket desconectado:', { code, reason: reason.toString() });
});

ws.on('error', function error(err) {
  console.error('❌ Erro WebSocket:', err);
});

// Fechar conexão após 10 segundos
setTimeout(() => {
  console.log('⏰ Fechando conexão de teste...');
  ws.close();
  process.exit(0);
}, 10000);