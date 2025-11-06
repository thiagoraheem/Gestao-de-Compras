#!/usr/bin/env node

/**
 * Executa a migração de integração de fornecedores corrigida.
 *
 * Funcionalidades:
 * - Lê variáveis de ambiente do arquivo .env
 * - Usa `DATABASE_URL_DEV` em desenvolvimento e `DATABASE_URL` em produção
 * - Executa o script SQL `db_scripts/migration_integracao_fornecedores_fixed.sql`
 * - Trata erros e fornece logs claros
 * - Opcionalmente ignora comandos GRANT se o papel `authenticated` não existir
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Carrega .env (se existir)
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = isProduction ? process.env.DATABASE_URL : process.env.DATABASE_URL_DEV;

async function main() {
  console.log('== Integração de Fornecedores: Execução de Migração ==');

  // Validação do .env e variáveis necessárias
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️ Arquivo .env não encontrado na raiz do projeto.');
    console.warn('   Copie .env.example para .env e configure as variáveis necessárias.');
  }

  if (!dbUrl) {
    console.error('❌ URL do banco não encontrada. Defina `DATABASE_URL_DEV` (dev) ou `DATABASE_URL` (prod) no .env.');
    process.exit(1);
  }

  // Caminho do script SQL
  const sqlFilePath = path.resolve(__dirname, '..', 'db_scripts', 'migration_integracao_fornecedores_fixed.sql');
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ Script SQL não encontrado em: ${sqlFilePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  // Configuração do pool de conexão
  const poolConfig = isProduction
    ? { connectionString: dbUrl, ssl: { rejectUnauthorized: false } }
    : { connectionString: dbUrl };

  const pool = new Pool(poolConfig);
  const client = await pool.connect();

  try {
    console.log('🔌 Conectado ao banco com sucesso. Ambiente:', isProduction ? 'production' : 'development');

    // Verificar existência do papel 'authenticated' para evitar falhas nos GRANT
    const roleCheck = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'");
    const hasAuthenticatedRole = roleCheck.rowCount > 0;

    let processedSql = sqlContent;
    if (!hasAuthenticatedRole) {
      console.warn('⚠️ Papel `authenticated` não encontrado. Comandos GRANT serão ignorados.');
      processedSql = processedSql.replace(/^GRANT\s+.+\s+TO\s+authenticated;$/gmi, '-- skipped: authenticated role not found');
    }

    console.log('▶️ Executando migração...');
    await client.query(processedSql);

    // Validação leve: conferir se as tabelas foram criadas
    const checkTables = await client.query(
      `SELECT t.table_name FROM information_schema.tables t
       WHERE t.table_schema = 'public'
       AND t.table_name IN (
         'supplier_integration_control',
         'supplier_integration_history',
         'supplier_integration_queue'
       )`
    );

    const created = checkTables.rows.map(r => r.table_name);
    if (created.length === 3) {
      console.log('✅ Migração concluída. Tabelas criadas:', created.join(', '));
    } else {
      console.warn('⚠️ Migração executada, mas nem todas as tabelas foram detectadas:', created.join(', '));
    }

    console.log('🎉 Tudo certo! Você pode reiniciar o servidor e testar as rotas de integração.');
  } catch (err) {
    console.error('❌ Erro durante a migração:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}