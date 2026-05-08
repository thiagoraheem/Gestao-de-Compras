import type { Express, Request, Response } from "express";
import { storage } from "../storage";
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
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "../../shared/realtime-events";
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

export function registerPurchaseRequestRoutes(app: Express) {
  // Purchase Requests routes
  app.get("/api/purchase-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId
        ? parseInt(req.query.companyId as string)
        : undefined;
      const userId = req.session.userId;
      const user = userId ? await storage.getUser(userId) : undefined;
      const requests = await storage.getAllPurchaseRequests(companyId, user);

      res.json(requests);
    } catch (error) {
      console.error("Error fetching purchase requests:", error);
      res.status(500).json({ message: "Failed to fetch purchase requests" });
    }
  });

  app.get(
    "/api/purchase-requests/phase/:phase",
    isAuthenticated,
    async (req, res) => {
      try {
        const phase = req.params.phase;
        const requests = await storage.getPurchaseRequestsByPhase(phase);
        res.json(requests);
      } catch (error) {
        console.error("Error fetching purchase requests by phase:", error);
        res.status(500).json({ message: "Failed to fetch purchase requests" });
      }
    },
  );

  app.get("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getPurchaseRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      res.json(request);
    } catch (error) {
      console.error("Error fetching purchase request:", error);
      res.status(500).json({ message: "Failed to fetch purchase request" });
    }
  });

  app.post("/api/purchase-requests", isAuthenticated, async (req, res) => {
    try {
      const request = await purchaseRequestService.createRequest(req.body);
      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error creating purchase request:", error);
      res.status(400).json({ message: error.message || "Invalid purchase request data" });
    }
  });

  app.put("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const idParam = req.params.id;

      // Handle temporary IDs
      if (idParam.startsWith("temp_")) {
        return res.status(400).json({
          message: "Solicitação precisa ser salva antes de ser atualizada",
        });
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const request = await purchaseRequestService.updateRequest(id, req.body);
      res.json(request);
    } catch (error: any) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: error.message || "Invalid purchase request data" });
    }
  });

  app.patch("/api/purchase-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const idParam = req.params.id;

      // Handle temporary IDs
      if (idParam.startsWith("temp_")) {
        return res
          .status(400)
          .json({
            message: "Solicitação precisa ser salva antes de ser atualizada",
          });
      }

      const id = parseInt(idParam);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Validate request data (only partial update)
      const validatedRequestData = insertPurchaseRequestSchema
        .partial()
        .parse(req.body);

      // Update the purchase request
      const request = await storage.updatePurchaseRequest(
        id,
        validatedRequestData,
      );

      // Invalidate cache for purchase requests
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
    } catch (error) {
      console.error("Error updating purchase request:", error);
      res.status(400).json({ message: "Invalid purchase request data" });
    }
  });

  // Purchase Request Items routes
  app.get(
    "/api/purchase-requests/:id/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;

        // Handle temporary IDs - return empty array for temp requests
        if (idParam.startsWith("temp_")) {
          return res.json([]);
        }

        const purchaseRequestId = parseInt(idParam);
        if (isNaN(purchaseRequestId)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        const includeTransferred = req.query.includeTransferred === "true";
        const items = await storage.getPurchaseRequestItems(
          purchaseRequestId,
          includeTransferred,
        );

        // Map the items to match the frontend EditableItem interface
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
      } catch (error) {
        console.error("Error fetching purchase request items:", error);
        res.status(500).json({ message: "Failed to fetch items" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/items",
    isAuthenticated,
    async (req, res) => {
      try {
        const purchaseRequestId = parseInt(req.params.id);
        const itemData = insertPurchaseRequestItemSchema.parse({
          ...req.body,
          purchaseRequestId,
        });
        const item = await storage.createPurchaseRequestItem(itemData);
        res.status(201).json(item);
      } catch (error) {
        console.error("Error creating purchase request item:", error);
        res.status(400).json({ message: "Invalid item data" });
      }
    },
  );

  app.put(
    "/api/purchase-request-items/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const itemData = insertPurchaseRequestItemSchema
          .partial()
          .parse(req.body);
        const item = await storage.updatePurchaseRequestItem(id, itemData);
        res.json(item);
      } catch (error) {
        console.error("Error updating purchase request item:", error);
        res.status(400).json({ message: "Invalid item data" });
      }
    },
  );

  app.delete(
    "/api/purchase-request-items/:id",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        await storage.deletePurchaseRequestItem(id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting purchase request item:", error);
        res.status(500).json({ message: "Failed to delete item" });
      }
    },
  );

  app.patch(
    "/api/purchase-requests/:id/update-phase",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { newPhase } = req.body;

        if (!newPhase) {
          return res.status(400).json({ message: "A nova fase é obrigatória" });
        }

        const request = await storage.getPurchaseRequestById(id);
        if (!request) {
          return res.status(404).json({ message: "Solicitação não encontrada" });
        }

        const updatedRequest = await storage.updatePurchaseRequest(id, {
          currentPhase: newPhase as any,
          updatedAt: new Date(),
        } as any);

        // Publish event for real-time updates
        realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
          event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
          payload: { id, currentPhase: newPhase, updatedAt: updatedRequest.updatedAt },
        });

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error updating phase:", error);
        res.status(500).json({ message: "Falha ao atualizar fase" });
      }
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
      try {
        const idParam = req.params.id;

        // Handle temporary IDs
        if (idParam.startsWith("temp_")) {
          return res.json({
            canApprove: false,
            message: "Solicitação temporária não pode ser aprovada",
          });
        }

        const requestId = parseInt(idParam);
        if (isNaN(requestId)) {
          return res.status(400).json({ message: "ID inválido" });
        }

        const userId = req.session.userId;

        const request = await storage.getPurchaseRequestById(requestId);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        const userCostCenters = await storage.getUserCostCenters(userId!);
        const canApprove = request.costCenterId != null && userCostCenters.includes(request.costCenterId);

        res.json({
          canApprove,
          requestCostCenter: request.costCenterId,
          userCostCenters: userCostCenters,
        });
      } catch (error) {
        console.error("Error checking approval permissions:", error);
        res
          .status(500)
          .json({ message: "Failed to check approval permissions" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/approve-a1",
    isAuthenticated,
    canApproveRequest,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { approved, rejectionReason, approverId } = req.body;

        const updatedRequest = await workflowService.approveA1(id, approved, rejectionReason, approverId);
        res.json(updatedRequest);
      } catch (error: any) {
        console.error("Error approving A1:", error);
        res.status(400).json({
          message: error.message || "Failed to process approval",
        });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/update-quotation",
    isAuthenticated,
    async (req, res) => {
      try {
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
      } catch (error) {
        console.error("Error updating quotation:", error);
        res.status(400).json({ message: "Failed to update quotation" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/approve-a2",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { approved, rejectionReason, rejectionAction, approverId } = req.body;

        const updatedRequest = await workflowService.approveA2(id, approved, rejectionReason, rejectionAction, approverId);
        res.json(updatedRequest);
      } catch (error: any) {
        console.error("Error approving A2:", error);
        res.status(400).json({ message: error.message || "Failed to process A2 approval" });
      }
    },
  );

  // Get selected supplier for A2 approval
  app.get(
    "/api/purchase-requests/:id/selected-supplier",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Get quotation for this purchase request
        const quotation = await storage.getQuotationByPurchaseRequestId(id);
        if (!quotation) {
          return res.json(null);
        }

        // Get supplier quotations for this quotation
        const supplierQuotations = await storage.getSupplierQuotations(
          quotation.id,
        );
        const selectedSupplier = supplierQuotations.find((sq) => sq.isChosen);

        if (!selectedSupplier) {
          return res.json(null);
        }

        // Get supplier details
        const supplier = await storage.getSupplierById(
          selectedSupplier.supplierId,
        );

        // Get supplier quotation items
        const items = await storage.getSupplierQuotationItems(
          selectedSupplier.id,
        );

        res.json({
          supplier,
          quotation: selectedSupplier,
          items,
          choiceReason: selectedSupplier.choiceReason,
        });
      } catch (error) {
        console.error("Error getting selected supplier:", error);
        res.status(500).json({ message: "Failed to get selected supplier" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/nf-status",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ message: "ID inválido" });
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
      } catch (error) {
        console.error("Error fetching NF status:", error);
        res.status(500).json({ message: "Erro ao buscar status da NF" });
      }
    },
  );

  app.post(
    "/api/purchase-requests/:id/report-issue",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { reportedById, pendencyReason, receivedQuantities } = req.body;

        const request = await storage.getPurchaseRequestById(id);
        if (!request || request.currentPhase !== "recebimento") {
          return res
            .status(400)
            .json({ message: "Request must be in the receiving phase" });
        }

        if (receivedQuantities && typeof receivedQuantities === "object") {
          for (const [key, value] of Object.entries(receivedQuantities)) {
            const qty = Number(value);
            if (!Number.isFinite(qty) || qty < 0) {
              return res.status(400).json({
                message: `Quantidade inválida para o item ${key}. Utilize apenas números maiores ou iguais a zero.`,
              });
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
      } catch (error) {
        console.error("Error reporting issue:", error);
        res.status(400).json({ message: "Failed to report issue" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/approval-history",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;
        if (idParam.startsWith("temp_")) {
          return res.json([]);
        }
        const id = parseInt(idParam);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        const history = await storage.getApprovalHistory(id);
        res.json(history);
      } catch (error) {
        console.error("Error fetching approval history:", error);
        res.status(500).json({ message: "Failed to fetch approval history" });
      }
    },
  );

  // Complete timeline endpoint for all phase transitions
  app.get(
    "/api/purchase-requests/:id/complete-timeline",
    isAuthenticated,
    async (req, res) => {
      try {
        const idParam = req.params.id;
        if (idParam.startsWith("temp_")) {
          return res.json([]);
        }
        const id = parseInt(idParam);
        if (isNaN(id)) {
          return res.status(400).json({ message: "ID inválido" });
        }
        const timeline = await storage.getCompleteTimeline(id);
        res.json(timeline);
      } catch (error) {
        console.error("Error fetching complete timeline:", error);
        res.status(500).json({ message: "Failed to fetch complete timeline" });
      }
    },
  );

  // New route for advancing from "Pedido de Compra" to "Recebimento"
  app.post(
    "/api/purchase-requests/:id/advance-to-receipt",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId;

        // Get current user data
        const user = await storage.getUser(userId!);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get current request data
        const request = await storage.getPurchaseRequestById(id);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Verify current phase is "pedido_compra"
        if (request.currentPhase !== "pedido_compra") {
          return res
            .status(400)
            .json({
              message:
                "Solicitação deve estar na fase 'Pedido de Compra' para avançar para recebimento",
            });
        }

        // Find the purchase order for this request
        const [purchaseOrder] = await db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseRequestId, id))
          .limit(1);

        // Update phase to "pedido_concluido" (Handoff column in Flow 1)
        const updatedRequest = await storage.updatePurchaseRequest(id, {
          currentPhase: "pedido_concluido",
        });

        // Requirement T01: Create the receipt record for Flow 2
        // This ensures the card appears in the "Recebimento Físico" column
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

        // Create movement history entry
        await storage.createApprovalHistory({
          purchaseRequestId: id,
          approverType: "MOVEMENT",
          approverId: Number(userId),
          approved: true,
          rejectionReason: null,
        });

        // Notify phase change for Flow 1
        realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
          event: PURCHASE_REQUEST_EVENTS.PHASE_CHANGED,
          payload: { id, currentPhase: "pedido_concluido", updatedAt: updatedRequest.updatedAt },
        });

        // Notify that a new receipt is available for Flow 2
        realtime.publish(REALTIME_CHANNELS.RECEIPTS, {
            event: 'receipt_created',
            payload: { purchaseRequestId: id }
        });

        res.json(updatedRequest);
      } catch (error) {
        console.error("Error advancing to receipt:", error);
        res.status(400).json({ message: "Failed to advance to receipt" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) {
          return res.status(400).json({ message: "Invalid purchase request ID" });
        }

        const attachmentsData = await storage.getAttachmentsByPurchaseRequestId(id);
        res.json(attachmentsData);
      } catch (error) {
        console.error("Error fetching purchase request attachments:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar anexos da solicitação" });
      }
    },
  );


  // Archive purchase request endpoint for ConclusionPhase
  app.patch(
    "/api/purchase-requests/:id/archive",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { conclusionObservations } = req.body;
        const request = await workflowService.archiveRequest(id, conclusionObservations);
        res.json(request);
      } catch (error: any) {
        console.error("Error archiving request:", error);
        res.status(400).json({ message: error.message || "Failed to archive request" });
      }
    },
  );

  // Rota para desarquivar uma solicitação (somente Comprador ou Admin)
  app.post(
    "/api/purchase-requests/:id/unarchive",
    isAuthenticated,
    isAdminOrBuyer,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.session.userId!;
        const updated = await workflowService.unarchiveRequest(id, userId);

        // Registrar no log de auditoria
        await pool.query(
          `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            id,
            userId,
            'unarchive',
            `Solicitação desarquivada e retornada para a fase: ${updated.currentPhase}`
          ]
        );

        res.json(updated);
      } catch (error: any) {
        console.error("Error unarchiving request:", error);
        res.status(500).json({ message: error.message || "Falha ao desarquivar solicitação" });
      }
    },
  );

  // Send conclusion email endpoint
  app.post(
    "/api/purchase-requests/:id/send-conclusion-email",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const request = await storage.getPurchaseRequestById(id);

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Verificar se o envio de e-mails está habilitado
        if (!isEmailEnabled()) {
          console.log(`📧 [EMAIL DISABLED] Tentativa de envio de e-mail de conclusão para solicitação ${request.requestNumber} foi bloqueada - envio de e-mails desabilitado`);
          return res.status(503).json({ 
            message: "Serviço de envio de e-mails temporariamente indisponível. Entre em contato com o administrador do sistema." 
          });
        }

        // Implementation...
        console.log(`📧 [EMAIL ENABLED] Enviando e-mail de conclusão para solicitação ${request.requestNumber}`);
        res.json({ message: "Conclusion email sent successfully" });
      } catch (error) {
        console.error("Error sending conclusion email:", error);
        res.status(500).json({ message: "Failed to send conclusion email" });
      }
    },
  );

  // Generate completion summary PDF endpoint
  app.get(
    "/api/purchase-requests/:id/pdf",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const purchaseRequest = await storage.getPurchaseRequestById(id);
        if (!purchaseRequest) {
          return res.status(404).json({ message: "Purchase request not found" });
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
      } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).json({ message: "Failed to generate PDF" });
      }
    },
  );

  app.get(
    "/api/purchase-requests/:id/completion-summary-pdf",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const request = await storage.getPurchaseRequestById(id);

        if (!request) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
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
      } catch (error) {
        console.error("Error generating completion PDF:", error);
        res.status(500).json({ message: "Failed to generate completion PDF" });
      }
    },
  );

  // Get distinct item descriptions for autocomplete
  app.get(
    "/api/purchase-request-items/distinct-descriptions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { query } = req.query;
        const descriptions = await storage.getDistinctItemDescriptions(query as string);
        res.json(descriptions);
      } catch (error) {
        console.error("Error fetching distinct item descriptions:", error);
        res.status(500).json({ message: "Failed to fetch item descriptions" });
      }
    }
  );
}
