const { Client } = require('pg');

async function checkUsersTable() {
  const client = new Client({
    connectionString: 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');
    
    // Verificar estrutura da tabela users
    console.log('\n📋 ESTRUTURA DA TABELA USERS:');
    console.log('='.repeat(50));
    
    const columnsResult = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    console.log(`\nTotal de colunas: ${columnsResult.rows.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkUsersTable();