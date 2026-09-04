-- ==============================================================
-- MIGRATION: Adiciona o campo 'phone' na tabela 'users'
-- Data: 2026-08-27
-- ==============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN users.phone IS 'Telefone de contato direto do usuário (Comprador, Aprovador, etc.)';

-- Rollback:
-- ALTER TABLE users DROP COLUMN IF EXISTS phone;
