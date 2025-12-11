#!/usr/bin/env node

/**
 * Script para aplicar a migração de Purchase Orders no banco de desenvolvimento
 * Este script deve ser executado para ativar a funcionalidade de Purchase Orders
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL_DEV = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || "postgres://compras:Compras2025@54.232.194.197:5432/locador_compras";

async function applyMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL_DEV
  });

  try {
    console.log('🔄 Conectando ao banco de desenvolvimento...');

    const filesArg = process.argv.find(a => a.startsWith('--files=')) || process.argv.find(a => a.startsWith('--file='));
    const filesList = filesArg ? filesArg.split('=')[1].split(',').map(f => f.trim()).filter(Boolean) : ['0005_add_purchase_order_indexes.sql'];

    for (const file of filesList) {
      const migrationPath = path.isAbsolute(file) ? file : path.join(__dirname, '..', 'migrations', file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log(`📄 Aplicando migração ${path.basename(migrationPath)}...`);
      await pool.query(migrationSQL);
      console.log(`✅ Migração ${path.basename(migrationPath)} aplicada com sucesso!`);
    }
    
    // Verificar se as tabelas estão funcionando
    console.log('🔍 Verificando estrutura das tabelas...');
    
    const tablesCheck = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name IN ('purchase_orders', 'purchase_order_items')
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log('📊 Estrutura das tabelas:');
    console.table(tablesCheck.rows);
    
    // Verificar índices criados
    const indexesCheck = await pool.query(`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes 
      WHERE tablename IN ('purchase_orders', 'purchase_order_items')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `);
    
    console.log('🔗 Índices criados:');
    console.table(indexesCheck.rows);
    
    // Verificar contagem atual das tabelas
    const countCheck = await pool.query(`
      SELECT 
        'purchase_orders' as table_name,
        COUNT(*) as row_count
      FROM purchase_orders
      UNION ALL
      SELECT 
        'purchase_order_items' as table_name,
        COUNT(*) as row_count
      FROM purchase_order_items;
    `);
    
    console.log('📈 Contagem atual das tabelas:');
    console.table(countCheck.rows);
    
    console.log('\n🎉 Migrações aplicadas com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('1. Reinicie o servidor de desenvolvimento se necessário');
    console.log('2. Valide a estrutura alterada e fluxos impactados');
  
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar o script
applyMigration().catch(console.error);
