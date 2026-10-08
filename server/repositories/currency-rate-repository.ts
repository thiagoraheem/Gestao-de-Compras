import { db } from "../db";
import { currencyRates, users } from "../../shared/schema";
import { eq, and, desc, gte, lte, asc, sql } from "drizzle-orm";
import type { CurrencyRate, InsertCurrencyRate } from "../../shared/schema";

export interface CurrencyRateWithUser extends CurrencyRate {
  createdByUser?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    username: string;
  } | null;
}

export class CurrencyRateRepository {
  async listRates(filters?: {
    currencyCode?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<CurrencyRateWithUser[]> {
    const conditions: any[] = [];

    if (filters?.currencyCode) {
      conditions.push(eq(currencyRates.currencyCode, filters.currencyCode.toUpperCase()));
    }

    if (filters?.fromDate) {
      conditions.push(gte(currencyRates.rateDate, new Date(filters.fromDate)));
    }

    if (filters?.toDate) {
      const toDate = new Date(filters.toDate);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(currencyRates.rateDate, toDate));
    }

    const results = await db
      .select({
        currencyRate: currencyRates,
        createdByUser: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
        },
      })
      .from(currencyRates)
      .leftJoin(users, eq(currencyRates.createdBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(currencyRates.rateDate), desc(currencyRates.id));

    return results.map((row) => ({
      ...row.currencyRate,
      createdByUser: row.createdByUser?.id ? row.createdByUser : null,
    }));
  }

  async getLatestRate(currencyCode: string): Promise<CurrencyRate | undefined> {
    const [rate] = await db
      .select()
      .from(currencyRates)
      .where(eq(currencyRates.currencyCode, currencyCode.toUpperCase()))
      .orderBy(desc(currencyRates.rateDate), desc(currencyRates.id))
      .limit(1);
    return rate || undefined;
  }

  async getTodayRate(currencyCode: string): Promise<CurrencyRate | undefined> {
    const code = currencyCode.toUpperCase();
    const result = await db
      .select()
      .from(currencyRates)
      .where(
        and(
          eq(currencyRates.currencyCode, code),
          sql`DATE(${currencyRates.rateDate}) = CURRENT_DATE`
        )
      )
      .orderBy(desc(currencyRates.rateDate), desc(currencyRates.id))
      .limit(1);
    return result[0] || undefined;
  }

  async getById(id: number): Promise<CurrencyRate | undefined> {
    const [rate] = await db
      .select()
      .from(currencyRates)
      .where(eq(currencyRates.id, id));
    return rate || undefined;
  }

  async createRate(
    data: InsertCurrencyRate & { createdBy: number }
  ): Promise<CurrencyRate> {
    const [rate] = await db
      .insert(currencyRates)
      .values({
        currencyCode: data.currencyCode.toUpperCase(),
        rateDate: data.rateDate,
        rateValue: data.rateValue,
        observations: data.observations,
        createdBy: data.createdBy,
      })
      .returning();
    return rate;
  }

  async updateRate(
    id: number,
    data: Partial<InsertCurrencyRate> & { updatedBy?: number }
  ): Promise<CurrencyRate> {
    const setData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.currencyCode !== undefined) {
      setData.currencyCode = data.currencyCode.toUpperCase();
    }
    if (data.rateDate !== undefined) {
      setData.rateDate = data.rateDate;
    }
    if (data.rateValue !== undefined) {
      setData.rateValue = data.rateValue;
    }
    if (data.observations !== undefined) {
      setData.observations = data.observations;
    }

    const [rate] = await db
      .update(currencyRates)
      .set(setData)
      .where(eq(currencyRates.id, id))
      .returning();
    return rate;
  }

  async deleteRate(id: number): Promise<void> {
    await db.delete(currencyRates).where(eq(currencyRates.id, id));
  }
}

export const currencyRateRepository = new CurrencyRateRepository();
