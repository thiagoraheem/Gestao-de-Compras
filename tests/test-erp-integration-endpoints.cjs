const BASE = process.env.BASE_URL || 'http://localhost:5201';
const API = `${BASE}/api`;

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${res.statusText}`);
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error('No Set-Cookie returned from login');
  const json = await res.json();
  console.log('✅ Login OK:', json.username || json.name || json.id);
  return cookie;
}

async function startIntegration(cookie) {
  const res = await fetch(`${API}/erp-integration/suppliers/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({})
  });
  const text = await res.text();
  console.log('▶️ Fetch response status:', res.status);
  console.log(text);
  try {
    const json = JSON.parse(text);
    return json.integration_id;
  } catch {
    return null;
  }
}

async function getHistory(cookie) {
  const res = await fetch(`${API}/erp-integration/history`, {
    headers: { 'Cookie': cookie }
  });
  const text = await res.text();
  console.log('📜 History status:', res.status);
  console.log(text);
}

async function getStatus(cookie, integrationId) {
  if (!integrationId) {
    console.log('ℹ️ No integration_id returned, skipping status check');
    return;
  }
  const res = await fetch(`${API}/erp-integration/suppliers/status/${integrationId}`, {
    headers: { 'Cookie': cookie }
  });
  const text = await res.text();
  console.log('📈 Status response:', res.status);
  console.log(text);
}

async function main() {
  try {
    console.log('== Testing ERP Integration Endpoints ==');
    const cookie = await login();
    const integrationId = await startIntegration(cookie);
    await getHistory(cookie);
    await getStatus(cookie, integrationId);
    console.log('✅ Tests completed');
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exitCode = 1;
  }
}

main();
