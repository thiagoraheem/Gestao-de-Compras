import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import {
  insertPurchaseOrderSchema,
  purchaseOrderItems,
  purchaseOrders,
  receiptItems,
} from "../../shared/schema";
import { z } from "zod";
import { db, pool } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  notifyRequestConclusion,
} from "../email-service";
import {
  isAuthenticated,
  isAdmin,
} from "./middleware";
import { purchaseOrderService } from "../services/purchase-order-service";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";

export function registerPurchaseOrderRoutes(app: Express) {
  // Purchase Orders endpoints
  app.post("/api/purchase-orders", isAuthenticated, async (req, res) => {
    const validatedData = insertPurchaseOrderSchema.parse(req.body);
    const purchaseOrder = await storage.createPurchaseOrder(validatedData);
    res.status(201).json(purchaseOrder);
  });

  app.get("/api/purchase-orders/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const purchaseOrder = await storage.getPurchaseOrderById(id);

    if (!purchaseOrder) {
      throw new NotFoundError("Pedido de compra não encontrado");
    }

    res.json(purchaseOrder);
  });

  app.get("/api/purchase-requests/:id/purchase-order", isAuthenticated, async (req, res) => {
    const purchaseRequestId = parseInt(req.params.id);
    const purchaseOrder =
      await storage.getPurchaseOrderByRequestId(purchaseRequestId);

    if (!purchaseOrder) {
      throw new NotFoundError("Pedido de compra não encontrado para esta solicitação");
    }

    res.json(purchaseOrder);
  });

  app.get("/api/purchase-orders/by-request/:id", isAuthenticated, async (req, res) => {
    const purchaseRequestId = parseInt(req.params.id);
    const purchaseOrder =
      await storage.getPurchaseOrderByRequestId(purchaseRequestId);

    if (!purchaseOrder) {
      throw new NotFoundError("Pedido de compra não encontrado para esta solicitação");
    }

    res.json(purchaseOrder);
  });

  app.get("/api/purchase-orders/:id/items", isAuthenticated, async (req, res) => {
    const purchaseOrderId = parseInt(req.params.id);
    const items = await storage.getPurchaseOrderItems(purchaseOrderId);
    res.json(items);
  });

  app.post(
    "/api/purchase-requests/:id/create-purchase-order",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const { purchaseObservations } = req.body;
      const userId = req.session?.userId;

      if (!userId) {
        throw new UnauthorizedError("User not authenticated");
      }

      const result = await purchaseOrderService.createPurchaseOrderFromQuotation(id, userId, {
        purchaseObservations,
        auditActionType: 'po_created_manual'
      });

      if (!result) {
        throw new ValidationError("Não foi possível criar o pedido. Verifique se a cotação foi aprovada e se o pedido já não existe.");
      }

      const updatedRequest = await storage.updatePurchaseRequest(id, {
        purchaseDate: new Date(),
        purchaseObservations,
        currentPhase: "pedido_compra" as const,
      });

      res.json({
        purchaseRequest: updatedRequest,
        purchaseOrder: result.purchaseOrder,
        message: "Purchase order created successfully",
      });
    },
  );


  // Admin endpoint to search purchase request by request number
  app.get(
    "/api/admin/purchase-requests/search/:requestNumber",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const { requestNumber } = req.params;
      const request = await storage.getPurchaseRequestByNumber(requestNumber);

      if (!request) {
        throw new NotFoundError("Solicitação não encontrada");
      }

      // Get complete request data with relationships
      const [items, attachments, costCenter, requester] = await Promise.all([
        storage.getPurchaseRequestItems(request.id),
        storage.getAttachmentsByPurchaseRequestId(request.id),
        request.costCenterId != null ? storage.getCostCenterById(request.costCenterId) : Promise.resolve(null as any),
        request.requesterId != null ? storage.getUser(request.requesterId) : Promise.resolve(null as any),
      ]);

      const enrichedRequest = {
        ...request,
        items,
        attachments,
        costCenter,
        requester: requester
          ? {
              id: requester.id,
              firstName: requester.firstName,
              lastName: requester.lastName,
              email: requester.email,
            }
          : null,
      };

      res.json(enrichedRequest);
    },
  );

  // Admin endpoint to update complete purchase request data
  app.patch(
    "/api/admin/purchase-requests/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const {
        category,
        urgency,
        justification,
        idealDeliveryDate,
        availableBudget,
        additionalInfo,
        currentPhase,
        items,
      } = req.body;

      const request = await storage.getPurchaseRequestById(id);
      if (!request) {
        throw new NotFoundError("Solicitação não encontrada");
      }

      // Update purchase request header
      const updatedRequest = await storage.updatePurchaseRequest(id, {
        category,
        urgency,
        justification,
        idealDeliveryDate: idealDeliveryDate ? new Date(idealDeliveryDate) : null,
        availableBudget,
        additionalInfo,
        currentPhase,
      });

      // Update items if provided
      if (items && Array.isArray(items)) {
        // Delete existing items
        const existingItems = await storage.getPurchaseRequestItems(id);
        for (const item of existingItems) {
          await storage.deletePurchaseRequestItem(item.id);
        }

        // Create new items
        for (const item of items) {
          await storage.createPurchaseRequestItem({
            ...item,
            purchaseRequestId: id,
            id: undefined, // Let database generate ID
          });
        }
      }

      res.json(updatedRequest);
    },
  );
}
