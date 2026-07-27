import { db } from "../db";
import { unitsOfMeasure, purchaseRequestItems } from "../../shared/schema";
import { eq, count, asc } from "drizzle-orm";
import type { UnitOfMeasure, InsertUnitOfMeasure } from "../../shared/schema";

export class UnitOfMeasureRepository {
  async getAllUnits(includeInactive = false): Promise<UnitOfMeasure[]> {
    if (includeInactive) {
      return await db.select().from(unitsOfMeasure).orderBy(asc(unitsOfMeasure.code));
    }
    return await db
      .select()
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.active, true))
      .orderBy(asc(unitsOfMeasure.code));
  }

  async getUnitByCode(code: string): Promise<UnitOfMeasure | undefined> {
    const [unit] = await db
      .select()
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.code, code.toUpperCase().trim()));
    return unit || undefined;
  }

  async createUnit(unit: InsertUnitOfMeasure): Promise<UnitOfMeasure> {
    const codeUpper = unit.code.toUpperCase().trim();
    const [newUnit] = await db
      .insert(unitsOfMeasure)
      .values({
        ...unit,
        code: codeUpper,
        description: unit.description.trim(),
        active: unit.active ?? true,
        updatedAt: new Date(),
      })
      .returning();
    return newUnit;
  }

  async updateUnit(
    code: string,
    updateData: Partial<InsertUnitOfMeasure>
  ): Promise<UnitOfMeasure> {
    const codeUpper = code.toUpperCase().trim();
    const setData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (updateData.description !== undefined) {
      setData.description = updateData.description.trim();
    }
    if (updateData.active !== undefined) {
      setData.active = updateData.active;
    }

    const [updatedUnit] = await db
      .update(unitsOfMeasure)
      .set(setData)
      .where(eq(unitsOfMeasure.code, codeUpper))
      .returning();

    if (!updatedUnit) {
      throw new Error("Unidade de medida não encontrada");
    }

    return updatedUnit;
  }

  async checkUnitCanBeDeleted(code: string): Promise<{ canDelete: boolean; usageCount: number; reason?: string }> {
    const codeUpper = code.toUpperCase().trim();
    const result = await db
      .select({ count: count() })
      .from(purchaseRequestItems)
      .where(eq(purchaseRequestItems.unit, codeUpper));

    const usageCount = Number(result[0]?.count || 0);

    if (usageCount > 0) {
      return {
        canDelete: false,
        usageCount,
        reason: `Existem ${usageCount} item(ns) de solicitação utilizando esta unidade de medida.`,
      };
    }

    return { canDelete: true, usageCount: 0 };
  }

  async deleteUnit(code: string): Promise<boolean> {
    const codeUpper = code.toUpperCase().trim();
    const result = await db
      .delete(unitsOfMeasure)
      .where(eq(unitsOfMeasure.code, codeUpper))
      .returning();
    return result.length > 0;
  }
}

export const unitOfMeasureRepository = new UnitOfMeasureRepository();
