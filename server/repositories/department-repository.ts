import { db } from "../db";
import { departments, costCenters, userDepartments, userCostCenters, purchaseRequests } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { count } from "drizzle-orm";
import type { Department, InsertDepartment, CostCenter, InsertCostCenter } from "../../shared/schema";

export class DepartmentRepository {
  // Department operations
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
      .set({ ...updateData })
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

  // Cost Center operations
  async getAllCostCenters(): Promise<CostCenter[]> {
    return await db.select().from(costCenters);
  }

  async getCostCenterById(id: number): Promise<CostCenter | undefined> {
    const [costCenter] = await db
      .select()
      .from(costCenters)
      .where(eq(costCenters.id, id));
    return costCenter || undefined;
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
      .set({ ...updateData })
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
}

export const departmentRepository = new DepartmentRepository();
