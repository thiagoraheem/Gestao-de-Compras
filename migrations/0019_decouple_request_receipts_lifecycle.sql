DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_phase') THEN
    CREATE TYPE receipt_phase AS ENUM ('recebimento_fisico', 'conf_fiscal', 'concluido', 'cancelado');
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "purchase_requests"
  ADD COLUMN IF NOT EXISTS "procurement_status" text NOT NULL DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS "procurement_concluded_at" timestamp,
  ADD COLUMN IF NOT EXISTS "procurement_concluded_by_id" integer;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_requests_procurement_concluded_by_id_users_id_fk'
  ) THEN
    ALTER TABLE "purchase_requests"
      ADD CONSTRAINT "purchase_requests_procurement_concluded_by_id_users_id_fk"
      FOREIGN KEY ("procurement_concluded_by_id") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "receipts"
  ADD COLUMN IF NOT EXISTS "purchase_request_id" integer,
  ADD COLUMN IF NOT EXISTS "receipt_phase" receipt_phase NOT NULL DEFAULT 'recebimento_fisico';
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'receipts_purchase_request_id_purchase_requests_id_fk'
  ) THEN
    ALTER TABLE "receipts"
      ADD CONSTRAINT "receipts_purchase_request_id_purchase_requests_id_fk"
      FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "receipt_id" integer,
  ADD COLUMN IF NOT EXISTS "action_scope" varchar(20) NOT NULL DEFAULT 'REQUEST';
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_receipt_id_receipts_id_fk'
  ) THEN
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_receipt_id_receipts_id_fk"
      FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_receipts_purchase_request_id" ON "receipts" ("purchase_request_id");
CREATE INDEX IF NOT EXISTS "idx_receipts_receipt_phase" ON "receipts" ("receipt_phase");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_receipt_id" ON "audit_logs" ("receipt_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action_scope" ON "audit_logs" ("action_scope");
--> statement-breakpoint

UPDATE "receipts" r
SET "purchase_request_id" = po."purchase_request_id"
FROM "purchase_orders" po
WHERE r."purchase_order_id" = po."id"
  AND r."purchase_request_id" IS NULL
  AND po."purchase_request_id" IS NOT NULL;
--> statement-breakpoint

UPDATE "receipts"
SET "receipt_phase" = CASE
  WHEN "status" IN ('conf_fisica') THEN 'conf_fiscal'::receipt_phase
  WHEN "status" IN ('fiscal_conferida', 'integrado_locador', 'conferida', 'complete') THEN 'concluido'::receipt_phase
  WHEN "status" IN ('cancelado', 'cancelled') THEN 'cancelado'::receipt_phase
  ELSE 'recebimento_fisico'::receipt_phase
END
WHERE "receipt_phase" IS NULL OR "receipt_phase" = 'recebimento_fisico';
--> statement-breakpoint

UPDATE "purchase_requests"
SET
  "procurement_status" = 'concluida',
  "procurement_concluded_at" = COALESCE("purchase_date", "received_date", "updated_at"),
  "procurement_concluded_by_id" = COALESCE("buyer_id", "received_by_id", "approver_a2_id")
WHERE "current_phase" IN ('recebimento', 'conf_fiscal', 'conclusao_compra')
  AND ("procurement_status" IS NULL OR "procurement_status" = 'aberta');

