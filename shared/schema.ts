import { pgTable, text, serial, integer, boolean, timestamp, decimal, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (for future auth implementation)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  cnpj: text("cnpj").unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoBase64: text("logo_base64"), // Armazenará a string base64 completa
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyId: integer("company_id").references(() => companies.id),
  departmentId: integer("department_id").references(() => departments.id),
  isBuyer: boolean("is_buyer").default(false),
  isApproverA1: boolean("is_approver_a1").default(false),
  isApproverA2: boolean("is_approver_a2").default(false),
  isAdmin: boolean("is_admin").default(false),
  isManager: boolean("is_manager").default(false),
  isReceiver: boolean("is_receiver").default(false),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cost Centers table
export const costCenters = pgTable("cost_centers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Department associations
export const userDepartments = pgTable("user_departments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
});

// User Cost Center associations
export const userCostCenters = pgTable("user_cost_centers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  costCenterId: integer("cost_center_id").references(() => costCenters.id),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  contact: text("contact"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  productsServices: text("products_services"),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment Methods table
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").default(true),
});

// Purchase Requests table
export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  requesterId: integer("requester_id").references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  costCenterId: integer("cost_center_id").references(() => costCenters.id),
  category: text("category").notNull(), // Produto, Serviço, Outros
  urgency: text("urgency").notNull(), // Baixo, Médio, Alto
  justification: text("justification").notNull(),
  idealDeliveryDate: timestamp("ideal_delivery_date"),
  availableBudget: decimal("available_budget", { precision: 10, scale: 2 }),
  additionalInfo: text("additional_info"),

  // Phase-specific fields
  currentPhase: text("current_phase").notNull().default("solicitacao"),

  // Aprovação A1
  approverA1Id: integer("approver_a1_id").references(() => users.id),
  approvedA1: boolean("approved_a1"),
  rejectionReasonA1: text("rejection_reason_a1"),
  approvalDateA1: timestamp("approval_date_a1"),

  // Cotação
  buyerId: integer("buyer_id").references(() => users.id),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),

  // Aprovação A2
  approverA2Id: integer("approver_a2_id").references(() => users.id),
  approvedA2: boolean("approved_a2"),
  rejectionReasonA2: text("rejection_reason_a2"),
  rejectionActionA2: text("rejection_action_a2"), // 'arquivar' or 'recotacao'
  approvalDateA2: timestamp("approval_date_a2"),
  chosenSupplierId: integer("chosen_supplier_id").references(() => suppliers.id),
  choiceReason: text("choice_reason"), // Melhor Preço, Melhor Relacionamento, etc.
  negotiatedValue: decimal("negotiated_value", { precision: 10, scale: 2 }),
  discountsObtained: decimal("discounts_obtained", { precision: 10, scale: 2 }),
  deliveryDate: timestamp("delivery_date"),

  // Pedido de Compra
  purchaseDate: timestamp("purchase_date"),
  purchaseObservations: text("purchase_observations"),

  // Recebimento
  receivedById: integer("received_by_id").references(() => users.id),
  receivedDate: timestamp("received_date"),
  hasPendency: boolean("has_pendency").default(false),
  pendencyReason: text("pendency_reason"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Request Items table
export const purchaseRequestItems = pgTable("purchase_request_items", {
  id: serial("id").primaryKey(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  stockQuantity: decimal("stock_quantity", { precision: 10, scale: 2 }),
  averageMonthlyQuantity: decimal("average_monthly_quantity", { precision: 10, scale: 2 }),
  requestedQuantity: decimal("requested_quantity", { precision: 10, scale: 2 }).notNull(),
  approvedQuantity: decimal("approved_quantity", { precision: 10, scale: 2 }),
  technicalSpecification: text("technical_specification"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Request Suppliers (for quotation phase)
export const purchaseRequestSuppliers = pgTable("purchase_request_suppliers", {
  id: serial("id").primaryKey(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  quotedValue: decimal("quoted_value", { precision: 10, scale: 2 }),
  quotationDate: timestamp("quotation_date"),
});

// Approval History table
export const approvalHistory = pgTable("approval_history", {
  id: serial("id").primaryKey(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id).notNull(),
  approverType: text("approver_type").notNull(), // 'A1', 'A2'
  approverId: integer("approver_id").references(() => users.id).notNull(),
  approved: boolean("approved").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// File Attachments table
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id),
  quotationId: integer("quotation_id").references(() => quotations.id),
  supplierQuotationId: integer("supplier_quotation_id").references(() => supplierQuotations.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  attachmentType: text("attachment_type").notNull(), // requisition, quotation, purchase_order, supplier_proposal, etc.
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Delivery Locations table
export const deliveryLocations = pgTable("delivery_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  address: text("address").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  observations: text("observations"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RFQ (Request for Quotation) tables
export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id).notNull(),
  deliveryLocationId: integer("delivery_location_id").references(() => deliveryLocations.id),
  status: text("status").notNull().default("draft"), // draft, sent, received, analyzed, approved, rejected
  quotationDeadline: timestamp("quotation_deadline").notNull(),
  termsAndConditions: text("terms_and_conditions"),
  technicalSpecs: text("technical_specs"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  // Multiple RFQs support
  isActive: boolean("is_active").default(true),
  rfqVersion: integer("rfq_version").default(1),
  parentQuotationId: integer("parent_quotation_id").references(() => quotations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").references(() => quotations.id).notNull(),
  itemCode: text("item_code").notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  specifications: text("specifications"),
  deliveryDeadline: timestamp("delivery_deadline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierQuotations = pgTable("supplier_quotations", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").references(() => quotations.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, received, expired, cancelled, no_response
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at"),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  warrantyPeriod: text("warranty_period"), // Período de garantia (ex: "12 meses", "24 meses", "1 ano")
  observations: text("observations"),
  isChosen: boolean("is_chosen").default(false),
  choiceReason: text("choice_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierQuotationItems = pgTable("supplier_quotation_items", {
  id: serial("id").primaryKey(),
  supplierQuotationId: integer("supplier_quotation_id").references(() => supplierQuotations.id).notNull(),
  quotationItemId: integer("quotation_item_id").references(() => quotationItems.id).notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  deliveryDays: integer("delivery_days"),
  brand: text("brand"),
  model: text("model"),
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Purchase Orders tables
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  quotationId: integer("quotation_id").references(() => quotations.id),
  status: text("status").notNull().default("draft"), // draft, sent, confirmed, cancelled, completed
  totalValue: decimal("total_value", { precision: 15, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  deliveryAddress: text("delivery_address"),
  contactPerson: text("contact_person"),
  contactPhone: text("contact_phone"),
  observations: text("observations"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  itemCode: text("item_code").notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  deliveryDeadline: timestamp("delivery_deadline"),
  costCenterId: integer("cost_center_id").references(() => costCenters.id),
  accountCode: text("account_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Receipt/Delivery tables
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  status: text("status").notNull().default("partial"), // partial, complete, pending_approval
  receivedBy: integer("received_by").references(() => users.id).notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  observations: text("observations"),
  qualityApproved: boolean("quality_approved").default(false),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const receiptItems = pgTable("receipt_items", {
  id: serial("id").primaryKey(),
  receiptId: integer("receipt_id").references(() => receipts.id).notNull(),
  purchaseOrderItemId: integer("purchase_order_item_id").references(() => purchaseOrderItems.id).notNull(),
  quantityReceived: decimal("quantity_received", { precision: 10, scale: 3 }).notNull(),
  quantityApproved: decimal("quantity_approved", { precision: 10, scale: 3 }),
  condition: text("condition").notNull().default("good"), // good, damaged, defective
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  departments: many(departments),
  costCenters: many(costCenters),
  suppliers: many(suppliers),
  purchaseRequests: many(purchaseRequests),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  userDepartments: many(userDepartments),
  userCostCenters: many(userCostCenters),
  requestedPurchases: many(purchaseRequests, { relationName: "requester" }),
  approvedA1Purchases: many(purchaseRequests, { relationName: "approverA1" }),
  approvedA2Purchases: many(purchaseRequests, { relationName: "approverA2" }),
  boughtPurchases: many(purchaseRequests, { relationName: "buyer" }),
  receivedPurchases: many(purchaseRequests, { relationName: "receiver" }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  costCenters: many(costCenters),
  users: many(users),
  userDepartments: many(userDepartments),
}));

export const costCentersRelations = relations(costCenters, ({ one, many }) => ({
  department: one(departments, {
    fields: [costCenters.departmentId],
    references: [departments.id],
  }),
  purchaseRequests: many(purchaseRequests),
  userCostCenters: many(userCostCenters),
}));

export const userDepartmentsRelations = relations(userDepartments, ({ one }) => ({
  user: one(users, {
    fields: [userDepartments.userId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [userDepartments.departmentId],
    references: [departments.id],
  }),
}));

export const userCostCentersRelations = relations(userCostCenters, ({ one }) => ({
  user: one(users, {
    fields: [userCostCenters.userId],
    references: [users.id],
  }),
  costCenter: one(costCenters, {
    fields: [userCostCenters.costCenterId],
    references: [costCenters.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  company: one(companies, {
    fields: [suppliers.companyId],
    references: [companies.id],
  }),
  purchaseRequestSuppliers: many(purchaseRequestSuppliers),
  chosenPurchases: many(purchaseRequests, { relationName: "chosenSupplier" }),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one, many }) => ({
  company: one(companies, {
    fields: [purchaseRequests.companyId],
    references: [companies.id],
  }),
  requester: one(users, {
    fields: [purchaseRequests.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  costCenter: one(costCenters, {
    fields: [purchaseRequests.costCenterId],
    references: [costCenters.id],
  }),
  approverA1: one(users, {
    fields: [purchaseRequests.approverA1Id],
    references: [users.id],
    relationName: "approverA1",
  }),
  approverA2: one(users, {
    fields: [purchaseRequests.approverA2Id],
    references: [users.id],
    relationName: "approverA2",
  }),
  buyer: one(users, {
    fields: [purchaseRequests.buyerId],
    references: [users.id],
    relationName: "buyer",
  }),
  receivedBy: one(users, {
    fields: [purchaseRequests.receivedById],
    references: [users.id],
    relationName: "receiver",
  }),
  chosenSupplier: one(suppliers, {
    fields: [purchaseRequests.chosenSupplierId],
    references: [suppliers.id],
    relationName: "chosenSupplier",
  }),
  paymentMethod: one(paymentMethods, {
    fields: [purchaseRequests.paymentMethodId],
    references: [paymentMethods.id],
  }),
  suppliers: many(purchaseRequestSuppliers),
  attachments: many(attachments),
  items: many(purchaseRequestItems),
  approvalHistory: many(approvalHistory),
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [approvalHistory.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  approver: one(users, {
    fields: [approvalHistory.approverId],
    references: [users.id],
  }),
}));

export const purchaseRequestSuppliersRelations = relations(purchaseRequestSuppliers, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseRequestSuppliers.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  supplier: one(suppliers, {
    fields: [purchaseRequestSuppliers.supplierId],
    references: [suppliers.id],
  }),
}));

export const purchaseRequestItemsRelations = relations(purchaseRequestItems, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseRequestItems.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [attachments.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  quotation: one(quotations, {
    fields: [attachments.quotationId],
    references: [quotations.id],
  }),
}));

// Delivery Locations Relations
export const deliveryLocationsRelations = relations(deliveryLocations, ({ many }) => ({
  quotations: many(quotations),
}));

// RFQ Relations
export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [quotations.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  deliveryLocation: one(deliveryLocations, {
    fields: [quotations.deliveryLocationId],
    references: [deliveryLocations.id],
  }),
  createdBy: one(users, {
    fields: [quotations.createdBy],
    references: [users.id],
  }),
  items: many(quotationItems),
  supplierQuotations: many(supplierQuotations),
  attachments: many(attachments),
  purchaseOrders: many(purchaseOrders),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
  supplierQuotationItems: many(supplierQuotationItems),
}));

export const supplierQuotationsRelations = relations(supplierQuotations, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [supplierQuotations.quotationId],
    references: [quotations.id],
  }),
  supplier: one(suppliers, {
    fields: [supplierQuotations.supplierId],
    references: [suppliers.id],
  }),
  items: many(supplierQuotationItems),
}));

export const supplierQuotationItemsRelations = relations(supplierQuotationItems, ({ one }) => ({
  supplierQuotation: one(supplierQuotations, {
    fields: [supplierQuotationItems.supplierQuotationId],
    references: [supplierQuotations.id],
  }),
  quotationItem: one(quotationItems, {
    fields: [supplierQuotationItems.quotationItemId],
    references: [quotationItems.id],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseOrders.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  quotation: one(quotations, {
    fields: [purchaseOrders.quotationId],
    references: [quotations.id],
  }),
  approvedBy: one(users, {
    fields: [purchaseOrders.approvedBy],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
  receipts: many(receipts),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  costCenter: one(costCenters, {
    fields: [purchaseOrderItems.costCenterId],
    references: [costCenters.id],
  }),
  receiptItems: many(receiptItems),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [receipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  receivedBy: one(users, {
    fields: [receipts.receivedBy],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [receipts.approvedBy],
    references: [users.id],
  }),
  items: many(receiptItems),
}));

export const receiptItemsRelations = relations(receiptItems, ({ one }) => ({
  receipt: one(receipts, {
    fields: [receiptItems.receiptId],
    references: [receipts.id],
  }),
  purchaseOrderItem: one(purchaseOrderItems, {
    fields: [receiptItems.purchaseOrderItemId],
    references: [purchaseOrderItems.id],
  }),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
});

export const insertCostCenterSchema = createInsertSchema(costCenters).omit({
  id: true,
  createdAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({
  id: true,
  requestNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  idealDeliveryDate: z.string().optional().transform((val) => val ? new Date(val) : null),
  deliveryDate: z.string().optional().transform((val) => val ? new Date(val) : null),
  availableBudget: z.union([z.string(), z.number()]).optional().transform((val) => val?.toString() || null),
  totalValue: z.string().optional().transform((val) => val || null),
  negotiatedValue: z.string().optional().transform((val) => val || null),
  discountsObtained: z.string().optional().transform((val) => val || null),
  currentPhase: z.enum([
    'solicitacao',
    'aprovacao_a1',
    'cotacao',
    'aprovacao_a2',
    'pedido_compra',
    'recebimento',
    'arquivado'
  ]).optional(),
});

export const insertPurchaseRequestItemSchema = createInsertSchema(purchaseRequestItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stockQuantity: z.union([z.string(), z.number(), z.undefined()]).optional().transform((val) => val?.toString() || "0"),
  averageMonthlyQuantity: z.union([z.string(), z.number(), z.undefined()]).optional().transform((val) => val?.toString() || "0"),
  requestedQuantity: z.union([z.string(), z.number()]).transform((val) => val.toString()),
  approvedQuantity: z.union([z.string(), z.number(), z.undefined(), z.null()]).optional().nullable().transform((val) => val?.toString() || null),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
});

export const insertDeliveryLocationSchema = createInsertSchema(deliveryLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// RFQ Insert schemas
export const insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  quotationNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  quotationDeadline: z.string().transform((val) => new Date(val)),
});

export const insertQuotationItemSchema = createInsertSchema(quotationItems).omit({
  id: true,
  createdAt: true,
}).extend({
  quantity: z.string().transform((val) => val),
  deliveryDeadline: z.string().optional().transform((val) => val ? new Date(val) : null),
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertSupplierQuotationSchema = createInsertSchema(supplierQuotations).omit({
  id: true,
  createdAt: true,
}).extend({
  totalValue: z.string().optional().transform((val) => val || null),
  sentAt: z.string().optional().transform((val) => val ? new Date(val) : null),
  receivedAt: z.string().optional().transform((val) => val ? new Date(val) : null),
});

export const insertSupplierQuotationItemSchema = createInsertSchema(supplierQuotationItems).omit({
  id: true,
  createdAt: true,
}).extend({
  unitPrice: z.string().transform((val) => val),
  totalPrice: z.string().transform((val) => val),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalValue: z.string().transform((val) => val),
  approvedAt: z.string().optional().transform((val) => val ? new Date(val) : null),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
}).extend({
  quantity: z.string().transform((val) => val),
  unitPrice: z.string().transform((val) => val),
  totalPrice: z.string().transform((val) => val),
  deliveryDeadline: z.string().optional().transform((val) => val ? new Date(val) : null),
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  receiptNumber: true,
  createdAt: true,
}).extend({
  receivedAt: z.string().transform((val) => new Date(val)),
  approvedAt: z.string().optional().transform((val) => val ? new Date(val) : null),
});

export const insertReceiptItemSchema = createInsertSchema(receiptItems).omit({
  id: true,
  createdAt: true,
}).extend({
  quantityReceived: z.string().transform((val) => val),
  quantityApproved: z.string().optional().transform((val) => val || null),
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type CostCenter = typeof costCenters.$inferSelect;
export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type DeliveryLocation = typeof deliveryLocations.$inferSelect;
export type InsertDeliveryLocation = z.infer<typeof insertDeliveryLocationSchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type PurchaseRequestSupplier = typeof purchaseRequestSuppliers.$inferSelect;
export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type InsertPurchaseRequestItem = z.infer<typeof insertPurchaseRequestItemSchema>;

// RFQ Types
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;
export type SupplierQuotation = typeof supplierQuotations.$inferSelect;
export type InsertSupplierQuotation = z.infer<typeof insertSupplierQuotationSchema>;
export type SupplierQuotationItem = typeof supplierQuotationItems.$inferSelect;
export type InsertSupplierQuotationItem = z.infer<typeof insertSupplierQuotationItemSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type InsertReceiptItem = z.infer<typeof insertReceiptItemSchema>;
export type ApprovalHistory = typeof approvalHistory.$inferSelect;

// Insert schemas
export const insertApprovalHistorySchema = createInsertSchema(approvalHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertApprovalHistory = z.infer<typeof insertApprovalHistorySchema>;