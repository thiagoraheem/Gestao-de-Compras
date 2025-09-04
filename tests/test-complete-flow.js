// Teste completo do fluxo de compras
// Este script testa desde a criação da solicitação até a criação do pedido de compra

const API_BASE = 'http://localhost:5201/api';

// Função para fazer requisições HTTP com cookies de sessão
async function makeRequest(url, options = {}, cookies = '') {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    // Capturar cookies de resposta
    const setCookieHeader = response.headers.get('set-cookie');
    const responseData = await response.json();
    
    return {
      data: responseData,
      cookies: setCookieHeader || cookies
    };
  } catch (error) {
    console.error(`Erro na requisição para ${url}:`, error.message);
    throw error;
  }
}

// Função para aguardar um tempo
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Dados de teste
const testData = {
  // Dados de login
  login: {
    username: 'admin',
    password: 'admin123'
  },
  
  // Dados da solicitação
  purchaseRequest: {
    requesterId: 2, // Admin (ID correto do banco)
    companyId: 1, // Empresa padrão
    costCenterId: 1, // TI
    category: 'produto',
    urgency: 'alta',
    justification: 'Teste completo do fluxo de compras - Aquisição de equipamentos para teste',
    idealDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias
    availableBudget: '1000.00',
    additionalInfo: 'Teste automatizado do sistema'
  },
  
  // Itens da solicitação
  items: [
    {
      description: 'Cabo HDMI 2.0 - 3 metros',
      requestedQuantity: '2',
      unit: 'UN',
      estimatedUnitPrice: '50.00',
      estimatedTotalPrice: '100.00',
      justification: 'Para conectar monitores'
    },
    {
      description: 'Mouse óptico USB',
      requestedQuantity: '3',
      unit: 'UN', 
      estimatedUnitPrice: '25.00',
      estimatedTotalPrice: '75.00',
      justification: 'Substituição de equipamentos defeituosos'
    }
  ],
  
  // Dados da RFQ
  rfq: {
    title: 'RFQ - Teste Completo',
    description: 'Solicitação de cotação para teste do fluxo completo',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias
    supplierIds: [1, 2] // Assumindo que existem fornecedores com IDs 1 e 2
  },
  
  // Cotações dos fornecedores
  supplierQuotations: [
    {
      supplierId: 1,
      totalValue: '170.00',
      deliveryTime: '5 dias úteis',
      paymentTerms: '30 dias',
      observations: 'Produtos em estoque',
      items: [
        {
          description: 'Cabo HDMI 2.0 - 3 metros',
          quantity: '2',
          unit: 'UN',
          unitPrice: '45.00',
          totalPrice: '90.00'
        },
        {
          description: 'Mouse óptico USB',
          quantity: '3', 
          unit: 'UN',
          unitPrice: '26.67',
          totalPrice: '80.00'
        }
      ]
    },
    {
      supplierId: 2,
      totalValue: '180.00',
      deliveryTime: '7 dias úteis',
      paymentTerms: '45 dias',
      observations: 'Produtos de alta qualidade',
      items: [
        {
          description: 'Cabo HDMI 2.0 - 3 metros',
          quantity: '2',
          unit: 'UN',
          unitPrice: '50.00',
          totalPrice: '100.00'
        },
        {
          description: 'Mouse óptico USB',
          quantity: '3',
          unit: 'UN', 
          unitPrice: '26.67',
          totalPrice: '80.00'
        }
      ]
    }
  ]
};

// Função principal do teste
async function runCompleteTest() {
  console.log('Iniciando teste completo do fluxo de compras...');
  
  let cookies = '';
  
  try {
    // 0. Fazer login
    // Fazendo login...
    const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(testData.login)
    });
    cookies = loginResponse.cookies;
    // Login realizado
    
    // 1. Criar solicitação de compra
    // Criando solicitação de compra...
    const purchaseRequestResponse = await makeRequest(`${API_BASE}/purchase-requests`, {
      method: 'POST',
      body: JSON.stringify(testData.purchaseRequest)
    }, cookies);
    const purchaseRequest = purchaseRequestResponse.data;
    console.log('Solicitação criada:', purchaseRequest.requestNumber);
    
    const requestId = purchaseRequest.id;
    
    // 2. Adicionar itens à solicitação
    // Adicionando itens à solicitação...
    for (const item of testData.items) {
      await makeRequest(`${API_BASE}/purchase-requests/${requestId}/items`, {
        method: 'POST',
        body: JSON.stringify(item)
      }, cookies);
    }
    console.log('Itens adicionados');
    
    // 3. Enviar para aprovação A1
    // Enviando para aprovação A1...
    await makeRequest(`${API_BASE}/purchase-requests/${requestId}/send-to-approval`, {
      method: 'POST'
    }, cookies);
    console.log('Enviado para aprovação A1');

    // 4. Aprovar A1
    // Aprovando A1...
    await makeRequest(`${API_BASE}/purchase-requests/${requestId}/approve-a1`, {
      method: 'POST',
      body: JSON.stringify({
        approved: true,
        rejectionReason: '',
        approverId: 2
      })
    }, cookies);
    console.log('A1 aprovado');
    
    // 5. Criar RFQ
    // Criando RFQ...
    const rfqData = {
      purchaseRequestId: requestId,
      quotationDeadline: testData.rfq.deadline,
      deliveryLocationId: 1,
      termsAndConditions: 'Termos e condições padrão para teste',
      technicalSpecs: testData.rfq.description
    };
    
    const rfqResponse = await makeRequest(`${API_BASE}/quotations`, {
      method: 'POST',
      body: JSON.stringify(rfqData)
    }, cookies);
    const rfq = rfqResponse.data;
    console.log(`RFQ criada: ${rfq.title}`);
    
    const quotationId = rfq.id;
    
    // 6. Adicionar itens à RFQ
    // Adicionando itens à RFQ...
    const quotationItemIds = [];
    for (const item of testData.items) {
      const quotationItem = {
        quotationId: quotationId,
        itemCode: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: item.description,
        quantity: item.requestedQuantity.toString(),
        unit: item.unit
      };
      
      const quotationItemResponse = await makeRequest(`${API_BASE}/quotations/${quotationId}/items`, {
        method: 'POST',
        body: JSON.stringify(quotationItem)
      }, cookies);
      quotationItemIds.push(quotationItemResponse.data.id);
    }
    console.log('Itens da RFQ adicionados');
    
    // 7. Criar cotações dos fornecedores
    // Criando cotações dos fornecedores...
    for (const supplierQuote of testData.supplierQuotations) {
      const supplierQuotationData = {
        quotationId: quotationId,
        supplierId: supplierQuote.supplierId,
        totalValue: supplierQuote.totalValue,
        deliveryTime: supplierQuote.deliveryTime,
        paymentTerms: supplierQuote.paymentTerms,
        observations: supplierQuote.observations,
        isChosen: supplierQuote.supplierId === 1
      };
      
      const createdSupplierQuotationResponse = await makeRequest(`${API_BASE}/quotations/${quotationId}/supplier-quotations`, {
        method: 'POST',
        body: JSON.stringify(supplierQuotationData)
      }, cookies);
      const createdSupplierQuotation = createdSupplierQuotationResponse.data;
      
      // Adicionar itens da cotação do fornecedor
      for (let i = 0; i < supplierQuote.items.length && i < quotationItemIds.length; i++) {
        const item = supplierQuote.items[i];
        const supplierQuotationItemData = {
          supplierQuotationId: createdSupplierQuotation.id,
          quotationItemId: quotationItemIds[i],
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
          deliveryDays: item.deliveryDays || 30,
          brand: item.brand || '',
          model: item.model || '',
          observations: item.observations || ''
        };
        
        await makeRequest(`${API_BASE}/supplier-quotations/${createdSupplierQuotation.id}/items`, {
          method: 'POST',
          body: JSON.stringify(supplierQuotationItemData)
        }, cookies);
      }
    }
    console.log('Cotações dos fornecedores criadas');
    
    // 8. Selecionar fornecedor vencedor
    // Selecionando fornecedor vencedor...
    await makeRequest(`${API_BASE}/quotations/${quotationId}/select-supplier`, {
      method: 'POST',
      body: JSON.stringify({
        selectedSupplierId: 1,
        totalValue: 170.00,
        observations: 'Melhor proposta técnica e comercial'
      })
    }, cookies);
    console.log('Fornecedor selecionado');

    // 9. Atualizar cotação para mover para aprovação A2
    // Atualizando cotação para A2...
    await makeRequest(`${API_BASE}/purchase-requests/${requestId}/update-quotation`, {
      method: 'POST',
      body: JSON.stringify({
        buyerId: 2,
        totalValue: 170.00,
        paymentMethodId: 1
      })
    }, cookies);
    console.log('Cotação atualizada para A2');

    // 10. Aprovar A2
    // Aprovando A2...
    await makeRequest(`${API_BASE}/purchase-requests/${requestId}/approve-a2`, {
      method: 'POST',
      body: JSON.stringify({
        approverId: 2,
        approved: true,
        chosenSupplierId: 1,
        choiceReason: 'Melhor preço e prazo de entrega',
        negotiatedValue: '170.00',
        observations: 'Aprovado para teste'
      })
    }, cookies);
    console.log('A2 aprovado');
    
    // 11. Verificar pedido de compra
    // Verificando pedido de compra...
    await sleep(2000);
    
    try {
      const purchaseOrderResponse = await makeRequest(`${API_BASE}/purchase-orders/by-request/${requestId}`, {}, cookies);
      const purchaseOrder = purchaseOrderResponse.data;
      
      if (purchaseOrder) {
        console.log('Pedido de compra criado:', purchaseOrder.orderNumber);
        console.log('Valor total: R$', purchaseOrder.totalValue);
      } else {
        console.log('❌ ERRO: Pedido de compra NÃO foi criado!');
        return false;
      }
    } catch (error) {
      console.log('❌ ERRO ao buscar pedido de compra:', error.message);
      return false;
    }
    
    console.log('Teste completo finalizado com SUCESSO!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    return false;
  }
}

// Executar o teste
if (typeof window === 'undefined') {
  // Node.js environment
  import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
    
    runCompleteTest().then(success => {
      process.exit(success ? 0 : 1);
    });
  }).catch(error => {
    console.error('Erro ao importar node-fetch:', error);
    process.exit(1);
  });
} else {
  // Browser environment
  window.runCompleteTest = runCompleteTest;
}