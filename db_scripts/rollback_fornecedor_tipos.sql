-- Rollback Migration: Remove modificações de tipos de fornecedor
-- Data: 2025-01-20
-- Descrição: Remove os campos adicionados e restaura estado anterior

BEGIN;

-- Remover novos campos
ALTER TABLE suppliers 
  DROP COLUMN IF EXISTS cpf,
  DROP COLUMN IF EXISTS idSupplierERP;

-- Restaurar constraint original (remover constraint atual)
ALTER TABLE suppliers 
  DROP CONSTRAINT IF EXISTS suppliers_type_check;

-- Remover índices
DROP INDEX IF EXISTS idx_suppliers_cpf;
DROP INDEX IF EXISTS idx_suppliers_idSupplierERP;

-- Opcionalmente, remover índice do tipo se não for mais necessário
-- DROP INDEX IF EXISTS idx_suppliers_type;

COMMIT;