import { storage } from "../storage";
import { pool } from "../db";
import {
  normalizeCurrencyCode,
  convertToBRL,
  roundCurrency,
  toNumber,
} from "../../shared/utils/currency-utils";

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

    const winnerCurrencyCode = normalizeCurrencyCode(
      (chosenSupplierQuotation as any)?.currencyCode
    );
    const winnerExchangeRateRaw = (chosenSupplierQuotation as any)?.exchangeRate;
    const winnerExchangeRate =
      winnerCurrencyCode === 'BRL'
        ? (winnerExchangeRateRaw ? toNumber(winnerExchangeRateRaw) : 1) || 1
        : (winnerExchangeRateRaw ? toNumber(winnerExchangeRateRaw) : 1);

    const totalOrig = parseFloat(chosenSupplierQuotation.totalValue || "0");
    const totalValueBrl = roundCurrency(convertToBRL(totalOrig, winnerExchangeRate), 2);

    // Check if purchase order already exists
    const existingPurchaseOrder = await storage.getPurchaseOrderByRequestId(purchaseRequestId);
    if (existingPurchaseOrder) return null;

    // Fetch supplier quotation items
    const supplierQuotationItems = await storage.getSupplierQuotationItems(chosenSupplierQuotation.id);
    if (supplierQuotationItems.length === 0) return null;

    // Fetch the purchase request for cost center data
    const purchaseRequest = await storage.getPurchaseRequestById(purchaseRequestId);

    // Determina o COMPRADOR: é quem CRIOU a COTAÇÃO (quotation.createdBy),
    // NÃO quem apertou o botão final (pode ser Aprovador A2, etc.)
    const buyerUserId = quotation.createdBy ?? createdByUserId;

    // Fetch buyer (creator da cotação) data
    let buyerName: string | null = null;
    let buyerPhone: string | null = null;
    let buyerEmail: string | null = null;
    const buyerUser = await storage.getUser(buyerUserId);
    if (buyerUser) {
      buyerName = [buyerUser.firstName, buyerUser.lastName].filter(Boolean).join(" ").trim() || buyerUser.username || null;
      buyerEmail = buyerUser.email || null;
      buyerPhone = (buyerUser as any).phone || null;
      if (!buyerPhone && buyerUser.companyId) {
        const company = (await storage.getAllCompanies()).find((c) => c.id === buyerUser.companyId);
        buyerPhone = company?.phone || null;
      }
    }

    // Generate order number
    const orderNumber = `PO-${new Date().getFullYear()}-${String(purchaseRequestId).padStart(3, "0")}`;

    // Create the purchase order
    const purchaseOrderData = {
      orderNumber,
      purchaseRequestId,
      supplierId: chosenSupplierQuotation.supplierId,
      quotationId: quotation.id,
      status: "draft" as const,
      totalValue: totalValueBrl.toFixed(2),
      totalValueBrl: totalValueBrl.toFixed(2),
      currencyCode: winnerCurrencyCode,
      exchangeRate: winnerExchangeRate > 0 ? winnerExchangeRate.toString() : "1",
      paymentTerms: chosenSupplierQuotation.paymentTerms || null,
      deliveryTerms: null,
      deliveryAddress: null,
      contactPerson: null,
      contactPhone: null,
      buyerName,
      buyerPhone,
      buyerEmail,
      observations: options?.purchaseObservations || null,
      approvedBy: null,
      approvedAt: null,
      createdBy: createdByUserId,
    };

    const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData);

    const quotationItems = await storage.getQuotationItems(quotation.id);
    let itemsTotal = 0;

    for (const si of supplierQuotationItems) {
      if (si.isAvailable === false) continue;

      const qi = quotationItems.find((q) => q.id === si.quotationItemId);
      const description = qi?.description || "";
      const unit = si.confirmedUnit || qi?.unit || "UN";
      const quantity = si.availableQuantity ?? qi?.quantity ?? "0";
      const unitPriceOrig = si.unitPrice || "0";
      const baseTotalOrig = (parseFloat(unitPriceOrig) || 0) * (parseFloat(quantity as any) || 0);

      let itemDiscountOrig = 0;
      let totalPriceOrig = baseTotalOrig;

      if (si.discountPercentage && parseFloat(si.discountPercentage as any) > 0) {
        itemDiscountOrig = (baseTotalOrig * parseFloat(si.discountPercentage as any)) / 100;
      } else if (si.discountValue && parseFloat(si.discountValue as any) > 0) {
        itemDiscountOrig = parseFloat(si.discountValue as any);
      }

      totalPriceOrig = Math.max(0, baseTotalOrig - itemDiscountOrig);

      // REGRA CRÍTICA: PO grava SEMPRE em BRL. Campos principais = BRL. *Brl redundantes = mesmo valor.
      const uPriceOrigNum = parseFloat(unitPriceOrig) || 0;
      const unitPriceBrlVal = roundCurrency(convertToBRL(uPriceOrigNum, winnerExchangeRate), 4);
      const totalPriceBrlVal = roundCurrency(convertToBRL(totalPriceOrig, winnerExchangeRate), 4);
      itemsTotal += totalPriceBrlVal;

      const purchaseOrderItemData = {
        purchaseOrderId: purchaseOrder.id,
        itemCode: qi?.itemCode || `ITEM-${si.id}`,
        description,
        quantity,
        unit,
        unitPrice: unitPriceBrlVal.toFixed(4),
        totalPrice: totalPriceBrlVal.toFixed(4),
        unitPriceBrl: unitPriceBrlVal.toFixed(4),
        totalPriceBrl: totalPriceBrlVal.toFixed(4),
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
