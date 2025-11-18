const http = require('http');
const fs = require('fs');

function getPort() {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const m = env.match(/PORT=(\d+)/);
    if (m) return parseInt(m[1], 10);
  } catch {}
  return 3000;
}

const PORT = getPort();

function request(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: PORT, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  const loginRes = await request('/api/auth/login', 'POST', JSON.stringify({ username: 'admin', password: 'admin123' }), { 'Content-Type': 'application/json' });
  if (loginRes.status !== 200) {
    console.error('Login failed', loginRes.status, loginRes.body);
    process.exit(1);
  }
  const cookie = loginRes.headers['set-cookie'];

  const sub = { endpoint: 'https://example/endpoint', keys: { p256dh: 'key', auth: 'auth' } };
  const subRes = await request('/api/notifications/subscribe', 'POST', JSON.stringify(sub), { 'Content-Type': 'application/json', Cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie });
  if (subRes.status !== 200) {
    console.error('Subscribe failed', subRes.status, subRes.body);
    process.exit(1);
  }

  const vapidRes = await request('/api/notifications/vapid-public-key', 'GET', null, { Cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie });
  if (vapidRes.status !== 200) {
    console.error('VAPID key failed', vapidRes.status, vapidRes.body);
    process.exit(1);
  }
  const k = JSON.parse(vapidRes.body).publicKey;
  console.log('OK subscribe, vapid=', k ? 'present' : 'empty');
}

run().catch((e) => { console.error(e); process.exit(1); });