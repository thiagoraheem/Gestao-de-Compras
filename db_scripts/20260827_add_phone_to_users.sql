ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
COMMENT ON COLUMN users.phone IS 'Telefone de contato direto do usuário';
