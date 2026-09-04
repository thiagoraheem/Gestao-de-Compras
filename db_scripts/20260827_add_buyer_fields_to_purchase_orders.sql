-- Migration: Adiciona campos do Comprador à tabela purchase_orders
-- Data: 2026-08-27
-- Descrição: Remove a dependência de exibição do Solicitante (PurchaseRequest)
--            e inclui dados do Comprador diretamente no Pedido de Compra.

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS buyer_name TEXT;

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS buyer_email TEXT;

-- Índice para busca por nome do comprador
CREATE INDEX IF NOT EXISTS idx_purchase_orders_buyer_name
ON purchase_orders (buyer_name);
