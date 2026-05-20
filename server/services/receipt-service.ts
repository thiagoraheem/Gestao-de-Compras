import { db } from "../db";
import { 
  receipts, 
  users, 
  purchaseOrders, 
  purchaseRequests, 
  receiptItems, 
  receiptAllocations, 
  receiptInstallments, 
  receiptNfXmls,
  auditLogs,
  suppliers,
  purchaseRequestItems,
  attachments,
  purchaseOrderItems
} from "../../shared/schema";
import { eq, and, sql, desc, like, or, inArray } from "drizzle-orm";
import { storage } from "../storage";
import { notifyRequestConclusion } from "../email-service";
import { generateReceiptNumber } from "../utils/generate-receipt-number";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, RECEIPT_EVENTS } from "../../shared/realtime-events";

export class ReceiptService {
  private isReceiptSyncedWithErp(receipt: any): boolean {
    const status = String(receipt?.status || "").toLowerCase();
    if (status === "enviado_locador" || status === "integrado_locador") return true;
    if (receipt?.locadorReceiptId || receipt?.locador_receipt_id) return true;
    return false;
  }

  async getUndoReceiptPreview(purchaseRequestId: number) {
    const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, purchaseRequestId));
    if (!pr) throw new Error("Solicitação não encontrada");

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseRequestId, purchaseRequestId))
      .limit(1);
    if (!po) throw new Error("Pedido de compra não encontrado");

    const receiptRows = await db
      .select({
        id: receipts.id,
        receiptNumber: receipts.receiptNumber,
        status: receipts.status,
        receiptPhase: receipts.receiptPhase,
        locadorReceiptId: receipts.locadorReceiptId,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(or(eq(receipts.purchaseOrderId, po.id), eq(receipts.purchaseRequestId, purchaseRequestId)))
      .orderBy(desc(receipts.createdAt));

    const erpSynced = receiptRows.filter((r: any) => this.isReceiptSyncedWithErp(r));
    const fiscalConferences = receiptRows.filter((r: any) => String(r.receiptPhase) === "conf_fiscal" || String(r.receiptPhase) === "concluido");

    return {
      purchaseRequestId,
      purchaseOrderId: po.id,
      currentPhase: pr.currentPhase,
      receipts: receiptRows,
      erpSyncedReceipts: erpSynced,
      fiscalConferenceReceipts: fiscalConferences,
      requiresConfirmation: receiptRows.length > 1,
    };
  }

  async undoReceiptForPurchaseRequest(purchaseRequestId: number, userId: number, options?: { confirm?: boolean; expectedReceiptIds?: number[] }) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || (!user.isAdmin && !user.isManager && !user.isBuyer)) {
      throw new Error("Sem permissão para desfazer recebimento");
    }

    const preview = await this.getUndoReceiptPreview(purchaseRequestId);

    const allowedPhases = new Set(["pedido_concluido", "conclusao_compra", "recebimento", "conf_fiscal"]);
    if (!allowedPhases.has(String(preview.currentPhase))) {
      throw new Error("A solicitação não está em um estado válido para desfazer recebimento");
    }

    if (preview.receipts.length === 0) {
      throw new Error("Nenhum recebimento encontrado para este pedido");
    }

    if (preview.erpSyncedReceipts.length > 0) {
      const r = preview.erpSyncedReceipts[0] as any;
      const ref = r?.receiptNumber ? `nº ${r.receiptNumber}` : `ID ${r?.id}`;
      throw new Error(`Não é possível desfazer o recebimento: o recebimento parcial ${ref} já foi enviado ao ERP.`);
    }

    const receiptIds = preview.receipts.map((r: any) => Number(r.id)).filter((id: number) => Number.isFinite(id));
    if (options?.expectedReceiptIds && options.expectedReceiptIds.length > 0) {
      const expected = [...options.expectedReceiptIds].sort((a, b) => a - b);
      const current = [...receiptIds].sort((a, b) => a - b);
      if (expected.length !== current.length || expected.some((v, i) => v !== current[i])) {
        throw new Error("Os recebimentos foram alterados desde a confirmação. Recarregue e tente novamente.");
      }
    }

    if (preview.requiresConfirmation && options?.confirm !== true) {
      throw new Error("Esta ação também desfará recebimentos parciais não sincronizados com o ERP. Confirme para prosseguir.");
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.delete(receiptItems).where(inArray(receiptItems.receiptId, receiptIds));
      await tx.delete(receiptAllocations).where(inArray(receiptAllocations.receiptId, receiptIds));
      await tx.delete(receiptInstallments).where(inArray(receiptInstallments.receiptId, receiptIds));
      await tx.delete(receiptNfXmls).where(inArray(receiptNfXmls.receiptId, receiptIds));
      await tx.delete(receipts).where(inArray(receipts.id, receiptIds));

      await tx
        .update(purchaseOrderItems)
        .set({ quantityReceived: "0" } as any)
        .where(eq(purchaseOrderItems.purchaseOrderId, preview.purchaseOrderId));

      await tx
        .update(purchaseOrders)
        .set({ fulfillmentStatus: "pending", updatedAt: now } as any)
        .where(eq(purchaseOrders.id, preview.purchaseOrderId));

      await tx
        .update(purchaseRequests)
        .set({
          currentPhase: "pedido_compra",
          updatedAt: now,
          receivedById: null,
          receivedDate: null,
          hasPendency: false,
          pendencyReason: null,
          physicalReceiptAt: null,
          physicalReceiptById: null,
          fiscalReceiptAt: null,
          fiscalReceiptById: null,
          procurementStatus: "aberta",
          procurementConcludedAt: null,
          procurementConcludedById: null,
          sentToPhysicalReceipt: false,
        } as any)
        .where(eq(purchaseRequests.id, purchaseRequestId));

      await tx.insert(auditLogs).values({
        purchaseRequestId,
        performedBy: userId,
        actionType: "undo_receiving",
        actionDescription: `Desfazer recebimento: ${receiptIds.length} recebimento(s) excluído(s) e retorno para Pedido de Compra`,
        performedAt: now,
        beforeData: {
          phase: preview.currentPhase,
          purchaseOrderId: preview.purchaseOrderId,
          receipts: preview.receipts,
        } as any,
        afterData: {
          phase: "pedido_compra",
          purchaseOrderId: preview.purchaseOrderId,
          deletedReceiptIds: receiptIds,
        } as any,
        affectedTables: ["receipts", "receipt_items", "receipt_allocations", "receipt_installments", "receipt_nf_xmls", "purchase_requests", "purchase_orders", "purchase_order_items"] as any,
        metadata: {
          fiscalConferenceReceiptIds: preview.fiscalConferenceReceipts.map((r: any) => r.id),
        } as any,
      } as any);
    });

    return {
      success: true,
      deletedReceiptIds: receiptIds,
      newPhase: "pedido_compra",
    };
  }

  async getReceiptsBoard() {
    const results = await db.execute(sql`
      SELECT 
        r.id,
        r.receipt_number as "receiptNumber",
        r.receipt_phase as "receiptPhase",
        r.status,
        r.document_number as "documentNumber",
        r.document_series as "documentSeries",
        r.document_key as "documentKey",
        r.document_issue_date as "documentIssueDate",
        r.document_entry_date as "documentEntryDate",
        COALESCE(
          NULLIF(r.total_amount, 0),
          (SELECT SUM(total_price) FROM receipt_items WHERE receipt_id = r.id),
          (SELECT SUM(total_price) FROM purchase_order_items WHERE purchase_order_id = r.purchase_order_id),
          pr.total_value,
          0
        ) as "totalAmount",
        r.observations,
        r.created_at as "createdAt",
        r.received_at as "receivedAt",
        r.locador_receipt_id as "locadorReceiptId",
        r.cost_center_id as "costCenterId",
        COALESCE(cc.department_id, pr_cc.department_id) as "departmentId",
        r.chart_of_accounts_id as "chartOfAccountsId",
        COALESCE(r.purchase_request_id, po.purchase_request_id) as "purchaseRequestId",
        pr.request_number as "requestNumber",
        pr.requester_id as "requesterId",
        pr.justification,
        pr.urgency,
        pr.category,
        po.order_number as "purchaseOrderNumber",
        COALESCE(r.supplier_id, po.supplier_id, pr.chosen_supplier_id) as "supplierId",
        s.name as "supplierName",
        u.first_name as "requesterFirstName",
        u.last_name as "requesterLastName",
        (
          CASE 
            WHEN r.purchase_order_id IS NOT NULL THEN
              (SELECT COALESCE(SUM(ri_all.quantity_received), 0) * 100.0 / NULLIF((SELECT SUM(poi.quantity) FROM purchase_order_items poi WHERE poi.purchase_order_id = r.purchase_order_id), 0)
               FROM receipt_items ri_all
               JOIN receipts r_all ON ri_all.receipt_id = r_all.id
               WHERE r_all.purchase_order_id = r.purchase_order_id
                 AND r_all.receipt_phase != 'cancelado')
            ELSE
              (SELECT COALESCE(SUM(ri_single.quantity_received), 0) * 100.0 / NULLIF(SUM(poi_single.quantity), 0)
               FROM receipt_items ri_single
               JOIN purchase_order_items poi_single ON ri_single.purchase_order_item_id = poi_single.id
               WHERE ri_single.receipt_id = r.id)
          END
        ) as "receivingPercent"
      FROM receipts r
      LEFT JOIN purchase_orders po ON r.purchase_order_id = po.id
      LEFT JOIN purchase_requests pr ON COALESCE(r.purchase_request_id, po.purchase_request_id) = pr.id
      LEFT JOIN suppliers s ON s.id = COALESCE(r.supplier_id, po.supplier_id, pr.chosen_supplier_id)
      LEFT JOIN users u ON pr.requester_id = u.id
      LEFT JOIN cost_centers cc ON r.cost_center_id = cc.id
      LEFT JOIN cost_centers pr_cc ON pr.cost_center_id = pr_cc.id
      WHERE r.receipt_phase != 'cancelado'
      ORDER BY r.created_at DESC
    `);
    return results.rows;
  }

  async getPendingConference() {
    const results = await db.execute(sql`
      WITH CalculatedReceipts AS (
        SELECT 
          r.id as "receiptId",
          r.receipt_number as "receiptNumber",
          r.receipt_phase as "receiptPhase",
          r.status as "status",
          r.created_at as "createdAt",
          COALESCE(r.purchase_request_id, po.purchase_request_id) as "purchaseRequestId",
          pr.request_number as "requestNumber",
          pr.justification,
          pr.urgency,
          pr.category,
          pr.ideal_delivery_date as "idealDeliveryDate",
          po.id as "orderId",
          po.order_number as "purchaseOrderNumber",
          po.total_value as "orderTotalValue",
          s.id as "supplierId",
          s.name as "supplierName",
          (
            CASE 
              WHEN r.purchase_order_id IS NOT NULL THEN
                (SELECT COALESCE(SUM(ri_all.quantity_received), 0) * 100.0 / NULLIF((SELECT SUM(poi.quantity) FROM purchase_order_items poi WHERE poi.purchase_order_id = r.purchase_order_id), 0)
                 FROM receipt_items ri_all
                 JOIN receipts r_all ON ri_all.receipt_id = r_all.id
                 WHERE r_all.purchase_order_id = r.purchase_order_id
                   AND r_all.receipt_phase != 'cancelado')
              ELSE
                (SELECT COALESCE(SUM(ri_single.quantity_received), 0) * 100.0 / NULLIF(SUM(poi_single.quantity), 0)
                 FROM receipt_items ri_single
                 JOIN purchase_order_items poi_single ON ri_single.purchase_order_item_id = poi_single.id
                 WHERE ri_single.receipt_id = r.id)
            END
          ) as "receivingPercent"
        FROM receipts r
        LEFT JOIN purchase_orders po ON r.purchase_order_id = po.id
        LEFT JOIN purchase_requests pr ON COALESCE(r.purchase_request_id, po.purchase_request_id) = pr.id
        LEFT JOIN suppliers s ON s.id = COALESCE(r.supplier_id, po.supplier_id, pr.chosen_supplier_id)
        WHERE r.receipt_phase = 'recebimento_fisico'
      )
      SELECT * FROM CalculatedReceipts
      WHERE NOT (
        COALESCE("receivingPercent", 0) >= 100 AND 
        ("status" = 'nf_pendente' OR "status" = 'rascunho')
      )
      ORDER BY "createdAt" DESC
    `);

    const formattedResults = await Promise.all(results.rows.map(async (row: any) => {
      const prId = row.purchaseRequestId;
      const items = prId ? await db
        .select()
        .from(purchaseRequestItems)
        .where(eq(purchaseRequestItems.purchaseRequestId, prId)) : [];

      return {
        id: prId,
        receiptId: row.receiptId,
        requestNumber: row.requestNumber || row.receiptNumber,
        justification: row.justification,
        urgency: row.urgency,
        category: row.category,
        createdAt: row.createdAt,
        idealDeliveryDate: row.idealDeliveryDate,
        chosenSupplier: row.supplierId ? { id: row.supplierId, name: row.supplierName } : null,
        purchaseOrder: row.orderId ? { 
          id: row.orderId, 
          orderNumber: row.purchaseOrderNumber, 
          totalValue: row.orderTotalValue 
        } : null,
        items: items,
        receivingPercent: row.receivingPercent
      };
    }));

    return formattedResults;
  }

  async finishReceiptWithoutErp(userId: number, receiptId: number) {
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
    
    const [updated] = await db.update(receipts)
      .set({ 
        status: "fiscal_conferida", 
        integrationMessage: justification,
        receiptPhase: "concluido",
        approvedAt: new Date(),
        approvedBy: user.id
      } as any)
      .where(eq(receipts.id, receiptId))
      .returning();

    let purchaseRequestId = 0;
    if (rec.purchaseOrderId) {
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

    try {
        await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
          VALUES (${purchaseRequestId}, ${'conferencia_fiscal_sem_erp'}, ${justification}, ${user.id}, ${JSON.stringify({ status: rec.status })}::jsonb, ${JSON.stringify({ status: updated.status })}::jsonb, ${sql`ARRAY['receipts']`} );`);
    } catch {}

    return updated;
  }

  async deleteReceipt(id: number, userId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.isAdmin && !user?.isManager && !user?.isBuyer) {
      throw new Error("Sem permissão para excluir recebimento");
    }

    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!receipt) throw new Error("Recebimento não encontrado");

    await db.transaction(async (tx) => {
      await tx.delete(receiptItems).where(eq(receiptItems.receiptId, id));
      await tx.delete(receiptAllocations).where(eq(receiptAllocations.receiptId, id));
      await tx.delete(receiptInstallments).where(eq(receiptInstallments.receiptId, id));
      await tx.delete(receiptNfXmls).where(eq(receiptNfXmls.receiptId, id));
      await tx.delete(receipts).where(eq(receipts.id, id));
    });

    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, receipt_id, action_scope)
        VALUES (${receipt.purchaseRequestId || 0}, 'receipt_deleted', 'Recebimento excluído permanentemente', ${userId}, ${id}, 'RECEIPT')`);
    } catch { }

    return { success: true };
  }

  async createReceiptForRequest(purchaseRequestId: number, userId: number) {
    const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, purchaseRequestId));
    if (!pr) throw new Error("Solicitação não encontrada");

    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.purchaseRequestId, purchaseRequestId)).limit(1);

    const [newReceipt] = await db.insert(receipts).values({
      receiptNumber: generateReceiptNumber(),
      purchaseOrderId: order?.id || null,
      purchaseRequestId: purchaseRequestId,
      status: "rascunho",
      receiptPhase: "recebimento_fisico",
      receiptType: (pr.category === "servico" ? "servico" : "produto") as any,
      supplierId: pr.chosenSupplierId,
      createdAt: new Date()
    } as any).returning();

    return newReceipt;
  }

  async confirmPhysical(purchaseRequestId: number, userId: number, data: any) {
    const { receivedQuantities, observations, manualNFNumber, manualNFSeries } = data;

    if (receivedQuantities && typeof receivedQuantities === "object") {
      for (const [key, value] of Object.entries(receivedQuantities)) {
        const qty = Number(value);
        if (!Number.isFinite(qty) || qty < 0) {
          throw new Error(`Quantidade inválida para o item ${key}. Utilize apenas números maiores ou iguais a zero.`);
        }
      }
    }

    const request = await storage.getPurchaseRequestById(purchaseRequestId);
    if (!request) throw new Error("Solicitação não encontrada");

    const purchaseOrder = await storage.getPurchaseOrderByRequestId(purchaseRequestId);
    if (!purchaseOrder) throw new Error("Pedido não encontrado");

    let allFulfilled = true;
    let anyReceived = false;
    const itemsToInsert: any[] = [];

    if (receivedQuantities) {
      const poItems = await storage.getPurchaseOrderItems(purchaseOrder.id);
      for (const it of poItems) {
        const qtyReceivedNow = Number(receivedQuantities[it.id] || 0);
        const currentQty = Number(it.quantityReceived || 0);
        const orderedQty = Number(it.quantity || 0);
        
        if (qtyReceivedNow > 0) {
           if (currentQty >= orderedQty) {
               throw new Error(`O item "${it.description}" já foi totalmente recebido.`);
           }
           if (currentQty + qtyReceivedNow > orderedQty) {
               throw new Error(`A quantidade informada para o item "${it.description}" excede o saldo restante.`);
           }

           await db.update(purchaseOrderItems)
             .set({ quantityReceived: String(currentQty + qtyReceivedNow) })
             .where(eq(purchaseOrderItems.id, it.id));
           
           itemsToInsert.push({
              purchaseOrderItemId: it.id,
              description: it.description,
              unit: it.unit,
              quantity: String(qtyReceivedNow),
              unitPrice: String(it.unitPrice),
              totalPrice: String(qtyReceivedNow * parseFloat(it.unitPrice || "0")),
              quantityReceived: String(qtyReceivedNow),
              locadorProductCode: it.itemCode, // Mapeando o código do produto do pedido
              condition: "bom",
              createdAt: new Date(),
           });
           anyReceived = true;
        }

        if (currentQty + qtyReceivedNow < orderedQty) {
           allFulfilled = false;
        }
      }
    }

    if (!anyReceived) {
      throw new Error("Informe a quantidade recebida de pelo menos um item.");
    }

    const [newReceipt] = await db.insert(receipts).values({
      receiptNumber: generateReceiptNumber(),
      purchaseOrderId: purchaseOrder.id,
      purchaseRequestId: purchaseRequestId,
      receivedAt: new Date(),
      receivedBy: userId,
      status: "conf_fisica",
      receiptPhase: "conf_fiscal",
      observations: observations ? JSON.stringify({ physical: observations }) : null,
      documentNumber: manualNFNumber || null,
      documentSeries: manualNFSeries || null,
      createdAt: new Date(),
    } as any).returning();

    for (const item of itemsToInsert) {
      await db.insert(receiptItems).values({
        ...item,
        receiptId: newReceipt.id,
      } as any);
    }

    const nextPhase = allFulfilled ? "recebimento" : "recebimento";
    await storage.updatePurchaseRequest(purchaseRequestId, {
       currentPhase: nextPhase as any,
    });

    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data)
        VALUES (${purchaseRequestId}, ${'recebimento_fisico_confirmado'}, ${'Recebimento físico confirmado'}, ${userId}, ${null}, ${JSON.stringify({ receiptId: newReceipt.id, allFulfilled })}::jsonb )`);
    } catch { }

    realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
      event: RECEIPT_EVENTS.PHASE_CHANGED,
      payload: { id: newReceipt.id, receiptPhase: "conf_fiscal", status: "conf_fisica" }
    });

    return { success: true, receipt: newReceipt };
  }

  async undoPhysicalConference(id: number, userId: number) {
    const receipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
      with: {
        items: true
      }
    });

    if (!receipt) throw new Error("Recebimento não encontrado");

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.isReceiver && !user?.isAdmin && !user?.isManager) {
      throw new Error("Sem permissão para desfazer conferência");
    }

    if (receipt.items && receipt.items.length > 0) {
      for (const item of receipt.items) {
        if (item.purchaseOrderItemId) {
          await db.execute(sql`
             UPDATE purchase_order_items 
             SET quantity_received = GREATEST(0, COALESCE(quantity_received, 0) - ${item.quantityReceived})
             WHERE id = ${item.purchaseOrderItemId}
           `);
        }
      }
    }

    await db.update(receipts)
      .set({
        receiptPhase: "cancelado",
        status: "cancelado",
        updatedAt: new Date()
      } as any)
      .where(eq(receipts.id, id));

    let requestId = 0;
    if (receipt.purchaseOrderId) {
      const order = await db.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, receipt.purchaseOrderId),
        columns: { purchaseRequestId: true }
      });
      requestId = order?.purchaseRequestId || 0;
    }

    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (${requestId}, ${'desfazer_conferencia_fisica'}, ${`Desfazer conferência física e exclusão - NF ${receipt.documentNumber || receipt.receiptNumber}`}, ${userId}, ${JSON.stringify({ receiptId: id, status: receipt.status })}::jsonb, ${JSON.stringify({ deleted: true })}::jsonb, ${sql`ARRAY['receipts', 'purchase_order_items', 'purchase_requests']`} );`);
    } catch { }

    return { success: true, message: "Conferência física desfeita e registro cancelado com sucesso" };
  }

  async undoFiscalConference(id: number, userId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || !user.isAdmin) {
      throw new Error("Apenas administradores podem desfazer a conferência fiscal.");
    }

    const [rec] = await db.select().from(receipts).where(eq(receipts.id, id));
    if (!rec) throw new Error("Recebimento não encontrado");

    if (!['fiscal_conferida', 'integrado_locador', 'erro_integracao'].includes(rec.status)) {
      throw new Error("Recebimento não está em fase de conferência fiscal ou já concluída.");
    }

    const [updated] = await db.update(receipts)
      .set({
        status: "conf_fisica",
        approvedAt: null,
        approvedBy: null,
        integrationMessage: null,
        receiptPhase: "conf_fiscal"
      } as any)
      .where(eq(receipts.id, id))
      .returning();

    let purchaseRequestId = 0;
    try {
      if (rec.purchaseOrderId) {
        const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rec.purchaseOrderId));
        if (order && order.purchaseRequestId) {
          purchaseRequestId = order.purchaseRequestId;
        }
      }

      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (${purchaseRequestId}, ${'desfazer_conferencia_fiscal'}, ${'Conferência fiscal desfeita por Admin'}, ${userId}, ${JSON.stringify({ receiptId: rec.id, status: rec.status })}::jsonb, ${JSON.stringify({ receiptId: updated.id, status: updated.status })}::jsonb, ${sql`ARRAY['receipts', 'purchase_requests']`} );`);
    } catch { }

    return updated;
  }

  async returnToPhysicalReceipt(requestId: number, userId: number) {
    const request = await storage.getPurchaseRequestById(requestId);
    if (!request) throw new Error("Solicitação não encontrada");

    await storage.updatePurchaseRequest(requestId, {
      currentPhase: "recebimento",
    });

    try {
      await db.execute(sql`INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, action_scope)
        VALUES (${requestId}, 'return_to_physical_receipt', 'Solicitação retornada para recebimento físico', ${userId}, 'REQUEST')`);
    } catch { }

    return { success: true };
  }
}

export const receiptService = new ReceiptService();

// Export legacy function for compatibility if needed, but we should migrate to the class instance
export const finishReceiptWithoutErp = (userId: number, receiptId: number) => receiptService.finishReceiptWithoutErp(userId, receiptId);
export const getUndoReceiptPreview = (purchaseRequestId: number) => receiptService.getUndoReceiptPreview(purchaseRequestId);
export const undoReceiptForPurchaseRequest = (purchaseRequestId: number, userId: number, options?: { confirm?: boolean; expectedReceiptIds?: number[] }) =>
  receiptService.undoReceiptForPurchaseRequest(purchaseRequestId, userId, options);
