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

-- 3. Limpeza de recebimentos órfãos
delete from receipt_installments
where receipt_id in (
select id
from receipts
where purchase_order_id is null and purchase_request_id is null
);

delete from receipt_items
where receipt_id in (
select id
from receipts
where purchase_order_id is null and purchase_request_id is null
);

delete from receipt_nf_xmls
where receipt_id in (
select id
from receipts
where purchase_order_id is null and purchase_request_id is null
);

delete from receipts
where purchase_order_id is null and purchase_request_id is null;