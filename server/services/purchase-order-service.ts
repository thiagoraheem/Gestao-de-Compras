import { storage } from "../storage";
import { pool } from "../db";

export interface CreatePurchaseOrderResult {
  purchaseOrder: any;
  itemsTotal: number;
  supplierQuotationTotal: number;
  discrepancy: number;
}

export class PurchaseOrderService {
  async getPurchaseOrderById(id: number) {
    return await storage.getPurchaseOrderById(id);
  }

  async getPurchaseOrderByRequestId(purchaseRequestId: number) {
    return await storage.getPurchaseOrderByRequestId(purchaseRequestId);
  }

  async getPurchaseOrderItems(purchaseOrderId: number) {
    return await storage.getPurchaseOrderItems(purchaseOrderId);
  }

  async createPurchaseOrderFromQuotation(
    purchaseRequestId: number,
    createdByUserId: number,
    options?: {
      purchaseObservations?: string | null;
      auditActionType?: string;
    }
  ): Promise<CreatePurchaseOrderResult | null> {
    // Fetch quotation
    const quotation = await storage.getQuotationByPurchaseRequestId(purchaseRequestId);
    if (!quotation) return null;

    const supplierQuotations = await storage.getSupplierQuotations(quotation.id);
    const chosenSupplierQuotation = supplierQuotations.find((sq) => sq.isChosen);
    if (!chosenSupplierQuotation) return null;

    // Check if purchase order already exists
    const existingPurchaseOrder = await storage.getPurchaseOrderByRequestId(purchaseRequestId);
    if (existingPurchaseOrder) return null;

    // Fetch supplier quotation items
    const supplierQuotationItems = await storage.getSupplierQuotationItems(chosenSupplierQuotation.id);
    if (supplierQuotationItems.length === 0) return null;

    // Fetch the purchase request for cost center data
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);

    // Generate order number
    const orderNumber = `PO-${new Date().getFullYear()}-${String(purchaseRequestId).padStart(3, "0")}`;

    // Create the purchase order
    const purchaseOrderData = {
      orderNumber,
      purchaseRequestId,
      supplierId: chosenSupplierQuotation.supplierId,
      quotationId: quotation.id,
      status: "draft" as const,
      totalValue: chosenSupplierQuotation.totalValue || "0",
      paymentTerms: chosenSupplierQuotation.paymentTerms || null,
      deliveryTerms: null,
      deliveryAddress: null,
      contactPerson: null,
      contactPhone: null,
      observations: options?.purchaseObservations || null,
      approvedBy: null,
      approvedAt: null,
      createdBy: createdByUserId,
    };

    const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData);

    // Create purchase order items from supplier quotation items
    const quotationItems = await storage.getQuotationItems(quotation.id);
    let itemsTotal = 0;

    for (const si of supplierQuotationItems) {
      if (si.isAvailable === false) continue;

      const qi = quotationItems.find((q) => q.id === si.quotationItemId);
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
        costCenterId: purchaseRequest?.costCenterId,
        accountCode: null,
      };

      await storage.createPurchaseOrderItem(purchaseOrderItemData);
    }

    // Calculate discrepancy for audit
    const supplierQuotationTotal = parseFloat(chosenSupplierQuotation.totalValue || "0");
    const discrepancy = Math.abs(supplierQuotationTotal - itemsTotal);

    // Log audit entry
    try {
      const actionType = options?.auditActionType || "po_created";
      await pool.query(
        `INSERT INTO audit_logs (purchase_request_id, performed_by, action_type, action_description, performed_at, before_data, after_data)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
        [
          purchaseRequestId,
          createdByUserId,
          actionType,
          `PO criado a partir da cotação vencedora. Soma itens: R$ ${itemsTotal.toFixed(4)} | Total cotação: R$ ${supplierQuotationTotal.toFixed(4)} | Diferença: R$ ${discrepancy.toFixed(4)}`,
          JSON.stringify({ supplierTotal: supplierQuotationTotal }),
          JSON.stringify({ itemsTotal }),
        ]
      );
    } catch {
      // Audit log failure should not block PO creation
    }

    return {
      purchaseOrder,
      itemsTotal,
      supplierQuotationTotal,
      discrepancy,
    };
  }
}

export const purchaseOrderService = new PurchaseOrderService();
