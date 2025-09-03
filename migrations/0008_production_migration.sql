-- Migração para adicionar colunas de transferência na tabela purchase_request_items
-- Execute este script no banco de PRODUÇÃO

-- Verificar se as colunas já existem antes de tentar adicionar
DO $$
BEGIN
    -- Adicionar coluna is_transferred se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_request_items' 
                   AND column_name = 'is_transferred') THEN
        ALTER TABLE purchase_request_items 
        ADD COLUMN is_transferred boolean DEFAULT false;
        
        RAISE NOTICE 'Coluna is_transferred adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna is_transferred já existe';
    END IF;

    -- Adicionar coluna transferred_to_request_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_request_items' 
                   AND column_name = 'transferred_to_request_id') THEN
        ALTER TABLE purchase_request_items 
        ADD COLUMN transferred_to_request_id integer;
        
        -- Adicionar foreign key constraint
        ALTER TABLE purchase_request_items 
        ADD CONSTRAINT fk_transferred_to_request 
        FOREIGN KEY (transferred_to_request_id) REFERENCES purchase_requests(id);
        
        RAISE NOTICE 'Coluna transferred_to_request_id adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna transferred_to_request_id já existe';
    END IF;

    -- Adicionar coluna transfer_reason se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_request_items' 
                   AND column_name = 'transfer_reason') THEN
        ALTER TABLE purchase_request_items 
        ADD COLUMN transfer_reason text;
        
        RAISE NOTICE 'Coluna transfer_reason adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna transfer_reason já existe';
    END IF;

    -- Adicionar coluna transferred_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_request_items' 
                   AND column_name = 'transferred_at') THEN
        ALTER TABLE purchase_request_items 
        ADD COLUMN transferred_at timestamp;
        
        RAISE NOTICE 'Coluna transferred_at adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna transferred_at já existe';
    END IF;

END$$;

-- Verificar as colunas adicionadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_request_items' 
AND column_name IN ('is_transferred', 'transferred_to_request_id', 'transfer_reason', 'transferred_at')
ORDER BY column_name;