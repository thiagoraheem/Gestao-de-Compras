-- Migration: Final Decoupling Data Fix
-- This script aligns legacy data with the new decoupled Kanban flow

-- 1. Move legacy phase requests to the new Handoff phase (Flow 1)
UPDATE purchase_requests 
SET current_phase = 'pedido_concluido',
    updated_at = NOW()
WHERE current_phase IN ('recebimento', 'conf_fiscal', 'conclusao_compra');

-- 2. Link existing receipts to their original requests (if not already linked)
UPDATE receipts r
SET purchase_request_id = po.purchase_request_id
FROM purchase_orders po
WHERE r.purchase_order_id = po.id
  AND r.purchase_request_id IS NULL;

-- 3. Move 100% completed receipts to 'conf_fiscal' (Flow 2)
-- This removes "finished" cards from the Physical Receipt column
WITH receipt_progress AS (
  SELECT 
    r.id,
    COALESCE(SUM(ri.quantity_received), 0) as total_received,
    NULLIF(SUM(poi.quantity), 0) as total_expected
  FROM receipts r
  JOIN receipt_items ri ON r.id = ri.receipt_id
  JOIN purchase_order_items poi ON ri.purchase_order_item_id = poi.id
  WHERE r.receipt_phase = 'recebimento_fisico'
  GROUP BY r.id
)
UPDATE receipts
SET receipt_phase = 'conf_fiscal'
WHERE id IN (
  SELECT id FROM receipt_progress 
  WHERE total_received >= total_expected AND total_expected > 0
);
