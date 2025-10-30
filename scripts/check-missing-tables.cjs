// Set environment to use development database
process.env.NODE_ENV = 'development';

// Configuração manual do banco para CommonJS
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');

// Configuração do banco
const databaseUrl = process.env.DATABASE_URL_DEV || 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

console.log('Conectando ao banco:', databaseUrl.replace(/:[^:]*@/, ':****@'));

const pool = new Pool({
    connectionString: databaseUrl
});

const db = drizzle(pool);

// Tabelas esperadas baseadas no schema.ts
const expectedTables = [
    'sessions',
    'companies',
    'users',
    'departments',
    'cost_centers',
    'user_departments',
    'user_cost_centers',
    'suppliers',
    'payment_methods',
    'purchase_requests',
    'purchase_request_items',
    'approval_history',
    'attachments',
    'delivery_locations',
    'quotations',
    'quotation_items',
    'supplier_quotations',
    'supplier_quotation_items',
    'quantity_adjustment_history',
    'quotation_version_history',
    'purchase_orders',
    'purchase_order_items',
    'receipts',
    'receipt_items',
    'approval_configurations',
    'configuration_history',
    'audit_logs',
    'detailed_audit_log'
];

async function checkMissingTables() {
    try {
        console.log('Verificando tabelas faltantes no banco de dados...\n');
        
        // Obter todas as tabelas existentes
        const existingTablesResult = await db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const existingTables = (existingTablesResult.rows || existingTablesResult).map(row => row.table_name);
        
        console.log('Tabelas existentes no banco:');
        existingTables.forEach(table => console.log('✓ ' + table));
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Verificar tabelas faltantes
        const missingTables = expectedTables.filter(table => !existingTables.includes(table));
        
        console.log('Tabelas faltantes (definidas no schema.ts mas não existem no banco):');
        if (missingTables.length > 0) {
            missingTables.forEach(table => console.log('✗ ' + table));
        } else {
            console.log('Nenhuma tabela faltante encontrada.');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Verificar tabelas extras (existem no banco mas não no schema)
        const extraTables = existingTables.filter(table => !expectedTables.includes(table));
        
        console.log('Tabelas extras (existem no banco mas não estão definidas no schema.ts):');
        if (extraTables.length > 0) {
            extraTables.forEach(table => console.log('? ' + table));
        } else {
            console.log('Nenhuma tabela extra encontrada.');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Verificar colunas específicas que foram adicionadas nas migrações mais recentes
        console.log('Verificando colunas específicas adicionadas nas migrações recentes...\n');
        
        // Verificar se a tabela detailed_audit_log existe
        const detailedAuditLogExists = existingTables.includes('detailed_audit_log');
        console.log('Tabela detailed_audit_log existe:', detailedAuditLogExists ? 'SIM' : 'NÃO');
        
        // Verificar colunas de aprovação dupla em users
        if (existingTables.includes('users')) {
            const userColumnsResult = await db.execute(sql`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
                AND column_name IN ('is_ceo', 'is_director')
                ORDER BY column_name
            `);
            
            const userColumns = userColumnsResult.rows || userColumnsResult;
            
            console.log('\nColunas de aprovação dupla em users:');
            if (userColumns.length > 0) {
                userColumns.forEach(col => {
                    console.log(`✓ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
                });
            } else {
                console.log('✗ Colunas is_ceo e is_director não encontradas');
            }
        }
        
        // Verificar colunas de aprovação dupla em purchase_requests
        if (existingTables.includes('purchase_requests')) {
            const prColumnsResult = await db.execute(sql`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'purchase_requests'
                AND column_name IN ('requires_dual_approval', 'first_approver_a2_id', 'final_approver_id', 'first_approval_date', 'final_approval_date', 'approval_configuration_id')
                ORDER BY column_name
            `);
            
            const prColumns = prColumnsResult.rows || prColumnsResult;
            
            console.log('\nColunas de aprovação dupla em purchase_requests:');
            if (prColumns.length > 0) {
                prColumns.forEach(col => {
                    console.log(`✓ ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
                });
            } else {
                console.log('✗ Colunas de aprovação dupla não encontradas');
            }
        }
        
        // Verificar funções e triggers específicos
        console.log('\n' + '='.repeat(60) + '\n');
        console.log('Verificando funções e triggers específicos...\n');
        
        const functionsResult = await db.execute(sql`
            SELECT routine_name, routine_type
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name IN ('calculate_fulfillment_percentage', 'log_quantity_adjustment', 'get_audit_context', 'audit_trigger_function', 'atomic_update_supplier_quotation_quantities')
            ORDER BY routine_name
        `);
        
        const functions = functionsResult.rows || functionsResult;
        
        console.log('Funções específicas:');
        if (functions.length > 0) {
            functions.forEach(func => {
                console.log(`✓ ${func.routine_name} (${func.routine_type})`);
            });
        } else {
            console.log('✗ Nenhuma função específica encontrada');
        }
        
        // Verificar triggers
        const triggersResult = await db.execute(sql`
            SELECT trigger_name, event_object_table, action_timing, event_manipulation
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public'
            ORDER BY trigger_name
        `);
        
        const triggers = triggersResult.rows || triggersResult;
        
        console.log('\nTriggers encontrados:');
        if (triggers.length > 0) {
            triggers.forEach(trigger => {
                console.log(`✓ ${trigger.trigger_name} on ${trigger.event_object_table} (${trigger.action_timing} ${trigger.event_manipulation})`);
            });
        } else {
            console.log('✗ Nenhum trigger encontrado');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        console.log('Resumo da análise:');
        console.log(`- Tabelas existentes: ${existingTables.length}`);
        console.log(`- Tabelas esperadas: ${expectedTables.length}`);
        console.log(`- Tabelas faltantes: ${missingTables.length}`);
        console.log(`- Tabelas extras: ${extraTables.length}`);
        console.log(`- Funções encontradas: ${functions.length}`);
        console.log(`- Triggers encontrados: ${triggers.length}`);
        
    } catch (error) {
        console.error('Erro ao verificar tabelas:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkMissingTables();