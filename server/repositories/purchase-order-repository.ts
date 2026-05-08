import { db } from "../db";
import { purchaseOrders, purchaseOrderItems } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { 
  PurchaseOrder, 
  InsertPurchaseOrder, 
  PurchaseOrderItem, 
  InsertPurchaseOrderItem 
} from "../../shared/schema";

export class PurchaseOrderRepository {
  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
    return purchaseOrder || undefined;
  }

  async getPurchaseOrderByRequestId(purchaseRequestId: number): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseRequestId, purchaseRequestId));
    return purchaseOrder || undefined;
  }

  async createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [created] = await db
      .insert(purchaseOrders)
      .values(purchaseOrder)
      .returning();
    return created;
  }

  async updatePurchaseOrder(
    id: number,
    purchaseOrder: Partial<InsertPurchaseOrder>,
  ): Promise<PurchaseOrder> {
    const [updated] = await db
      .update(purchaseOrders)
      .set({ ...purchaseOrder, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return updated;
  }

  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
      .orderBy(purchaseOrderItems.id);
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [created] = await db
      .insert(purchaseOrderItems)
      .values(item)
      .returning();
    return created;
  }

  async deletePurchaseOrderByRequestId(purchaseRequestId: number): Promise<number> {
    const po = await this.getPurchaseOrderByRequestId(purchaseRequestId);
    if (!po) return 0;
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, po.id));
    return 1;
  }

  async updatePurchaseOrderItem(
    id: number,
    item: Partial<InsertPurchaseOrderItem>,
  ): Promise<PurchaseOrderItem> {
    const [updated] = await db
      .update(purchaseOrderItems)
      .set(item)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return updated;
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
