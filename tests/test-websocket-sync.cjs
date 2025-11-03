const WebSocket = require('ws');

console.log('🔧 Testing WebSocket synchronization...');

// Create WebSocket connection
const ws = new WebSocket('ws://localhost:5201/ws');
let receivedNotifications = [];

ws.on('open', function open() {
  console.log('✅ WebSocket connected');
  
  // Subscribe to purchase_requests
  const subscribeMessage = {
    type: 'subscribe',
    resource: 'purchase_requests'
  };
  
  console.log('📝 Subscribing to purchase_requests...');
  ws.send(JSON.stringify(subscribeMessage));
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data.toString());
    console.log('📨 Received:', parsed);
    
    if (parsed.type === 'notification') {
      receivedNotifications.push(parsed);
      console.log('🔔 Notification received:', parsed);
    }
  } catch (error) {
    console.log('📨 Raw message:', data.toString());
  }
});

ws.on('close', function close(code, reason) {
  console.log('❌ WebSocket closed:', { code, reason: reason.toString() });
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
});

// Close after 30 seconds
setTimeout(() => {
  console.log('\n📊 Test Summary:');
  console.log(`Notifications received: ${receivedNotifications.length}`);
  receivedNotifications.forEach((notif, index) => {
    console.log(`  ${index + 1}. ${notif.action} on ${notif.resource}`);
  });
  
  console.log('\n🔚 Closing test connection');
  ws.close();
  process.exit(0);
}, 30000);