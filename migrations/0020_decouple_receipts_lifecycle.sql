DO $$ BEGIN
 CREATE TYPE "receipt_phase" AS ENUM('recebimento_fisico', 'conf_fiscal', 'concluido', 'cancelado');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "procurement_status" text DEFAULT 'aberta';
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "procurement_concluded_at" timestamp;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "procurement_concluded_by_id" integer;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "sent_to_physical_receipt" boolean DEFAULT false;

ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "purchase_request_id" integer;
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "receipt_phase" "receipt_phase" DEFAULT 'recebimento_fisico';

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "receipt_id" integer;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action_scope" text;

-- Backfill receipts.purchase_request_id
UPDATE receipts r
SET purchase_request_id = po.purchase_request_id
FROM purchase_orders po
WHERE r.purchase_order_id = po.id
  AND r.purchase_request_id IS NULL
  AND po.purchase_request_id IS NOT NULL;

-- Backfill purchase_requests.procurement_status
UPDATE purchase_requests
SET procurement_status = 'concluida',
    procurement_concluded_at = COALESCE(fiscal_receipt_at, physical_receipt_at, updated_at)
WHERE current_phase IN ('recebimento', 'conf_fiscal', 'conclusao_compra')
  AND (procurement_status = 'aberta' OR procurement_status IS NULL);

-- Backfill sent_to_physical_receipt
UPDATE purchase_requests
SET sent_to_physical_receipt = true
WHERE current_phase IN ('recebimento', 'conf_fiscal', 'conclusao_compra');
