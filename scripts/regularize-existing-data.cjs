// Script para regularizar dados existentes em produção
// Este script identifica e corrige divergências de quantidades e referências
// em dados que já estão em produção

const API_BASE = process.env.API_BASE || 'http://localhost:5201';
let fetch;

// Função para importar fetch dinamicamente
async function importFetch() {
  if (!fetch) {
    const { default: nodeFetch } = await import('node-fetch');
    fetch = nodeFetch;
  }
}

// Configuração de autenticação
const AUTH_CONFIG = {
  username: process.env.ADMIN_EMAIL || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

let sessionCookie = '';

// Função para fazer login e obter cookie de sessão
async function login() {
  console.log('🔐 Fazendo login como administrador...');
  
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(AUTH_CONFIG)
  });

  if (!response.ok) {
    throw new Error(`Falha no login: ${response.status} ${response.statusText}`);
  }

  // Extrair cookie de sessão
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    sessionCookie = setCookieHeader.split(';')[0];
  }

  console.log('✅ Login realizado com sucesso');
}

// Função para fazer requisições autenticadas
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

// Função para obter todas as solicitações de compra
async function getAllPurchaseRequests() {
  console.log('📋 Buscando todas as solicitações de compra...');
  
  const requests = await apiRequest('/api/purchase-requests');
  console.log(`📊 Encontradas ${requests.length} solicitações de compra`);
  
  return requests;
}

// Função para executar auditoria em uma solicitação
async function auditPurchaseRequest(requestId) {
  try {
    const auditResult = await apiRequest(`/api/admin/purchase-requests/${requestId}/audit`);
    return auditResult;
  } catch (error) {
    console.error(`❌ Erro na auditoria da solicitação ${requestId}:`, error.message);
    return null;
  }
}

// Função para aplicar correções em uma solicitação
async function fixPurchaseRequestData(requestId, issues) {
  try {
    // Determinar tipos de correção baseado nos problemas encontrados
    const fixTypes = [];
    
    if (issues.some(issue => issue.type === 'orphaned_quotation_item')) {
      fixTypes.push('orphaned_quotation_item');
    }
    if (issues.some(issue => issue.type === 'missing_reference')) {
      fixTypes.push('missing_reference');
    }
    if (issues.some(issue => issue.type === 'quantity_discrepancy')) {
      fixTypes.push('quantity_discrepancy');
    }
    if (issues.some(issue => issue.type === 'missing_quotation_item_reference')) {
      fixTypes.push('missing_quotation_item_reference');
    }

    if (fixTypes.length === 0) {
      return { summary: { totalFixes: 0 }, fixes: [] };
    }

    const fixResult = await apiRequest(`/api/admin/purchase-requests/${requestId}/fix-data`, {
      method: 'POST',
      body: JSON.stringify({
        fixTypes: fixTypes,
        dryRun: false
      })
    });

    return fixResult;
  } catch (error) {
    console.error(`❌ Erro ao corrigir dados da solicitação ${requestId}:`, error.message);
    return null;
  }
}

// Função principal de regularização
async function regularizeExistingData() {
  await importFetch();
  await login();

  console.log('\n🚀 Iniciando regularização de dados existentes...\n');

  const requests = await getAllPurchaseRequests();
  
  let totalProcessed = 0;
  let totalWithIssues = 0;
  let totalFixed = 0;
  let totalErrors = 0;

  const results = {
    processed: [],
    errors: []
  };

  for (const request of requests) {
    console.log(`\n📋 Processando solicitação ${request.requestNumber} (ID: ${request.id})...`);
    totalProcessed++;

    try {
      // Executar auditoria
      const auditResult = await auditPurchaseRequest(request.id);
      
      if (!auditResult) {
        console.log(`⚠️ Não foi possível auditar a solicitação ${request.requestNumber}`);
        totalErrors++;
        results.errors.push({
          requestId: request.id,
          requestNumber: request.requestNumber,
          error: 'Falha na auditoria'
        });
        continue;
      }

      const issuesCount = auditResult.summary.totalIssues || 0;
      
      if (issuesCount === 0) {
        console.log(`✅ Solicitação ${request.requestNumber}: Nenhum problema encontrado`);
        results.processed.push({
          requestId: request.id,
          requestNumber: request.requestNumber,
          issuesFound: 0,
          fixesApplied: 0,
          status: 'ok'
        });
        continue;
      }

      console.log(`⚠️ Solicitação ${request.requestNumber}: ${issuesCount} problema(s) encontrado(s)`);
      totalWithIssues++;

      // Aplicar correções
      const fixResult = await fixPurchaseRequestData(request.id, auditResult.issues || []);
      
      if (!fixResult) {
        console.log(`❌ Não foi possível corrigir a solicitação ${request.requestNumber}`);
        totalErrors++;
        results.errors.push({
          requestId: request.id,
          requestNumber: request.requestNumber,
          error: 'Falha na correção'
        });
        continue;
      }

      const fixesApplied = fixResult.summary.totalFixes || 0;
      
      if (fixesApplied > 0) {
        console.log(`✅ Solicitação ${request.requestNumber}: ${fixesApplied} correção(ões) aplicada(s)`);
        totalFixed++;
      } else {
        console.log(`⚠️ Solicitação ${request.requestNumber}: Nenhuma correção foi aplicada`);
      }

      results.processed.push({
        requestId: request.id,
        requestNumber: request.requestNumber,
        issuesFound: issuesCount,
        fixesApplied: fixesApplied,
        status: fixesApplied > 0 ? 'fixed' : 'issues_remain',
        details: fixResult.fixes || []
      });

    } catch (error) {
      console.error(`❌ Erro ao processar solicitação ${request.requestNumber}:`, error.message);
      totalErrors++;
      results.errors.push({
        requestId: request.id,
        requestNumber: request.requestNumber,
        error: error.message
      });
    }

    // Pequena pausa para não sobrecarregar o servidor
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO FINAL DE REGULARIZAÇÃO');
  console.log('='.repeat(60));
  console.log(`📋 Total de solicitações processadas: ${totalProcessed}`);
  console.log(`⚠️ Solicitações com problemas: ${totalWithIssues}`);
  console.log(`✅ Solicitações corrigidas: ${totalFixed}`);
  console.log(`❌ Erros durante processamento: ${totalErrors}`);
  console.log('='.repeat(60));

  if (results.errors.length > 0) {
    console.log('\n❌ ERROS ENCONTRADOS:');
    results.errors.forEach(error => {
      console.log(`  - ${error.requestNumber}: ${error.error}`);
    });
  }

  const fixedRequests = results.processed.filter(r => r.status === 'fixed');
  if (fixedRequests.length > 0) {
    console.log('\n✅ SOLICITAÇÕES CORRIGIDAS:');
    fixedRequests.forEach(request => {
      console.log(`  - ${request.requestNumber}: ${request.fixesApplied} correção(ões)`);
    });
  }

  const remainingIssues = results.processed.filter(r => r.status === 'issues_remain');
  if (remainingIssues.length > 0) {
    console.log('\n⚠️ SOLICITAÇÕES COM PROBLEMAS REMANESCENTES:');
    remainingIssues.forEach(request => {
      console.log(`  - ${request.requestNumber}: ${request.issuesFound} problema(s) não corrigido(s)`);
    });
  }

  console.log('\n💡 PRÓXIMOS PASSOS:');
  if (totalFixed > 0) {
    console.log('✅ Dados regularizados com sucesso');
    console.log('💡 Verifique o sistema para confirmar as correções');
  }
  if (remainingIssues.length > 0) {
    console.log('⚠️ Algumas solicitações ainda possuem problemas');
    console.log('💡 Verifique manualmente as solicitações listadas acima');
  }
  if (totalErrors > 0) {
    console.log('❌ Alguns erros ocorreram durante o processamento');
    console.log('💡 Verifique os logs e tente novamente se necessário');
  }

  return results;
}

// Executar regularização
if (require.main === module) {
  regularizeExistingData().catch(error => {
    console.error('❌ Erro fatal na regularização:', error);
    process.exit(1);
  });
}

module.exports = { regularizeExistingData };