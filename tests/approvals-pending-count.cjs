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
  const res = await request('/api/approvals/pending-count', 'GET', null, { Cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie });
  if (res.status !== 200) {
    console.error('pending-count failed', res.status, res.body);
    process.exit(1);
  }
  const data = JSON.parse(res.body);
  if (typeof data.total !== 'number' || typeof data.a1 !== 'number' || typeof data.a2 !== 'number' || typeof data.ts !== 'string') {
    console.error('Invalid response shape', data);
    process.exit(1);
  }
  console.log('OK /api/approvals/pending-count', data);
}

run().catch((e) => { console.error(e); process.exit(1); });
