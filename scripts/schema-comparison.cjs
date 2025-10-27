const fs = require('fs');

console.log('🚀 Iniciando análise de comparação de schemas...');

// Análise das tabelas do banco de dados
const databaseTables = [
  'approval_configurations',
  'approval_history', 
  'attachments',
  'audit_logs',
  'companies',
  'configuration_history',
  'cost_centers',
  'delivery_locations',
  'departments',
  'payment_methods',
  'purchase_order_items',
  'purchase_orders',
  'purchase_request_items',
  'purchase_requests',
  'quantity_adjustment_history',
  'quotation_items',
  'quotations',
  'receipt_items',
  'receipts',
  'session',
  'sessions',
  'supplier_quotation_items',
  'supplier_quotations',
  'suppliers',
  'test_table',
  'user_cost_centers',
  'user_departments',
  'users'
];

// Tabelas definidas no schema.ts
const schemaTables = [
  'sessions',
  'companies',
  'users',
  'departments',
  'costCenters', // cost_centers no banco
  'userDepartments', // user_departments no banco
  'userCostCenters', // user_cost_centers no banco
  'suppliers',
  'paymentMethods', // payment_methods no banco
  'purchaseRequests', // purchase_requests no banco
  'purchaseRequestItems', // purchase_request_items no banco
  'approvalHistory', // approval_history no banco
  'attachments',
  'deliveryLocations', // delivery_locations no banco
  'quotations',
  'quotationItems', // quotation_items no banco
  'supplierQuotations', // supplier_quotations no banco
  'supplierQuotationItems', // supplier_quotation_items no banco
  'quantityAdjustmentHistory', // quantity_adjustment_history no banco
  'purchaseOrders', // purchase_orders no banco
  'purchaseOrderItems', // purchase_order_items no banco
  'receipts',
  'receiptItems', // receipt_items no banco
  'approvalConfigurations', // approval_configurations no banco
  'configurationHistory' // configuration_history no banco
];

function convertCamelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertSnakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

function compareSchemas() {
  console.log('🔍 COMPARAÇÃO ENTRE SCHEMA.TS E BANCO DE DADOS');
  console.log('='.repeat(60));
  
  // Converter nomes do schema para snake_case para comparação
  const schemaTablesSnakeCase = schemaTables.map(table => convertCamelToSnake(table));
  
  console.log('\n📊 TABELAS NO SCHEMA.TS (convertidas para snake_case):');
  console.log('-'.repeat(50));
  schemaTablesSnakeCase.forEach((table, index) => {
    console.log(`${index + 1}. ${table} (${schemaTables[index]})`);
  });
  
  console.log('\n📊 TABELAS NO BANCO DE DADOS:');
  console.log('-'.repeat(50));
  databaseTables.forEach((table, index) => {
    console.log(`${index + 1}. ${table}`);
  });
  
  // Encontrar tabelas que estão no schema mas não no banco
  console.log('\n❌ TABELAS DEFINIDAS NO SCHEMA MAS NÃO EXISTEM NO BANCO:');
  console.log('-'.repeat(50));
  const missingInDatabase = schemaTablesSnakeCase.filter(table => !databaseTables.includes(table));
  if (missingInDatabase.length === 0) {
    console.log('✅ Todas as tabelas do schema existem no banco de dados');
  } else {
    missingInDatabase.forEach((table, index) => {
      const originalName = schemaTables[schemaTablesSnakeCase.indexOf(table)];
      console.log(`${index + 1}. ${table} (${originalName})`);
    });
  }
  
  // Encontrar tabelas que estão no banco mas não no schema
  console.log('\n⚠️  TABELAS NO BANCO MAS NÃO DEFINIDAS NO SCHEMA:');
  console.log('-'.repeat(50));
  const missingInSchema = databaseTables.filter(table => !schemaTablesSnakeCase.includes(table));
  if (missingInSchema.length === 0) {
    console.log('✅ Todas as tabelas do banco estão definidas no schema');
  } else {
    missingInSchema.forEach((table, index) => {
      console.log(`${index + 1}. ${table}`);
    });
  }
  
  // Tabelas que coincidem
  console.log('\n✅ TABELAS QUE COINCIDEM (SCHEMA ↔ BANCO):');
  console.log('-'.repeat(50));
  const matchingTables = schemaTablesSnakeCase.filter(table => databaseTables.includes(table));
  matchingTables.forEach((table, index) => {
    const originalName = schemaTables[schemaTablesSnakeCase.indexOf(table)];
    console.log(`${index + 1}. ${table} (${originalName})`);
  });
  
  console.log('\n📈 RESUMO DA COMPARAÇÃO:');
  console.log('-'.repeat(50));
  console.log(`Total de tabelas no schema: ${schemaTables.length}`);
  console.log(`Total de tabelas no banco: ${databaseTables.length}`);
  console.log(`Tabelas coincidentes: ${matchingTables.length}`);
  console.log(`Tabelas faltando no banco: ${missingInDatabase.length}`);
  console.log(`Tabelas extras no banco: ${missingInSchema.length}`);
  
  // Análise específica das tabelas extras
  console.log('\n🔍 ANÁLISE DAS TABELAS EXTRAS NO BANCO:');
  console.log('-'.repeat(50));
  
  if (missingInSchema.includes('audit_logs')) {
    console.log('• audit_logs: Tabela de auditoria - provavelmente criada por migration específica');
  }
  
  if (missingInSchema.includes('session')) {
    console.log('• session: Tabela de sessões (diferente de "sessions") - possível duplicação');
  }
  
  if (missingInSchema.includes('test_table')) {
    console.log('• test_table: Tabela de teste - pode ser removida em produção');
  }
  
  // Verificar se há problemas críticos
  console.log('\n🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS:');
  console.log('-'.repeat(50));
  
  let criticalIssues = 0;
  
  if (missingInDatabase.length > 0) {
    console.log(`❌ ${missingInDatabase.length} tabela(s) definida(s) no schema não existe(m) no banco`);
    criticalIssues++;
  }
  
  if (missingInSchema.includes('session') && schemaTablesSnakeCase.includes('sessions')) {
    console.log('⚠️  Possível duplicação de tabelas de sessão (session vs sessions)');
    criticalIssues++;
  }
  
  if (criticalIssues === 0) {
    console.log('✅ Nenhum problema crítico identificado');
  }
  
  console.log('\n✅ Análise de comparação concluída!');
}

try {
  compareSchemas();
} catch (error) {
  console.error('❌ Erro durante a análise:', error);
  process.exit(1);
}