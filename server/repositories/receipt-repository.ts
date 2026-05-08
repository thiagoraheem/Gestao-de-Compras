import { db } from "../db";
import { 
  receipts, 
  receiptItems, 
  purchaseOrders, 
  purchaseOrderItems, 
  purchaseRequests, 
  auditLogs 
} from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import type { 
  Receipt, 
  InsertReceipt, 
  ReceiptItem, 
  InsertReceiptItem,
  PurchaseRequest
} from "../../shared/schema";
import { purchaseOrderRepository } from "./purchase-order-repository";

export class ReceiptRepository {
  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const now = new Date();
    const gen = () => {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      return `REC-${y}${m}${d}-${rand}`;
    };
    const values = {
      receiptNumber: gen(),
      status: receipt.status,
      purchaseOrderId: receipt.purchaseOrderId,
      receivedBy: receipt.receivedBy,
      receivedAt: receipt.receivedAt ?? now,
      observations: receipt.observations ?? null,
      approvedBy: receipt.approvedBy ?? null,
      approvedAt: receipt.approvedAt ?? null,
      qualityApproved: receipt.qualityApproved ?? null,
      createdAt: now,
    };
    const [created] = await db
      .insert(receipts)
      .values(values as any)
      .returning();
    return created as Receipt;
  }

  async createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem> {
    const values = {
      ...item,
      quantityReceived: item.quantityReceived ?? "0",
      quantityApproved: item.quantityApproved ?? null,
      condition: item.condition ?? null,
      observations: item.observations ?? null,
      createdAt: new Date(),
    };
    const [created] = await db
      .insert(receiptItems)
      .values(values as any)
      .returning();
    return created as ReceiptItem;
  }

  async getReceiptsByPurchaseOrderId(purchaseOrderId: number): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(eq(receipts.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(receipts.createdAt));
  }

  async getReceiptById(id: number): Promise<Receipt | undefined> {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, id));
    return receipt;
  }

  async returnToPhysicalReceipt(purchaseRequestId: number, userId: number): Promise<void> {
    const purchaseOrder = await purchaseOrderRepository.getPurchaseOrderByRequestId(purchaseRequestId);
    if (!purchaseOrder) throw new Error("Pedido de compra não encontrado");

    const allReceipts = await this.getReceiptsByPurchaseOrderId(purchaseOrder.id);

    const confirmedReceipts = allReceipts.filter(
      (r) => r.status === "conferida" || r.status === "fiscal_conferida",
    );

    const isPartialReturn = confirmedReceipts.length > 0;

    const receiptsToDelete = isPartialReturn
      ? allReceipts.filter((r) => r.status !== "conferida" && r.status !== "fiscal_conferida")
      : allReceipts;

    // Requirement T05: No physical deletion - mark as cancelled
    for (const receipt of receiptsToDelete) {
      await db.update(receipts)
        .set({ 
          status: "cancelado", 
          receiptPhase: "cancelado",
          updatedAt: new Date() 
        } as any)
        .where(eq(receipts.id, receipt.id));
    }

    if (!isPartialReturn) {
      const poItems = await purchaseOrderRepository.getPurchaseOrderItems(purchaseOrder.id);
      for (const item of poItems) {
        await db
          .update(purchaseOrderItems)
          .set({ quantityReceived: "0" })
          .where(eq(purchaseOrderItems.id, item.id));
      }
    }

    const updateData: Partial<PurchaseRequest> = {
      // NOTE: We no longer revert currentPhase to 'recebimento'.
      // Procurement remains finished (Flow 1). Flow 2 (Receipts) will handle its own states.
      fiscalReceiptAt: null,
      fiscalReceiptById: null,
      updatedAt: new Date(),
    };

    if (!isPartialReturn) {
      updateData.physicalReceiptAt = null;
      updateData.physicalReceiptById = null;
      updateData.receivedDate = null;
      updateData.receivedById = null;
    }

    await db
      .update(purchaseRequests)
      .set(updateData)
      .where(eq(purchaseRequests.id, purchaseRequestId));
    
    // Ensure we have at least one draft receipt in Flow 2 if everything was cancelled
    if (!isPartialReturn) {
        // Create a new draft receipt for Flow 2
        await db.insert(receipts).values({
            purchaseRequestId,
            purchaseOrderId: purchaseOrder.id,
            receiptNumber: `REC-RESTART-${purchaseRequestId}`,
            status: "nf_pendente",
            receiptPhase: "recebimento_fisico",
            supplierId: purchaseOrder.supplierId
        } as any);
    }

    await db
      .update(purchaseOrders)
      .set({
        fulfillmentStatus: isPartialReturn ? "partial" : "pending",
      })
      .where(eq(purchaseOrders.id, purchaseOrder.id));

    try {
      await db.insert(auditLogs).values({
        purchaseRequestId,
        performedBy: userId,
        actionType: "phase_rollback_receipt",
        actionDescription: `Retorno da Conf. Fiscal para Recebimento Físico. Tipo: ${isPartialReturn ? "Parcial" : "Total"}. ${receiptsToDelete.length} recibos excluídos.`,
        performedAt: new Date(),
        beforeData: {
          phase: "conf_fiscal",
          isPartialReturn,
        } as any,
        afterData: {
          phase: "recebimento",
          receiptsDeleted: receiptsToDelete.map((r) => r.id),
        } as any,
        affectedTables: ["receipts", "purchase_requests", "purchase_orders", "purchase_order_items"],
      });
    } catch (error) {
      console.error("Error logging phase rollback in audit_logs:", error);
    }
  }
}

export const receiptRepository = new ReceiptRepository();
