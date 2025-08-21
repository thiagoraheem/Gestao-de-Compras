-- Migration: Add availability fields to supplier_quotation_items table
-- This migration adds fields to track product availability for supplier return functionality

-- Add isAvailable field (defaults to true for existing records)
ALTER TABLE supplier_quotation_items 
ADD COLUMN is_available BOOLEAN DEFAULT true;

-- Add unavailabilityReason field for tracking why a product is unavailable
ALTER TABLE supplier_quotation_items 
ADD COLUMN unavailability_reason TEXT;

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN supplier_quotation_items.is_available IS 'Indicates if the product is available from the supplier';
COMMENT ON COLUMN supplier_quotation_items.unavailability_reason IS 'Reason why the product is unavailable from the supplier';