-- Migration: Integração de Fornecedores com ERP
-- Created at: $(date)
-- Description: Adiciona tabelas e campos necessários para integração com ERP

-- Adicionar campo idsuppliererp na tabela suppliers se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'idsuppliererp'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN idsuppliererp VARCHAR(100) UNIQUE;
    END IF;
END $$;

-- Criar tabela de histórico de integrações
CREATE TABLE IF NOT EXISTS supplier_integration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    erp_supplier_id VARCHAR(100),
    supplier_name VARCHAR(255),
    action_taken VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    processed_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

-- Criar tabela de fila de integração
CREATE TABLE IF NOT EXISTS supplier_integration_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL,
    erp_supplier_id VARCHAR(100) NOT NULL,
    supplier_data JSONB NOT NULL,
    comparison_result VARCHAR(50) NOT NULL,
    action_required VARCHAR(50) NOT NULL,
    local_supplier_id INTEGER REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de controle de integrações
CREATE TABLE IF NOT EXISTS supplier_integration_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_suppliers INTEGER DEFAULT 0,
    processed_suppliers INTEGER DEFAULT 0,
    created_suppliers INTEGER DEFAULT 0,
    updated_suppliers INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    error_log TEXT
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_suppliers_idsuppliererp ON suppliers(idsuppliererp);
CREATE INDEX IF NOT EXISTS idx_suppliers_cnpj ON suppliers(cnpj);
CREATE INDEX IF NOT EXISTS idx_suppliers_cpf ON suppliers(cpf);
CREATE INDEX IF NOT EXISTS idx_integration_history_integration_id ON supplier_integration_history(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_history_created_at ON supplier_integration_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_queue_integration_id ON supplier_integration_queue(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_queue_status ON supplier_integration_queue(status);
CREATE INDEX IF NOT EXISTS idx_integration_control_status ON supplier_integration_control(status);
CREATE INDEX IF NOT EXISTS idx_integration_control_created_at ON supplier_integration_control(created_at DESC);

-- Criar função para limpar integrações antigas
CREATE OR REPLACE FUNCTION cleanup_old_integrations() RETURNS INTEGER AS $$
DECLARE
    deleted_queue INTEGER := 0;
    deleted_history INTEGER := 0;
BEGIN
    -- Contar e remover itens processados com mais de 90 dias
    SELECT COUNT(*) INTO deleted_queue
    FROM supplier_integration_queue 
    WHERE status = 'processed' 
      AND created_at < NOW() - INTERVAL '90 days';

    DELETE FROM supplier_integration_queue 
    WHERE status = 'processed' 
      AND created_at < NOW() - INTERVAL '90 days';

    -- Contar e remover histórico com mais de 1 ano
    SELECT COUNT(*) INTO deleted_history
    FROM supplier_integration_history 
    WHERE created_at < NOW() - INTERVAL '1 year';

    DELETE FROM supplier_integration_history 
    WHERE created_at < NOW() - INTERVAL '1 year';

    RETURN COALESCE(deleted_queue, 0) + COALESCE(deleted_history, 0);
END;
$$ LANGUAGE plpgsql;

-- Garantir extensão necessária para gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Criar função para obter estatísticas de integração
CREATE OR REPLACE FUNCTION get_integration_stats(
    p_integration_id UUID
) RETURNS TABLE (
    total INTEGER,
    pending INTEGER,
    processed INTEGER,
    created INTEGER,
    updated INTEGER,
    errors INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending,
        COUNT(*) FILTER (WHERE status = 'processed')::INTEGER as processed,
        COUNT(*) FILTER (WHERE action_required = 'create')::INTEGER as created,
        COUNT(*) FILTER (WHERE action_required = 'update')::INTEGER as updated,
        COUNT(*) FILTER (WHERE status = 'error')::INTEGER as errors
    FROM supplier_integration_queue
    WHERE integration_id = p_integration_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON supplier_integration_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON supplier_integration_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON supplier_integration_control TO authenticated;
GRANT SELECT ON suppliers TO authenticated;
GRANT UPDATE (idsuppliererp) ON suppliers TO authenticated;

-- Adicionar comentários para documentação
COMMENT ON TABLE supplier_integration_history IS 'Histórico de todas as operações de integração de fornecedores';
COMMENT ON TABLE supplier_integration_queue IS 'Fila de fornecedores a serem processados na integração';
COMMENT ON TABLE supplier_integration_control IS 'Controle e monitoramento de processos de integração';
COMMENT ON COLUMN suppliers.idsuppliererp IS 'ID do fornecedor no sistema ERP externo';

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_suppliers_updated_at'
    ) THEN
        CREATE TRIGGER update_suppliers_updated_at
            BEFORE UPDATE ON suppliers
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;