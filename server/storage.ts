import {
  users,
  companies,
  departments,
  costCenters,
  userDepartments,
  userCostCenters,
  suppliers,
  paymentMethods,
  purchaseRequests,
  purchaseRequestItems,
  purchaseRequestSuppliers,
  deliveryLocations,
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
  type Company,
  type InsertCompany,
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
  type DeliveryLocation,
  type InsertDeliveryLocation,
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
import { db, pool } from "./db";
import { eq, and, desc, like, sql, gt, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Company operations
  getAllCompanies(): Promise<Company[]>;
  getCompanyById(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;

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
  updateDepartment(
    id: number,
    department: Partial<InsertDepartment>,
  ): Promise<Department>;
  checkDepartmentCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedCostCenters?: number;
    associatedUsers?: number;
  }>;
  deleteDepartment(id: number): Promise<void>;

  // Cost Center operations
  getAllCostCenters(): Promise<CostCenter[]>;
  getCostCentersByDepartment(departmentId: number): Promise<CostCenter[]>;
  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;
  updateCostCenter(
    id: number,
    costCenter: Partial<InsertCostCenter>,
  ): Promise<CostCenter>;
  checkCostCenterCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedUsers?: number;
    associatedRequests?: number;
  }>;
  deleteCostCenter(id: number): Promise<void>;

  // User delete operations
  deleteUser(id: number): Promise<void>;
  checkUserCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedRequests?: number;
  }>;

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
  updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>,
  ): Promise<Supplier>;

  // Payment Method operations
  getAllPaymentMethods(): Promise<PaymentMethod[]>;
  createPaymentMethod(
    paymentMethod: InsertPaymentMethod,
  ): Promise<PaymentMethod>;

  // Delivery Location operations
  getAllDeliveryLocations(): Promise<DeliveryLocation[]>;
  getDeliveryLocationById(id: number): Promise<DeliveryLocation | undefined>;
  createDeliveryLocation(
    deliveryLocation: InsertDeliveryLocation,
  ): Promise<DeliveryLocation>;
  updateDeliveryLocation(
    id: number,
    deliveryLocation: Partial<InsertDeliveryLocation>,
  ): Promise<DeliveryLocation>;
  deleteDeliveryLocation(id: number): Promise<void>;

  // Purchase Request operations
  getAllPurchaseRequests(): Promise<PurchaseRequest[]>;
  getPurchaseRequestById(id: number): Promise<PurchaseRequest | undefined>;
  createPurchaseRequest(
    request: InsertPurchaseRequest,
  ): Promise<PurchaseRequest>;
  updatePurchaseRequest(
    id: number,
    request: Partial<InsertPurchaseRequest>,
  ): Promise<PurchaseRequest>;
  getPurchaseRequestsByPhase(phase: string): Promise<PurchaseRequest[]>;
  getPurchaseRequestsByUser(userId: number): Promise<PurchaseRequest[]>;
  deletePurchaseRequest(id: number): Promise<void>;

  // Purchase Request Items operations
  getPurchaseRequestItems(
    purchaseRequestId: number,
  ): Promise<PurchaseRequestItem[]>;
  createPurchaseRequestItem(
    item: InsertPurchaseRequestItem,
  ): Promise<PurchaseRequestItem>;
  updatePurchaseRequestItem(
    id: number,
    item: Partial<InsertPurchaseRequestItem>,
  ): Promise<PurchaseRequestItem>;
  deletePurchaseRequestItem(id: number): Promise<void>;
  createPurchaseRequestItems(
    items: InsertPurchaseRequestItem[],
  ): Promise<PurchaseRequestItem[]>;

  // RFQ (Quotation) operations
  getAllQuotations(): Promise<Quotation[]>;
  getQuotationById(id: number): Promise<Quotation | undefined>;
  getQuotationByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation | undefined>;
  getRFQHistoryByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation[]>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(
    id: number,
    quotation: Partial<InsertQuotation>,
  ): Promise<Quotation>;

  // Quotation Items operations
  getQuotationItems(quotationId: number): Promise<QuotationItem[]>;
  createQuotationItem(item: InsertQuotationItem): Promise<QuotationItem>;
  updateQuotationItem(
    id: number,
    item: Partial<InsertQuotationItem>,
  ): Promise<QuotationItem>;
  deleteQuotationItem(id: number): Promise<void>;

  // Supplier Quotations operations
  getSupplierQuotations(quotationId: number): Promise<SupplierQuotation[]>;
  getSupplierQuotationById(id: number): Promise<SupplierQuotation | undefined>;
  createSupplierQuotation(
    supplierQuotation: InsertSupplierQuotation,
  ): Promise<SupplierQuotation>;
  updateSupplierQuotation(
    id: number,
    supplierQuotation: Partial<InsertSupplierQuotation>,
  ): Promise<SupplierQuotation>;

  // Supplier Quotation Items operations
  getSupplierQuotationItems(
    supplierQuotationId: number,
  ): Promise<SupplierQuotationItem[]>;
  createSupplierQuotationItem(
    item: InsertSupplierQuotationItem,
  ): Promise<SupplierQuotationItem>;
  updateSupplierQuotationItem(
    id: number,
    item: Partial<InsertSupplierQuotationItem>,
  ): Promise<SupplierQuotationItem>;

  // Approval History operations
  getApprovalHistory(purchaseRequestId: number): Promise<any[]>;
  createApprovalHistory(
    approvalHistory: InsertApprovalHistory,
  ): Promise<ApprovalHistory>;

  // Complete Timeline operations
  getCompleteTimeline(purchaseRequestId: number): Promise<any[]>;

  // Attachment operations
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;

  // Initialize default data
  initializeDefaultData(): Promise<void>;

  // Method to cleanup Purchase Requests data
  cleanupPurchaseRequestsData(): Promise<void>;

  // Password reset methods
  generatePasswordResetToken(email: string): Promise<string | null>;
  validatePasswordResetToken(token: string): Promise<User | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
}

// Create aliases for user tables
const requesterUser = alias(users, "requester_user");
const approverA1User = alias(users, "approver_a1_user");

export class DatabaseStorage implements IStorage {
  // Company operations
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.active, true));
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.update(companies).set({ active: false }).where(eq(companies.id, id));
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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

  async deleteUser(id: number): Promise<void> {
    // Delete all user associations first
    await db.delete(userDepartments).where(eq(userDepartments.userId, id));
    await db.delete(userCostCenters).where(eq(userCostCenters.userId, id));

    // Delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async checkUserCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedRequests?: number;
  }> {
    // Check if user has any purchase requests as requester
    const requestsAsRequester = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.requesterId, id));

    // Check if user has any purchase requests as approver A1
    const requestsAsApproverA1 = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.approverA1Id, id));

    // Check if user has any purchase requests as approver A2
    const requestsAsApproverA2 = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.approverA2Id, id));

    // Check approval history
    const approvalHistoryCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(approvalHistory)
      .where(eq(approvalHistory.approverId, id));

    const totalRequests =
      Number(requestsAsRequester[0].count) +
      Number(requestsAsApproverA1[0].count) +
      Number(requestsAsApproverA2[0].count);

    const totalApprovals = Number(approvalHistoryCount[0].count);

    if (totalRequests > 0 || totalApprovals > 0) {
      return {
        canDelete: false,
        reason:
          "Usuário possui solicitações de compra ou histórico de aprovações associadas",
        associatedRequests: totalRequests + totalApprovals,
      };
    }

    return { canDelete: true };
  }

  async getAllDepartments(companyId?: number): Promise<Department[]> {
    const query = db.select().from(departments);
    if (companyId) {
      query.where(eq(departments.companyId, companyId));
    }
    return await query;
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db
      .insert(departments)
      .values(department)
      .returning();
    return newDepartment;
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id));
    return department || undefined;
  }

  async updateDepartment(
    id: number,
    updateData: Partial<InsertDepartment>,
  ): Promise<Department> {
    const [department] = await db
      .update(departments)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return department;
  }

  async checkDepartmentCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedCostCenters?: number;
    associatedUsers?: number;
  }> {
    // Check if department has cost centers
    const costCentersCount = await db
      .select({ count: count() })
      .from(costCenters)
      .where(eq(costCenters.departmentId, id));

    const totalCostCenters = Number(costCentersCount[0].count);

    // Check if department has users
    const usersCount = await db
      .select({ count: count() })
      .from(userDepartments)
      .where(eq(userDepartments.departmentId, id));

    const totalUsers = Number(usersCount[0].count);

    if (totalCostCenters > 0) {
      return {
        canDelete: false,
        reason: "Departamento possui centros de custo associados",
        associatedCostCenters: totalCostCenters,
        associatedUsers: totalUsers,
      };
    }

    if (totalUsers > 0) {
      return {
        canDelete: false,
        reason: "Departamento possui usuários associados",
        associatedCostCenters: totalCostCenters,
        associatedUsers: totalUsers,
      };
    }

    return { canDelete: true };
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getAllCostCenters(): Promise<CostCenter[]> {
    return await db.select().from(costCenters);
  }

  async getCostCentersByDepartment(
    departmentId: number,
  ): Promise<CostCenter[]> {
    return await db
      .select()
      .from(costCenters)
      .where(eq(costCenters.departmentId, departmentId));
  }

  async createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter> {
    const [newCostCenter] = await db
      .insert(costCenters)
      .values(costCenter)
      .returning();
    return newCostCenter;
  }

  async updateCostCenter(
    id: number,
    updateData: Partial<InsertCostCenter>,
  ): Promise<CostCenter> {
    const [costCenter] = await db
      .update(costCenters)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(costCenters.id, id))
      .returning();
    return costCenter;
  }

  async checkCostCenterCanBeDeleted(
    id: number,
  ): Promise<{
    canDelete: boolean;
    reason?: string;
    associatedUsers?: number;
    associatedRequests?: number;
  }> {
    // Check if cost center has users
    const usersCount = await db
      .select({ count: count() })
      .from(userCostCenters)
      .where(eq(userCostCenters.costCenterId, id));

    const totalUsers = Number(usersCount[0].count);

    // Check if cost center has purchase requests
    const requestsCount = await db
      .select({ count: count() })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.costCenterId, id));

    const totalRequests = Number(requestsCount[0].count);

    if (totalUsers > 0) {
      return {
        canDelete: false,
        reason: "Centro de custo possui usuários associados",
        associatedUsers: totalUsers,
        associatedRequests: totalRequests,
      };
    }

    if (totalRequests > 0) {
      return {
        canDelete: false,
        reason: "Centro de custo possui solicitações de compra associadas",
        associatedUsers: totalUsers,
        associatedRequests: totalRequests,
      };
    }

    return { canDelete: true };
  }

  async deleteCostCenter(id: number): Promise<void> {
    await db.delete(costCenters).where(eq(costCenters.id, id));
  }

  async getUserDepartments(userId: number): Promise<number[]> {
    const userDepts = await db
      .select({ departmentId: userDepartments.departmentId })
      .from(userDepartments)
      .where(eq(userDepartments.userId, userId));
    return userDepts.map((ud) => ud.departmentId!).filter((id) => id !== null);
  }

  async assignUserToDepartment(
    userId: number,
    departmentId: number,
  ): Promise<void> {
    await db
      .insert(userDepartments)
      .values({ userId, departmentId })
      .onConflictDoNothing();
  }

  async removeUserFromDepartment(
    userId: number,
    departmentId: number,
  ): Promise<void> {
    await db
      .delete(userDepartments)
      .where(
        and(
          eq(userDepartments.userId, userId),
          eq(userDepartments.departmentId, departmentId),
        ),
      );
  }

  async getUserCostCenters(userId: number): Promise<number[]> {
    const userCostCentersList = await db
      .select({ costCenterId: userCostCenters.costCenterId })
      .from(userCostCenters)
      .where(eq(userCostCenters.userId, userId));
    return userCostCentersList
      .map((uc) => uc.costCenterId!)
      .filter((id) => id !== null);
  }

  async assignUserToCostCenter(
    userId: number,
    costCenterId: number,
  ): Promise<void> {
    await db
      .insert(userCostCenters)
      .values({ userId, costCenterId })
      .onConflictDoNothing();
  }

  async removeUserFromCostCenter(
    userId: number,
    costCenterId: number,
  ): Promise<void> {
    await db
      .delete(userCostCenters)
      .where(
        and(
          eq(userCostCenters.userId, userId),
          eq(userCostCenters.costCenterId, costCenterId),
        ),
      );
  }

  async setUserCostCenters(
    userId: number,
    costCenterIds: number[],
  ): Promise<void> {
    // Remove all existing associations
    await db.delete(userCostCenters).where(eq(userCostCenters.userId, userId));

    // Add new associations
    if (costCenterIds.length > 0) {
      await db
        .insert(userCostCenters)
        .values(
          costCenterIds.map((costCenterId) => ({ userId, costCenterId })),
        );
    }
  }

  async getAllSuppliers(companyId?: number): Promise<Supplier[]> {
    const query = db.select().from(suppliers);
    if (companyId) {
      query.where(eq(suppliers.companyId, companyId));
    }
    return await query;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db
      .insert(suppliers)
      .values(supplier)
      .returning();
    return newSupplier;
  }

  async getSupplierById(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));
    return supplier || undefined;
  }

  async updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>,
  ): Promise<Supplier> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({
        ...supplier,
        // Ensure we don't accidentally clear the companyId
        companyId: supplier.companyId || undefined,
      })
      .where(eq(suppliers.id, id))
      .returning();
    
    if (!updatedSupplier) {
      throw new Error("Supplier not found");
    }
    
    return updatedSupplier;
  }

  async getAllPaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods);
  }

  async createPaymentMethod(
    paymentMethod: InsertPaymentMethod,
  ): Promise<PaymentMethod> {
    const [newPaymentMethod] = await db
      .insert(paymentMethods)
      .values(paymentMethod)
      .returning();
    return newPaymentMethod;
  }

  async getAllDeliveryLocations(): Promise<DeliveryLocation[]> {
    return await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.active, true));
  }

  async getDeliveryLocationById(
    id: number,
  ): Promise<DeliveryLocation | undefined> {
    const [location] = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.id, id));
    return location || undefined;
  }

  async createDeliveryLocation(
    deliveryLocation: InsertDeliveryLocation,
  ): Promise<DeliveryLocation> {
    const [newLocation] = await db
      .insert(deliveryLocations)
      .values(deliveryLocation)
      .returning();
    return newLocation;
  }

  async updateDeliveryLocation(
    id: number,
    deliveryLocation: Partial<InsertDeliveryLocation>,
  ): Promise<DeliveryLocation> {
    const [updatedLocation] = await db
      .update(deliveryLocations)
      .set({ ...deliveryLocation, updatedAt: new Date() })
      .where(eq(deliveryLocations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteDeliveryLocation(id: number): Promise<void> {
    await db
      .update(deliveryLocations)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(deliveryLocations.id, id));
  }

  async getAllPurchaseRequests(companyId?: number): Promise<PurchaseRequest[]> {
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
        approvedA2: purchaseRequests.approvedA2,
        rejectionReasonA2: purchaseRequests.rejectionReasonA2,
        rejectionActionA2: purchaseRequests.rejectionActionA2,
        approvalDateA2: purchaseRequests.approvalDateA2,
        chosenSupplierId: purchaseRequests.chosenSupplierId,
        choiceReason: purchaseRequests.choiceReason,
        negotiatedValue: purchaseRequests.negotiatedValue,
        discountsObtained: purchaseRequests.discountsObtained,
        deliveryDate: purchaseRequests.deliveryDate,
        purchaseDate: purchaseRequests.purchaseDate,
        purchaseObservations: purchaseRequests.purchaseObservations,
        receivedById: purchaseRequests.receivedById,
        receivedDate: purchaseRequests.receivedDate,
        hasPendency: purchaseRequests.hasPendency,
        pendencyReason: purchaseRequests.pendencyReason,
        createdAt: purchaseRequests.createdAt,
        updatedAt: purchaseRequests.updatedAt,
        // Requester data
        requester: {
          id: requesterUser.id,
          firstName: requesterUser.firstName,
          lastName: requesterUser.lastName,
          username: requesterUser.username,
          email: requesterUser.email,
        },
        // Approver A1 data
        approverA1: {
          id: approverA1User.id,
          firstName: approverA1User.firstName,
          lastName: approverA1User.lastName,
          username: approverA1User.username,
          email: approverA1User.email,
        },
        // Cost Center and Department data
        costCenter: {
          id: costCenters.id,
          code: costCenters.code,
          name: costCenters.name,
          departmentId: costCenters.departmentId,
        },
        department: {
          id: departments.id,
          name: departments.name,
          description: departments.description,
        },
        // Check if quotation exists
        hasQuotation: sql<boolean>`EXISTS(SELECT 1 FROM ${quotations} WHERE ${quotations.purchaseRequestId} = ${purchaseRequests.id})`,
      })
      .from(purchaseRequests)
      .leftJoin(
        requesterUser,
        eq(purchaseRequests.requesterId, requesterUser.id),
      )
      .leftJoin(
        approverA1User,
        eq(purchaseRequests.approverA1Id, approverA1User.id),
      )
      .leftJoin(costCenters, eq(purchaseRequests.costCenterId, costCenters.id))
      .leftJoin(departments, eq(costCenters.departmentId, departments.id))
      .where(companyId ? eq(purchaseRequests.companyId, companyId) : undefined)
      .orderBy(desc(purchaseRequests.createdAt));

    return requests as any[];
  }

  async getPurchaseRequestById(
    id: number,
  ): Promise<PurchaseRequest | undefined> {
    // First get the purchase request
    const [request] = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, id));

    if (!request) {
      return undefined;
    }

    // Then get the requester data separately if requesterId exists
    let requester = null;
    let requesterName = "N/A";
    let requesterUsername = "N/A";
    let requesterEmail = "";

    if (request.requesterId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.requesterId));

      if (user) {
        requester = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        };
        requesterName = user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.username;
        requesterUsername = user.username;
        requesterEmail = user.email || "";
      }
    }

    // Return the complete object with all necessary fields
    const result = {
      ...request,
      requester,
      requesterName,
      requesterUsername,
      requesterEmail,
    };

    return result as any;
  }

  async createPurchaseRequest(
    request: InsertPurchaseRequest,
  ): Promise<PurchaseRequest> {
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
    const requestNumber = `${prefix}${String(nextSequence).padStart(3, "0")}`;

    const [newRequest] = await db
      .insert(purchaseRequests)
      .values({ ...request, requestNumber })
      .returning();
    return newRequest;
  }

  async updatePurchaseRequest(
    id: number,
    request: Partial<InsertPurchaseRequest>,
  ): Promise<PurchaseRequest> {
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
  async getPurchaseRequestItems(
    purchaseRequestId: number,
  ): Promise<PurchaseRequestItem[]> {
    return await db
      .select()
      .from(purchaseRequestItems)
      .where(eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId))
      .orderBy(purchaseRequestItems.id);
  }

  async createPurchaseRequestItem(
    item: InsertPurchaseRequestItem,
  ): Promise<PurchaseRequestItem> {
    const [newItem] = await db
      .insert(purchaseRequestItems)
      .values(item)
      .returning();
    return newItem;
  }

  async updatePurchaseRequestItem(
    id: number,
    item: Partial<InsertPurchaseRequestItem>,
  ): Promise<PurchaseRequestItem> {
    const [updatedItem] = await db
      .update(purchaseRequestItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(purchaseRequestItems.id, id))
      .returning();
    return updatedItem;
  }

  async deletePurchaseRequestItem(id: number): Promise<void> {
    await db
      .delete(purchaseRequestItems)
      .where(eq(purchaseRequestItems.id, id));
  }

  async createPurchaseRequestItems(
    items: InsertPurchaseRequestItem[],
  ): Promise<PurchaseRequestItem[]> {
    if (items.length === 0) return [];

    return await db.insert(purchaseRequestItems).values(items).returning();
  }

  // RFQ (Quotation) operations
  async getAllQuotations(): Promise<Quotation[]> {
    return await db
      .select()
      .from(quotations)
      .orderBy(desc(quotations.createdAt));
  }

  async getQuotationById(id: number): Promise<Quotation | undefined> {
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, id));
    return quotation || undefined;
  }

  async getQuotationByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation | undefined> {
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(
        and(
          eq(quotations.purchaseRequestId, purchaseRequestId),
          eq(quotations.isActive, true)
        )
      );
    return quotation || undefined;
  }

  async getRFQHistoryByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation[]> {
    const quotationHistory = await db
      .select()
      .from(quotations)
      .where(eq(quotations.purchaseRequestId, purchaseRequestId))
      .orderBy(desc(quotations.createdAt));
    return quotationHistory;
  }

  async createQuotation(quotationData: InsertQuotation): Promise<Quotation> {
    // Check if there's an existing quotation for this purchase request
    const existingQuotations = await db
      .select()
      .from(quotations)
      .where(eq(quotations.purchaseRequestId, quotationData.purchaseRequestId))
      .orderBy(desc(quotations.rfqVersion));

    // If there's an existing quotation, deactivate it and create a new version
    let newVersion = 1;
    let parentQuotationId: number | undefined;

    if (existingQuotations.length > 0) {
      const currentQuotation = existingQuotations[0];
      newVersion = (currentQuotation.rfqVersion || 1) + 1;
      parentQuotationId = currentQuotation.id;

      // Deactivate the current quotation
      await db
        .update(quotations)
        .set({ isActive: false })
        .where(eq(quotations.id, currentQuotation.id));
    }

    // Generate quotation number
    const year = new Date().getFullYear();
    const quotationsThisYear = await db
      .select()
      .from(quotations)
      .where(like(quotations.quotationNumber, `COT-${year}-%`));

    // Find the highest number used this year
    let maxNumber = 0;
    quotationsThisYear.forEach((q) => {
      const match = q.quotationNumber.match(/COT-\d{4}-(\d{4})/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    });

    const quotationNumber = `COT-${year}-${String(maxNumber + 1).padStart(4, "0")}`;

    const [quotation] = await db
      .insert(quotations)
      .values({
        ...quotationData,
        quotationNumber,
        rfqVersion: newVersion,
        parentQuotationId,
        isActive: true,
      })
      .returning();
    return quotation;
  }

  async updateQuotation(
    id: number,
    quotationData: Partial<InsertQuotation>,
  ): Promise<Quotation> {
    const [quotation] = await db
      .update(quotations)
      .set({ ...quotationData, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    return quotation;
  }

  // Quotation Items operations
  async getQuotationItems(quotationId: number): Promise<QuotationItem[]> {
    return await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quotationId));
  }

  async createQuotationItem(
    itemData: InsertQuotationItem,
  ): Promise<QuotationItem> {
    const [item] = await db.insert(quotationItems).values(itemData).returning();
    return item;
  }

  async updateQuotationItem(
    id: number,
    itemData: Partial<InsertQuotationItem>,
  ): Promise<QuotationItem> {
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
  async getSupplierQuotations(
    quotationId: number,
  ): Promise<SupplierQuotation[]> {
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
        isChosen: supplierQuotations.isChosen,
        choiceReason: supplierQuotations.choiceReason,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          cnpj: suppliers.cnpj,
          contact: suppliers.contact,
          address: suppliers.address,
          paymentTerms: suppliers.paymentTerms,
        },
      })
      .from(supplierQuotations)
      .leftJoin(suppliers, eq(supplierQuotations.supplierId, suppliers.id))
      .where(eq(supplierQuotations.quotationId, quotationId));
  }

  async getSupplierQuotationById(
    id: number,
  ): Promise<SupplierQuotation | undefined> {
    const [supplierQuotation] = await db
      .select()
      .from(supplierQuotations)
      .where(eq(supplierQuotations.id, id));
    return supplierQuotation || undefined;
  }

  async createSupplierQuotation(
    supplierQuotationData: InsertSupplierQuotation,
  ): Promise<SupplierQuotation> {
    const [supplierQuotation] = await db
      .insert(supplierQuotations)
      .values(supplierQuotationData)
      .returning();
    return supplierQuotation;
  }

  async updateSupplierQuotation(
    id: number,
    supplierQuotationData: Partial<InsertSupplierQuotation>,
  ): Promise<SupplierQuotation> {
    const [supplierQuotation] = await db
      .update(supplierQuotations)
      .set(supplierQuotationData)
      .where(eq(supplierQuotations.id, id))
      .returning();
    return supplierQuotation;
  }

  // Supplier Quotation Items operations
  async getSupplierQuotationItems(
    supplierQuotationId: number,
  ): Promise<SupplierQuotationItem[]> {
    return await db
      .select()
      .from(supplierQuotationItems)
      .where(
        eq(supplierQuotationItems.supplierQuotationId, supplierQuotationId),
      );
  }

  async createSupplierQuotationItem(
    itemData: InsertSupplierQuotationItem,
  ): Promise<SupplierQuotationItem> {
    const [item] = await db
      .insert(supplierQuotationItems)
      .values(itemData)
      .returning();
    return item;
  }

  async updateSupplierQuotationItem(
    id: number,
    itemData: Partial<InsertSupplierQuotationItem>,
  ): Promise<SupplierQuotationItem> {
    const [item] = await db
      .update(supplierQuotationItems)
      .set(itemData)
      .where(eq(supplierQuotationItems.id, id))
      .returning();
    return item;
  }

  async deletePurchaseRequest(id: number): Promise<void> {
    // Primeiro, deletar todos os itens associados
    await db
      .delete(purchaseRequestItems)
      .where(eq(purchaseRequestItems.purchaseRequestId, id));

    // Depois, deletar a requisição
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));
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
        },
      })
      .from(approvalHistory)
      .leftJoin(users, eq(approvalHistory.approverId, users.id))
      .where(eq(approvalHistory.purchaseRequestId, purchaseRequestId))
      .orderBy(desc(approvalHistory.createdAt));
  }

  async createApprovalHistory(
    approvalHistoryData: InsertApprovalHistory,
  ): Promise<ApprovalHistory> {
    const [newApprovalHistory] = await db
      .insert(approvalHistory)
      .values(approvalHistoryData)
      .returning();
    return newApprovalHistory;
  }

  async getCompleteTimeline(purchaseRequestId: number): Promise<any[]> {
    // Get the purchase request details
    const request = await this.getPurchaseRequestById(purchaseRequestId);
    if (!request) {
      return [];
    }

    const timeline: any[] = [];

    // 1. Request Creation
    timeline.push({
      id: 'request_created',
      type: 'creation',
      phase: 'solicitacao',
      action: 'Solicitação criada',
      userId: request.requesterId,
      userName: request.requester?.firstName && request.requester?.lastName
        ? `${request.requester.firstName} ${request.requester.lastName}`
        : request.requester?.username || 'Sistema',
      timestamp: request.createdAt,
      status: 'completed',
      icon: 'file-plus',
      description: `Solicitação ${request.requestNumber} criada`
    });

    // 2. Get approval history and convert to timeline events
    const approvals = await this.getApprovalHistory(purchaseRequestId);
    for (const approval of approvals) {
      const phaseMap: Record<string, string> = {
        'A1': 'aprovacao_a1',
        'A2': 'aprovacao_a2'
      };

      timeline.push({
        id: `approval_${approval.id}`,
        type: 'approval',
        phase: phaseMap[approval.approverType] || approval.approverType,
        action: approval.approved ? 'Aprovação' : 'Reprovação',
        userId: approval.approver?.id,
        userName: approval.approver?.firstName && approval.approver?.lastName
          ? `${approval.approver.firstName} ${approval.approver.lastName}`
          : approval.approver?.username || 'Sistema',
        timestamp: approval.createdAt,
        status: approval.approved ? 'approved' : 'rejected',
        icon: approval.approved ? 'check-circle' : 'x-circle',
        description: approval.approved 
          ? `Aprovado por ${approval.approver?.firstName || approval.approver?.username || 'Sistema'}`
          : `Reprovado por ${approval.approver?.firstName || approval.approver?.username || 'Sistema'}`,
        reason: approval.rejectionReason
      });
    }

    // 3. Phase transitions based on request data
    if (request.quotationDate) {
      timeline.push({
        id: 'quotation_created',
        type: 'quotation',
        phase: 'cotacao',
        action: 'RFQ criada',
        userId: request.createdBy || request.requesterId,
        userName: 'Sistema',
        timestamp: request.quotationDate,
        status: 'completed',
        icon: 'file-text',
        description: 'Solicitação de cotação enviada aos fornecedores'
      });
    }

    if (request.approvedA2Date) {
      timeline.push({
        id: 'supplier_selected',
        type: 'supplier_selection',
        phase: 'cotacao',
        action: 'Fornecedor selecionado',
        userId: request.approverA2Id,
        userName: 'Sistema',
        timestamp: request.approvedA2Date,
        status: 'completed',
        icon: 'check-circle',
        description: 'Fornecedor vencedor selecionado'
      });
    }

    if (request.purchaseDate) {
      timeline.push({
        id: 'purchase_order_created',
        type: 'purchase_order',
        phase: 'pedido_compra',
        action: 'Pedido de compra criado',
        userId: request.createdBy || request.requesterId,
        userName: 'Sistema',
        timestamp: request.purchaseDate,
        status: 'completed',
        icon: 'shopping-cart',
        description: 'Pedido de compra oficial gerado'
      });
    }

    if (request.receivedDate) {
      timeline.push({
        id: 'material_received',
        type: 'receipt',
        phase: 'recebimento',
        action: 'Material recebido',
        userId: request.receivedById,
        userName: 'Sistema',
        timestamp: request.receivedDate,
        status: 'completed',
        icon: 'package-check',
        description: 'Material recebido e conferido'
      });
    }

    if (request.currentPhase === 'conclusao_compra' || request.currentPhase === 'arquivado') {
      timeline.push({
        id: 'process_completed',
        type: 'completion',
        phase: request.currentPhase,
        action: request.currentPhase === 'arquivado' ? 'Processo arquivado' : 'Processo concluído',
        userId: request.updatedBy || request.requesterId,
        userName: 'Sistema',
        timestamp: request.updatedAt || new Date(),
        status: 'completed',
        icon: request.currentPhase === 'arquivado' ? 'archive' : 'check-circle-2',
        description: request.currentPhase === 'arquivado' 
          ? 'Processo arquivado com sucesso'
          : 'Processo de compra concluído'
      });
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  }

  async createAttachment(
    attachmentData: InsertAttachment,
  ): Promise<Attachment> {
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

      // 6. Delete attachments (all types)
      await db.delete(attachments);
      console.log("✅ Attachments deletados");

      // 7. Delete supplier quotations
      await db.delete(supplierQuotations);
      console.log("✅ Supplier quotations deletados");

      // 8. Delete quotation items
      await db.delete(quotationItems);
      console.log("✅ Quotation items deletados");

      // 9. Delete quotations
      await db.delete(quotations);
      console.log("✅ Quotations deletados");

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
      console.log(
        "📋 Dados mantidos: usuários, departamentos, centros de custo, fornecedores, métodos de pagamento e locais de entrega",
      );
    } catch (error) {
      console.error("❌ Erro durante a limpeza:", error);
      throw error;
    }
  }

  async generatePasswordResetToken(email: string): Promise<string | null> {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        return null;
      }

      // Generate a secure random token
      const token =
        Math.random().toString(36).substr(2, 15) +
        Math.random().toString(36).substr(2, 15);

      // Set expiration to 1 hour from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Update user with reset token and expiration
      await db
        .update(users)
        .set({
          passwordResetToken: token,
          passwordResetExpires: expiresAt,
        })
        .where(eq(users.id, user.id));

      return token;
    } catch (error) {
      console.error("Error generating password reset token:", error);
      return null;
    }
  }

  async validatePasswordResetToken(token: string): Promise<User | null> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.passwordResetToken, token),
            gt(users.passwordResetExpires, new Date()),
          ),
        )
        .limit(1);

      return user[0] || null;
    } catch (error) {
      console.error("Error validating password reset token:", error);
      return null;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.validatePasswordResetToken(token);
      if (!user) {
        return false;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db
        .update(users)
        .set({
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        })
        .where(eq(users.id, user.id));

      return true;
    } catch (error) {
      console.error("Error resetting password:", error);
      return false;
    }
  }

  async initializeDefaultData(): Promise<void> {
    // Check if admin user already exists
    const adminUser = await this.getUserByUsername("admin");
    if (adminUser) {
      console.log("Admin user already exists, skipping initialization");
      return; // Admin user already exists
    }

    // Create default company if none exist
    const existingCompanies = await this.getAllCompanies();
    if (existingCompanies.length === 0) {
      await this.createCompany({
        name: "Empresa Matriz",
        cnpj: "00.000.000/0001-00",
        address: "Endereço da empresa",
        phone: "(11) 99999-9999",
        email: "contato@empresa.com",
        active: true
      });
    }

    // Create default payment methods (check if they exist first)
    const defaultPaymentMethods = [
      { name: "Boleto", active: true },
      { name: "Cheque", active: true },
      { name: "Transferência Bancária", active: true },
      { name: "Cartão de Crédito", active: true },
      { name: "Dinheiro", active: true },
      { name: "Pix", active: true },
    ];

    const existingPaymentMethods = await this.getAllPaymentMethods();
    const existingMethodNames = existingPaymentMethods.map(pm => pm.name);

    for (const method of defaultPaymentMethods) {
      if (!existingMethodNames.includes(method.name)) {
        await this.createPaymentMethod(method);
      }
    }

    // Create default departments and cost centers (check if they exist first)
    const defaultDepartments = [
      { name: "TI", description: "Tecnologia da Informação" },
      { name: "Financeiro", description: "Departamento Financeiro" },
      { name: "RH", description: "Recursos Humanos" },
      { name: "Marketing", description: "Marketing e Vendas" },
      { name: "Administrativo", description: "Departamento Administrativo" },
    ];

    const existingDepartments = await this.getAllDepartments();
    const existingDeptNames = existingDepartments.map(d => d.name);
    const existingCostCenters = await this.getAllCostCenters();
    const existingCostCenterCodes = existingCostCenters.map(cc => cc.code);

    for (const dept of defaultDepartments) {
      let department;
      
      // Check if department already exists
      if (existingDeptNames.includes(dept.name)) {
        department = existingDepartments.find(d => d.name === dept.name);
      } else {
        department = await this.createDepartment(dept);
      }

      if (department) {
        // Create cost centers for each department (check if they exist first)
        const generalCostCenterCode = `${dept.name.toUpperCase()}-GER-001`;
        if (!existingCostCenterCodes.includes(generalCostCenterCode)) {
          await this.createCostCenter({
            code: generalCostCenterCode,
            name: `${dept.name} - Geral`,
            departmentId: department.id,
          });
        }

        if (dept.name === "TI") {
          const devCostCenterCode = "TI-DEV-001";
          if (!existingCostCenterCodes.includes(devCostCenterCode)) {
            await this.createCostCenter({
              code: devCostCenterCode,
              name: "TI - Desenvolvimento",
              departmentId: department.id,
            });
          }
        }
      }
    }

    // Create default admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await this.createUser({
      username: "admin",
      password: hashedPassword,
      email: "admin@empresa.com",
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