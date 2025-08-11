-- Migration: Add discount fields to supplier quotations and items
-- Created: 2025-01-17

-- Add discount fields to supplier_quotations table
ALTER TABLE supplier_quotations 
ADD COLUMN discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'none')) DEFAULT 'none',
ADD COLUMN discount_value DECIMAL(15, 4) DEFAULT 0,
ADD COLUMN subtotal_value DECIMAL(15, 2),
ADD COLUMN final_value DECIMAL(15, 2);

-- Add discount fields to supplier_quotation_items table  
ALTER TABLE supplier_quotation_items
ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN discount_value DECIMAL(15, 4) DEFAULT 0,
ADD COLUMN original_total_price DECIMAL(15, 2),
ADD COLUMN discounted_total_price DECIMAL(15, 2);

-- Update existing records to set default values
UPDATE supplier_quotations 
SET discount_type = 'none', 
    discount_value = 0,
    subtotal_value = total_value,
    final_value = total_value
WHERE discount_type IS NULL;

UPDATE supplier_quotation_items 
SET discount_percentage = 0,
    discount_value = 0,
    original_total_price = total_price,
    discounted_total_price = total_price
WHERE discount_percentage IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN supplier_quotations.discount_type IS 'Type of discount applied: percentage, fixed amount, or none';
COMMENT ON COLUMN supplier_quotations.discount_value IS 'Discount value (percentage or fixed amount)';
COMMENT ON COLUMN supplier_quotations.subtotal_value IS 'Total value before discount';
COMMENT ON COLUMN supplier_quotations.final_value IS 'Final value after discount';

COMMENT ON COLUMN supplier_quotation_items.discount_percentage IS 'Discount percentage applied to this item (0-100)';
COMMENT ON COLUMN supplier_quotation_items.discount_value IS 'Fixed discount value applied to this item';
COMMENT ON COLUMN supplier_quotation_items.original_total_price IS 'Original total price before discount';
COMMENT ON COLUMN supplier_quotation_items.discounted_total_price IS 'Total price after discount';