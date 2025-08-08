-- Migration: Add product_code field to purchase_request_items table
-- This field will store the product code from the external ERP system for traceability

ALTER TABLE "purchase_request_items" 
ADD COLUMN "product_code" text;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN "purchase_request_items"."product_code" IS 'Código do produto no sistema ERP externo para rastreabilidade';