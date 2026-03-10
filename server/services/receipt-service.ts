
import { db } from "../db";
import { receipts, users, purchaseOrders, purchaseRequests, auditLogs } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyRequestConclusion } from "../email-service";

export async function finishReceiptWithoutErp(userId: number, receiptId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user || !user.isBuyer) {
    throw new Error("Apenas compradores podem realizar esta ação.");
  }

  const [rec] = await db.select().from(receipts).where(eq(receipts.id, receiptId));
  if (!rec) throw new Error("Recebimento não encontrado");

  if (['fiscal_conferida', 'integrado_locador', 'conferida'].includes(rec.status)) {
    throw new Error("Recebimento já finalizado.");
  }

  const justification = "Finalização manual sem ERP realizada pelo comprador (Processo Excepcional)";
  
  // Update status locally
  const [updated] = await db.update(receipts)
    .set({ 
      status: "fiscal_conferida", 
      integrationMessage: justification,
      approvedAt: new Date(),
      approvedBy: user.id
    })
    .where(eq(receipts.id, receiptId))
    .returning();

  let purchaseRequestId = 0;
  if (rec.purchaseOrderId) {
      // Check pending receipts
      const pendingReceipts = await db.select()
        .from(receipts)
        .where(and(
          eq(receipts.purchaseOrderId, rec.purchaseOrderId),
          sql`status NOT IN ('fiscal_conferida', 'conferida', 'integrado_locador')`,
          sql`id != ${receiptId}`
        ));
      
      const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rec.purchaseOrderId));
      if (order && order.purchaseRequestId) {
          purchaseRequestId = order.purchaseRequestId;
          
          if (pendingReceipts.length === 0) {
              await db.update(purchaseRequests)
                  .set({ currentPhase: "conclusao_compra", updatedAt: new Date() })
                  .where(eq(purchaseRequests.id, purchaseRequestId));

              try {
                await notifyRequestConclusion(purchaseRequestId);
              } catch (emailError) {
                console.error("Erro ao enviar notificação de conclusão (manual sem ERP):", emailError);
              }
          }
      }
  }

  // Audit Log
  try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (${purchaseRequestId}, ${'conferencia_fiscal_sem_erp'}, ${justification}, ${user.id}, ${JSON.stringify({ status: rec.status })}::jsonb, ${JSON.stringify({ status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
  } catch {}

  return updated;
}
