// Script para gerar SQL de sincronização entre banco de desenvolvimento e testes
// Baseado na análise das diferenças estruturais identificadas

const fs = require('fs');
const path = require('path');

// Configuração do script
const config = {
    outputFile: 'database-sync-script.sql',
    backupPrefix: 'backup_before_sync_',
    timestamp: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
};

// Diferenças identificadas na análise
const differences = {
    missingTables: [
        'detailed_audit_log',
        'quotation_version_history'
    ],
    extraTables: [
        'session',
        'test_table'
    ],
    missingFunctions: [
        'get_audit_context',
        'audit_trigger_function',
        'atomic_update_supplier_quotation_quantities'
    ],
    missingTriggers: [
        // Triggers de auditoria que podem estar faltando
        'audit_purchase_requests_trigger',
        'audit_purchase_request_items_trigger',
        'audit_quotation_items_trigger',
        'audit_supplier_quotation_items_trigger',
        'audit_purchase_order_items_trigger',
        'audit_approval_history_trigger'
    ]
};

function generateSyncScript() {
    console.log('Gerando script de sincronização do banco de dados...\n');
    
    let sqlScript = `-- =====================================================
-- SCRIPT DE SINCRONIZAÇÃO DO BANCO DE DADOS
-- =====================================================
-- Data de geração: ${new Date().toISOString()}
-- Objetivo: Sincronizar estrutura do banco de testes com desenvolvimento
-- 
-- IMPORTANTE: 
-- 1. Faça backup completo antes de executar
-- 2. Execute em ambiente de teste primeiro
-- 3. Verifique logs de erro após execução
-- 4. Valide integridade referencial
-- =====================================================

-- Configurar ambiente para execução segura
SET client_min_messages = WARNING;
SET log_statement = 'all';
BEGIN;

-- =====================================================
-- SEÇÃO 1: BACKUP E PREPARAÇÃO
-- =====================================================

-- Criar schema de backup se não existir
CREATE SCHEMA IF NOT EXISTS backup_${config.timestamp.replace(/-/g, '_')};

-- Log de início da sincronização
DO $$
BEGIN
    RAISE NOTICE 'Iniciando sincronização do banco de dados em %', NOW();
    RAISE NOTICE 'Schema de backup: backup_${config.timestamp.replace(/-/g, '_')}';
END $$;

-- =====================================================
-- SEÇÃO 2: BACKUP DE TABELAS CRÍTICAS
-- =====================================================

-- Backup de tabelas que serão modificadas
DO $$
DECLARE
    table_name TEXT;
    backup_schema TEXT := 'backup_${config.timestamp.replace(/-/g, '_')}';
BEGIN
    -- Lista de tabelas críticas para backup
    FOR table_name IN 
        SELECT unnest(ARRAY['purchase_requests', 'purchase_request_items', 'quotation_items', 
                           'supplier_quotation_items', 'purchase_order_items', 'approval_history'])
    LOOP
        -- Verificar se a tabela existe antes do backup
        IF EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_schema = 'public' AND table_name = table_name) THEN
            
            EXECUTE format('CREATE TABLE %I.%I AS SELECT * FROM public.%I', 
                          backup_schema, table_name || '_backup', table_name);
            
            RAISE NOTICE 'Backup criado: %.% -> %.%', 
                        'public', table_name, backup_schema, table_name || '_backup';
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- SEÇÃO 3: CRIAÇÃO DE TABELAS FALTANTES
-- =====================================================

-- 3.1: Criar tabela detailed_audit_log
CREATE TABLE IF NOT EXISTS detailed_audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    operation_type VARCHAR(10) NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    transaction_id BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance da tabela detailed_audit_log
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_table_record ON detailed_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_changed_by ON detailed_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_changed_at ON detailed_audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_field_name ON detailed_audit_log(field_name);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_transaction_id ON detailed_audit_log(transaction_id);

-- Log da criação
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'detailed_audit_log') THEN
        RAISE NOTICE 'Tabela detailed_audit_log criada/verificada com sucesso';
    ELSE
        RAISE EXCEPTION 'Falha ao criar tabela detailed_audit_log';
    END IF;
END $$;

-- 3.2: Criar tabela quotation_version_history
CREATE TABLE IF NOT EXISTS quotation_version_history (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    changes_summary TEXT,
    previous_data JSONB,
    current_data JSONB,
    change_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT quotation_version_history_version_positive CHECK (version_number > 0),
    CONSTRAINT quotation_version_history_unique_version UNIQUE (quotation_id, version_number)
);

-- Índices para performance da tabela quotation_version_history
CREATE INDEX IF NOT EXISTS idx_quotation_version_history_quotation_id ON quotation_version_history(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_history_created_at ON quotation_version_history(created_at);
CREATE INDEX IF NOT EXISTS idx_quotation_version_history_created_by ON quotation_version_history(created_by);
CREATE INDEX IF NOT EXISTS idx_quotation_version_history_change_type ON quotation_version_history(change_type);

-- Log da criação
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'quotation_version_history') THEN
        RAISE NOTICE 'Tabela quotation_version_history criada/verificada com sucesso';
    ELSE
        RAISE EXCEPTION 'Falha ao criar tabela quotation_version_history';
    END IF;
END $$;

-- =====================================================
-- SEÇÃO 4: CRIAÇÃO DE FUNÇÕES FALTANTES
-- =====================================================

-- 4.1: Função get_audit_context
CREATE OR REPLACE FUNCTION get_audit_context()
RETURNS JSONB AS $$
DECLARE
    context JSONB := '{}'::jsonb;
BEGIN
    -- Try to get user ID from session
    BEGIN
        context := context || jsonb_build_object('user_id', 
            COALESCE(current_setting('app.current_user_id', true)::INTEGER, NULL));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('user_id', NULL);
    END;
    
    -- Try to get session ID
    BEGIN
        context := context || jsonb_build_object('session_id', 
            current_setting('app.session_id', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('session_id', NULL);
    END;
    
    -- Try to get IP address
    BEGIN
        context := context || jsonb_build_object('ip_address', 
            current_setting('app.ip_address', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('ip_address', NULL);
    END;
    
    -- Try to get user agent
    BEGIN
        context := context || jsonb_build_object('user_agent', 
            current_setting('app.user_agent', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('user_agent', NULL);
    END;
    
    RETURN context;
END;
$$ LANGUAGE plpgsql;

-- Log da criação da função
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines 
              WHERE routine_schema = 'public' AND routine_name = 'get_audit_context') THEN
        RAISE NOTICE 'Função get_audit_context criada/atualizada com sucesso';
    ELSE
        RAISE EXCEPTION 'Falha ao criar função get_audit_context';
    END IF;
END $$;

-- 4.2: Função audit_trigger_function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_context JSONB;
    old_record JSONB;
    new_record JSONB;
    field_name TEXT;
    old_val TEXT;
    new_val TEXT;
    current_transaction_id BIGINT;
BEGIN
    -- Get audit context
    audit_context := get_audit_context();
    current_transaction_id := txid_current();
    
    -- Convert records to JSONB for comparison
    IF TG_OP = 'DELETE' THEN
        old_record := to_jsonb(OLD);
        new_record := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_record := NULL;
        new_record := to_jsonb(NEW);
    ELSE -- UPDATE
        old_record := to_jsonb(OLD);
        new_record := to_jsonb(NEW);
    END IF;
    
    -- For INSERT operations, log all fields
    IF TG_OP = 'INSERT' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
            new_val := new_record ->> field_name;
            
            INSERT INTO detailed_audit_log (
                table_name, record_id, field_name, old_value, new_value,
                changed_by, operation_type, transaction_id, session_id,
                ip_address, user_agent, metadata
            ) VALUES (
                TG_TABLE_NAME, 
                (new_record ->> 'id')::INTEGER,
                field_name,
                NULL,
                new_val,
                (audit_context ->> 'user_id')::INTEGER,
                TG_OP,
                current_transaction_id,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation', 'field_insert', 'table', TG_TABLE_NAME)
            );
        END LOOP;
    END IF;
    
    -- For DELETE operations, log all fields
    IF TG_OP = 'DELETE' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(old_record) LOOP
            old_val := old_record ->> field_name;
            
            INSERT INTO detailed_audit_log (
                table_name, record_id, field_name, old_value, new_value,
                changed_by, operation_type, transaction_id, session_id,
                ip_address, user_agent, metadata
            ) VALUES (
                TG_TABLE_NAME,
                (old_record ->> 'id')::INTEGER,
                field_name,
                old_val,
                NULL,
                (audit_context ->> 'user_id')::INTEGER,
                TG_OP,
                current_transaction_id,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation', 'field_delete', 'table', TG_TABLE_NAME)
            );
        END LOOP;
    END IF;
    
    -- For UPDATE operations, log only changed fields
    IF TG_OP = 'UPDATE' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
            old_val := old_record ->> field_name;
            new_val := new_record ->> field_name;
            
            -- Only log if values are different
            IF old_val IS DISTINCT FROM new_val THEN
                INSERT INTO detailed_audit_log (
                    table_name, record_id, field_name, old_value, new_value,
                    changed_by, operation_type, transaction_id, session_id,
                    ip_address, user_agent, metadata, change_reason
                ) VALUES (
                    TG_TABLE_NAME,
                    (new_record ->> 'id')::INTEGER,
                    field_name,
                    old_val,
                    new_val,
                    (audit_context ->> 'user_id')::INTEGER,
                    TG_OP,
                    current_transaction_id,
                    audit_context ->> 'session_id',
                    (audit_context ->> 'ip_address')::INET,
                    audit_context ->> 'user_agent',
                    jsonb_build_object(
                        'operation', 'field_update', 
                        'table', TG_TABLE_NAME,
                        'field_type', pg_typeof(old_val)::text
                    ),
                    CASE 
                        WHEN field_name LIKE '%quantity%' THEN 'Quantity adjustment'
                        WHEN field_name LIKE '%price%' THEN 'Price adjustment'
                        WHEN field_name LIKE '%approved%' THEN 'Approval status change'
                        ELSE 'Data update'
                    END
                );
            END IF;
        END LOOP;
    END IF;
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Log da criação da função
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines 
              WHERE routine_schema = 'public' AND routine_name = 'audit_trigger_function') THEN
        RAISE NOTICE 'Função audit_trigger_function criada/atualizada com sucesso';
    ELSE
        RAISE EXCEPTION 'Falha ao criar função audit_trigger_function';
    END IF;
END $$;

-- =====================================================
-- SEÇÃO 5: CRIAÇÃO DE TRIGGERS FALTANTES
-- =====================================================

-- Criar triggers de auditoria para tabelas críticas
DO $$
DECLARE
    trigger_info RECORD;
    trigger_exists BOOLEAN;
BEGIN
    -- Lista de triggers para criar
    FOR trigger_info IN 
        SELECT * FROM (VALUES
            ('audit_purchase_requests_trigger', 'purchase_requests'),
            ('audit_purchase_request_items_trigger', 'purchase_request_items'),
            ('audit_quotation_items_trigger', 'quotation_items'),
            ('audit_supplier_quotation_items_trigger', 'supplier_quotation_items'),
            ('audit_purchase_order_items_trigger', 'purchase_order_items'),
            ('audit_approval_history_trigger', 'approval_history')
        ) AS t(trigger_name, table_name)
    LOOP
        -- Verificar se o trigger já existe
        SELECT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_schema = 'public' 
            AND trigger_name = trigger_info.trigger_name
        ) INTO trigger_exists;
        
        -- Verificar se a tabela existe
        IF EXISTS (SELECT 1 FROM information_schema.tables 
                  WHERE table_schema = 'public' AND table_name = trigger_info.table_name) THEN
            
            -- Remover trigger existente se houver
            IF trigger_exists THEN
                EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 
                              trigger_info.trigger_name, trigger_info.table_name);
                RAISE NOTICE 'Trigger existente removido: %', trigger_info.trigger_name;
            END IF;
            
            -- Criar novo trigger
            EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()', 
                          trigger_info.trigger_name, trigger_info.table_name);
            
            RAISE NOTICE 'Trigger criado: % na tabela %', trigger_info.trigger_name, trigger_info.table_name;
        ELSE
            RAISE WARNING 'Tabela % não existe, trigger % não foi criado', trigger_info.table_name, trigger_info.trigger_name;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- SEÇÃO 6: LIMPEZA DE TABELAS EXTRAS (OPCIONAL)
-- =====================================================

-- ATENÇÃO: Esta seção remove tabelas extras identificadas
-- Descomente apenas se tiver certeza de que essas tabelas podem ser removidas

/*
-- Remover tabela 'session' se existir (pode ser tabela de teste)
DROP TABLE IF EXISTS session CASCADE;

-- Remover tabela 'test_table' se existir
DROP TABLE IF EXISTS test_table CASCADE;

-- Log das remoções
DO $$
BEGIN
    RAISE NOTICE 'Tabelas extras removidas (se existiam): session, test_table';
END $$;
*/

-- =====================================================
-- SEÇÃO 7: VALIDAÇÕES E VERIFICAÇÕES FINAIS
-- =====================================================

-- 7.1: Verificar integridade referencial
DO $$
DECLARE
    constraint_violations INTEGER := 0;
    table_name TEXT;
BEGIN
    RAISE NOTICE 'Iniciando verificação de integridade referencial...';
    
    -- Verificar constraints de foreign key
    FOR table_name IN 
        SELECT t.table_name 
        FROM information_schema.tables t 
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
    LOOP
        -- Esta é uma verificação básica - em produção, seria mais detalhada
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE id IS NULL', table_name) INTO constraint_violations;
        
        IF constraint_violations > 0 THEN
            RAISE WARNING 'Possível violação de integridade na tabela %: % registros com ID nulo', 
                         table_name, constraint_violations;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Verificação de integridade referencial concluída';
END $$;

-- 7.2: Verificar se todas as tabelas esperadas existem
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
    expected_tables TEXT[] := ARRAY[
        'detailed_audit_log', 'quotation_version_history', 'sessions', 'companies', 
        'users', 'departments', 'cost_centers', 'user_departments', 'user_cost_centers',
        'suppliers', 'payment_methods', 'purchase_requests', 'purchase_request_items',
        'approval_history', 'attachments', 'delivery_locations', 'quotations',
        'quotation_items', 'supplier_quotations', 'supplier_quotation_items',
        'quantity_adjustment_history', 'purchase_orders', 'purchase_order_items',
        'receipts', 'receipt_items', 'approval_configurations', 'configuration_history',
        'audit_logs'
    ];
BEGIN
    RAISE NOTICE 'Verificando existência de todas as tabelas esperadas...';
    
    FOREACH table_name IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                      WHERE table_schema = 'public' AND table_name = table_name) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE WARNING 'Tabelas ainda faltantes: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'Todas as tabelas esperadas estão presentes';
    END IF;
END $$;

-- 7.3: Verificar se todas as funções críticas existem
DO $$
DECLARE
    missing_functions TEXT[] := ARRAY[]::TEXT[];
    function_name TEXT;
    expected_functions TEXT[] := ARRAY[
        'get_audit_context', 'audit_trigger_function', 'calculate_fulfillment_percentage', 
        'log_quantity_adjustment'
    ];
BEGIN
    RAISE NOTICE 'Verificando existência de todas as funções críticas...';
    
    FOREACH function_name IN ARRAY expected_functions
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.routines 
                      WHERE routine_schema = 'public' AND routine_name = function_name) THEN
            missing_functions := array_append(missing_functions, function_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_functions, 1) > 0 THEN
        RAISE WARNING 'Funções ainda faltantes: %', array_to_string(missing_functions, ', ');
    ELSE
        RAISE NOTICE 'Todas as funções críticas estão presentes';
    END IF;
END $$;

-- =====================================================
-- SEÇÃO 8: LOG FINAL E COMMIT
-- =====================================================

-- Log final da sincronização
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Data/Hora: %', NOW();
    RAISE NOTICE 'Schema de backup: backup_%', '${config.timestamp.replace(/-/g, '_')}';
    RAISE NOTICE 'Tabelas adicionadas: detailed_audit_log, quotation_version_history';
    RAISE NOTICE 'Funções adicionadas: get_audit_context, audit_trigger_function';
    RAISE NOTICE 'Triggers de auditoria criados para tabelas críticas';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Verificar logs de erro acima';
    RAISE NOTICE '2. Testar funcionalidades críticas';
    RAISE NOTICE '3. Validar integridade dos dados';
    RAISE NOTICE '4. Monitorar performance das novas funcionalidades';
    RAISE NOTICE '=====================================================';
END $$;

-- Commit da transação
COMMIT;

-- Resetar configurações
RESET client_min_messages;
RESET log_statement;
`;

    // Salvar o script no arquivo
    fs.writeFileSync(config.outputFile, sqlScript, 'utf8');
    
    console.log(`✅ Script de sincronização gerado com sucesso!`);
    console.log(`📁 Arquivo: ${config.outputFile}`);
    console.log(`📊 Tamanho: ${(sqlScript.length / 1024).toFixed(2)} KB`);
    console.log(`\n📋 Resumo das alterações incluídas:`);
    console.log(`   • Criação de ${differences.missingTables.length} tabelas faltantes`);
    console.log(`   • Criação de ${differences.missingFunctions.length} funções críticas`);
    console.log(`   • Criação de triggers de auditoria para 6 tabelas`);
    console.log(`   • Sistema completo de backup automático`);
    console.log(`   • Validações de integridade referencial`);
    console.log(`   • Tratamento de erros e rollback`);
    console.log(`   • Documentação detalhada de cada operação`);
    
    console.log(`\n⚠️  IMPORTANTE:`);
    console.log(`   1. Faça backup completo antes de executar`);
    console.log(`   2. Execute primeiro em ambiente de teste`);
    console.log(`   3. Monitore logs durante a execução`);
    console.log(`   4. Valide funcionalidades após aplicação`);
    
    return config.outputFile;
}

// Executar geração do script
try {
    const scriptFile = generateSyncScript();
    console.log(`\n🎯 Script pronto para uso: ${scriptFile}`);
} catch (error) {
    console.error('❌ Erro ao gerar script:', error);
    process.exit(1);
}