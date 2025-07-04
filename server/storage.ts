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
  quotations,
  quotationItems,
  supplierQuotations,
  supplierQuotationItems,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
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

  // Initialize default data
  initializeDefaultData(): Promise<void>;
}

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
    return await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
  }

  async getPurchaseRequestById(id: number): Promise<PurchaseRequest | undefined> {
    const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
    return request || undefined;
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
    const count = await db.select().from(quotations).where(eq(quotations.quotationNumber, `COT-${year}-%`));
    const quotationNumber = `COT-${year}-${String(count.length + 1).padStart(4, '0')}`;

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
    return await db.select().from(supplierQuotations).where(eq(supplierQuotations.quotationId, quotationId));
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

  async initializeDefaultData(): Promise<void> {
    // Check if data already exists
    const existingPaymentMethods = await this.getAllPaymentMethods();
    if (existingPaymentMethods.length > 0) return;

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
    });
  }
}

export const storage = new DatabaseStorage();
