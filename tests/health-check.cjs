
const fetch = require('node-fetch');
const BASE_URL = 'http://localhost:5201';

async function check() {
  try {
    const res = await fetch(`${BASE_URL}/api/companies`);
    console.log('Server is up, status:', res.status);
  } catch (err) {
    console.error('Server check failed:', err.message);
  }
}

check();
