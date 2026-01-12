const API_BASE = process.env.API_BASE || 'http://localhost:5201';
let fetch;

async function importFetch() {
  if (!fetch) {
    const { default: nodeFetch } = await import('node-fetch');
    fetch = nodeFetch;
  }
}

const AUTH_CONFIG = {
  username: process.env.ADMIN_EMAIL || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

let sessionCookie = '';

async function login() {
  console.log('🔐 Fazendo login como administrador...');
  
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(AUTH_CONFIG)
  });

  if (!response.ok) {
    throw new Error(`Falha no login: ${response.status} ${response.statusText}`);
  }

  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    sessionCookie = setCookieHeader.split(';')[0];
  }
  console.log('✅ Login realizado com sucesso');
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function migrateFlow() {
  await importFetch();
  await login();

  console.log('\n🚀 Iniciando migração para novo fluxo Kanban...\n');

  const requests = await apiRequest('/api/purchase-requests');
  console.log(`📊 Total de solicitações encontradas: ${requests.length}`);

  let migratedCount = 0;

  for (const req of requests) {
    // Check if in 'recebimento' phase
    if (req.currentPhase === 'recebimento') {
      // If physical receipt is done, move to 'conf_fiscal'
      if (req.physicalReceiptAt && !req.fiscalReceiptAt) {
        console.log(`🔄 Migrando Solicitação #${req.requestNumber} (ID: ${req.id}) para 'conf_fiscal'`);
        try {
          await apiRequest(`/api/purchase-requests/${req.id}/update-phase`, {
            method: 'PATCH',
            body: JSON.stringify({ newPhase: 'conf_fiscal' })
          });
          migratedCount++;
          console.log(`✅ Sucesso`);
        } catch (e) {
          console.error(`❌ Erro ao migrar ${req.requestNumber}:`, e.message);
        }
      } 
      // If both are done, move to 'conclusao_compra'
      else if (req.physicalReceiptAt && req.fiscalReceiptAt) {
        console.log(`🔄 Migrando Solicitação #${req.requestNumber} (ID: ${req.id}) para 'conclusao_compra'`);
        try {
          await apiRequest(`/api/purchase-requests/${req.id}/update-phase`, {
            method: 'PATCH',
            body: JSON.stringify({ newPhase: 'conclusao_compra' })
          });
          migratedCount++;
          console.log(`✅ Sucesso`);
        } catch (e) {
          console.error(`❌ Erro ao migrar ${req.requestNumber}:`, e.message);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migração concluída. Total migrado: ${migratedCount}`);
  console.log('='.repeat(60));
}

if (require.main === module) {
  migrateFlow().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}
