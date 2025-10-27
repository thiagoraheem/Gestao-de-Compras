const { Client } = require('pg');

async function checkDatabase() {
  const client = new Client({
    connectionString: "postgres://compras:Compras2025@54.232.194.197:5432/locador_compras"
  });

  try {
    console.log('🔄 Tentando conectar ao banco de dados PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado ao banco de dados PostgreSQL');
    
    // 1. Listar todas as tabelas
    console.log('\n📋 TABELAS EXISTENTES NO BANCO:');
    console.log('='.repeat(50));
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table}`);
    });
    
    console.log(`\nTotal de tabelas: ${tables.length}`);
    
    // 2. Para cada tabela, obter estrutura detalhada
    console.log('\n🔍 ESTRUTURA DETALHADA DAS TABELAS:');
    console.log('='.repeat(50));
    
    for (const tableName of tables) {
      console.log(`\n📊 TABELA: ${tableName.toUpperCase()}`);
      console.log('-'.repeat(30));
      
      // Obter colunas
      const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position;
      `, [tableName]);
      
      console.log('Colunas:');
      columnsResult.rows.forEach(col => {
        let typeInfo = col.data_type;
        if (col.character_maximum_length) {
          typeInfo += `(${col.character_maximum_length})`;
        } else if (col.numeric_precision && col.numeric_scale) {
          typeInfo += `(${col.numeric_precision},${col.numeric_scale})`;
        }
        
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        
        console.log(`  - ${col.column_name}: ${typeInfo} ${nullable}${defaultVal}`);
      });
      
      // Obter constraints (chaves primárias, estrangeiras, etc.)
      const constraintsResult = await client.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = $1
        ORDER BY tc.constraint_type, tc.constraint_name;
      `, [tableName]);
      
      if (constraintsResult.rows.length > 0) {
        console.log('Constraints:');
        constraintsResult.rows.forEach(constraint => {
          let constraintInfo = `  - ${constraint.constraint_type}: ${constraint.constraint_name}`;
          if (constraint.column_name) {
            constraintInfo += ` (${constraint.column_name})`;
          }
          if (constraint.foreign_table_name) {
            constraintInfo += ` -> ${constraint.foreign_table_name}(${constraint.foreign_column_name})`;
          }
          console.log(constraintInfo);
        });
      }
    }
    
    // 3. Verificar índices
    console.log('\n🔗 ÍNDICES EXISTENTES:');
    console.log('='.repeat(50));
    
    const indexesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    
    let currentTable = '';
    indexesResult.rows.forEach(idx => {
      if (idx.tablename !== currentTable) {
        console.log(`\n📊 ${idx.tablename.toUpperCase()}:`);
        currentTable = idx.tablename;
      }
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });
    
    console.log('\n✅ Análise do banco de dados concluída!');
    
  } catch (error) {
    console.error('❌ Erro ao conectar/consultar banco de dados:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    try {
      await client.end();
      console.log('🔌 Conexão com banco de dados encerrada');
    } catch (err) {
      console.error('Erro ao fechar conexão:', err.message);
    }
  }
}

console.log('🚀 Iniciando análise do banco de dados...');
checkDatabase();