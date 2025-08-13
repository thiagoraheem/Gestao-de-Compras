-- Migration: Add indexes for purchase_orders and purchase_order_items tables
-- This migration adds useful indexes to improve query performance

-- Add index on purchase_orders.purchase_request_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_purchase_request_id" 
ON "purchase_orders" ("purchase_request_id");

-- Add index on purchase_orders.supplier_id for supplier-based queries
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_supplier_id" 
ON "purchase_orders" ("supplier_id");

-- Add index on purchase_orders.created_by for user-based queries
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_created_by" 
ON "purchase_orders" ("created_by");

-- Add index on purchase_orders.status for status-based filtering
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_status" 
ON "purchase_orders" ("status");

-- Add index on purchase_orders.created_at for date-based queries
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_created_at" 
ON "purchase_orders" ("created_at");

-- Add index on purchase_order_items.purchase_order_id for faster item lookups
CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_purchase_order_id" 
ON "purchase_order_items" ("purchase_order_id");

-- Add index on purchase_order_items.cost_center_id for cost center reporting
CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_cost_center_id" 
ON "purchase_order_items" ("cost_center_id");

-- Add comment to document the purpose of this migration
COMMENT ON INDEX "idx_purchase_orders_purchase_request_id" IS 'Index para melhorar performance de consultas por purchase_request_id';
COMMENT ON INDEX "idx_purchase_orders_supplier_id" IS 'Index para melhorar performance de consultas por fornecedor';
COMMENT ON INDEX "idx_purchase_orders_created_by" IS 'Index para melhorar performance de consultas por usuário criador';
COMMENT ON INDEX "idx_purchase_orders_status" IS 'Index para melhorar performance de filtros por status';
COMMENT ON INDEX "idx_purchase_orders_created_at" IS 'Index para melhorar performance de consultas por data';
COMMENT ON INDEX "idx_purchase_order_items_purchase_order_id" IS 'Index para melhorar performance de consultas de itens por pedido';
COMMENT ON INDEX "idx_purchase_order_items_cost_center_id" IS 'Index para melhorar performance de relatórios por centro de custo';