import { db } from "../db";
import { auditLogs } from "../../shared/schema";
import { sql } from "drizzle-orm";

export interface AuditLogOptions {
  purchaseRequestId?: number;
  actionType: string;
  actionDescription: string;
  performedBy?: number | null;
  beforeData?: any;
  afterData?: any;
  affectedTables?: string[];
}

export class AuditService {
  async log(options: AuditLogOptions): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        purchaseRequestId: options.purchaseRequestId ?? 0,
        actionType: options.actionType,
        actionDescription: options.actionDescription,
        performedBy: options.performedBy ?? null,
        beforeData: options.beforeData ?? null,
        afterData: options.afterData ?? null,
        affectedTables: options.affectedTables ?? [],
        performedAt: new Date(),
      } as any);
    } catch (error) {
      console.error("Failed to write audit log:", error);
      // We don't throw here to avoid breaking the main business flow if audit fails
    }
  }
}

export const auditService = new AuditService();
