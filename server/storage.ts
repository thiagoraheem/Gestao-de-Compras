import {
  users,
  departments,
  costCenters,
  userDepartments,
  userCostCenters,
  suppliers,
  paymentMethods,
  purchaseRequests,
  purchaseRequestItems,
  purchaseRequestSuppliers,
  quotations,
  quotationItems,
  supplierQuotations,
  supplierQuotationItems,
  purchaseOrders,
  purchaseOrderItems,
  receipts,
  receiptItems,
  attachments,
  approvalHistory,
  type User,
  type InsertUser,
  type Department,
  type InsertDepartment,
  type CostCenter,
  type InsertCostCenter,
  type Supplier,
  type InsertSupplier,
  type PurchaseRequest,
  type InsertPurchaseRequest,
  type PurchaseRequestItem,
  type InsertPurchaseRequestItem,
  type PaymentMethod,
  type InsertPaymentMethod,
  type Quotation,
  type InsertQuotation,
  type QuotationItem,
  type InsertQuotationItem,
  type SupplierQuotation,
  type InsertSupplierQuotation,
  type SupplierQuotationItem,
  type InsertSupplierQuotationItem,
  type ApprovalHistory,
  type InsertApprovalHistory,
  type Attachment,
  type InsertAttachment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Department operations
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  getDepartmentById(id: number): Promise<Department | undefined>;

  // Cost Center operations
  getAllCostCenters(): Promise<CostCenter[]>;
  getCostCentersByDepartment(departmentId: number): Promise<CostCenter[]>;
  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;

  // User Department associations
  getUserDepartments(userId: number): Promise<number[]>;
  assignUserToDepartment(userId: number, departmentId: number): Promise<void>;
  removeUserFromDepartment(userId: number, departmentId: number): Promise<void>;

  // User Cost Center associations
  getUserCostCenters(userId: number): Promise<number[]>;
  assignUserToCostCenter(userId: number, costCenterId: number): Promise<void>;
  removeUserFromCostCenter(userId: number, costCenterId: number): Promise<void>;
  setUserCostCenters(userId: number, costCenterIds: number[]): Promise<void>;

  // Supplier operations
  getAllSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  getSupplierById(id: number): Promise<Supplier | undefined>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier>;

  // Payment Method operations
  getAllPaymentMethods(): Promise<PaymentMethod[]>;
  createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod>;

  // Purchase Request operations
  getAllPurchaseRequests(): Promise<PurchaseRequest[]>;
  getPurchaseRequestById(id: number): Promise<PurchaseRequest | undefined>;
  createPurchaseRequest(request: InsertPurchaseRequest): Promise<PurchaseRequest>;
  updatePurchaseRequest(id: number, request: Partial<InsertPurchaseRequest>): Promise<PurchaseRequest>;
  getPurchaseRequestsByPhase(phase: string): Promise<PurchaseRequest[]>;
  getPurchaseRequestsByUser(userId: number): Promise<PurchaseRequest[]>;
  deletePurchaseRequest(id: number): Promise<void>;

  // Purchase Request Items operations
  getPurchaseRequestItems(purchaseRequestId: number): Promise<PurchaseRequestItem[]>;
  createPurchaseRequestItem(item: InsertPurchaseRequestItem): Promise<PurchaseRequestItem>;
  updatePurchaseRequestItem(id: number, item: Partial<InsertPurchaseRequestItem>): Promise<PurchaseRequestItem>;
  deletePurchaseRequestItem(id: number): Promise<void>;
  createPurchaseRequestItems(items: InsertPurchaseRequestItem[]): Promise<PurchaseRequestItem[]>;

  // RFQ (Quotation) operations
  getAllQuotations(): Promise<Quotation[]>;
  getQuotationById(id: number): Promise<Quotation | undefined>;
  getQuotationByPurchaseRequestId(purchaseRequestId: number): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation>;

  // Quotation Items operations
  getQuotationItems(quotationId: number): Promise<QuotationItem[]>;
  createQuotationItem(item: InsertQuotationItem): Promise<QuotationItem>;
  updateQuotationItem(id: number, item: Partial<InsertQuotationItem>): Promise<QuotationItem>;
  deleteQuotationItem(id: number): Promise<void>;

  // Supplier Quotations operations
  getSupplierQuotations(quotationId: number): Promise<SupplierQuotation[]>;
  getSupplierQuotationById(id: number): Promise<SupplierQuotation | undefined>;
  createSupplierQuotation(supplierQuotation: InsertSupplierQuotation): Promise<SupplierQuotation>;
  updateSupplierQuotation(id: number, supplierQuotation: Partial<InsertSupplierQuotation>): Promise<SupplierQuotation>;

  // Supplier Quotation Items operations
  getSupplierQuotationItems(supplierQuotationId: number): Promise<SupplierQuotationItem[]>;
  createSupplierQuotationItem(item: InsertSupplierQuotationItem): Promise<SupplierQuotationItem>;
  updateSupplierQuotationItem(id: number, item: Partial<InsertSupplierQuotationItem>): Promise<SupplierQuotationItem>;

  // Approval History operations
  getApprovalHistory(purchaseRequestId: number): Promise<any[]>;
  createApprovalHistory(approvalHistory: InsertApprovalHistory): Promise<ApprovalHistory>;

  // Attachment operations
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;

  // Initialize default data
  initializeDefaultData(): Promise<void>;

  // Method to cleanup Purchase Requests data
  cleanupPurchaseRequestsData(): Promise<void>;
}

// Create aliases for user tables
const requesterUser = alias(users, "requester_user");
const approverA1User = alias(users, "approver_a1_user");

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db
      .insert(departments)
      .values(department)
      .returning();
    return newDepartment;
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department || undefined;
  }

  async getAllCostCenters(): Promise<CostCenter[]> {
    return await db.select().from(costCenters);
  }

  async getCostCentersByDepartment(departmentId: number): Promise<CostCenter[]> {
    return await db.select().from(costCenters).where(eq(costCenters.departmentId, departmentId));
  }

  async createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter> {
    const [newCostCenter] = await db
      .insert(costCenters)
      .values(costCenter)
      .returning();
    return newCostCenter;
  }

  async getUserDepartments(userId: number): Promise<number[]> {
    const userDepts = await db
      .select({ departmentId: userDepartments.departmentId })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId));
    return userDepts.map(ud => ud.departmentId!).filter(id => id !== null);
  }

  async assignUserToDepartment(userId: number, departmentId: number): Promise<void> {
    await db
      .insert(userDepartments)
      .values({ userId, departmentId })
      .onConflictDoNothing();
  }

  async removeUserFromDepartment(userId: number, departmentId: number): Promise<void> {
    await db
      .delete(userDepartments)
      .where(and(eq(userDepartments.userId, userId), eq(userDepartments.departmentId, departmentId)));
  }

  async getUserCostCenters(userId: number): Promise<number[]> {
    const userCostCentersList = await db
      .select({ costCenterId: userCostCenters.costCenterId })
      .from(userCostCenters)
      .where(eq(userCostCenters.userId, userId));
    return userCostCentersList.map(uc => uc.costCenterId!).filter(id => id !== null);
  }

  async assignUserToCostCenter(userId: number, costCenterId: number): Promise<void> {
    await db
      .insert(userCostCenters)
      .values({ userId, costCenterId })
      .onConflictDoNothing();
  }

  async removeUserFromCostCenter(userId: number, costCenterId: number): Promise<void> {
    await db
      .delete(userCostCenters)
      .where(and(eq(userCostCenters.userId, userId), eq(userCostCenters.costCenterId, costCenterId)));
  }

  async setUserCostCenters(userId: number, costCenterIds: number[]): Promise<void> {
    // Remove all existing associations
    await db.delete(userCostCenters).where(eq(userCostCenters.userId, userId));

    // Add new associations
    if (costCenterIds.length > 0) {
      await db.insert(userCostCenters).values(
        costCenterIds.map(costCenterId => ({ userId, costCenterId }))
      );
    }
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db
      .insert(suppliers)
      .values(supplier)
      .returning();
    return newSupplier;
  }

  async getSupplierById(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier || undefined;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set(supplier)
      .where(eq(suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async getAllPaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods);
  }

  async createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod> {
    const [newPaymentMethod] = await db
      .insert(paymentMethods)
      .values(paymentMethod)
      .returning();
    return newPaymentMethod;
  }

  async getAllPurchaseRequests(): Promise<PurchaseRequest[]> {
    const requests = await db
      .select({
        id: purchaseRequests.id,
        requestNumber: purchaseRequests.requestNumber,
        requesterId: purchaseRequests.requesterId,
        costCenterId: purchaseRequests.costCenterId,
        category: purchaseRequests.category,
        urgency: purchaseRequests.urgency,
        justification: purchaseRequests.justification,
        idealDeliveryDate: purchaseRequests.idealDeliveryDate,
        availableBudget: purchaseRequests.availableBudget,
        additionalInfo: purchaseRequests.additionalInfo,
        currentPhase: purchaseRequests.currentPhase,
        approverA1Id: purchaseRequests.approverA1Id,
        approvedA1: purchaseRequests.approvedA1,
        rejectionReasonA1: purchaseRequests.rejectionReasonA1,
        approvalDateA1: purchaseRequests.approvalDateA1,
        buyerId: purchaseRequests.buyerId,
        totalValue: purchaseRequests.totalValue,
        paymentMethodId: purchaseRequests.paymentMethodId,
        approverA2Id: purchaseRequests.approverA2Id,
        chosenSupplierId: purchaseRequests.chosenSupplierId,
        choiceReason: purchaseRequests.choiceReason,
        negotiatedValue: purchaseRequests.negotiatedValue,
        discountsObtained: purchaseRequests.discountsObtained,
        deliveryDate: purchaseRequests.deliveryDate,
        purchaseDate: purchaseRequests.purchaseDate,
        purchaseObservations: purchaseRequests.purchaseObservations,
        receivedById: purchaseRequests.receivedById,
        receivedDate: purchaseRequests.receivedDate,
        createdAt: purchaseRequests.createdAt,
        updatedAt: purchaseRequests.updatedAt,
        // Requester data
        requester: {
          id: requesterUser.id,
          firstName: requesterUser.firstName,
          lastName: requesterUser.lastName,
          username: requesterUser.username,
          email: requesterUser.email
        },
        // Approver A1 data
        approverA1: {
          id: approverA1User.id,
          firstName: approverA1User.firstName,
          lastName: approverA1User.lastName,
          username: approverA1User.username,
          email: approverA1User.email
        },
        // Cost Center and Department data
        costCenter: {
          id: costCenters.id,
          code: costCenters.code,
          name: costCenters.name,
          departmentId: costCenters.departmentId
        },
        department: {
          id: departments.id,
          name: departments.name,
          description: departments.description
        },
        // Check if quotation exists
        hasQuotation: sql<boolean>`EXISTS(SELECT 1 FROM ${quotations} WHERE ${quotations.purchaseRequestId} = ${purchaseRequests.id})`
      })
      .from(purchaseRequests)
      .leftJoin(requesterUser, eq(purchaseRequests.requesterId, requesterUser.id))
      .leftJoin(approverA1User, eq(purchaseRequests.approverA1Id, approverA1User.id))
      .leftJoin(costCenters, eq(purchaseRequests.costCenterId, costCenters.id))
      .leftJoin(departments, eq(costCenters.departmentId, departments.id))
      .orderBy(desc(purchaseRequests.createdAt));

    return requests as any[];
  }

  async getPurchaseRequestById(id: number): Promise<PurchaseRequest | undefined> {
    // First get the basic purchase request data
    const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));

    if (!request) {
      return undefined;
    }

    // Then get requester data if exists
    let requesterData = null;
    if (request.requesterId) {
      const [requester] = await db.select().from(users).where(eq(users.id, request.requesterId));
      if (requester) {
        requesterData = {
          requesterName: `${requester.firstName || ''} ${requester.lastName || ''}`.trim(),
          requesterUsername: requester.username,
          requesterEmail: requester.email
        };
      }
    }

    // Combine the data
    const result = {
      ...request,
      requesterName: requesterData?.requesterName || '',
      requesterUsername: requesterData?.requesterUsername || '',
      requesterEmail: requesterData?.requesterEmail || ''
    };

    return result as any;
  }

  async createPurchaseRequest(request: InsertPurchaseRequest): Promise<PurchaseRequest> {
    // Generate request number
    const year = new Date().getFullYear();
    const requests = await db
      .select()
      .from(purchaseRequests)
      .orderBy(desc(purchaseRequests.requestNumber));

    let maxSequence = 0;
    const prefix = `SOL-${year}-`;

    // Find the highest sequence number for the current year
    for (const req of requests) {
      if (req.requestNumber?.startsWith(prefix)) {
        const sequence = parseInt(req.requestNumber.substring(prefix.length));
        if (!isNaN(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }

    // Generate next sequence number
    const nextSequence = maxSequence + 1;
    const requestNumber = `${prefix}${String(nextSequence).padStart(3, '0')}`;

    const [newRequest] = await db
      .insert(purchaseRequests)
      .values({ ...request, requestNumber })
      .returning();
    return newRequest;
  }

  async updatePurchaseRequest(id: number, request: Partial<InsertPurchaseRequest>): Promise<PurchaseRequest> {
    const [updatedRequest] = await db
      .update(purchaseRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(purchaseRequests.id, id))
      .returning();
    return updatedRequest;
  }

  async getPurchaseRequestsByPhase(phase: string): Promise<PurchaseRequest[]> {
    return await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.currentPhase, phase))
      .orderBy(desc(purchaseRequests.createdAt));
  }

  async getPurchaseRequestsByUser(userId: number): Promise<PurchaseRequest[]> {
    return await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, userId))
      .orderBy(desc(purchaseRequests.createdAt));
  }

  // Purchase Request Items operations
  async getPurchaseRequestItems(purchaseRequestId: number): Promise<PurchaseRequestItem[]> {
    return await db
      .select()
      .from(purchaseRequestItems)
      .where(eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId))
      .orderBy(purchaseRequestItems.id);
  }

  async createPurchaseRequestItem(item: InsertPurchaseRequestItem): Promise<PurchaseRequestItem> {
    const [newItem] = await db
      .insert(purchaseRequestItems)
      .values(item)
      .returning();
    return newItem;
  }

  async updatePurchaseRequestItem(id: number, item: Partial<InsertPurchaseRequestItem>): Promise<PurchaseRequestItem> {
    const [updatedItem] = await db
      .update(purchaseRequestItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(purchaseRequestItems.id, id))
      .returning();
    return updatedItem;
  }

  async deletePurchaseRequestItem(id: number): Promise<void> {
    await db.delete(purchaseRequestItems).where(eq(purchaseRequestItems.id, id));
  }

  async createPurchaseRequestItems(items: InsertPurchaseRequestItem[]): Promise<PurchaseRequestItem[]> {
    if (items.length === 0) return [];

    return await db
      .insert(purchaseRequestItems)
      .values(items)
      .returning();
  }

  // RFQ (Quotation) operations
  async getAllQuotations(): Promise<Quotation[]> {
    return await db.select().from(quotations).orderBy(desc(quotations.createdAt));
  }

  async getQuotationById(id: number): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation || undefined;
  }

  async getQuotationByPurchaseRequestId(purchaseRequestId: number): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.purchaseRequestId, purchaseRequestId));
    return quotation || undefined;
  }

  async createQuotation(quotationData: InsertQuotation): Promise<Quotation> {
    // Generate quotation number
    const year = new Date().getFullYear();
    const quotationsThisYear = await db
      .select()
      .from(quotations)
      .where(like(quotations.quotationNumber, `COT-${year}-%`));

    // Find the highest number used this year
    let maxNumber = 0;
    quotationsThisYear.forEach(q => {
      const match = q.quotationNumber.match(/COT-\d{4}-(\d{4})/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    });

    const quotationNumber = `COT-${year}-${String(maxNumber + 1).padStart(4, '0')}`;

    const [quotation] = await db
      .insert(quotations)
      .values({
        ...quotationData,
        quotationNumber,
      })
      .returning();
    return quotation;
  }

  async updateQuotation(id: number, quotationData: Partial<InsertQuotation>): Promise<Quotation> {
    const [quotation] = await db
      .update(quotations)
      .set({ ...quotationData, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    return quotation;
  }

  // Quotation Items operations
  async getQuotationItems(quotationId: number): Promise<QuotationItem[]> {
    return await db.select().from(quotationItems).where(eq(quotationItems.quotationId, quotationId));
  }

  async createQuotationItem(itemData: InsertQuotationItem): Promise<QuotationItem> {
    const [item] = await db
      .insert(quotationItems)
      .values(itemData)
      .returning();
    return item;
  }

  async updateQuotationItem(id: number, itemData: Partial<InsertQuotationItem>): Promise<QuotationItem> {
    const [item] = await db
      .update(quotationItems)
      .set(itemData)
      .where(eq(quotationItems.id, id))
      .returning();
    return item;
  }

  async deleteQuotationItem(id: number): Promise<void> {
    await db.delete(quotationItems).where(eq(quotationItems.id, id));
  }

  // Supplier Quotations operations
  async getSupplierQuotations(quotationId: number): Promise<SupplierQuotation[]> {
    return await db
      .select({
        id: supplierQuotations.id,
        quotationId: supplierQuotations.quotationId,
        supplierId: supplierQuotations.supplierId,
        status: supplierQuotations.status,
        sentAt: supplierQuotations.sentAt,
        receivedAt: supplierQuotations.receivedAt,
        totalValue: supplierQuotations.totalValue,
        paymentTerms: supplierQuotations.paymentTerms,
        deliveryTerms: supplierQuotations.deliveryTerms,
        observations: supplierQuotations.observations,
        createdAt: supplierQuotations.createdAt,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
        }
      })
      .from(supplierQuotations)
      .leftJoin(suppliers, eq(supplierQuotations.supplierId, suppliers.id))
      .where(eq(supplierQuotations.quotationId, quotationId));
  }

  async getSupplierQuotationById(id: number): Promise<SupplierQuotation | undefined> {
    const [supplierQuotation] = await db.select().from(supplierQuotations).where(eq(supplierQuotations.id, id));
    return supplierQuotation || undefined;
  }

  async createSupplierQuotation(supplierQuotationData: InsertSupplierQuotation): Promise<SupplierQuotation> {
    const [supplierQuotation] = await db
      .insert(supplierQuotations)
      .values(supplierQuotationData)
      .returning();
    return supplierQuotation;
  }

  async updateSupplierQuotation(id: number, supplierQuotationData: Partial<InsertSupplierQuotation>): Promise<SupplierQuotation> {
    const [supplierQuotation] = await db
      .update(supplierQuotations)
      .set(supplierQuotationData)
      .where(eq(supplierQuotations.id, id))
      .returning();
    return supplierQuotation;
  }

  // Supplier Quotation Items operations
  async getSupplierQuotationItems(supplierQuotationId: number): Promise<SupplierQuotationItem[]> {
    return await db.select().from(supplierQuotationItems).where(eq(supplierQuotationItems.supplierQuotationId, supplierQuotationId));
  }

  async createSupplierQuotationItem(itemData: InsertSupplierQuotationItem): Promise<SupplierQuotationItem> {
    const [item] = await db
      .insert(supplierQuotationItems)
      .values(itemData)
      .returning();
    return item;
  }

  async updateSupplierQuotationItem(id: number, itemData: Partial<InsertSupplierQuotationItem>): Promise<SupplierQuotationItem> {
    const [item] = await db
      .update(supplierQuotationItems)
      .set(itemData)
      .where(eq(supplierQuotationItems.id, id))
      .returning();
    return item;
  }

  async deletePurchaseRequest(id: number): Promise<void> {
    // Primeiro, deletar todos os itens associados
    await db.delete(purchaseRequestItems)
      .where(eq(purchaseRequestItems.purchaseRequestId, id));

    // Depois, deletar a requisição
    await db.delete(purchaseRequests)
      .where(eq(purchaseRequests.id, id));
  }

  // Approval History operations
  async getApprovalHistory(purchaseRequestId: number): Promise<any[]> {
    return await db
      .select({
        id: approvalHistory.id,
        approverType: approvalHistory.approverType,
        approved: approvalHistory.approved,
        rejectionReason: approvalHistory.rejectionReason,
        createdAt: approvalHistory.createdAt,
        approver: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(approvalHistory)
      .leftJoin(users, eq(approvalHistory.approverId, users.id))
      .where(eq(approvalHistory.purchaseRequestId, purchaseRequestId))
      .orderBy(desc(approvalHistory.createdAt));
  }

  async createApprovalHistory(approvalHistoryData: InsertApprovalHistory): Promise<ApprovalHistory> {
    const [newApprovalHistory] = await db
      .insert(approvalHistory)
      .values(approvalHistoryData)
      .returning();
    return newApprovalHistory;
  }

  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db
      .insert(attachments)
      .values(attachmentData)
      .returning();
    return attachment;
  }

  async cleanupPurchaseRequestsData(): Promise<void> {
    console.log("🧹 Iniciando limpeza dos dados de solicitações...");

    try {
      // Delete in the correct order to respect foreign key constraints

      // 1. Delete receipt items first
      await db.delete(receiptItems);
      console.log("✅ Receipt items deletados");

      // 2. Delete receipts
      await db.delete(receipts);
      console.log("✅ Receipts deletados");

      // 3. Delete purchase order items
      await db.delete(purchaseOrderItems);
      console.log("✅ Purchase order items deletados");

      // 4. Delete purchase orders
      await db.delete(purchaseOrders);
      console.log("✅ Purchase orders deletados");

      // 5. Delete supplier quotation items
      await db.delete(supplierQuotationItems);
      console.log("✅ Supplier quotation items deletados");

      // 6. Delete supplier quotations
      await db.delete(supplierQuotations);
      console.log("✅ Supplier quotations deletados");

      // 7. Delete quotation items
      await db.delete(quotationItems);
      console.log("✅ Quotation items deletados");

      // 8. Delete quotations
      await db.delete(quotations);
      console.log("✅ Quotations deletados");

      // 9. Delete attachments
      await db.delete(attachments);
      console.log("✅ Attachments deletados");

      // 10. Delete approval history
      await db.delete(approvalHistory);
      console.log("✅ Approval history deletado");

      // 11. Delete purchase request suppliers
      await db.delete(purchaseRequestSuppliers);
      console.log("✅ Purchase request suppliers deletados");

      // 12. Delete purchase request items
      await db.delete(purchaseRequestItems);
      console.log("✅ Purchase request items deletados");

      // 13. Finally, delete purchase requests
      await db.delete(purchaseRequests);
      console.log("✅ Purchase requests deletados");

      console.log("🎉 Limpeza concluída com sucesso!");
      console.log("📋 Dados mantidos: usuários, departamentos, centros de custo, fornecedores e métodos de pagamento");

    } catch (error) {
      console.error("❌ Erro durante a limpeza:", error);
      throw error;
    }
  }

  async initializeDefaultData(): Promise<void> {
    // Check if data already exists
    const existingUsers = await this.getAllUsers();
    if (existingUsers.length > 0) {
      return; // Data already initialized
    }

    // Create default payment methods
    const defaultPaymentMethods = [
      { name: "Boleto", active: true },
      { name: "Cheque", active: true },
      { name: "Transferência Bancária", active: true },
      { name: "Cartão de Crédito", active: true },
      { name: "Dinheiro", active: true },
      { name: "Pix", active: true },
    ];

    for (const method of defaultPaymentMethods) {
      await this.createPaymentMethod(method);
    }

    // Create default departments and cost centers
    const defaultDepartments = [
      { name: "TI", description: "Tecnologia da Informação" },
      { name: "Financeiro", description: "Departamento Financeiro" },
      { name: "RH", description: "Recursos Humanos" },
      { name: "Marketing", description: "Marketing e Vendas" },
      { name: "Administrativo", description: "Departamento Administrativo" },
    ];

    for (const dept of defaultDepartments) {
      const department = await this.createDepartment(dept);

      // Create cost centers for each department
      await this.createCostCenter({
        code: `${dept.name.toUpperCase()}-GER-001`,
        name: `${dept.name} - Geral`,
        departmentId: department.id,
      });

      if (dept.name === "TI") {
        await this.createCostCenter({
          code: "TI-DEV-001",
          name: "TI - Desenvolvimento",
          departmentId: department.id,
        });
      }
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await this.createUser({
      username: "admin",
      email: "admin@empresa.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Sistema",
      isBuyer: true,
      isApproverA1: true,
      isApproverA2: true,
      isAdmin: true,
    });
  }
}

export const storage = new DatabaseStorage();