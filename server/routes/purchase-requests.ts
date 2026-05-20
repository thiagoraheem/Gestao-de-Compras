import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { auditService } from "../services/audit-service";
import {
  insertPurchaseRequestSchema,
  insertPurchaseRequestItemSchema,
  purchaseRequests,
  purchaseOrderItems,
  purchaseOrders,
  receipts,
  receiptItems,
  costCenters,
  chartOfAccounts,
  receiptAllocations,
  insertReceiptAllocationSchema,
} from "../../shared/schema";
import { z } from "zod";
import { pool, db } from "../db";
import { eq, sql, and, or, asc } from "drizzle-orm";
import {
  notifyNewRequest,
  notifyApprovalA1,
  notifyApprovalA2,
  notifyRejection,
  notifyRequestConclusion,
} from "../email-service";
import { invalidateCache } from "../cache";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS, RECEIPT_EVENTS } from "../../shared/realtime-events";
import {
  isAuthenticated,
  canApproveRequest,
  isAdmin,
  isAdminOrBuyer,
  isReceiver,
} from "./middleware";
import { isInvalidDescription } from "../utils/validate-description";
import { generateReceiptNumber } from "../utils/generate-receipt-number";
import { costCenterService } from "../integracao_locador/services/cost-center-service";
import { chartOfAccountsService } from "../integracao_locador/services/chart-of-accounts-service";
import { fileStorageService } from "../services/file-storage-service";
import { isEmailEnabled } from "../config";
import { PDFService } from "../pdf-service";
import { workflowService } from "../services/workflow-service";
import { purchaseRequestService } from "../services/purchase-request-service";
import { receiptService } from "../services/receipt-service";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";

export function registerPurchaseRequestRoutes(app: Express) {
  // Purchase Requests routes
  app.get("/api/purchase-requests", isAuthenticated, async (req: Request, res: Response) => {
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : undefined;
    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : undefined;
    const requests = await storage.getAllPurchaseRequests(companyId, user);
    res.json(requests);
  });

  app.get(
    "/api/purchase-requests/phase/:phase",
    isAuthenticated,
    async (req, res) => {
      const phase = req.params.phase;
      const requests = await storage.getPurchaseRequestsByPhase(phase);
      res.json(requests);
    },
  );

  app.get("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const request = await storage.getPurchaseRequestById(id);
    if (!request) {
      throw new NotFoundError("Solicitação não encontrada");
    }
    res.json(request);
  });

  app.post("/api/purchase-requests", isAuthenticated, async (req, res) => {
    const request = await purchaseRequestService.createRequest(req.body);
    res.status(201).json(request);
  });

  app.put("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    const idParam = req.params.id;

    if (idParam.startsWith("temp_")) {
      throw new ValidationError("Solicitação precisa ser salva antes de ser atualizada");
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      throw new ValidationError("ID inválido");
    }

    const request = await purchaseRequestService.updateRequest(id, req.body);
    res.json(request);
  });

  app.patch("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    const idParam = req.params.id;

    if (idParam.startsWith("temp_")) {
      throw new ValidationError("Solicitação precisa ser salva antes de ser atualizada");
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      throw new ValidationError("ID inválido");
    }

    const validatedRequestData = insertPurchaseRequestSchema
      .partial()
      .parse(req.body);

    const request = await storage.updatePurchaseRequest(
      id,
      validatedRequestData,
    );

    invalidateCache(["/api/purchase-requests"]);

    realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
      event: PURCHASE_REQUEST_EVENTS.UPDATED,
      payload: {
        id,
        updatedAt: request.updatedAt,
        changes: validatedRequestData,
      },
    });

    res.json(request);
  });

  // Purchase Request Items routes
  app.get(
    "/api/purchase-requests/:id/items",
    isAuthenticated,
    async (req, res) => {
      const idParam = req.params.id;

      if (idParam.startsWith("temp_")) {
        return res.json([]);
      }

      const purchaseRequestId = parseInt(idParam);
      if (isNaN(purchaseRequestId)) {
        throw new ValidationError("ID inválido");
      }
      const includeTransferred = req.query.includeTransferred === "true";
      const items = await storage.getPurchaseRequestItems(
        purchaseRequestId,
        includeTransferred,
      );

      const mappedItems = items.map((item) => ({
        id: item.id,
        description: item.description,
        unit: item.unit,
        requestedQuantity: parseFloat(item.requestedQuantity) || 0,
        technicalSpecification: item.technicalSpecification || "",
        isTransferred: item.isTransferred,
        transferReason: item.transferReason,
        transferredToRequestId: item.transferredToRequestId,
        productCode: item.productCode || "",
        price: item.price ? parseFloat(item.price.toString()) : undefined,
        partNumber: item.partNumber || "",
      }));

      res.json(mappedItems);
    },
  );

  app.post(
    "/api/purchase-requests/:id/items",
    isAuthenticated,
    async (req, res) => {
      const purchaseRequestId = parseInt(req.params.id);
      const itemData = insertPurchaseRequestItemSchema.parse({
        ...req.body,
        purchaseRequestId,
      });
      const item = await storage.createPurchaseRequestItem(itemData);
      res.status(201).json(item);
    },
  );

  app.put(
    "/api/purchase-request-items/:id",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const itemData = insertPurchaseRequestItemSchema
        .partial()
        .parse(req.body);
      const item = await storage.updatePurchaseRequestItem(id, itemData);
      res.json(item);
    },
  );

  app.delete(
    "/api/purchase-request-items/:id",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      await storage.deletePurchaseRequestItem(id);
      res.status(204).send();
    },
  );

  app.patch(
    "/api/purchase-requests/:id/update-phase",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { newPhase } = req.body;

      if (!newPhase) {
        throw new ValidationError("A nova fase é obrigatória");
      }

      const request = await storage.getPurchaseRequestById(id);
      if (!request) {
        throw new NotFoundError("Solicitação não encontrada");
      }

      const phasesBeforePurchaseOrder = new Set([
        "solicitacao",
        "aprovacao_a1",
        "cotacao",
        "aprovacao_a2",
      ]);
      const phasesWithPurchaseOrder = new Set([
        "pedido_compra",
        "recebimento",
        "conf_fiscal",
        "conclusao_compra",
        "pedido_concluido",
      ]);

      const isRollbackFromPurchaseOrderFlow =
        phasesWithPurchaseOrder.has(String(request.currentPhase)) &&
        phasesBeforePurchaseOrder.has(String(newPhase));

      if (isRollbackFromPurchaseOrderFlow) {
        const existingPurchaseOrder = await storage.getPurchaseOrderByRequestId(id);
        if (existingPurchaseOrder) {
          const receiptsLinked = await storage.getReceiptsByPurchaseOrderId(existingPurchaseOrder.id);
          if (receiptsLinked.length > 0) {
            throw new ValidationError(
              "Não é possível retornar para uma fase anterior porque já existem recebimentos vinculados a este Pedido de Compra. Remova/estorne os recebimentos antes de retroceder.",
            );
          }

          await storage.deletePurchaseOrderByRequestId(id);

          await auditService.log({
            purchaseRequestId: id,
            actionType: "purchase_order_deleted_on_phase_rollback",
            actionDescription: `Pedido de compra excluído automaticamente ao retroceder da fase ${request.currentPhase} para ${newPhase}`,
            performedBy: req.session?.userId,
            affectedTables: ["purchase_orders", "purchase_order_items"],
          });
        }
      }

      const updatedRequest = await storage.updatePurchaseRequest(id, {
        currentPhase: newPhase as any,
        updatedAt: new Date(),
        ...(isRollbackFromPurchaseOrderFlow
          ? {
              purchaseDate: null,
              purchaseObservations: null,
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
            }
          : {}),
      } as any);

      realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
        event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
        payload: { id, currentPhase: newPhase, updatedAt: updatedRequest.updatedAt },
      });

      res.json(updatedRequest);
    },
  );

  // Phase transition routes
  app.post(
    "/api/purchase-requests/:id/send-to-approval",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;

        // Handle temporary IDs
        if (idParam.startsWith("temp_")) {
          return res.status(400).json({
            message: "Solicitação precisa ser salva antes de ser enviada para aprovação",
          });
        }

        const id = parseInt(idParam);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const updatedRequest = await workflowService.sendToApproval(id);
        res.json(updatedRequest);
      } catch (error: any) {
        console.error("Error sending to approval:", error);
        res.status(400).json({ message: error.message || "Failed to send to approval" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/can-approve-a1",
    isAuthenticated,
    async (req, res) => {
      const idParam = req.params.id;

      if (idParam.startsWith("temp_")) {
        return res.json({
          canApprove: false,
          message: "Solicitação temporária não pode ser aprovada",
        });
      }

      const requestId = parseInt(idParam);
      if (isNaN(requestId)) {
        throw new ValidationError("ID inválido");
      }

      const userId = req.session.userId;

      const request = await storage.getPurchaseRequestById(requestId);
      if (!request) {
        throw new NotFoundError("Solicitação de compra não encontrada");
      }

      const userCostCenters = await storage.getUserCostCenters(userId!);
      const canApprove = request.costCenterId != null && userCostCenters.includes(request.costCenterId);

      res.json({
        canApprove,
        requestCostCenter: request.costCenterId,
        userCostCenters: userCostCenters,
      });
    },
  );

  app.post(
    "/api/purchase-requests/:id/approve-a1",
    isAuthenticated,
    canApproveRequest,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { approved, rejectionReason, approverId } = req.body;

      const updatedRequest = await workflowService.approveA1(id, approved, rejectionReason, approverId);
      res.json(updatedRequest);
    },
  );

  app.post(
    "/api/purchase-requests/:id/update-quotation",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { buyerId, totalValue, paymentMethodId } = req.body;

      const updates = {
        buyerId,
        totalValue,
        paymentMethodId,
        currentPhase: "aprovacao_a2" as const,
      };

      const request = await storage.updatePurchaseRequest(id, updates);
      res.json(request);
    },
  );

  app.post(
    "/api/purchase-requests/:id/approve-a2",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { approved, rejectionReason, rejectionAction, approverId } = req.body;

      const updatedRequest = await workflowService.approveA2(id, approved, rejectionReason, rejectionAction, approverId);
      res.json(updatedRequest);
    },
  );

  // Get selected supplier for A2 approval
  app.get(
    "/api/purchase-requests/:id/selected-supplier",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);

      const quotation = await storage.getQuotationByPurchaseRequestId(id);
      if (!quotation) {
        return res.json(null);
      }

      const supplierQuotations = await storage.getSupplierQuotations(
        quotation.id,
      );
      const selectedSupplier = supplierQuotations.find((sq) => sq.isChosen);

      if (!selectedSupplier) {
        return res.json(null);
      }

      const supplier = await storage.getSupplierById(
        selectedSupplier.supplierId,
      );

      const items = await storage.getSupplierQuotationItems(
        selectedSupplier.id,
      );

      res.json({
        supplier,
        quotation: selectedSupplier,
        items,
        choiceReason: selectedSupplier.choiceReason,
      });
    },
  );

  app.get(
    "/api/purchase-requests/:id/nf-status",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) {
        throw new ValidationError("ID inválido");
      }
      const purchaseOrder = await storage.getPurchaseOrderByRequestId(id);
      if (!purchaseOrder) {
        return res.json({ nfConfirmed: false, status: "nf_pendente" });
      }
      const receiptsList = await storage.getReceiptsByPurchaseOrderId(purchaseOrder.id);
      const confirmedStatuses = new Set([
        "nf_confirmada",
        "recebimento_confirmado",
        "recebimento_parcial",
        "complete",
        "partial",
        "validado_compras",
      ]);
      const nfReceipt = receiptsList.find((rec) => confirmedStatuses.has(rec.status));
      if (!nfReceipt) {
        const physicalReceipt = receiptsList.find((rec) => rec.status === "conf_fisica");
        if (physicalReceipt) {
           return res.json({
             nfConfirmed: false,
             status: "conf_fisica",
             receiptId: physicalReceipt.id,
             documentNumber: physicalReceipt.documentNumber,
             documentSeries: physicalReceipt.documentSeries,
           });
         }

        const pendingReceipt = receiptsList.find((rec) => rec.status === "nf_pendente");
        return res.json({
          nfConfirmed: false,
          status: pendingReceipt ? pendingReceipt.status : "nf_pendente",
        });
      }
        const confirmedBy = nfReceipt.approvedBy ? await storage.getUser(nfReceipt.approvedBy) : null;
        let financialData = null;
        if (nfReceipt.observations) {
          try {
            financialData = typeof nfReceipt.observations === 'string' 
              ? JSON.parse(nfReceipt.observations) 
              : nfReceipt.observations;
          } catch {}
        }
        return res.json({
          nfConfirmed: true,
          status: nfReceipt.status,
          receiptId: nfReceipt.id,
          confirmedAt: nfReceipt.approvedAt || nfReceipt.createdAt,
          financialData,
          confirmedBy: confirmedBy
            ? {
                id: confirmedBy.id,
                name: `${confirmedBy.firstName} ${confirmedBy.lastName}`.trim(),
                email: confirmedBy.email,
              }
            : null,
        });
    },
  );

  app.post(
    "/api/purchase-requests/:id/report-issue",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { reportedById, pendencyReason, receivedQuantities } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      if (!request || request.currentPhase !== "recebimento") {
        throw new ValidationError("Request must be in the receiving phase");
      }

      if (receivedQuantities && typeof receivedQuantities === "object") {
        for (const [key, value] of Object.entries(receivedQuantities)) {
          const qty = Number(value);
          if (!Number.isFinite(qty) || qty < 0) {
            throw new ValidationError(`Quantidade inválida para o item ${key}. Utilize apenas números maiores ou iguais a zero.`);
          }
        }
      }

      // Persist received quantities if provided
      const purchaseOrder = await storage.getPurchaseOrderByRequestId(id);
      if (purchaseOrder && receivedQuantities) {
         const poItems = await storage.getPurchaseOrderItems(purchaseOrder.id);
         
         for (const it of poItems) {
            const qty = Number(receivedQuantities[it.id] || 0);
            if (qty > 0) {
               const currentQty = Number(it.quantityReceived || 0);
               await db.update(purchaseOrderItems)
                 .set({ quantityReceived: String(currentQty + qty) })
                 .where(eq(purchaseOrderItems.id, it.id));
            }
         }
      }

      const updateData = {
        currentPhase: "pedido_compra" as any,
        hasPendency: true,
        pendencyReason: pendencyReason || "Pendência reportada",
        updatedAt: new Date(),
      };

      const updatedRequest = await storage.updatePurchaseRequest(
        id,
        updateData,
      );
      res.json(updatedRequest);
    },
  );

  app.get(
    "/api/purchase-requests/:id/approval-history",
    isAuthenticated,
    async (req, res) => {
      const idParam = req.params.id;
      if (idParam.startsWith("temp_")) {
        return res.json([]);
      }
      const id = parseInt(idParam);
      if (isNaN(id)) {
        throw new ValidationError("ID inválido");
      }
      const history = await storage.getApprovalHistory(id);
      res.json(history);
    },
  );

  // Complete timeline endpoint for all phase transitions
  app.get(
    "/api/purchase-requests/:id/complete-timeline",
    isAuthenticated,
    async (req, res) => {
      const idParam = req.params.id;
      if (idParam.startsWith("temp_")) {
        return res.json([]);
      }
      const id = parseInt(idParam);
      if (isNaN(id)) {
        throw new ValidationError("ID inválido");
      }
      const timeline = await storage.getCompleteTimeline(id);
      res.json(timeline);
    },
  );

  // New route for advancing from "Pedido de Compra" to "Recebimento"
  app.post(
    "/api/purchase-requests/:id/advance-to-receipt",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const userId = req.session.userId;

      const user = await storage.getUser(userId!);
      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      const request = await storage.getPurchaseRequestById(id);
      if (!request) {
        throw new NotFoundError("Solicitação de compra não encontrada");
      }

      if (request.currentPhase !== "pedido_compra") {
        throw new ValidationError("Solicitação deve estar na fase 'Pedido de Compra' para avançar para recebimento");
      }

      const [purchaseOrder] = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseRequestId, id))
        .limit(1);

      const updatedRequest = await storage.updatePurchaseRequest(id, {
        currentPhase: "pedido_concluido",
      });

      await db.insert(receipts).values({
        receiptNumber: generateReceiptNumber(),
        purchaseOrderId: purchaseOrder?.id || null,
        purchaseRequestId: id,
        status: "rascunho",
        receiptPhase: "recebimento_fisico",
        receiptType: (request.category === "servico" ? "servico" : "produto") as any,
        supplierId: request.chosenSupplierId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await storage.createApprovalHistory({
        purchaseRequestId: id,
        approverType: "MOVEMENT",
        approverId: Number(userId),
        approved: true,
        rejectionReason: null,
      });

      realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
        event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
        payload: { id, currentPhase: "pedido_concluido", updatedAt: updatedRequest.updatedAt },
      });

      realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
          event: 'receipt_created',
          payload: { purchaseRequestId: id }
      });

      res.json(updatedRequest);
    },
  );

  app.get(
    "/api/purchase-requests/:id/undo-receipt/preview",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) throw new ValidationError("ID inválido");

      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user || (!user.isAdmin && !user.isManager && !user.isBuyer)) {
        throw new UnauthorizedError("Sem permissão para desfazer recebimento");
      }

      const preview = await receiptService.getUndoReceiptPreview(id);
      res.json({ success: true, data: preview });
    },
  );

  app.post(
    "/api/purchase-requests/:id/undo-receipt",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) throw new ValidationError("ID inválido");

      const schema = z.object({
        confirm: z.boolean().optional(),
        expectedReceiptIds: z.array(z.number()).optional(),
      });
      const body = schema.parse(req.body || {});

      const userId = req.session.userId!;
      const result = await receiptService.undoReceiptForPurchaseRequest(id, userId, {
        confirm: body.confirm,
        expectedReceiptIds: body.expectedReceiptIds,
      });

      realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
        event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
        payload: { id, currentPhase: "pedido_compra", updatedAt: new Date() },
      });
      realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
        event: RECEIPT_EVENTS.PHASE_CHANGED,
        payload: { purchaseRequestId: id, action: "undo_receiving" } as any,
      });

      res.json({ success: true, data: result });
    },
  );

  app.get(
    "/api/purchase-requests/:id/attachments",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        throw new ValidationError("Invalid purchase request ID");
      }

      const attachmentsData = await storage.getAttachmentsByPurchaseRequestId(id);
      res.json(attachmentsData);
    },
  );


  // Archive purchase request endpoint for ConclusionPhase
  app.patch(
    "/api/purchase-requests/:id/archive",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { conclusionObservations } = req.body;
      const request = await workflowService.archiveRequest(id, conclusionObservations);
      res.json(request);
    },
  );

  // Quick archive endpoint for Kanban board
  app.post(
    "/api/purchase-requests/:id/archive-direct",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const request = await workflowService.archiveRequest(id, "Arquivado diretamente via Kanban");
      res.json(request);
    },
  );

  // Rota para desarquivar uma solicitação (somente Comprador ou Admin)
  app.post(
    "/api/purchase-requests/:id/unarchive",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const updated = await workflowService.unarchiveRequest(id, userId);

      await auditService.log({
        purchaseRequestId: id,
        actionType: 'unarchive',
        actionDescription: `Solicitação desarquivada e retornada para a fase: ${updated.currentPhase}`,
        performedBy: userId,
        affectedTables: ['purchase_requests']
      });

      res.json(updated);
    },
  );

  // Send conclusion email endpoint
  app.post(
    "/api/purchase-requests/:id/send-conclusion-email",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);

      if (!request) {
        throw new NotFoundError("Purchase request not found");
      }

      if (!isEmailEnabled()) {
        console.log(`📧 [EMAIL DISABLED] Tentativa de envio de e-mail de conclusão para solicitação ${request.requestNumber} foi bloqueada - envio de e-mails desabilitado`);
        throw new ValidationError("Serviço de envio de e-mails temporariamente indisponível. Entre em contato com o administrador do sistema.");
      }

      console.log(`📧 [EMAIL ENABLED] Enviando e-mail de conclusão para solicitação ${request.requestNumber}`);
      res.json({ message: "Conclusion email sent successfully" });
    },
  );

  // Generate completion summary PDF endpoint
  app.get(
    "/api/purchase-requests/:id/pdf",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const purchaseRequest = await storage.getPurchaseRequestById(id);
      if (!purchaseRequest) {
        throw new NotFoundError("Purchase request not found");
      }

      const pdfBuffer = await PDFService.generatePurchaseOrderPDF(id);

      const bufferStart = pdfBuffer.toString(
        "utf8",
        0,
        Math.min(1000, pdfBuffer.length),
      );
      const isHtmlContent =
        bufferStart.includes("HTML_FALLBACK_MARKER") ||
        bufferStart.includes("<!DOCTYPE html>") ||
        bufferStart.includes("<html>") ||
        bufferStart.includes("<HTML>") ||
        bufferStart.trim().startsWith("<");

      if (isHtmlContent) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="Pedido_Compra_${purchaseRequest.requestNumber}.html"`,
        );
        res.send(pdfBuffer);
      } else {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="Pedido_Compra_${purchaseRequest.requestNumber}.pdf"`,
        );
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(pdfBuffer);
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/completion-summary-pdf",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);

      if (!request) {
        throw new NotFoundError("Purchase request not found");
      }

      const pdfBuffer = await PDFService.generateCompletionSummaryPDF(id);

      const bufferStart = pdfBuffer.toString(
        "utf8",
        0,
        Math.min(1000, pdfBuffer.length),
      );
      const isHtmlContent =
        bufferStart.includes("HTML_FALLBACK_MARKER") ||
        bufferStart.includes("<!DOCTYPE html>") ||
        bufferStart.includes("<html>") ||
        bufferStart.includes("<HTML>") ||
        bufferStart.trim().startsWith("<");

      const filename = `Conclusao_${request.requestNumber}`;

      if (isHtmlContent) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.html"`);
        res.send(pdfBuffer);
      } else {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        res.send(pdfBuffer);
      }
    },
  );

  // Get distinct item descriptions for autocomplete
  app.get(
    "/api/purchase-request-items/distinct-descriptions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const { query } = req.query;
      const descriptions = await storage.getDistinctItemDescriptions(query as string);
      res.json(descriptions);
    }
  );
}
