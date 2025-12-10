#!/usr/bin/env node
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5201;
const BASE_URL = `http://127.0.0.1:${PORT}`;

(async () => {
  console.log('Test: Plano de Contas - integração Locador');
  try {
    const res = await fetch(`${BASE_URL}/api/plano-contas`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('✓ Recebidos', Array.isArray(data) ? data.length : 0, 'contas');
    if (Array.isArray(data) && data.length) {
      const sample = data.slice(0, 3).map(a => `${a.code} - ${a.name}`);
      console.log('Exemplo:', sample.join(' | '));
    }
  } catch (err) {
    console.error('✗ Falha ao consultar plano de contas:', err.message);
    process.exitCode = 1;
  }
})();
