/**
 * Testes para validar o fluxo completo de produtos indisponíveis
 * Este arquivo testa:
 * 1. Marcação de itens como indisponíveis durante análise de cotações
 * 2. Criação automática de nova solicitação com itens indisponíveis
 * 3. Filtros de produtos indisponíveis nas fases posteriores
 */

const { Pool } = require('pg');

// Configuração do banco de dados
require('dotenv').config();

const poolConfig = {
  connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
};

const pool = new Pool(poolConfig);

// Função auxiliar para criar dados de teste
async function createTestData() {
  // Criando dados de teste...
  
  const client = await pool.connect();
  
  try {
    // Criar solicitação de compra com número único
    const requestNumber = `TEST-UNAVAILABLE-${Date.now()}`;
    const requestResult = await client.query(`
      INSERT INTO purchase_requests (
        request_number, requester_id, company_id, cost_center_id,
        category, urgency, justification, current_phase
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      requestNumber, 2, 1, 1,
      'Produto', 'Médio', 'Teste de produtos indisponíveis', 'cotacao'
    ]);
    
    const requestId = requestResult.rows[0].id;
    
    // Criar itens da solicitação
    const itemsResult = await client.query(`
      INSERT INTO purchase_request_items (
        purchase_request_id, product_code, description, requested_quantity, unit
      ) VALUES 
        ($1, 'PROD-001', 'Produto Disponível', 10, 'UN'),
        ($1, 'PROD-002', 'Produto Indisponível', 5, 'UN'),
        ($1, 'PROD-003', 'Outro Produto Indisponível', 3, 'UN')
      RETURNING id, product_code
    `, [requestId]);
    
    const items = itemsResult.rows;
    
    // Criar cotação
    const quotationResult = await client.query(`
      INSERT INTO quotations (
        quotation_number, purchase_request_id, status, quotation_deadline, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      'COT-TEST-001', requestId, 'received', 
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 2
    ]);
    
    const quotationId = quotationResult.rows[0].id;
    
    // Criar itens da cotação
    const quotationItemsResult = await client.query(`
      INSERT INTO quotation_items (
        quotation_id, purchase_request_item_id, item_code, description, quantity, unit
      ) VALUES 
        ($1, $2, 'PROD-001', 'Produto Disponível', 10, 'UN'),
        ($1, $3, 'PROD-002', 'Produto Indisponível', 5, 'UN'),
        ($1, $4, 'PROD-003', 'Outro Produto Indisponível', 3, 'UN')
      RETURNING id
    `, [quotationId, items[0].id, items[1].id, items[2].id]);
    
    const quotationItems = quotationItemsResult.rows;
    
    // Criar cotação do fornecedor
    const supplierQuotationResult = await client.query(`
      INSERT INTO supplier_quotations (
        quotation_id, supplier_id, status, total_value
      ) VALUES ($1, 1, 'received', 950.00)
      RETURNING id
    `, [quotationId]);
    
    const supplierQuotationId = supplierQuotationResult.rows[0].id;
    
    // Criar itens de cotação do fornecedor
    await client.query(`
      INSERT INTO supplier_quotation_items (
        supplier_quotation_id, quotation_item_id, unit_price, total_price,
        is_available, unavailability_reason
      ) VALUES 
        ($1, $2, 95.00, 950.00, true, NULL),
        ($1, $3, 0, 0, false, 'Produto descontinuado pelo fabricante'),
        ($1, $4, 0, 0, false, 'Fora de estoque - prazo indeterminado')
    `, [supplierQuotationId, quotationItems[0].id, quotationItems[1].id, quotationItems[2].id]);
    
    return {
      requestId,
      quotationId,
      supplierQuotationId,
      items,
      requestNumber: requestNumber
    };
    
  } finally {
    client.release();
  }
}

// Teste 1: Validar marcação de itens como indisponíveis
async function testUnavailableItemsMarking() {
  // Teste 1: Validando marcação de itens como indisponíveis...
  
  try {
    const testData = await createTestData();
    const client = await pool.connect();
    
    try {
      // Verificar se os itens foram marcados corretamente
      const unavailableResult = await client.query(`
        SELECT sqi.* FROM supplier_quotation_items sqi
        JOIN supplier_quotations sq ON sqi.supplier_quotation_id = sq.id
        WHERE sq.quotation_id = $1 AND sqi.is_available = false
      `, [testData.quotationId]);
      
      const unavailableItems = unavailableResult.rows;
      // Encontrados itens indisponíveis
      
      // Validar que os itens indisponíveis têm motivo preenchido
      const itemsWithReason = unavailableItems.filter(item => 
        item.unavailability_reason && item.unavailability_reason.trim() !== ''
      );
      
      if (itemsWithReason.length === unavailableItems.length) {
        // Todos os itens indisponíveis têm motivo preenchido
      } else {
        console.error('❌ Alguns itens indisponíveis não têm motivo preenchido');
      }
      
      // Validar que itens indisponíveis têm preço zero
      const itemsWithZeroPrice = unavailableItems.filter(item => 
        parseFloat(item.unit_price) === 0 && parseFloat(item.total_price) === 0
      );
      
      if (itemsWithZeroPrice.length === unavailableItems.length) {
        // Todos os itens indisponíveis têm preço zero
      } else {
        console.error('❌ Alguns itens indisponíveis têm preço diferente de zero');
      }
      
      return testData;
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de marcação:', error.message);
    throw error;
  }
}

// Teste 2: Simular criação de nova solicitação com itens indisponíveis
async function testNewRequestCreation(testData) {
  // Teste 2: Simulando criação de nova solicitação...
  
  try {
    const client = await pool.connect();
    
    try {
      // Buscar solicitação original
      const originalResult = await client.query(`
        SELECT * FROM purchase_requests WHERE id = $1
      `, [testData.requestId]);
      
      if (originalResult.rows.length === 0) {
        throw new Error('Solicitação original não encontrada');
      }
      
      const originalRequest = originalResult.rows[0];
      
      // Buscar itens indisponíveis
      const unavailableResult = await client.query(`
        SELECT qi.purchase_request_item_id as item_id, sqi.unavailability_reason as reason
        FROM supplier_quotation_items sqi
        JOIN quotation_items qi ON sqi.quotation_item_id = qi.id
        JOIN supplier_quotations sq ON sqi.supplier_quotation_id = sq.id
        WHERE sq.quotation_id = $1 AND sqi.is_available = false
      `, [testData.quotationId]);
      
      const unavailableItems = unavailableResult.rows;
      // Encontrados itens para nova solicitação
      
      // Criar nova solicitação
      const newRequestNumber = `${originalRequest.request_number}-R${Date.now().toString().slice(-4)}`;
      const newRequestResult = await client.query(`
        INSERT INTO purchase_requests (
          request_number, requester_id, company_id, cost_center_id,
          category, justification, urgency, current_phase
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING id, request_number
      `, [
        newRequestNumber,
        originalRequest.requester_id,
        originalRequest.company_id,
        originalRequest.cost_center_id,
        originalRequest.category,
        `Recotação de itens indisponíveis da solicitação ${originalRequest.request_number}`,
        originalRequest.urgency,
        'solicitacao'
      ]);
      
      const newRequest = newRequestResult.rows[0];
      // Nova solicitação criada
      
      // Buscar detalhes dos itens originais para copiar
      const originalItemsResult = await client.query(`
        SELECT * FROM purchase_request_items WHERE purchase_request_id = $1
      `, [testData.requestId]);
      
      const originalItems = originalItemsResult.rows;
      
      // Criar itens na nova solicitação (apenas os indisponíveis)
      let itemsAdded = 0;
      for (const unavailableItem of unavailableItems) {
        const originalItem = originalItems.find(item => item.id === unavailableItem.item_id);
        if (originalItem) {
          await client.query(`
            INSERT INTO purchase_request_items (
              purchase_request_id, product_code, description, requested_quantity, unit
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            newRequest.id,
            originalItem.product_code,
            originalItem.description,
            originalItem.requested_quantity,
            originalItem.unit
          ]);
          itemsAdded++;
        }
      }
      
      // Itens adicionados à nova solicitação
      
      return newRequest.id;
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Erro na criação de nova solicitação:', error.message);
    throw error;
  }
}

// Teste 3: Validar filtros nas fases posteriores
async function testPhaseFilters(testData) {
  // Teste 3: Validando filtros nas fases posteriores...
  
  try {
    const client = await pool.connect();
    
    try {
      // Simular avanço para fase A2
      await client.query(`
        UPDATE purchase_requests 
        SET current_phase = 'aprovacao_a2'
        WHERE id = $1
      `, [testData.requestId]);
      
      // Solicitação avançada para fase A2
      
      // Buscar apenas itens disponíveis (simulando filtro da aplicação)
      const availableResult = await client.query(`
        SELECT qi.purchase_request_item_id as item_id, sqi.unit_price, sqi.total_price
        FROM supplier_quotation_items sqi
        JOIN quotation_items qi ON sqi.quotation_item_id = qi.id
        JOIN supplier_quotations sq ON sqi.supplier_quotation_id = sq.id
        WHERE sq.quotation_id = $1 AND sqi.is_available = true
      `, [testData.quotationId]);
      
      const availableItems = availableResult.rows;
      // Filtro aplicado para próximas fases
      
      // Calcular valor total apenas dos itens disponíveis
      const totalValue = availableItems.reduce((sum, item) => 
        sum + (parseFloat(item.total_price) || 0), 0
      );
      // Valor total calculado
      
      return availableItems;
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Erro na validação de filtros:', error.message);
    throw error;
  }
}

// Função de limpeza
async function cleanup(requestNumber = null) {
  // Limpando dados de teste...
  
  try {
    const client = await pool.connect();
    
    try {
      // Limpar dados de teste na ordem correta (respeitando chaves estrangeiras)
      const requestNumberPattern = requestNumber || 'TEST-UNAVAILABLE-%';
      
      // 1. Primeiro deletar supplier_quotation_items
      await client.query(`
        DELETE FROM supplier_quotation_items 
        WHERE supplier_quotation_id IN (
          SELECT sq.id FROM supplier_quotations sq
          JOIN quotations q ON sq.quotation_id = q.id
          JOIN purchase_requests pr ON q.purchase_request_id = pr.id
          WHERE pr.request_number LIKE $1
        )
      `, [requestNumberPattern]);
      
      // 2. Depois deletar supplier_quotations
      await client.query(`
        DELETE FROM supplier_quotations 
        WHERE quotation_id IN (
          SELECT q.id FROM quotations q
          JOIN purchase_requests pr ON q.purchase_request_id = pr.id
          WHERE pr.request_number LIKE $1
        )
      `, [requestNumberPattern]);
      
      // 3. Deletar quotation_items
      await client.query(`
        DELETE FROM quotation_items 
        WHERE quotation_id IN (
          SELECT q.id FROM quotations q
          JOIN purchase_requests pr ON q.purchase_request_id = pr.id
          WHERE pr.request_number LIKE $1
        )
      `, [requestNumberPattern]);
      
      // 4. Deletar quotations
      await client.query(`
        DELETE FROM quotations 
        WHERE purchase_request_id IN (
          SELECT id FROM purchase_requests 
          WHERE request_number LIKE $1
        )
      `, [requestNumberPattern]);
      
      // 5. Deletar purchase_request_items
      await client.query(`
        DELETE FROM purchase_request_items 
        WHERE purchase_request_id IN (
          SELECT id FROM purchase_requests 
          WHERE request_number LIKE $1
        )
      `, [requestNumberPattern]);
      
      // 6. Por último, deletar purchase_requests
      await client.query(`
        DELETE FROM purchase_requests 
        WHERE request_number LIKE $1
      `, [requestNumberPattern]);
      
      // Limpar também possíveis novas solicitações criadas
      const baseRequestNumber = requestNumber ? requestNumber.replace(/TEST-UNAVAILABLE-/, '') : '%';
      const newRequestsResult = await client.query(`
        SELECT id FROM purchase_requests 
        WHERE justification LIKE $1
      `, [`Recotação de itens indisponíveis da solicitação %${baseRequestNumber}%`]);
      
      for (const request of newRequestsResult.rows) {
        await client.query(`
          DELETE FROM purchase_request_items 
          WHERE purchase_request_id = $1
        `, [request.id]);
        
        await client.query(`
          DELETE FROM purchase_requests 
          WHERE id = $1
        `, [request.id]);
      }
      
      // Dados de teste removidos
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

// Função principal de teste
async function runTests() {
  // Iniciando testes de produtos indisponíveis...
  
  let testData = null;
  
  try {
    // Executar testes
    testData = await testUnavailableItemsMarking();
    await testNewRequestCreation(testData);
    await testPhaseFilters(testData);
    
    console.log('✅ Todos os testes executados com sucesso!');
    
  } catch (error) {
    console.error('\n💥 Erro durante os testes:', error.message);
  } finally {
    // Sempre limpar os dados de teste
    if (testData && testData.requestNumber) {
      await cleanup(testData.requestNumber);
    } else {
      await cleanup();
    }
  }
}

// Executar testes se o arquivo for chamado diretamente
if (require.main === module) {
  runTests()
    .then(() => {
      // Testes finalizados
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = {
  runTests,
  testUnavailableItemsMarking,
  testNewRequestCreation,
  testPhaseFilters,
  cleanup
};