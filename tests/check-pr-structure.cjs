const { Client } = require('pg');

async function checkPurchaseRequestsStructure() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');
    
    // Verificar estrutura da tabela purchase_requests
    console.log('\n📋 ESTRUTURA DA TABELA PURCHASE_REQUESTS:');
    console.log('='.repeat(50));
    
    const columnsResult = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'purchase_requests' 
      ORDER BY ordinal_position;
    `);
    
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // Verificar dados das solicitações específicas
    console.log('\n🔍 DADOS DAS SOLICITAÇÕES SOL-2025-330 e SOL-2025-329:');
    console.log('='.repeat(50));
    
    const requestsResult = await client.query(`
      SELECT *
      FROM purchase_requests 
      WHERE request_number IN ('SOL-2025-330', 'SOL-2025-329')
      ORDER BY request_number;
    `);
    
    if (requestsResult.rows.length === 0) {
      console.log('❌ Nenhuma solicitação encontrada');
    } else {
      requestsResult.rows.forEach(request => {
        console.log(`📋 ${request.request_number}:`);
        Object.entries(request).forEach(([key, value]) => {
          console.log(`   - ${key}: ${value}`);
        });
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error);
  } finally {
    await client.end();
  }
}

checkPurchaseRequestsStructure();