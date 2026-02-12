import {
  supplierIntegrationRuns,
  supplierIntegrationItems,
  type InsertSupplierIntegrationRun,
  type SupplierIntegrationRun,
  type InsertSupplierIntegrationItem,
  type SupplierIntegrationItem,
} from "../../shared/schema";
import { db } from "../db";
import { eq, and, desc, inArray, notInArray } from "drizzle-orm";

export async function createSupplierIntegrationRun(
  run: InsertSupplierIntegrationRun,
): Promise<SupplierIntegrationRun> {
  const [created] = await db
    .insert(supplierIntegrationRuns)
    .values(run)
    .returning();
  return created;
}

export async function updateSupplierIntegrationRun(
  id: number,
  updates: Partial<InsertSupplierIntegrationRun> & {
    status?: SupplierIntegrationRun["status"];
    finishedAt?: Date | null;
    processedSuppliers?: number;
    createdSuppliers?: number;
    updatedSuppliers?: number;
    ignoredSuppliers?: number;
    invalidSuppliers?: number;
    message?: string | null;
    metadata?: Record<string, unknown> | null;
    cancelledBy?: number | null;
  },
): Promise<SupplierIntegrationRun | undefined> {
  const [updated] = await db
    .update(supplierIntegrationRuns)
    .set({ ...updates })
    .where(eq(supplierIntegrationRuns.id, id))
    .returning();
  return updated ?? undefined;
}

export async function getSupplierIntegrationRun(
  id: number,
): Promise<SupplierIntegrationRun | undefined> {
  const [run] = await db
    .select()
    .from(supplierIntegrationRuns)
    .where(eq(supplierIntegrationRuns.id, id));
  return run ?? undefined;
}

export async function listSupplierIntegrationRuns(
  limit = 20,
): Promise<SupplierIntegrationRun[]> {
  return db
    .select()
    .from(supplierIntegrationRuns)
    .orderBy(desc(supplierIntegrationRuns.startedAt))
    .limit(limit);
}

export async function insertSupplierIntegrationItems(
  items: InsertSupplierIntegrationItem[],
): Promise<SupplierIntegrationItem[]> {
  if (items.length === 0) {
    return [];
  }

  return db.insert(supplierIntegrationItems).values(items).returning();
}

export async function getSupplierIntegrationItems(
  runId: number,
): Promise<SupplierIntegrationItem[]> {
  return db
    .select()
    .from(supplierIntegrationItems)
    .where(eq(supplierIntegrationItems.runId, runId))
    .orderBy(supplierIntegrationItems.id);
}

export async function updateSupplierIntegrationItem(
  id: number,
  updates: Partial<InsertSupplierIntegrationItem> & {
    status?: SupplierIntegrationItem["status"];
    selected?: boolean;
    issues?: unknown;
    differences?: unknown;
    payload?: unknown;
    localSupplierId?: number | null;
  },
): Promise<SupplierIntegrationItem | undefined> {
  const [updated] = await db
    .update(supplierIntegrationItems)
    .set({ ...updates })
    .where(eq(supplierIntegrationItems.id, id))
    .returning();
  return updated ?? undefined;
}

export async function getSupplierIntegrationItemsByIds(
  runId: number,
  itemIds: number[],
): Promise<SupplierIntegrationItem[]> {
  if (itemIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(supplierIntegrationItems)
    .where(
      and(
        eq(supplierIntegrationItems.runId, runId),
        inArray(supplierIntegrationItems.id, itemIds),
      ),
    )
    .orderBy(supplierIntegrationItems.id);
}

export async function markIntegrationItemsStatus(
  runId: number,
  status: SupplierIntegrationItem["status"],
): Promise<void> {
  await db
    .update(supplierIntegrationItems)
    .set({ status })
    .where(eq(supplierIntegrationItems.runId, runId));
}

export async function deselectItemsNotInList(
  runId: number,
  allowedIds: number[],
): Promise<void> {
  if (allowedIds.length === 0) {
    await db
      .update(supplierIntegrationItems)
      .set({ selected: false })
      .where(eq(supplierIntegrationItems.runId, runId));
    return;
  }

  await db
    .update(supplierIntegrationItems)
    .set({ selected: false })
    .where(
      and(
        eq(supplierIntegrationItems.runId, runId),
        notInArray(supplierIntegrationItems.id, allowedIds),
      ),
    );
}
