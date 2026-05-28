import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { auditService } from "../services/audit-service";
import {
  insertQuotationSchema,
  insertQuotationItemSchema,
  insertSupplierQuotationSchema,
  insertSupplierQuotationItemSchema,
} from "../../shared/schema";
import { z } from "zod";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  notifyNewRFQ,
} from "../email-service";
import { invalidateCache } from "../cache";
import { realtime } from "../realtime";
import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "../../shared/realtime-events";
import {
  isAuthenticated,
  isAdminOrBuyer,
} from "./middleware";
import { NumberParser } from "../utils/number-parser";
import { fileStorageService } from "../services/file-storage-service";
import { notificationService } from "../services/notification-service";
import { quotationVersionService } from "../services/quotation-versioning";
import { QuantityValidationMiddleware } from "../middleware/quantity-validation";
import { quotationUpload } from "./upload-config";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import path from "path";

export function registerQuotationRoutes(app: Express) {
  // Quotation routes
  app.post(
    "/api/purchase-requests/:id/quotations",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      const {
        supplierId,
        quotedValue,
        paymentConditions,
        deliveryDays,
        observations,
      } = req.body;

      res.status(201).json({
        id: Math.floor(Math.random() * 1000000),
        supplierId,
        quotedValue,
        paymentConditions,
        deliveryDays,
        observations,
      });
    },
  );

  app.get(
    "/api/purchase-requests/:id/quotation-history",
    isAuthenticated,
    async (req, res) => {
      const id = parseInt(req.params.id);
      res.json([]);
    },
  );

  app.get("/api/quotations", isAuthenticated, async (req, res) => {
    const quotations = await storage.getAllQuotations();
    res.json(quotations);
  });

  app.get("/api/purchase-requests/:id/quotations", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const quotation = await storage.getQuotationByPurchaseRequestId(id);
    if (!quotation) {
      throw new NotFoundError("Cotação não encontrada");
    }
    res.json(quotation);
  });

  app.get("/api/quotations/dashboard", isAuthenticated, async (req, res) => {
    const data = await storage.getQuotationsDashboardData();
    res.json(data);
  });

  app.get("/api/quotations/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const quotation = await storage.getQuotationById(id);
    if (!quotation) {
      throw new NotFoundError("Cotação não encontrada");
    }
    res.json(quotation);
  });

  app.get("/api/quotations/:id/quantity-comparison", isAuthenticated, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    
    const quotation = await storage.getQuotationById(quotationId);
    if (!quotation) {
      throw new NotFoundError("Cotação não encontrada");
    }

    const quotationItems = await storage.getQuotationItems(quotationId);
    const prItems = await storage.getPurchaseRequestItems(quotation.purchaseRequestId, true);
    const supplierQuotations = await storage.getSupplierQuotations(quotationId);
    const comparison: any[] = [];
    
    for (const quotationItem of quotationItems) {
      const prItem = prItems.find(pr => 
        (pr.productCode && quotationItem.itemCode && pr.productCode === quotationItem.itemCode) || 
        (pr.description && quotationItem.description && pr.description === quotationItem.description)
      );

      const itemComparison = {
        quotationItemId: quotationItem.id,
        itemCode: quotationItem.itemCode,
        description: quotationItem.description,
        requestedQuantity: quotationItem.quantity,
        requestedUnit: quotationItem.unit,
        purchaseRequestItem: prItem ? {
          price: prItem.price ? prItem.price.toString() : null,
          partNumber: prItem.partNumber
        } : undefined,
        suppliers: [] as any[]
      };

      for (const supplierQuotation of supplierQuotations) {
        const supplierItems = await storage.getSupplierQuotationItems(supplierQuotation.id);
        const supplierItem = supplierItems.find(item => item.quotationItemId === quotationItem.id);
        
        if (supplierItem) {
          const supplier = await storage.getSupplierById(supplierQuotation.supplierId);
          
          itemComparison.suppliers.push({
            supplierId: supplierQuotation.supplierId,
            supplierName: supplier?.name || 'Unknown',
            supplierQuotationId: supplierQuotation.id,
            supplierQuotationItemId: supplierItem.id,
            availableQuantity: supplierItem.availableQuantity || quotationItem.quantity || 0,
            confirmedUnit: supplierItem.confirmedUnit,
            fulfillmentPercentage: supplierItem.fulfillmentPercentage || 100,
            unitPrice: supplierItem.unitPrice || 0,
            totalPrice: supplierItem.totalPrice || 0,
            quantityAdjustmentReason: supplierItem.quantityAdjustmentReason,
            isAvailable: supplierItem.isAvailable,
            unavailabilityReason: supplierItem.unavailabilityReason,
            deliveryDays: supplierItem.deliveryDays,
            brand: supplierItem.brand,
            model: supplierItem.model
          });
        }
      }

      comparison.push(itemComparison);
    }

    res.json({
      quotationId,
      quotationNumber: quotation.quotationNumber,
      comparison
    });
  });

  app.get(
    "/api/quotations/purchase-request/:purchaseRequestId",
    isAuthenticated,
    async (req, res) => {
      const purchaseRequestId = parseInt(req.params.purchaseRequestId);
      const quotation =
        await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
      res.json(quotation || null);
    },
  );

  app.get(
    "/api/quotations/purchase-request/:purchaseRequestId/history",
    isAuthenticated,
    async (req, res) => {
      const purchaseRequestId = parseInt(req.params.purchaseRequestId);
      const quotationHistory =
        await storage.getRFQHistoryByPurchaseRequestId(purchaseRequestId);
      res.json(quotationHistory);
    },
  );

  app.post("/api/quotations", isAuthenticated, async (req, res) => {
    const quotationApiSchema = z.object({
      purchaseRequestId: z.number(),
      quotationDeadline: z.string().transform((val) => new Date(val)),
      deliveryLocationId: z.number(),
      termsAndConditions: z.string().optional(),
      technicalSpecs: z.string().optional(),
    });

    const quotationDataForApi = quotationApiSchema.parse(req.body);
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) throw new UnauthorizedError("Usuário não encontrado");

    const purchaseRequest = await storage.getPurchaseRequestById(
      quotationDataForApi.purchaseRequestId,
    );
    if (!purchaseRequest) throw new NotFoundError("Solicitação não encontrada");

    if (currentUser.isBuyer && purchaseRequest.buyerId === null) {
      await storage.updatePurchaseRequest(purchaseRequest.id, {
        buyerId: currentUser.id,
      });
    }

    const quotation = await storage.createQuotation({
      ...quotationDataForApi,
      status: "draft",
      createdBy: req.session.userId!,
    });

    await auditService.log({
      purchaseRequestId: quotation.purchaseRequestId,
      actionType: 'rfq_created',
      actionDescription: `RFQ ${quotation.quotationNumber} aberta`,
      performedBy: req.session?.userId,
      afterData: quotation,
      affectedTables: ['quotations']
    });

    res.status(201).json(quotation);
  });

  app.put("/api/quotations/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const quotationData = insertQuotationSchema.partial().parse(req.body);
    const quotation = await storage.updateQuotation(id, quotationData);
    res.json(quotation);
  });

  app.delete("/api/quotations/:id", isAuthenticated, isAdminOrBuyer, async (req, res) => {
    const id = parseInt(req.params.id);
    const quotation = await storage.getQuotationById(id);

    if (!quotation) {
      throw new NotFoundError("RFQ não encontrada");
    }

    if (quotation.isActive) {
      throw new ValidationError("Não é possível excluir uma RFQ ativa");
    }

    await storage.deleteQuotation(id);

    await auditService.log({
      purchaseRequestId: quotation.purchaseRequestId,
      actionType: 'rfq_deleted',
      actionDescription: `RFQ ${quotation.quotationNumber} excluída`,
      performedBy: req.session?.userId,
      beforeData: quotation,
      affectedTables: ['quotations']
    });

    res.json({ message: "RFQ excluída com sucesso" });
  });

  app.post("/api/quotations/:id/items", isAuthenticated, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    const itemData = insertQuotationItemSchema.parse({
      ...req.body,
      quotationId,
    });
    const item = await storage.createQuotationItem(itemData);
    res.status(201).json(item);
  });

  app.get("/api/quotations/:id/items", isAuthenticated, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    const items = await storage.getQuotationItems(quotationId);
    res.json(items);
  });

  app.get("/api/supplier-quotations/:id/items", isAuthenticated, async (req, res) => {
    const supplierQuotationId = parseInt(req.params.id);
    if (Number.isNaN(supplierQuotationId)) {
      throw new ValidationError("ID da cotação do fornecedor inválido");
    }
    const items = await storage.getSupplierQuotationItems(supplierQuotationId);
    res.json(items);
  });

  app.post("/api/quotations/:id/send-rfq", isAuthenticated, async (req, res) => {
    const quotationId = parseInt(req.params.id);
    const { suppliers: supplierIds, releaseWithoutEmail, sendEmail } = req.body;
    
    // Determine if emails should be sent
    const shouldSendEmail = sendEmail !== false && releaseWithoutEmail !== true;

    const quotation = await storage.getQuotationById(quotationId);
    if (!quotation) {
      throw new NotFoundError("Cotação não encontrada");
    }

    // If no suppliers provided in the body, check if they are already associated
    let effectiveSupplierIds = supplierIds;
    const existingSupplierQuotations = await storage.getSupplierQuotations(quotationId);
    
    if (!Array.isArray(effectiveSupplierIds) || effectiveSupplierIds.length === 0) {
      effectiveSupplierIds = existingSupplierQuotations.map(sq => sq.supplierId);
    }

    if (!effectiveSupplierIds || effectiveSupplierIds.length === 0) {
      throw new ValidationError("Pelo menos um fornecedor deve ser selecionado");
    }

    const results = [];
    for (const supplierId of effectiveSupplierIds) {
      const supplier = await storage.getSupplierById(supplierId);
      if (!supplier) continue;

      // Check if a quotation for this supplier already exists
      let supplierQuotation = existingSupplierQuotations.find(sq => sq.supplierId === supplierId);
      const token = Math.random().toString(36).substring(2, 15);

      if (!supplierQuotation) {
        // Create new supplier quotation if it doesn't exist
        supplierQuotation = await storage.createSupplierQuotation({
          quotationId,
          supplierId,
          status: "pending",
          totalValue: null,
          sentAt: null,
          receivedAt: null,
        });

        const quotationItems = await storage.getQuotationItems(quotationId);
        const supplierQuotationItems = quotationItems.map((item) => ({
          supplierQuotationId: supplierQuotation!.id,
          quotationItemId: item.id,
          availableQuantity: item.quantity || "0",
          unitPrice: "0",
          totalPrice: "0",
          isAvailable: true,
          fulfillmentPercentage: "100",
          deliveryDays: null,
          originalTotalPrice: null,
          discountedTotalPrice: null,
        }));

        await storage.createSupplierQuotationItems(supplierQuotationItems);
      }

      // Only send email if requested
      if (shouldSendEmail) {
        try {
          await notifyNewRFQ(supplier, quotation, token);
        } catch (emailError) {
          console.error(`Error sending email to ${supplier.name}:`, emailError);
        }
      }

      results.push(supplierQuotation);
    }

    await storage.updateQuotation(quotationId, { status: "sent" });

    res.json({ 
      message: shouldSendEmail ? "RFQ sent successfully" : "RFQ released without email", 
      results 
    });
  });

  app.get(
    "/api/quotations/:id/supplier-quotations",
    isAuthenticated,
    async (req, res) => {
      const quotationId = parseInt(req.params.id);
      const supplierQuotations =
        await storage.getSupplierQuotations(quotationId);

      const enriched = await Promise.all(
        supplierQuotations.map(async (sq) => {
          const supplier = await storage.getSupplierById(sq.supplierId);
          return {
            ...sq,
            supplierName: supplier?.name,
          };
        }),
      );

      res.json(enriched);
    },
  );

  app.get(
    "/api/quotations/:id/supplier-quotations/:supplierId",
    isAuthenticated,
    async (req, res) => {
      const quotationId = parseInt(req.params.id);
      const supplierId = parseInt(req.params.supplierId);

      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      const supplierQuotation = supplierQuotations.find(
        (sq) => sq.supplierId === supplierId,
      );

      if (!supplierQuotation) {
        return res.json(null);
      }

      const items = await storage.getSupplierQuotationItems(supplierQuotation.id);

      res.json({
        ...supplierQuotation,
        items,
      });
    },
  );

  app.get(
    "/api/quotations/:id/supplier-comparison",
    isAuthenticated,
    async (req, res) => {
      const quotationId = parseInt(req.params.id);
      const supplierQuotations =
        await storage.getSupplierQuotations(quotationId);

      const comparison = await Promise.all(
        supplierQuotations.map(async (sq) => {
          const supplier = await storage.getSupplierById(sq.supplierId);
          const items = await storage.getSupplierQuotationItems(sq.id);
          return {
            ...sq,
            supplierName: supplier?.name,
            items,
          };
        }),
      );

      res.json(comparison);
    },
  );

  app.post(
    "/api/quotations/:quotationId/update-supplier-quotation",
    isAuthenticated,
    async (req, res) => {
      const quotationId = parseInt(req.params.quotationId);
      const {
        supplierId,
        items,
        totalValue,
        paymentTerms,
        deliveryTerms,
        warrantyPeriod,
        observations,
        subtotalValue,
        finalValue,
        discountType,
        discountValue,
        includesFreight,
        freightValue,
      } = req.body;

      if (!supplierId) {
        throw new ValidationError("ID do fornecedor é obrigatório");
      }

      const quotation = await storage.getQuotationById(quotationId);
      if (!quotation) {
        throw new NotFoundError("Cotação não encontrada");
      }

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) throw new UnauthorizedError("Usuário não encontrado");

      const purchaseRequest = await storage.getPurchaseRequestById(
        quotation.purchaseRequestId,
      );
      if (!purchaseRequest) throw new NotFoundError("Solicitação não encontrada");

      if (currentUser.isBuyer && !purchaseRequest.buyerId) {
        await storage.updatePurchaseRequest(purchaseRequest.id, {
          buyerId: currentUser.id,
        });
      }

      const supplierQuotations =
        await storage.getSupplierQuotations(quotationId);
      let supplierQuotation = supplierQuotations.find(
        (sq) => sq.supplierId === supplierId,
      );

      if (!supplierQuotation) {
        supplierQuotation = await storage.createSupplierQuotation({
          quotationId,
          supplierId,
          status: "received",
          totalValue: null,
          sentAt: null,
          receivedAt: new Date(),
        });
      }

      const updateData = {
        status: "received",
        totalValue: totalValue || null,
        subtotalValue: subtotalValue || null,
        finalValue: finalValue || null,
        discountType: discountType || null,
        discountValue: discountValue ? String(discountType === 'fixed' ? NumberParser.parse(discountValue) : discountValue) : null,
        paymentTerms: paymentTerms || null,
        deliveryTerms: deliveryTerms || null,
        warrantyPeriod: warrantyPeriod || null,
        observations: observations || null,
        includesFreight: includesFreight || false,
        freightValue: freightValue ? String(NumberParser.parse(freightValue)) : null,
        receivedAt: new Date(),
      };

      const updatedSupplierQuotation = await storage.updateSupplierQuotation(supplierQuotation.id, updateData);

      if (updatedSupplierQuotation.isChosen) {
           const fVal = updateData.finalValue ? Number(updateData.finalValue) : 0;
           const frVal = (updateData.includesFreight && updateData.freightValue) ? Number(updateData.freightValue) : 0;
           const grandTotal = fVal + frVal;

           await storage.updatePurchaseRequest(purchaseRequest.id, {
               totalValue: grandTotal.toFixed(2),
           });
      }

      if (items && items.length > 0) {
        const existingItems = await storage.getSupplierQuotationItems(
          supplierQuotation.id,
        );

        for (const item of items) {
          const existingItem = existingItems.find(
            (ei) => ei.quotationItemId === item.quotationItemId,
          );

          const quotationItems = await storage.getQuotationItems(quotationId);
          const quotationItem = quotationItems.find(
            (qi) => qi.id === item.quotationItemId,
          );
          
          // Use availableQuantity if provided, otherwise fallback to requested quantity
          const quantity = (item.availableQuantity != null && item.availableQuantity !== "") 
            ? Number(item.availableQuantity) 
            : Number(quotationItem?.quantity || 1);
            
          const unitPriceNum = NumberParser.parse(item.unitPrice);
          const totalNum = unitPriceNum * quantity;

          const discountPercentageNum = item.discountPercentage != null ? Number(item.discountPercentage) || 0 : 0;
          const discountValueNum = item.discountValue != null ? NumberParser.parse(item.discountValue) || 0 : 0;
          const hasItemDiscount = discountPercentageNum > 0 || discountValueNum > 0;

          const originalTotalPrice = hasItemDiscount ? totalNum : null;
          let discountedTotalPrice: number | null = null;
          if (hasItemDiscount) {
            let discounted = totalNum;
            if (discountPercentageNum > 0) discounted *= (1 - discountPercentageNum / 100);
            if (discountValueNum > 0) discounted -= discountValueNum;
            discountedTotalPrice = Math.max(0, discounted);
          }

          const itemPayload = {
            unitPrice: unitPriceNum.toFixed(4),
            totalPrice: totalNum.toFixed(4),
            originalTotalPrice: originalTotalPrice !== null ? originalTotalPrice.toFixed(4) : null,
            discountPercentage: discountPercentageNum > 0 ? discountPercentageNum.toString() : null,
            discountValue: discountValueNum > 0 ? discountValueNum.toFixed(4) : null,
            discountedTotalPrice: discountedTotalPrice !== null ? discountedTotalPrice.toFixed(4) : null,
            deliveryDays: item.deliveryDays,
            brand: item.brand,
            model: item.model,
            observations: item.observations,
            isAvailable: item.isAvailable,
            unavailabilityReason: item.unavailabilityReason,
            availableQuantity: item.availableQuantity ?? null,
            confirmedUnit: item.confirmedUnit,
            quantityAdjustmentReason: item.quantityAdjustmentReason,
            fulfillmentPercentage: "0",
          };

          if (existingItem) {
            await storage.updateSupplierQuotationItem(existingItem.id, itemPayload);
          } else {
            await storage.createSupplierQuotationItem({
              ...itemPayload,
              supplierQuotationId: supplierQuotation.id,
              quotationItemId: item.quotationItemId,
            });
          }
        }
      }

      res.json({ message: "Cotação do fornecedor atualizada com sucesso" });
    },
  );

  app.post(
    "/api/quotations/:quotationId/upload-supplier-file",
    isAuthenticated,
    quotationUpload.single("file"),
    async (req, res) => {
      const quotationId = parseInt(req.params.quotationId);
      const { attachmentType, supplierId } = req.body;

      if (!req.file) {
        throw new ValidationError("Nenhum arquivo foi enviado");
      }

      if (!supplierId) {
        throw new ValidationError("ID do fornecedor é obrigatório");
      }

      const supplierQuotations = await storage.getSupplierQuotations(quotationId);
      const supplierQuotation = supplierQuotations.find(
        (sq) => sq.supplierId === parseInt(supplierId),
      );

      if (!supplierQuotation) {
        throw new NotFoundError("Cotação do fornecedor não encontrada");
      }

      const storedFile = await fileStorageService.uploadFile({
        category: "supplier-quotations",
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
        buffer: req.file.buffer,
        entityId: supplierQuotation.id,
      });

      const attachment = await storage.createAttachment({
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: storedFile.filePath,
        supplierQuotationId: supplierQuotation.id,
        attachmentType: attachmentType || "other",
      });

      res.json({
        message: "Arquivo enviado com sucesso",
        fileName: req.file.originalname,
        attachmentId: attachment.id,
        storage: storedFile.storage,
      });
    },
  );



  app.post(
    "/api/quotations/:quotationId/select-supplier",
    isAuthenticated,
    async (req, res) => {
      const quotationId = parseInt(req.params.quotationId);
      const {
        selectedSupplierId,
        totalValue,
        observations,
        unavailableItems,
        nonSelectedItems,
        selectedItems,
        nonSelectedItemsOption,
        unavailableItemsOption,
      } = req.body;

      const quotation = await storage.getQuotationById(quotationId);
      if (!quotation) throw new NotFoundError("Cotação não encontrada");

      const supplierQuotations = await storage.getSupplierQuotations(quotationId);

      await Promise.all(
        supplierQuotations.map((sq) =>
          storage.updateSupplierQuotation(sq.id, { isChosen: false }),
        ),
      );

      const selectedSupplierQuotation = supplierQuotations.find(
        (sq) => sq.supplierId === selectedSupplierId,
      );
      
      let finalTotalValue = totalValue;
      let newPR: any = null;
      let newQuotation: any = null;
      let itemsTransferredCount = 0;

      if (selectedSupplierQuotation) {
        const currentSupplierItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
        
        // Determinar quais items de cotação estão selecionados (aprovados)
        const selectedQuotationItemIds = new Set<number>();
        if (Array.isArray(selectedItems) && selectedItems.length > 0) {
          selectedItems.forEach((item: any) => {
            selectedQuotationItemIds.add(item.quotationItemId);
          });
        } else {
          // Default: todos os itens disponíveis do fornecedor vencedor
          currentSupplierItems.forEach((item) => {
            if (item.isAvailable !== false) {
              selectedQuotationItemIds.add(item.quotationItemId);
            }
          });
        }

        // Calcular valor total baseado apenas nos itens selecionados/aprovados
        let calculatedTotal = 0;
        for (const item of currentSupplierItems) {
          if (selectedQuotationItemIds.has(item.quotationItemId)) {
            calculatedTotal += parseFloat(item.totalPrice || "0");
          }
        }

        if (selectedSupplierQuotation.discountType === 'percentage' && selectedSupplierQuotation.discountValue) {
          calculatedTotal *= (1 - parseFloat(selectedSupplierQuotation.discountValue) / 100);
        } else if (selectedSupplierQuotation.discountType === 'fixed' && selectedSupplierQuotation.discountValue) {
          calculatedTotal -= parseFloat(selectedSupplierQuotation.discountValue);
        }

        if (selectedSupplierQuotation.includesFreight && selectedSupplierQuotation.freightValue) {
          calculatedTotal += parseFloat(selectedSupplierQuotation.freightValue);
        }

        finalTotalValue = Math.max(0, calculatedTotal).toFixed(4);

        await storage.updateSupplierQuotation(selectedSupplierQuotation.id, {
          totalValue: finalTotalValue,
          isChosen: true,
          choiceReason: observations,
        });

        // Identificar itens restantes
        const quotationItems = await storage.getQuotationItems(quotationId);
        const remainingQuotationItems = quotationItems.filter(qi => !selectedQuotationItemIds.has(qi.id));

        const itemsToTransferToNewPR: any[] = [];
        const itemsToDiscard: any[] = [];

        for (const qItem of remainingQuotationItems) {
          const supplierItem = currentSupplierItems.find(si => si.quotationItemId === qItem.id);
          const isAvailable = supplierItem ? supplierItem.isAvailable !== false : true;

          let shouldTransfer = false;
          if (!isAvailable) {
            shouldTransfer = (unavailableItemsOption === 'with-rfq' || req.body.createNewRequest === true);
          } else {
            shouldTransfer = (nonSelectedItemsOption === 'separate-quotation');
          }

          if (shouldTransfer) {
            itemsToTransferToNewPR.push({ qItem, supplierItem });
          } else {
            itemsToDiscard.push({ qItem, supplierItem });
          }
        }

        // Criar nova solicitação de compra se houver itens para transferir
        if (itemsToTransferToNewPR.length > 0) {
          const originalPR = await storage.getPurchaseRequestById(quotation.purchaseRequestId);
          if (originalPR) {
            const { id: _prId, requestNumber: _rn, createdAt: _prC, updatedAt: _prU, ...prData } = originalPR;
            const targetJustification = `[Divisão de Pedido] Derivado da solicitação ${originalPR.requestNumber}. ` + (originalPR.justification || "");
            const targetAdditionalInfo = `[Rastreabilidade] Solicitação dividida. Solicitação original: ${originalPR.requestNumber}.\n` + (originalPR.additionalInfo || "");
            
            console.log('originalPR.additionalInfo:', originalPR.additionalInfo);
            console.log('targetAdditionalInfo to insert:', targetAdditionalInfo);

            newPR = await storage.createPurchaseRequest({
              ...prData,
              category: prData.category as any,
              justification: targetJustification,
              additionalInfo: targetAdditionalInfo,
              currentPhase: "cotacao",
              approvedA1: true,
              approvalDateA1: new Date(),
            });

            console.log('newPR returned from DB:', JSON.stringify(newPR, null, 2));

            itemsTransferredCount = itemsToTransferToNewPR.length;

            // Automatically open/create Quotation (RFQ) for the new Purchase Request
            newQuotation = await storage.createQuotation({
              purchaseRequestId: newPR.id,
              quotationDeadline: quotation.quotationDeadline,
              deliveryLocationId: quotation.deliveryLocationId,
              termsAndConditions: quotation.termsAndConditions || "",
              technicalSpecs: quotation.technicalSpecs || "",
              status: "draft",
              createdBy: req.session.userId!,
            });

            await auditService.log({
              purchaseRequestId: newQuotation.purchaseRequestId,
              actionType: 'rfq_created',
              actionDescription: `RFQ ${newQuotation.quotationNumber} aberta automaticamente (Rascunho) devido a divisão de pedido da solicitação ${originalPR.requestNumber}`,
              performedBy: req.session?.userId,
              afterData: newQuotation,
              affectedTables: ['quotations']
            });
          }
        }

        const originalItems = await storage.getPurchaseRequestItems(quotation.purchaseRequestId, true);

        // Processar itens transferidos
        for (const { qItem, supplierItem } of itemsToTransferToNewPR) {
          if (qItem.purchaseRequestItemId) {
            const originalItem = originalItems.find(pi => pi.id === qItem.purchaseRequestItemId);
            if (originalItem && !originalItem.isTransferred) {
              const { id: _id, createdAt: _c, updatedAt: _u, ...itemData } = originalItem;
              
              let newPRItem: any = null;
              if (newPR) {
                newPRItem = await storage.createPurchaseRequestItem({
                  ...itemData,
                  stockQuantity: itemData.stockQuantity || "0",
                  averageMonthlyQuantity: itemData.averageMonthlyQuantity || "0",
                  purchaseRequestId: newPR.id,
                });

                if (newQuotation && newPRItem) {
                  // Create corresponding quotation item linked to the new RFQ and the new PR Item
                  await storage.createQuotationItem({
                    quotationId: newQuotation.id,
                    purchaseRequestItemId: newPRItem.id,
                    itemCode: newPRItem.productCode || qItem.itemCode || "",
                    description: newPRItem.description || qItem.description || "",
                    quantity: newPRItem.requestedQuantity || qItem.quantity || "1",
                    unit: newPRItem.unit || qItem.unit || "UN",
                    specifications: newPRItem.technicalSpecification || qItem.specifications || "",
                    deliveryDeadline: qItem.deliveryDeadline ? new Date(qItem.deliveryDeadline) : null,
                  });
                }
              }

              await storage.updatePurchaseRequestItem(originalItem.id, {
                isTransferred: true,
                transferredToRequestId: newPR ? newPR.id : null,
                transferReason: supplierItem && supplierItem.isAvailable === false
                  ? (supplierItem.unavailabilityReason || "Item indisponível no fornecedor selecionado")
                  : "Item não selecionado pelo comprador na cotação parcial",
                transferredAt: new Date()
              });
            }
          }
        }

        // Processar itens descartados
        for (const { qItem, supplierItem } of itemsToDiscard) {
          if (qItem.purchaseRequestItemId) {
            const originalItem = originalItems.find(pi => pi.id === qItem.purchaseRequestItemId);
            if (originalItem && !originalItem.isTransferred) {
              await storage.updatePurchaseRequestItem(originalItem.id, {
                isTransferred: true,
                transferredToRequestId: null,
                transferReason: supplierItem && supplierItem.isAvailable === false
                  ? (supplierItem.unavailabilityReason || "Item indisponível no fornecedor selecionado (descartado)")
                  : "Item não selecionado pelo comprador na cotação parcial (descartado)",
                transferredAt: new Date()
              });
            }
          }
        }

        await storage.updatePurchaseRequest(quotation.purchaseRequestId, {
          currentPhase: "aprovacao_a2",
          totalValue: finalTotalValue,
          chosenSupplierId: selectedSupplierId,
          choiceReason: observations,
        });

        // Gravar snapshot de itens aprovados
        await storage.clearApprovedQuotationItems(quotationId);
        const finalQuotationItems = await storage.getQuotationItems(quotationId);
        const finalSupplierItems = await storage.getSupplierQuotationItems(selectedSupplierQuotation.id);
        const purchaseRequestItems = await storage.getPurchaseRequestItems(quotation.purchaseRequestId, true);
        const singlePurchaseRequestItemId =
          purchaseRequestItems.length === 1 ? purchaseRequestItems[0].id : null;

        for (const item of finalSupplierItems) {
          if (selectedQuotationItemIds.has(item.quotationItemId)) {
            const qItem = finalQuotationItems.find(qi => qi.id === item.quotationItemId);
            const resolvedPurchaseRequestItemId = (() => {
              if (qItem?.purchaseRequestItemId) return qItem.purchaseRequestItemId;
              if (singlePurchaseRequestItemId) return singlePurchaseRequestItemId;
              const normalizedDescription = (qItem?.description || "").trim().toLowerCase();
              if (normalizedDescription) {
                const matches = purchaseRequestItems.filter((pi: any) => {
                  const piDesc = (pi?.description || "").trim().toLowerCase();
                  return piDesc === normalizedDescription;
                });
                if (matches.length === 1) return matches[0].id;
              }
              return null;
            })();

            if (qItem && resolvedPurchaseRequestItemId) {
              const quantity = item.availableQuantity || qItem.quantity;
              const pct = parseFloat(item.discountPercentage || "0") || 0;
              const fixed = parseFloat(item.discountValue || "0") || 0;
              const discCand = item.discountedTotalPrice ? parseFloat(item.discountedTotalPrice) : NaN;
              const baseTotal = parseFloat(item.totalPrice || "0") || 0;
              const itemTotalPrice = (pct > 0 || fixed > 0) && Number.isFinite(discCand) && discCand > 0 ? discCand.toFixed(4) : baseTotal.toFixed(4);

              await storage.createApprovedQuotationItem({
                quotationId: quotationId,
                supplierQuotationItemId: item.id,
                purchaseRequestItemId: resolvedPurchaseRequestItemId,
                approvedQuantity: quantity.toString(),
                unitPrice: item.unitPrice,
                totalPrice: itemTotalPrice,
              });
            }
          }
        }

        await auditService.log({
          purchaseRequestId: quotation.purchaseRequestId,
          actionType: 'supplier_chosen',
          actionDescription: `Fornecedor ${selectedSupplierId} escolhido como vencedor para a cotação ${quotation.quotationNumber}`,
          performedBy: req.session?.userId,
          afterData: { selectedSupplierId, finalTotalValue, observations },
          affectedTables: ['purchase_requests', 'supplier_quotations']
        });
      }

      res.json({ 
        message: "Fornecedor selecionado com sucesso",
        nonSelectedRequestId: newPR ? newPR.id : null,
        nonSelectedItemsCount: itemsTransferredCount
      });
    },
  );

  app.put("/api/supplier-quotations/:id/mark-no-response", isAuthenticated, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateSupplierQuotation(id, { status: "no_response" });
    res.json(updated);
  });

  app.put("/api/supplier-quotations/:id/update-quantities", isAuthenticated, QuantityValidationMiddleware.fullValidation, async (req: Request, res: Response) => {
    const supplierQuotationId = parseInt(req.params.id);
    const { items } = req.body;
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser) throw new UnauthorizedError("Usuário não encontrado");

    const supplierQuotation = await storage.getSupplierQuotationById(supplierQuotationId);
    if (!supplierQuotation) throw new NotFoundError("Cotação do fornecedor não encontrada");

    const clientIp = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const sessionId = req.sessionID || 'unknown';

    const result = await db.execute(sql`SELECT atomic_update_supplier_quotation_quantities(${supplierQuotationId}, ${JSON.stringify(items)}, ${currentUser.id}, ${sessionId}, ${clientIp}, ${userAgent}) as result`);
    const atomicResult = (result.rows[0] as any).result;

    if (!atomicResult.success) {
      throw new ValidationError(atomicResult.error || "Erro ao atualizar quantidades");
    }

    res.json({ message: "Quantities updated successfully", success: true });
  });

  app.get("/api/quotations/:id/versions/history", isAuthenticated, async (req: Request, res: Response) => {
    const quotationId = parseInt(req.params.id);
    const history = await quotationVersionService.getVersionHistory(quotationId);
    res.json(history);
  });

  app.post("/api/quotations/:quotationId/versions/:targetVersion/rollback", isAuthenticated, async (req: Request, res: Response) => {
    const quotationId = parseInt(req.params.quotationId);
    const targetVersion = parseInt(req.params.targetVersion);
    const currentUser = await storage.getUser(req.session.userId!);
    
    if (!currentUser?.isAdmin && !currentUser?.isManager) {
      throw new UnauthorizedError("Permissões insuficientes");
    }

    const result = await quotationVersionService.rollbackToVersion(quotationId, targetVersion, currentUser.id);
    res.json(result);
  });
}
