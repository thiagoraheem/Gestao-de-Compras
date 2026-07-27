import { storage } from "../storage";
import { 
  notifyApprovalA1,
  notifyApprovalA2, 
  notifyRejection,
  notifyArchival
} from "../email-service";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "../../shared/realtime-events";
import { purchaseOrderService } from "./purchase-order-service";
import { db } from "../db";
import {
  receipts,
  purchaseOrders,
  purchaseOrderItems,
  purchaseRequests,
  purchaseRequestItems,
  receiptItems,
  receiptAllocations,
  receiptInstallments,
  receiptNfXmls,
  auditLogs,
} from "../../shared/schema";
import { and, eq, inArray, or, desc } from "drizzle-orm";
import { ValidationError } from "../utils/errors";


export class WorkflowService {
  async sendToApproval(id: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request || request.currentPhase !== "solicitacao") {
      throw new Error("Request must be in the request phase");
    }

    const updateData = {
      currentPhase: "aprovacao_a1" as any,
      updatedAt: new Date(),
    };

    const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

    // Send notification to approvers A1
    try {
      await notifyApprovalA1(updatedRequest);
    } catch (emailError) {
      console.error("Error sending approval notification:", emailError);
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: updateData.currentPhase, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  async approveA1(id: number, approved: boolean, rejectionReason: string | null, approverId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request || request.currentPhase !== "aprovacao_a1") {
      throw new Error("Request must be in the A1 approval phase");
    }

    const updateData = {
      approverA1Id: approverId,
      approvedA1: approved,
      approvalDateA1: new Date(),
      currentPhase: approved ? "cotacao" : "arquivado",
      rejectionReasonA1: approved ? null : rejectionReason || "Solicitação reprovada",
      updatedAt: new Date(),
    } as const;

    // Create approval history entry
    await storage.createApprovalHistory({
      purchaseRequestId: id,
      approverType: "A1",
      approverId: approverId,
      approved: approved,
      rejectionReason: approved ? null : rejectionReason || "Solicitação reprovada",
    });

    const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

    // Send rejection notification email if request was rejected
    if (!approved && rejectionReason) {
      await notifyRejection(updatedRequest, rejectionReason, "A1");
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: updateData.currentPhase, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  async approveA2(id: number, approved: boolean, rejectionReason: string | null, rejectionAction: string | null, approverId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request || request.currentPhase !== "aprovacao_a2") {
      throw new Error("Request must be in the A2 approval phase");
    }

    let newPhase = "pedido_compra";
    if (!approved) {
      if (rejectionAction === "recotacao") {
        newPhase = "cotacao";
      } else {
        newPhase = "arquivado";
      }
    }

    const updateData = {
      approverA2Id: approverId,
      approvalDateA2: new Date(),
      approvedA2: approved,
      rejectionReasonA2: approved ? null : rejectionReason,
      rejectionActionA2: approved ? null : rejectionAction,
      currentPhase: newPhase as any,
      lastPhase: newPhase === "arquivado" ? request.currentPhase : undefined,
      updatedAt: new Date(),
    } as const;

    // Create approval history entry
    await storage.createApprovalHistory({
      purchaseRequestId: id,
      approverType: "A2",
      approverId: approverId,
      approved: approved,
      rejectionReason: approved ? null : rejectionReason || "Solicitação reprovada",
    });

    const updatedRequest = await storage.updatePurchaseRequest(id, updateData);

    // If approved, create purchase order automatically
    if (approved) {
      try {
        await purchaseOrderService.createPurchaseOrderFromQuotation(id, approverId, {
          auditActionType: 'po_created_a2'
        });
      } catch (purchaseOrderError) {
        console.error("Error creating purchase order automatically:", purchaseOrderError);
      }
    }

    // Send rejection notification email if request was rejected
    if (!approved && rejectionReason) {
      await notifyRejection(updatedRequest, rejectionReason, "A2");
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: newPhase, updatedAt: updatedRequest.updatedAt },
    });

    return updatedRequest;
  }

  async archiveRequest(id: number, conclusionObservations: string): Promise<any> {
    const currentRequest = await storage.getPurchaseRequestById(id);
    if (!currentRequest) throw new Error("Request not found");

    const blockingReceipt = await db
      .select({ id: receipts.id, receiptPhase: receipts.receiptPhase })
      .from(receipts)
      .where(and(
        eq(receipts.purchaseRequestId, id),
        inArray(receipts.receiptPhase, ["recebimento_fisico", "conf_fiscal"]),
      ))
      .limit(1);

    if (String(currentRequest.currentPhase) === "pedido_concluido" || blockingReceipt.length > 0) {
      throw new ValidationError(
        'Não é possível arquivar um pedido que está na fase "Pedido Concluído".',
      );
    }

    const updates = {
      currentPhase: "arquivado" as const,
      lastPhase: currentRequest.currentPhase,
      conclusionObservations,
      archivedDate: new Date(),
    };

    const request = await storage.updatePurchaseRequest(id, updates);

    // Enviar notificação de arquivamento
    try {
      await notifyArchival(request, conclusionObservations);
    } catch (emailError) {
      console.error("Erro ao enviar notificação de arquivamento:", emailError);
    }

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: "arquivado", updatedAt: request.updatedAt },
    });

    return request;
  }

  async unarchiveRequest(id: number, userId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request) throw new Error("Solicitação não encontrada");
    if (request.currentPhase !== "arquivado") throw new Error("Solicitação não está arquivada");

    const targetPhase = request.lastPhase || "cotacao";

    const updated = await storage.updatePurchaseRequest(id, {
      currentPhase: targetPhase as any,
      lastPhase: null,
    });

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
      payload: { id, currentPhase: targetPhase, updatedAt: updated.updatedAt },
    });

    return updated;
  }

  /**
   * Retorna uma solicitação de compra para a fase de Cotação.
   *
   * Regras de negócio:
   * - Apenas fases "pedido_compra" e "pedido_concluido" são permitidas.
   * - Caso haja recebimento feito parcialmente:
   *   - O Pedido de Compra original NÃO é excluído. Ele é marcado como "concluído parcialmente" (fulfillmentStatus = "partial", status = "completed").
   *   - A solicitação original é concluída (currentPhase = "conclusao_compra").
   *   - Uma nova solicitação é criada contendo apenas os itens com quantidades pendentes de recebimento, posicionada em "Cotação".
   * - Caso NÃO haja recebimento parcial do pedido:
   *   - Exclui os recebimentos em aberto.
   *   - Exclui o Pedido de Compra e seus itens.
   *   - Retorna a solicitação original para "Cotação".
   */
  async returnToQuotation(id: number, reason: string, userId: number): Promise<any> {
    const request = await storage.getPurchaseRequestById(id);
    if (!request) throw new Error("Solicitação não encontrada");

    const allowedPhases = ["pedido_compra", "pedido_concluido", "recebimento"];
    if (!allowedPhases.includes(String(request.currentPhase))) {
      throw new ValidationError(
        `Apenas solicitações nas fases 'Pedido de Compra' ou 'Recebimento Físico' podem ser retornadas para Cotação. Fase atual: ${request.currentPhase}`
      );
    }

    // Buscar purchase order
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseRequestId, id))
      .limit(1);

    // Buscar itens do pedido de compra
    const poItems = po
      ? await db
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, po.id))
      : [];

    // Calcular se há recebimento feito parcialmente de fato
    const hasAnyPartialReceipt = poItems.some(
      (item: any) => Number(item.quantityReceived || 0) > 0
    );

    // Buscar todos os receipts (registros de recebimento)
    const receiptRows = po
      ? await db
          .select({
            id: receipts.id,
            receiptNumber: receipts.receiptNumber,
            documentNumber: receipts.documentNumber,
            receiptPhase: receipts.receiptPhase,
            status: receipts.status,
          })
          .from(receipts)
          .where(
            or(
              eq(receipts.purchaseOrderId, po.id),
              eq(receipts.purchaseRequestId, id)
            )
          )
      : [];

    const now = new Date();

    if (hasAnyPartialReceipt) {
      // REGRA: Recebimento feito parcialmente
      let newRequestCreated: any = null;

      await db.transaction(async (tx) => {
        // 1. Excluir recebimentos "rascunho" (placeholders criados por advance-to-receipt sem NF real)
        //    Eles ficam no kanban poluindo o quadro pois não representam recebimento efetivo.
        const rascunhoIds = receiptRows
          .filter((r: any) => String(r.status) === "rascunho")
          .map((r: any) => Number(r.id))
          .filter((rid: number) => Number.isFinite(rid));

        if (rascunhoIds.length > 0) {
          await tx.delete(receiptItems).where(inArray(receiptItems.receiptId, rascunhoIds));
          await tx.delete(receiptAllocations).where(inArray(receiptAllocations.receiptId, rascunhoIds));
          await tx.delete(receiptInstallments).where(inArray(receiptInstallments.receiptId, rascunhoIds));
          await tx.delete(receiptNfXmls).where(inArray(receiptNfXmls.receiptId, rascunhoIds));
          await tx.delete(receipts).where(inArray(receipts.id, rascunhoIds));
        }

        // 2. Marcar o pedido de compra original como concluído parcialmente
        if (po) {
          const updatedObs = `${po.observations || ""}\n[Retorno para Cotação] Concluído parcialmente - saldo restante movido para nova solicitação. Motivo: ${reason}`.trim();
          await tx
            .update(purchaseOrders)
            .set({
              status: "completed",
              fulfillmentStatus: "partial",
              observations: updatedObs,
              updatedAt: now,
            })
            .where(eq(purchaseOrders.id, po.id));
        }

        // 3. Concluir a solicitação original
        await tx
          .update(purchaseRequests)
          .set({
            currentPhase: "conclusao_compra",
            updatedAt: now,
            procurementStatus: "concluida" as any,
            procurementConcludedAt: now,
            procurementConcludedById: userId,
          })
          .where(eq(purchaseRequests.id, id));

        // 4. Criar uma nova solicitação com os itens pendentes
        // 4.1. Gerar número de solicitação (SOL-ANO-SEQ)
        const year = new Date().getFullYear();
        const allRequests = await tx
          .select()
          .from(purchaseRequests)
          .orderBy(desc(purchaseRequests.requestNumber));

        let maxSequence = 0;
        const prefix = `SOL-${year}-`;

        for (const req of allRequests) {
          if (req.requestNumber?.startsWith(prefix)) {
            const sequence = parseInt(req.requestNumber.substring(prefix.length));
            if (!isNaN(sequence) && sequence > maxSequence) {
              maxSequence = sequence;
            }
          }
        }

        const nextSequence = maxSequence + 1;
        const newRequestNumber = `${prefix}${String(nextSequence).padStart(3, "0")}`;

        // 4.2. Inserir a nova solicitação na fase 'cotacao'
        const [insertedPR] = await tx
          .insert(purchaseRequests)
          .values({
            requestNumber: newRequestNumber,
            requesterId: request.requesterId,
            companyId: request.companyId,
            costCenterId: request.costCenterId,
            category: request.category,
            urgency: request.urgency,
            justification: `[Saldo Restante da ${request.requestNumber}] ${request.justification}`,
            idealDeliveryDate: request.idealDeliveryDate,
            availableBudget: request.availableBudget,
            additionalInfo: request.additionalInfo,
            currentPhase: "cotacao",
            procurementStatus: "aberta" as any,
            createdAt: now,
            updatedAt: now,
          } as any)
          .returning();

        newRequestCreated = insertedPR;

        // 4.3. Inserir itens pendentes na nova solicitação
        const prItems = await tx
          .select()
          .from(purchaseRequestItems)
          .where(eq(purchaseRequestItems.purchaseRequestId, id));

        // Normaliza texto para comparação resiliente a espaços e capitalização
        const normalize = (s: string | null | undefined) =>
          (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

        let pendingItemCount = 0;

        for (let idx = 0; idx < prItems.length; idx++) {
          const itemOriginal = prItems[idx];

          // --- Estratégia de matching em 3 etapas ---
          let correspondingPoItem: any = null;

          // 1. Produto: match por código de produto ERP (mais confiável)
          if (itemOriginal.productCode) {
            correspondingPoItem = (poItems as any[]).find(
              (poi: any) => poi.itemCode === itemOriginal.productCode
            );
          }

          // 2. Serviço/Material: match por descrição normalizada
          if (!correspondingPoItem) {
            const normalizedDesc = normalize(itemOriginal.description);
            correspondingPoItem = (poItems as any[]).find(
              (poi: any) => normalize(poi.description) === normalizedDesc
            );
          }

          // 3. Fallback posicional: mesmo índice nos arrays (último recurso)
          if (!correspondingPoItem && idx < (poItems as any[]).length) {
            correspondingPoItem = (poItems as any[])[idx];
          }

          // Calcular quantidade pendente
          let pendingQty: number;
          if (correspondingPoItem) {
            const orderedQty = Number(correspondingPoItem.quantity || 0);
            const receivedQty = Number(correspondingPoItem.quantityReceived || 0);
            pendingQty = Math.max(0, orderedQty - receivedQty);
          } else {
            // Nenhum PO item encontrado: assume o item inteiro como pendente
            pendingQty = Number(itemOriginal.requestedQuantity || 0);
          }

          if (pendingQty > 0) {
            await tx.insert(purchaseRequestItems).values({
              purchaseRequestId: insertedPR.id,
              productCode: itemOriginal.productCode,
              description: itemOriginal.description,
              unit: itemOriginal.unit,
              stockQuantity: itemOriginal.stockQuantity,
              averageMonthlyQuantity: itemOriginal.averageMonthlyQuantity,
              requestedQuantity: String(pendingQty),
              approvedQuantity: String(pendingQty),
              technicalSpecification: itemOriginal.technicalSpecification,
              price: correspondingPoItem?.unitPrice ?? itemOriginal.price,
              partNumber: itemOriginal.partNumber,
              createdAt: now,
              updatedAt: now,
            } as any);
            pendingItemCount++;
          }
        }

        // 5. Audit log para a solicitação original
        await tx.insert(auditLogs).values({
          purchaseRequestId: id,
          performedBy: userId,
          actionType: "return_to_quotation_partial",
          actionDescription: `Retornado parcialmente para cotação. Pedido de Compra original preservado (concluído parcialmente). Criada nova solicitação ${newRequestNumber} com ${pendingItemCount} itens pendentes. ${rascunhoIds.length > 0 ? `${rascunhoIds.length} recebimento(s) rascunho excluído(s). ` : ""}Motivo: ${reason}`,
          performedAt: now,
          beforeData: {
            phase: request.currentPhase,
            purchaseOrderId: po?.id ?? null,
            deletedRascunhoIds: rascunhoIds,
          } as any,
          afterData: {
            phase: "conclusao_compra",
            newRequestNumber,
            newRequestId: insertedPR.id,
            pendingItemCount,
          } as any,
          affectedTables: ["purchase_requests", "purchase_orders", "receipts"] as any,
        } as any);
      });

      // Publicar eventos em tempo real
      realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
        event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
        payload: { id, currentPhase: "conclusao_compra", updatedAt: now },
      });

      if (newRequestCreated) {
        realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
          event: PURCHASE_REQUEST_EVENTS.CREATED,
          payload: {
            request: {
              id: newRequestCreated.id,
              requestNumber: newRequestCreated.requestNumber,
              currentPhase: "cotacao",
              totalValue: newRequestCreated.totalValue,
              updatedAt: now,
            },
          },
        });
      }

      return {
        success: true,
        partial: true,
        newRequest: newRequestCreated,
      };
    } else {
      // REGRA: Sem recebimento parcial - Excluir tudo e retornar a original para Cotação
      const receiptIds = receiptRows.map((r: any) => Number(r.id)).filter((rid: number) => Number.isFinite(rid));

      await db.transaction(async (tx) => {
        // Excluir receipts em aberto (sem NF) e seus sub-registros
        if (receiptIds.length > 0) {
          await tx.delete(receiptItems).where(inArray(receiptItems.receiptId, receiptIds));
          await tx.delete(receiptAllocations).where(inArray(receiptAllocations.receiptId, receiptIds));
          await tx.delete(receiptInstallments).where(inArray(receiptInstallments.receiptId, receiptIds));
          await tx.delete(receiptNfXmls).where(inArray(receiptNfXmls.receiptId, receiptIds));
          await tx.delete(receipts).where(inArray(receipts.id, receiptIds));
        }

        // Excluir purchase order e seus itens
        if (po) {
          await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
          await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, po.id));
        }

        // Mover solicitação para Cotação e limpar campos de recebimento
        await tx
          .update(purchaseRequests)
          .set({
            currentPhase: "cotacao" as any,
            updatedAt: now,
            hasPendency: false,
            pendencyReason: null,
            receivedById: null,
            receivedDate: null,
            physicalReceiptAt: null,
            physicalReceiptById: null,
            fiscalReceiptAt: null,
            fiscalReceiptById: null,
            procurementStatus: "aberta" as any,
            procurementConcludedAt: null,
            procurementConcludedById: null,
            sentToPhysicalReceipt: false,
          } as any)
          .where(eq(purchaseRequests.id, id));

        // Audit log
        await tx.insert(auditLogs).values({
          purchaseRequestId: id,
          performedBy: userId,
          actionType: "return_to_quotation",
          actionDescription: `Retornado para Cotação. Motivo: ${reason}. Pedido de Compra excluído${receiptIds.length > 0 ? `. ${receiptIds.length} recebimento(s) sem NF excluído(s)` : ""}.`,
          performedAt: now,
          beforeData: {
            phase: request.currentPhase,
            purchaseOrderId: po?.id ?? null,
            deletedReceiptIds: receiptIds,
          } as any,
          afterData: { phase: "cotacao", reason } as any,
          affectedTables: ["purchase_requests", "purchase_orders", "purchase_order_items", "receipts", "receipt_items"] as any,
        } as any);
      });

      const updated = await storage.getPurchaseRequestById(id);

      realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
        event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
        payload: { id, currentPhase: "cotacao", updatedAt: now },
      });

      return updated;
    }
  }
}

export const workflowService = new WorkflowService();
