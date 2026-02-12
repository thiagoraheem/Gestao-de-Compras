#!/usr/bin/env node
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5201;
const BASE_URL = `http://127.0.0.1:${PORT}`;

(async () => {
  console.log('Test: Centros de Custo - integração Locador');
  try {
    const res = await fetch(`${BASE_URL}/api/integracao-locador/centros-custo`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('✓ Recebidos', Array.isArray(data) ? data.length : 0, 'centros de custo');
    if (Array.isArray(data) && data.length) {
      const sample = data.slice(0, 3).map(cc => `${cc.idCostCenter} - ${cc.name}`);
      console.log('Exemplo:', sample.join(' | '));
    }
  } catch (err) {
    console.error('✗ Falha ao consultar centros de custo:', err.message);
    process.exitCode = 1;
  }
})();
