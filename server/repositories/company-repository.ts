import { db } from "../db";
import { companies } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { Company, InsertCompany } from "../../shared/schema";

export class CompanyRepository {
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
}

export const companyRepository = new CompanyRepository();
