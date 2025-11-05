-- Migration: Implementação de Tipos de Fornecedor
-- Data: 2025-01-20
-- Descrição: Adiciona suporte a Pessoa Jurídica, Online e Pessoa Física

BEGIN;

-- Adicionar novos campos
ALTER TABLE suppliers 
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS idSupplierERP INTEGER DEFAULT NULL;

-- Atualizar constraint do tipo
ALTER TABLE suppliers 
  DROP CONSTRAINT IF EXISTS suppliers_type_check;

ALTER TABLE suppliers 
  ADD CONSTRAINT suppliers_type_check 
  CHECK (type IN (0, 1, 2));

-- Atualizar descrições existentes
UPDATE suppliers 
SET type = 0 
WHERE type NOT IN (0, 1, 2);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(type);
CREATE INDEX IF NOT EXISTS idx_suppliers_cpf ON suppliers(cpf);
CREATE INDEX IF NOT EXISTS idx_suppliers_idSupplierERP ON suppliers(idSupplierERP);

COMMIT;