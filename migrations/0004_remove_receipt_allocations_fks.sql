ALTER TABLE "receipt_allocations" DROP CONSTRAINT "receipt_allocations_cost_center_id_cost_centers_id_fk";
--> statement-breakpoint
ALTER TABLE "receipt_allocations" DROP CONSTRAINT "receipt_allocations_chart_of_accounts_id_chart_of_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "part_number" text;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "last_phase" text;