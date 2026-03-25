ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
CREATE INDEX "idx_users_is_active" ON "users" USING btree ("is_active");