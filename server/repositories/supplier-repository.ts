import { db } from "../db";
import { suppliers } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { Supplier, InsertSupplier } from "../../shared/schema";

export class SupplierRepository {
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
}

export const supplierRepository = new SupplierRepository();
