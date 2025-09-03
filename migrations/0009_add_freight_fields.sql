-- Migration: Add freight fields to supplier quotations table
-- Created: 2025-01-17

-- Add freight fields to supplier_quotations table
ALTER TABLE supplier_quotations 
ADD COLUMN includes_freight BOOLEAN DEFAULT false,
ADD COLUMN freight_value DECIMAL(15, 2);

-- Update existing records to set default values
UPDATE supplier_quotations 
SET includes_freight = false
WHERE includes_freight IS NULL;

-- Add comment to document the purpose of this migration
COMMENT ON COLUMN supplier_quotations.includes_freight IS 'Indicates if the quotation includes freight costs';
COMMENT ON COLUMN supplier_quotations.freight_value IS 'Freight value when includes_freight is true';

-- Migration completed successfully
-- Next: Update application code to handle freight fields