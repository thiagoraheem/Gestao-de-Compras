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

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isBuyer: boolean("is_buyer").default(false),
  isApproverA1: boolean("is_approver_a1").default(false),
  isApproverA2: boolean("is_approver_a2").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
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

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  contact: text("contact"),
  email: text("email"),
  productsServices: text("products_services"),
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

// File Attachments table
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  purchaseRequestId: integer("purchase_request_id").references(() => purchaseRequests.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  attachmentType: text("attachment_type").notNull(), // requisition, quotation, purchase_order, etc.
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userDepartments: many(userDepartments),
  requestedPurchases: many(purchaseRequests, { relationName: "requester" }),
  approvedA1Purchases: many(purchaseRequests, { relationName: "approverA1" }),
  approvedA2Purchases: many(purchaseRequests, { relationName: "approverA2" }),
  boughtPurchases: many(purchaseRequests, { relationName: "buyer" }),
  receivedPurchases: many(purchaseRequests, { relationName: "receiver" }),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  costCenters: many(costCenters),
  userDepartments: many(userDepartments),
}));

export const costCentersRelations = relations(costCenters, ({ one, many }) => ({
  department: one(departments, {
    fields: [costCenters.departmentId],
    references: [departments.id],
  }),
  purchaseRequests: many(purchaseRequests),
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

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseRequestSuppliers: many(purchaseRequestSuppliers),
  chosenPurchases: many(purchaseRequests, { relationName: "chosenSupplier" }),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one, many }) => ({
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

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [attachments.purchaseRequestId],
    references: [purchaseRequests.id],
  }),
}));

// Insert schemas
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
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
});

// Types
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
export type Attachment = typeof attachments.$inferSelect;
export type PurchaseRequestSupplier = typeof purchaseRequestSuppliers.$inferSelect;
