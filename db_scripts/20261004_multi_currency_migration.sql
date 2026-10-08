-- Migration: Suporte a Multiplas Moedas no Processo de Compras
-- Data: 2026-10-04
-- Descrição:
--   - Cria tabela currency_rates para armazenar taxas de cambio historicas
--   - Adiciona colunas de moeda/origem (BRL) em todas as tabelas financeiras
--     do fluxo de compras: purchase_requests, supplier_quotations,
--     supplier_quotation_items, approved_quotation_items,
--     purchase_orders, purchase_order_items
--
-- Observacoes:
--   - DEFAULTs sao aplicados via SET DEFAULT apos ADD COLUMN para evitar
--     rewrite massivo de tabelas grandes (apenas novas linhas recebem o default).
--   - Linhas existentes permanecem NULL (tratadas como BRL implicitamente
--     na camada de aplicacao).
--   - Campos *_brl armazenam o valor convertido para Reais (BRL).
--   - Campos *_orig armazenam o valor na moeda original da solicitacao.

-- =====================================================================
-- 1) TABELA: currency_rates
-- =====================================================================
CREATE TABLE IF NOT EXISTS currency_rates (
    id              SERIAL PRIMARY KEY,
    currency_code   TEXT                                NOT NULL,
    rate_date       TIMESTAMP                           NOT NULL,
    rate_value      DECIMAL(15, 6)                      NOT NULL,
    observations    TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restricao unica: nao pode haver duas taxas para a mesma moeda e mesma data
CREATE UNIQUE INDEX IF NOT EXISTS uk_currency_rates_currency_code_rate_date
    ON currency_rates (currency_code, rate_date);

-- Indices para busca
CREATE INDEX IF NOT EXISTS idx_currency_rates_currency_code
    ON currency_rates (currency_code);

CREATE INDEX IF NOT EXISTS idx_currency_rates_rate_date
    ON currency_rates (rate_date);


-- =====================================================================
-- 2) TABELA: purchase_requests  (5 novas colunas)
-- =====================================================================
ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS currency_code          TEXT;

ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS exchange_rate          DECIMAL(15, 6);

ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS total_value_orig       DECIMAL(15, 4);

ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS negotiated_value_orig  DECIMAL(15, 4);

ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS discounts_obtained_orig DECIMAL(15, 4);


-- =====================================================================
-- 3) TABELA: supplier_quotations  (7 novas colunas)
-- =====================================================================
-- Passo 1: adicionar colunas SEM DEFAULT (evita rewrite da tabela)
ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS currency_code      TEXT;

ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS exchange_rate      DECIMAL(15, 6);

ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS total_value_brl    DECIMAL(15, 4);

ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS subtotal_value_brl DECIMAL(15, 4);

ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS final_value_brl    DECIMAL(15, 4);

ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS freight_value_brl  DECIMAL(15, 4);

ALTER TABLE supplier_quotations
    ADD COLUMN IF NOT EXISTS discount_value_brl DECIMAL(15, 4);

-- Passo 2: aplicar DEFAULTs apenas para novas linhas
ALTER TABLE supplier_quotations
    ALTER COLUMN currency_code SET DEFAULT 'BRL';

ALTER TABLE supplier_quotations
    ALTER COLUMN exchange_rate SET DEFAULT 1;


-- =====================================================================
-- 4) TABELA: supplier_quotation_items  (5 novas colunas)
-- =====================================================================
ALTER TABLE supplier_quotation_items
    ADD COLUMN IF NOT EXISTS unit_price_brl              DECIMAL(15, 4);

ALTER TABLE supplier_quotation_items
    ADD COLUMN IF NOT EXISTS total_price_brl             DECIMAL(15, 4);

ALTER TABLE supplier_quotation_items
    ADD COLUMN IF NOT EXISTS discount_value_brl          DECIMAL(15, 4);

ALTER TABLE supplier_quotation_items
    ADD COLUMN IF NOT EXISTS original_total_price_brl    DECIMAL(15, 4);

ALTER TABLE supplier_quotation_items
    ADD COLUMN IF NOT EXISTS discounted_total_price_brl  DECIMAL(15, 4);


-- =====================================================================
-- 5) TABELA: approved_quotation_items  (2 novas colunas)
-- =====================================================================
ALTER TABLE approved_quotation_items
    ADD COLUMN IF NOT EXISTS unit_price_brl   DECIMAL(15, 4);

ALTER TABLE approved_quotation_items
    ADD COLUMN IF NOT EXISTS total_price_brl  DECIMAL(15, 4);


-- =====================================================================
-- 6) TABELA: purchase_orders  (3 novas colunas)
-- =====================================================================
-- Passo 1: adicionar colunas SEM DEFAULT (evita rewrite da tabela)
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS currency_code   TEXT;

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS exchange_rate   DECIMAL(15, 6);

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS total_value_brl DECIMAL(15, 2);

-- Passo 2: aplicar DEFAULTs apenas para novas linhas
ALTER TABLE purchase_orders
    ALTER COLUMN currency_code SET DEFAULT 'BRL';

ALTER TABLE purchase_orders
    ALTER COLUMN exchange_rate SET DEFAULT 1;


-- =====================================================================
-- 7) TABELA: purchase_order_items  (2 novas colunas)
-- =====================================================================
ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS unit_price_brl   DECIMAL(15, 4);

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS total_price_brl  DECIMAL(15, 4);
