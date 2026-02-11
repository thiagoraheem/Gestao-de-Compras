CREATE TYPE "public"."receipt_status" AS ENUM('rascunho', 'nf_pendente', 'nf_confirmada', 'validado_compras', 'enviado_locador', 'integrado_locador', 'erro_integracao', 'recebimento_confirmado', 'recebimento_parcial', 'partial', 'complete', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."receipt_type" AS ENUM('produto', 'servico', 'avulso');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "approval_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"value_threshold" numeric(15, 2) DEFAULT '2500.00' NOT NULL,
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approved_quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"supplier_quotation_item_id" integer NOT NULL,
	"purchase_request_item_id" integer NOT NULL,
	"approved_quantity" numeric(10, 3) NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"total_price" numeric(15, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_request_id" integer NOT NULL,
	"performed_by" integer,
	"action_type" varchar(100) NOT NULL,
	"action_description" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"affected_tables" text[],
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" varchar(50) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trading_name" text,
	"cnpj" text,
	"address" text,
	"phone" text,
	"email" text,
	"logo_url" text,
	"logo_base64" text,
	"id_company_erp" integer,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "configuration_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"configuration_id" integer,
	"change_type" varchar(50) NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb NOT NULL,
	"changed_by" integer,
	"ip_address" "inet",
	"user_agent" text,
	"changed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "delivery_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"observations" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "delivery_locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "detailed_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar(100) NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" integer NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"change_reason" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quantity_adjustment_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_quotation_item_id" integer NOT NULL,
	"quotation_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"previous_quantity" numeric(10, 3),
	"new_quantity" numeric(10, 3),
	"previous_unit" text,
	"new_unit" text,
	"adjustment_reason" text,
	"adjusted_by" integer NOT NULL,
	"adjusted_at" timestamp DEFAULT now() NOT NULL,
	"previous_total_value" numeric(15, 2),
	"new_total_value" numeric(15, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"severity_level" text
);
--> statement-breakpoint
CREATE TABLE "quotation_version_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"previous_version" integer,
	"new_version" integer NOT NULL,
	"change_type" text NOT NULL,
	"change_description" text,
	"changed_fields" jsonb,
	"previous_values" jsonb,
	"new_values" jsonb,
	"items_affected" jsonb,
	"reason_for_change" text,
	"impact_assessment" text,
	"changed_by" integer NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"notifications_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"cost_center_id" integer NOT NULL,
	"chart_of_accounts_id" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"percentage" numeric(7, 4),
	"mode" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "receipt_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"installment_number" varchar(50) NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_nf_xmls" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"xml_content" text NOT NULL,
	"xml_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "receipt_nf_xmls_xml_hash_unique" UNIQUE("xml_hash")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_integration_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"erp_id" text NOT NULL,
	"erp_document" text,
	"erp_name" text NOT NULL,
	"action" text NOT NULL,
	"match_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"local_supplier_id" integer,
	"payload" jsonb NOT NULL,
	"differences" jsonb,
	"issues" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_integration_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"total_suppliers" integer DEFAULT 0 NOT NULL,
	"processed_suppliers" integer DEFAULT 0 NOT NULL,
	"created_suppliers" integer DEFAULT 0 NOT NULL,
	"updated_suppliers" integer DEFAULT 0 NOT NULL,
	"ignored_suppliers" integer DEFAULT 0 NOT NULL,
	"invalid_suppliers" integer DEFAULT 0 NOT NULL,
	"message" text,
	"created_by" integer,
	"cancelled_by" integer,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "purchase_request_suppliers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "purchase_request_suppliers" CASCADE;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "total_price" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "receipt_items" ALTER COLUMN "purchase_order_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipt_items" ALTER COLUMN "condition" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "purchase_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "received_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "received_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "received_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "quality_approved" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ALTER COLUMN "total_price" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_quotations" ALTER COLUMN "total_value" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "approval_history" ADD COLUMN "approval_step" text DEFAULT 'single';--> statement-breakpoint
ALTER TABLE "approval_history" ADD COLUMN "approval_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "approval_history" ADD COLUMN "requires_dual_approval" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "approval_history" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "approval_history" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "supplier_quotation_id" integer;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD COLUMN "external_id" varchar(50);--> statement-breakpoint
ALTER TABLE "cost_centers" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "quantity_received" numeric(10, 3) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "fulfillment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "product_code" text;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "technical_specification" text;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "is_transferred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "transferred_to_request_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "transfer_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD COLUMN "transferred_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "approved_a2" boolean;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "rejection_reason_a2" text;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "rejection_action_a2" text;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "approval_date_a2" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "requires_dual_approval" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "first_approver_a2_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "final_approver_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "first_approval_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "final_approval_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "approval_configuration_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "has_pendency" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "pendency_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "physical_receipt_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "physical_receipt_by_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "fiscal_receipt_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD COLUMN "fiscal_receipt_by_id" integer;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "purchase_request_item_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "delivery_location_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "rfq_version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "parent_quotation_id" integer;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "line_number" integer;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "description" varchar(300);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "unit" varchar(20);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "quantity" numeric(18, 4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "unit_price" numeric(18, 6) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "total_price" numeric(18, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "locador_product_id" varchar(50);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "locador_product_code" varchar(50);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "remaining_quantity" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "ncm" varchar(20);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "cfop" varchar(10);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "icms_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "icms_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "ipi_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "ipi_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "pis_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "pis_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "cofins_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "receipt_items" ADD COLUMN "cofins_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "receipt_type" "receipt_type" DEFAULT 'produto' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "locador_supplier_id" varchar(50);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "document_number" varchar(50);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "document_series" varchar(20);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "document_key" varchar(100);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "document_issue_date" timestamp;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "document_entry_date" timestamp;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "total_amount" numeric(18, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "installments_count" integer;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "payment_terms" varchar(200);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "cost_center_id" integer;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "chart_of_accounts_id" integer;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "locador_receipt_id" varchar(50);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "integration_message" text;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "discount_percentage" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "discount_value" numeric(15, 4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "original_total_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "discounted_total_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "is_available" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "unavailability_reason" text;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "available_quantity" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "confirmed_unit" text;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "quantity_adjustment_reason" text;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD COLUMN "fulfillment_percentage" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "warranty_period" text;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "is_chosen" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "choice_reason" text;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "discount_type" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "discount_value" numeric(15, 4) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "subtotal_value" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "final_value" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "includes_freight" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD COLUMN "freight_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "type" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "cpf" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "idsuppliererp" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_manager" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_receiver" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_ceo" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_director" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "force_change_password" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expires" timestamp;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_configurations" ADD CONSTRAINT "approval_configurations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_quotation_items" ADD CONSTRAINT "approved_quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_quotation_items" ADD CONSTRAINT "approved_quotation_items_supplier_quotation_item_id_supplier_quotation_items_id_fk" FOREIGN KEY ("supplier_quotation_item_id") REFERENCES "public"."supplier_quotation_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_quotation_items" ADD CONSTRAINT "approved_quotation_items_purchase_request_item_id_purchase_request_items_id_fk" FOREIGN KEY ("purchase_request_item_id") REFERENCES "public"."purchase_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuration_history" ADD CONSTRAINT "configuration_history_configuration_id_approval_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."approval_configurations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuration_history" ADD CONSTRAINT "configuration_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detailed_audit_log" ADD CONSTRAINT "detailed_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quantity_adjustment_history" ADD CONSTRAINT "quantity_adjustment_history_supplier_quotation_item_id_supplier_quotation_items_id_fk" FOREIGN KEY ("supplier_quotation_item_id") REFERENCES "public"."supplier_quotation_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quantity_adjustment_history" ADD CONSTRAINT "quantity_adjustment_history_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quantity_adjustment_history" ADD CONSTRAINT "quantity_adjustment_history_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quantity_adjustment_history" ADD CONSTRAINT "quantity_adjustment_history_adjusted_by_users_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_version_history" ADD CONSTRAINT "quotation_version_history_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_version_history" ADD CONSTRAINT "quotation_version_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_version_history" ADD CONSTRAINT "quotation_version_history_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_chart_of_accounts_id_chart_of_accounts_id_fk" FOREIGN KEY ("chart_of_accounts_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_installments" ADD CONSTRAINT "receipt_installments_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_nf_xmls" ADD CONSTRAINT "receipt_nf_xmls_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_integration_items" ADD CONSTRAINT "supplier_integration_items_run_id_supplier_integration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."supplier_integration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_integration_items" ADD CONSTRAINT "supplier_integration_items_local_supplier_id_suppliers_id_fk" FOREIGN KEY ("local_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_integration_runs" ADD CONSTRAINT "supplier_integration_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_integration_runs" ADD CONSTRAINT "supplier_integration_runs_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_purchase_request_id" ON "audit_logs" USING btree ("purchase_request_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action_type" ON "audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_performed_at" ON "audit_logs" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_detailed_audit_transaction_id" ON "detailed_audit_log" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_detailed_audit_table_record" ON "detailed_audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "idx_detailed_audit_created_at" ON "detailed_audit_log" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_supplier_quotation_id_supplier_quotations_id_fk" FOREIGN KEY ("supplier_quotation_id") REFERENCES "public"."supplier_quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_transferred_to_request_id_purchase_requests_id_fk" FOREIGN KEY ("transferred_to_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_first_approver_a2_id_users_id_fk" FOREIGN KEY ("first_approver_a2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_final_approver_id_users_id_fk" FOREIGN KEY ("final_approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_physical_receipt_by_id_users_id_fk" FOREIGN KEY ("physical_receipt_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_fiscal_receipt_by_id_users_id_fk" FOREIGN KEY ("fiscal_receipt_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_purchase_request_item_id_purchase_request_items_id_fk" FOREIGN KEY ("purchase_request_item_id") REFERENCES "public"."purchase_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_delivery_location_id_delivery_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_parent_quotation_id_quotations_id_fk" FOREIGN KEY ("parent_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_receipts_document_number" ON "receipts" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX "idx_receipts_document_key" ON "receipts" USING btree ("document_key");--> statement-breakpoint
CREATE INDEX "idx_receipts_document_series" ON "receipts" USING btree ("document_series");--> statement-breakpoint
CREATE INDEX "idx_receipts_supplier_id" ON "receipts" USING btree ("supplier_id");--> statement-breakpoint
ALTER TABLE "purchase_request_items" DROP COLUMN "item_number";