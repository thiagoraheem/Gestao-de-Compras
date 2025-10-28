// Set environment to use development database
process.env.NODE_ENV = 'development';

// Configuração manual do banco para CommonJS
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { sql } = require('drizzle-orm');

// Configuração do banco
const databaseUrl = process.env.DATABASE_URL_DEV || 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

const pool = new Pool({
    connectionString: databaseUrl
});

const db = drizzle(pool);

async function checkTables() {
    try {
        console.log('Verificando tabelas existentes no banco de dados...\n');
        
        // Verificar todas as tabelas
        const allTablesResult = await db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const allTables = allTablesResult.rows || allTablesResult;
        
        console.log('Todas as tabelas encontradas:');
        allTables.forEach(row => console.log('- ' + row.table_name));
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Verificar tabelas relacionadas a quotation
        const quotationTablesResult = await db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%quotation%'
            ORDER BY table_name
        `);
        
        const quotationTables = quotationTablesResult.rows || quotationTablesResult;
        
        console.log('Tabelas relacionadas a quotation:');
        if (quotationTables.length > 0) {
            quotationTables.forEach(row => console.log('- ' + row.table_name));
        } else {
            console.log('Nenhuma tabela relacionada a quotation encontrada.');
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Verificar tabelas de auditoria
        const auditTablesResult = await db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%audit%' OR table_name LIKE '%history%')
            ORDER BY table_name
        `);
        
        const auditTables = auditTablesResult.rows || auditTablesResult;
        
        console.log('Tabelas de auditoria e histórico:');
        if (auditTables.length > 0) {
            auditTables.forEach(row => console.log('- ' + row.table_name));
        } else {
            console.log('Nenhuma tabela de auditoria encontrada.');
        }
        
        // Verificar se quotation_version_history existe
        const versionHistoryExistsResult = await db.execute(sql`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'quotation_version_history'
            ) as exists
        `);
        
        const versionHistoryExists = versionHistoryExistsResult.rows || versionHistoryExistsResult;
        
        console.log('\n' + '='.repeat(50) + '\n');
        console.log('Tabela quotation_version_history existe:', versionHistoryExists[0].exists ? 'SIM' : 'NÃO');
        
        // Verificar colunas específicas que foram adicionadas recentemente
        console.log('\n' + '='.repeat(50) + '\n');
        console.log('Verificando colunas específicas...\n');
        
        // Verificar colunas de supplier_quotation_items
        const supplierQuotationItemsColumnsResult = await db.execute(sql`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'supplier_quotation_items'
            AND column_name IN ('available_quantity', 'confirmed_unit', 'quantity_adjustment_reason', 'fulfillment_percentage')
            ORDER BY column_name
        `);
        
        const supplierQuotationItemsColumns = supplierQuotationItemsColumnsResult.rows || supplierQuotationItemsColumnsResult;
        
        console.log('Colunas de gerenciamento de quantidade em supplier_quotation_items:');
        if (supplierQuotationItemsColumns.length > 0) {
            supplierQuotationItemsColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
            });
        } else {
            console.log('Nenhuma coluna de gerenciamento de quantidade encontrada.');
        }
        
    } catch (error) {
        console.error('Erro ao verificar tabelas:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

checkTables();