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

export function registerPurchaseOrderRoutes(app: Express) {
  // Purchase Orders endpoints
  app.post("/api/purchase-orders", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPurchaseOrderSchema.parse(req.body);
      const purchaseOrder = await storage.createPurchaseOrder(validatedData);
      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res
        .status(500)
        .json({
          message: "Failed to create purchase order",
          error: String(error),
        });
    }
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const purchaseOrder = await storage.getPurchaseOrderById(id);

      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.get("/api/purchase-requests/:id/purchase-order", async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.id);
      const purchaseOrder =
        await storage.getPurchaseOrderByRequestId(purchaseRequestId);

      if (!purchaseOrder) {
        return res
          .status(404)
          .json({ message: "Purchase order not found for this request" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order by request:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.get("/api/purchase-orders/by-request/:id", async (req, res) => {
    try {
      const purchaseRequestId = parseInt(req.params.id);
      const purchaseOrder =
        await storage.getPurchaseOrderByRequestId(purchaseRequestId);

      if (!purchaseOrder) {
        return res
          .status(404)
          .json({ message: "Purchase order not found for this request" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error fetching purchase order by request:", error);
      res.status(500).json({ message: "Failed to fetch purchase order" });
    }
  });

  app.get("/api/purchase-orders/:id/items", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const items = await storage.getPurchaseOrderItems(purchaseOrderId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase order items:", error);
      res.status(500).json({ message: "Failed to fetch purchase order items" });
    }
  });

  app.post(
    "/api/purchase-requests/:id/create-purchase-order",
    isAuthenticated,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { purchaseObservations } = req.body;
        const userId = req.session?.userId;

        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        const result = await purchaseOrderService.createPurchaseOrderFromQuotation(id, userId, {
          purchaseObservations,
          auditActionType: 'po_created_manual'
        });

        if (!result) {
          return res.status(400).json({ message: "Não foi possível criar o pedido. Verifique se a cotação foi aprovada e se o pedido já não existe." });
        }

        // Atualizar o purchase request para refletir a nova fase se necessário
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
      } catch (error: any) {
        console.error("Error creating purchase order:", error);
        res.status(500).json({
          message: "Failed to create purchase order",
          error: error.message || String(error),
        });
      }
    },
  );


  // Admin endpoint to search purchase request by request number
  app.get(
    "/api/admin/purchase-requests/search/:requestNumber",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { requestNumber } = req.params;
        const request = await storage.getPurchaseRequestByNumber(requestNumber);

        if (!request) {
          return res
            .status(404)
            .json({ message: "Solicitação não encontrada" });
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
      } catch (error) {
        console.error("Error searching purchase request:", error);
        res.status(500).json({ message: "Falha ao buscar solicitação" });
      }
    },
  );

  // Admin endpoint to update complete purchase request data
  app.patch(
    "/api/admin/purchase-requests/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
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
          return res.status(404).json({ message: "Solicitação não encontrada" });
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
      } catch (error) {
        console.error("Error updating purchase request (admin):", error);
        res.status(500).json({ message: "Falha ao atualizar solicitação" });
      }
    },
  );
}
