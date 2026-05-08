import { db } from "../db";
import { purchaseOrders, purchaseOrderItems, suppliers } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { 
  PurchaseOrder, 
  InsertPurchaseOrder, 
  PurchaseOrderItem, 
  InsertPurchaseOrderItem 
} from "../../shared/schema";

export class PurchaseOrderRepository {
  async getPurchaseOrderById(id: number): Promise<any | undefined> {
    const [result] = await db
      .select({
        purchaseOrder: purchaseOrders,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          cnpj: suppliers.cnpj,
        },
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, id));

    if (!result) return undefined;
    return { ...result.purchaseOrder, supplier: result.supplier };
  }

  async getPurchaseOrderByRequestId(purchaseRequestId: number): Promise<any | undefined> {
    const [result] = await db
      .select({
        purchaseOrder: purchaseOrders,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          cnpj: suppliers.cnpj,
        },
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.purchaseRequestId, purchaseRequestId));

    if (!result) return undefined;
    return { ...result.purchaseOrder, supplier: result.supplier };
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
