CREATE TABLE "approval_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_request_id" integer NOT NULL,
	"approver_type" text NOT NULL,
	"approver_id" integer NOT NULL,
	"approved" boolean NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_request_id" integer,
	"quotation_id" integer,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer,
	"attachment_type" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"department_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"item_code" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"delivery_deadline" timestamp,
	"cost_center_id" integer,
	"account_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"purchase_request_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"quotation_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_value" numeric(15, 2) NOT NULL,
	"payment_terms" text,
	"delivery_terms" text,
	"delivery_address" text,
	"contact_person" text,
	"contact_phone" text,
	"observations" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_request_id" integer,
	"item_number" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"stock_quantity" numeric(10, 2),
	"average_monthly_quantity" numeric(10, 2),
	"requested_quantity" numeric(10, 2) NOT NULL,
	"approved_quantity" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_request_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_request_id" integer,
	"supplier_id" integer,
	"quoted_value" numeric(10, 2),
	"quotation_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"requester_id" integer,
	"cost_center_id" integer,
	"category" text NOT NULL,
	"urgency" text NOT NULL,
	"justification" text NOT NULL,
	"ideal_delivery_date" timestamp,
	"available_budget" numeric(10, 2),
	"additional_info" text,
	"current_phase" text DEFAULT 'solicitacao' NOT NULL,
	"approver_a1_id" integer,
	"approved_a1" boolean,
	"rejection_reason_a1" text,
	"approval_date_a1" timestamp,
	"buyer_id" integer,
	"total_value" numeric(10, 2),
	"payment_method_id" integer,
	"approver_a2_id" integer,
	"chosen_supplier_id" integer,
	"choice_reason" text,
	"negotiated_value" numeric(10, 2),
	"discounts_obtained" numeric(10, 2),
	"delivery_date" timestamp,
	"purchase_date" timestamp,
	"purchase_observations" text,
	"received_by_id" integer,
	"received_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "purchase_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"item_code" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"specifications" text,
	"delivery_deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_number" text NOT NULL,
	"purchase_request_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"quotation_deadline" timestamp NOT NULL,
	"terms_and_conditions" text,
	"technical_specs" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_number_unique" UNIQUE("quotation_number")
);
--> statement-breakpoint
CREATE TABLE "receipt_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"purchase_order_item_id" integer NOT NULL,
	"quantity_received" numeric(10, 3) NOT NULL,
	"quantity_approved" numeric(10, 3),
	"condition" text DEFAULT 'good' NOT NULL,
	"observations" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_number" text NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"status" text DEFAULT 'partial' NOT NULL,
	"received_by" integer NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"observations" text,
	"quality_approved" boolean DEFAULT false,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_quotation_id" integer NOT NULL,
	"quotation_item_id" integer NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"delivery_days" integer,
	"brand" text,
	"model" text,
	"observations" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"quotation_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"received_at" timestamp,
	"total_value" numeric(15, 2),
	"payment_terms" text,
	"delivery_terms" text,
	"observations" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cnpj" text,
	"contact" text,
	"email" text,
	"products_services" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_cost_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"cost_center_id" integer
);
--> statement-breakpoint
CREATE TABLE "user_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"department_id" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"department_id" integer,
	"is_buyer" boolean DEFAULT false,
	"is_approver_a1" boolean DEFAULT false,
	"is_approver_a2" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_suppliers" ADD CONSTRAINT "purchase_request_suppliers_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_suppliers" ADD CONSTRAINT "purchase_request_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approver_a1_id_users_id_fk" FOREIGN KEY ("approver_a1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approver_a2_id_users_id_fk" FOREIGN KEY ("approver_a2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_chosen_supplier_id_suppliers_id_fk" FOREIGN KEY ("chosen_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_supplier_quotation_id_supplier_quotations_id_fk" FOREIGN KEY ("supplier_quotation_id") REFERENCES "public"."supplier_quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotation_items" ADD CONSTRAINT "supplier_quotation_items_quotation_item_id_quotation_items_id_fk" FOREIGN KEY ("quotation_item_id") REFERENCES "public"."quotation_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cost_centers" ADD CONSTRAINT "user_cost_centers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cost_centers" ADD CONSTRAINT "user_cost_centers_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");