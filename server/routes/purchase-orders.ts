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
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const { purchaseObservations } = req.body;
        const userId = req.session?.userId;

        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }

        // Buscar o purchase request e dados relacionados
        const purchaseRequest = await storage.getPurchaseRequestById(id);
        if (!purchaseRequest) {
          return res
            .status(404)
            .json({ message: "Purchase request not found" });
        }

        // Buscar cotação e fornecedor escolhido
        const quotation = await storage.getQuotationByPurchaseRequestId(id);
        if (!quotation) {
          return res
            .status(400)
            .json({ message: "No quotation found for this purchase request" });
        }

        const supplierQuotations = await storage.getSupplierQuotations(
          quotation.id,
        );
        const chosenSupplierQuotation = supplierQuotations.find(
          (sq) => sq.isChosen,
        );
        if (!chosenSupplierQuotation) {
          return res
            .status(400)
            .json({ message: "No supplier chosen for this quotation" });
        }

        // Buscar itens do purchase request
        const purchaseRequestItems = await storage.getPurchaseRequestItems(id);
        if (purchaseRequestItems.length === 0) {
          return res
            .status(400)
            .json({ message: "No items found for this purchase request" });
        }

        // Buscar itens da cotação do fornecedor para obter preços
        const supplierQuotationItems = await storage.getSupplierQuotationItems(
          chosenSupplierQuotation.id,
        );

        // Verificar se já existe um purchase order para este request
        const existingPurchaseOrder =
          await storage.getPurchaseOrderByRequestId(id);
        if (existingPurchaseOrder) {
          return res
            .status(400)
            .json({
              message: "Purchase order already exists for this request",
            });
        }

        // Gerar número do pedido
        const orderNumber = `PO-${new Date().getFullYear()}-${String(id).padStart(3, "0")}`;

        // Criar o purchase order
        const purchaseOrderData = {
          orderNumber,
          purchaseRequestId: id,
          supplierId: chosenSupplierQuotation.supplierId,
          quotationId: quotation.id,
          status: "draft" as const,
          totalValue: chosenSupplierQuotation.totalValue || "0",
          paymentTerms: null,
          deliveryTerms: null,
          deliveryAddress: null,
          contactPerson: null,
          contactPhone: null,
          observations: purchaseObservations || null,
          approvedBy: null,
          approvedAt: null,
          createdBy: userId,
        };

        const purchaseOrder =
          await storage.createPurchaseOrder(purchaseOrderData);

        const quotationItems = await storage.getQuotationItems(quotation.id);
        let itemsTotal = 0;
        for (const si of supplierQuotationItems) {
          if (si.isAvailable === false) continue;
          const qi = quotationItems.find(q => q.id === si.quotationItemId);
          const description = qi?.description || "";
          const unit = si.confirmedUnit || qi?.unit || "UN";
          const quantity = si.availableQuantity ?? qi?.quantity ?? "0";
          const unitPrice = si.unitPrice || "0";
          const baseTotal = (parseFloat(unitPrice) || 0) * (parseFloat(quantity as any) || 0);
          let itemDiscount = 0;
          let totalPrice = baseTotal;
          if (si.discountPercentage && parseFloat(si.discountPercentage as any) > 0) {
            itemDiscount = (baseTotal * parseFloat(si.discountPercentage as any)) / 100;
          } else if (si.discountValue && parseFloat(si.discountValue as any) > 0) {
            itemDiscount = parseFloat(si.discountValue as any);
          }
          totalPrice = Math.max(0, baseTotal - itemDiscount);
          itemsTotal += totalPrice;
          const purchaseOrderItemData = {
            purchaseOrderId: purchaseOrder.id,
            itemCode: qi?.itemCode || `ITEM-${si.id}`,
            description,
            quantity,
            unit,
            unitPrice,
            totalPrice: totalPrice.toFixed(4),
            deliveryDeadline: null,
            costCenterId: purchaseRequest.costCenterId,
            accountCode: null,
          };
          await storage.createPurchaseOrderItem(purchaseOrderItemData);
        }
        try {
          const supplierTotal = parseFloat(chosenSupplierQuotation.totalValue || "0");
          const discrepancy = Math.abs(supplierTotal - itemsTotal);
          await pool.query(
            `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at, before_data, after_data)
             VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
            [
              id,
              userId,
              'po_created_manual',
              `PO criado manualmente a partir da cotação vencedora. Soma itens: R$ ${itemsTotal.toFixed(4)} | Total cotação: R$ ${supplierTotal.toFixed(4)} | Diferença: R$ ${discrepancy.toFixed(4)}`,
              JSON.stringify({ supplierTotal }),
              JSON.stringify({ itemsTotal })
            ]
          );
        } catch {}

        // Atualizar o purchase request
        const updates = {
          purchaseDate: new Date(),
          purchaseObservations,
          currentPhase: "pedido_compra" as const,
        };

        const updatedRequest = await storage.updatePurchaseRequest(id, updates);

        res.json({
          purchaseRequest: updatedRequest,
          purchaseOrder: purchaseOrder,
          message: "Purchase order created successfully",
        });
      } catch (error) {
        console.error("Error creating purchase order:", error);
        res
          .status(500)
          .json({
            message: "Failed to create purchase order",
            error: String(error),
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
