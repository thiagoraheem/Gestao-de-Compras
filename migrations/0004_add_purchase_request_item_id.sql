-- Add purchase_request_item_id to quotation_items table to maintain direct relationship
ALTER TABLE quotation_items 
ADD COLUMN purchase_request_item_id INTEGER REFERENCES purchase_request_items(id);

-- Update existing quotation_items to link with purchase_request_items based on description matching
-- This is a one-time fix for existing data
UPDATE quotation_items 
SET purchase_request_item_id = (
  SELECT pri.id 
  FROM purchase_request_items pri
  JOIN quotations q ON q.id = quotation_items.quotation_id
  WHERE pri.purchase_request_id = q.purchase_request_id
  AND TRIM(LOWER(pri.description)) = TRIM(LOWER(quotation_items.description))
  LIMIT 1
)
WHERE purchase_request_item_id IS NULL;