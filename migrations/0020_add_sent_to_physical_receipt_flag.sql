ALTER TABLE "purchase_requests"
  ADD COLUMN IF NOT EXISTS "sent_to_physical_receipt" boolean NOT NULL DEFAULT false;

