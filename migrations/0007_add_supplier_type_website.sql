-- Migration: Add type and website fields to suppliers table
-- This migration adds supplier categorization (Traditional vs Online) and website field

-- Add type field (0: Traditional, 1: Online)
ALTER TABLE "suppliers" ADD COLUMN "type" INTEGER NOT NULL DEFAULT 0;

-- Add website field for online suppliers
ALTER TABLE "suppliers" ADD COLUMN "website" TEXT;

-- Add comment to document the purpose of this migration
COMMENT ON COLUMN "suppliers"."type" IS 'Supplier type: 0 = Traditional, 1 = Online';
COMMENT ON COLUMN "suppliers"."website" IS 'Supplier website URL (required for Online suppliers)';

-- Add index on type for filtering
CREATE INDEX IF NOT EXISTS "idx_suppliers_type" ON "suppliers" ("type");

-- Migration completed successfully