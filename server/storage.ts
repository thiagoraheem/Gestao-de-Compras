import {
  users,
  departments,
  costCenters,
  userDepartments,
  userCostCenters,
  suppliers,
  paymentMethods,
  purchaseRequests,
  purchaseRequestSuppliers,
  attachments,
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
  type PaymentMethod,
  type InsertPaymentMethod,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, desc } from "drizzle-orm";
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
    const count = await db.select().from(purchaseRequests);
    const requestNumber = `SOL-${new Date().getFullYear()}-${String(count.length + 1).padStart(3, '0')}`;
    
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
