#!/usr/bin/env node

/**
 * Script para testar o fluxo completo de atualização de cotação do fornecedor
 * Verifica se os campos availableQuantity e confirmedUnit estão sendo persistidos corretamente
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5201';

// Dados de login (ajuste conforme necessário)
const LOGIN_DATA = {
  email: 'admin@blomaq.com.br',
  password: 'admin123'
};

let authToken = null;

async function login() {
  try {
    console.log('🔐 Fazendo login...');
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(LOGIN_DATA),
    });

    if (!response.ok) {
      throw new Error(`Login falhou: ${response.status}`);
    }

    const data = await response.json();
    authToken = data.token;
    console.log('✅ Login realizado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    return false;
  }
}

async function makeAuthenticatedRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

async function findTestRequest() {
  try {
    console.log('🔍 Buscando solicitações existentes...');
    const response = await makeAuthenticatedRequest(`${BASE_URL}/api/purchase-requests`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar solicitações: ${response.status}`);
    }

    const requests = await response.json();
    
    // Procurar por uma solicitação na fase de cotação
    const quotationRequest = requests.find(req => req.phase === 'cotacao');
    
    if (quotationRequest) {
      console.log(`✅ Encontrada solicitação para teste: ${quotationRequest.requestNumber}`);
      return quotationRequest;
    }

    // Se não encontrar, pegar a primeira disponível
    if (requests.length > 0) {
      console.log(`⚠️ Usando primeira solicitação disponível: ${requests[0].requestNumber}`);
      return requests[0];
    }

    console.log('❌ Nenhuma solicitação encontrada');
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar solicitações:', error.message);
    return null;
  }
}

async function getQuotationData(requestId) {
  try {
    console.log(`📋 Buscando dados da cotação para solicitação ${requestId}...`);
    const response = await makeAuthenticatedRequest(`${BASE_URL}/api/quotations/by-request/${requestId}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar cotação: ${response.status}`);
    }

    const quotation = await response.json();
    console.log(`✅ Cotação encontrada: ID ${quotation.id}`);
    return quotation;
  } catch (error) {
    console.error('❌ Erro ao buscar cotação:', error.message);
    return null;
  }
}

async function getSupplierQuotations(quotationId) {
  try {
    console.log(`🏢 Buscando cotações de fornecedores para cotação ${quotationId}...`);
    const response = await makeAuthenticatedRequest(`${BASE_URL}/api/supplier-quotations/${quotationId}`);
    
    if (!response.ok) {
      throw new Error(`Erro ao buscar cotações de fornecedores: ${response.status}`);
    }

    const supplierQuotations = await response.json();
    console.log(`✅ Encontradas ${supplierQuotations.length} cotações de fornecedores`);
    return supplierQuotations;
  } catch (error) {
    console.error('❌ Erro ao buscar cotações de fornecedores:', error.message);
    return [];
  }
}

async function testSupplierQuotationUpdate(quotationId, supplierId) {
  try {
    console.log(`🧪 Testando atualização da cotação do fornecedor...`);
    
    // Dados de teste com os campos que estavam com problema
    const testData = {
      supplierId: supplierId,
      items: [
        {
          id: 1,
          description: "Chave Liga/desliga Bipolar 20a 1,5cv Cs-102 Margirius",
          quantity: "1",
          unitPrice: "120.00",
          availableQuantity: "10", // Campo que estava com problema
          confirmedUnit: "UN", // Campo que estava com problema
          brand: "Margirius",
          model: "CS-102",
          deliveryDays: "30",
          observations: "Teste de persistência dos campos"
        }
      ],
      totalValue: "1200.00",
      paymentTerms: "30 dias",
      deliveryTerms: "FOB",
      warrantyPeriod: "12 meses",
      observations: "Teste automatizado",
      subtotalValue: "1200.00",
      finalValue: "1200.00",
      discountType: "none",
      discountValue: "0.00",
      includesFreight: false,
      freightValue: "0.00"
    };

    console.log('📤 Enviando dados de teste...');
    console.log('Dados enviados:', JSON.stringify(testData, null, 2));

    const response = await makeAuthenticatedRequest(
      `${BASE_URL}/api/quotations/${quotationId}/update-supplier-quotation`,
      {
        method: 'POST',
        body: JSON.stringify(testData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na atualização: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Atualização realizada com sucesso');
    console.log('Resposta:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('❌ Erro na atualização da cotação:', error.message);
    return null;
  }
}

async function verifyDataPersistence(quotationId, supplierId) {
  try {
    console.log('🔍 Verificando persistência dos dados...');
    
    // Buscar as cotações atualizadas
    const supplierQuotations = await getSupplierQuotations(quotationId);
    const targetQuotation = supplierQuotations.find(sq => sq.supplierId === supplierId);
    
    if (!targetQuotation) {
      console.log('❌ Cotação do fornecedor não encontrada');
      return false;
    }

    console.log('📋 Buscando itens da cotação...');
    const response = await makeAuthenticatedRequest(
      `${BASE_URL}/api/supplier-quotation-items/${targetQuotation.id}`
    );

    if (!response.ok) {
      throw new Error(`Erro ao buscar itens: ${response.status}`);
    }

    const items = await response.json();
    console.log(`✅ Encontrados ${items.length} itens`);

    // Verificar se os campos problemáticos foram salvos
    let allFieldsPersisted = true;
    
    items.forEach((item, index) => {
      console.log(`\n📦 Item ${index + 1}:`);
      console.log(`  Descrição: ${item.description}`);
      console.log(`  Quantidade Disponível: ${item.availableQuantity}`);
      console.log(`  Unidade Confirmada: ${item.confirmedUnit}`);
      
      if (!item.availableQuantity || item.availableQuantity === null) {
        console.log(`  ❌ Campo availableQuantity está NULL ou vazio`);
        allFieldsPersisted = false;
      } else {
        console.log(`  ✅ Campo availableQuantity persistido: ${item.availableQuantity}`);
      }
      
      if (!item.confirmedUnit || item.confirmedUnit === null) {
        console.log(`  ❌ Campo confirmedUnit está NULL ou vazio`);
        allFieldsPersisted = false;
      } else {
        console.log(`  ✅ Campo confirmedUnit persistido: ${item.confirmedUnit}`);
      }
    });

    return allFieldsPersisted;
  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    return false;
  }
}

async function runTest() {
  console.log('🚀 Iniciando teste do fluxo de cotação do fornecedor...\n');

  // 1. Fazer login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Teste falhou no login');
    return;
  }

  // 2. Encontrar uma solicitação para teste
  const testRequest = await findTestRequest();
  if (!testRequest) {
    console.log('❌ Teste falhou: nenhuma solicitação encontrada');
    return;
  }

  // 3. Buscar dados da cotação
  const quotation = await getQuotationData(testRequest.id);
  if (!quotation) {
    console.log('❌ Teste falhou: cotação não encontrada');
    return;
  }

  // 4. Buscar cotações de fornecedores
  const supplierQuotations = await getSupplierQuotations(quotation.id);
  if (supplierQuotations.length === 0) {
    console.log('❌ Teste falhou: nenhuma cotação de fornecedor encontrada');
    return;
  }

  // 5. Usar o primeiro fornecedor para teste
  const firstSupplier = supplierQuotations[0];
  console.log(`🎯 Usando fornecedor: ${firstSupplier.supplierId}`);

  // 6. Testar atualização
  const updateResult = await testSupplierQuotationUpdate(quotation.id, firstSupplier.supplierId);
  if (!updateResult) {
    console.log('❌ Teste falhou na atualização');
    return;
  }

  // 7. Verificar persistência
  console.log('\n🔍 Verificando se os dados foram persistidos corretamente...');
  const persistenceSuccess = await verifyDataPersistence(quotation.id, firstSupplier.supplierId);

  console.log('\n' + '='.repeat(60));
  if (persistenceSuccess) {
    console.log('🎉 TESTE PASSOU: Todos os campos foram persistidos corretamente!');
  } else {
    console.log('❌ TESTE FALHOU: Alguns campos não foram persistidos corretamente!');
  }
  console.log('='.repeat(60));
}

// Executar o teste
runTest().catch(error => {
  console.error('💥 Erro fatal no teste:', error);
});