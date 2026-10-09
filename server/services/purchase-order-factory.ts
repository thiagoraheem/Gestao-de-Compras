import { storage } from "../storage";
import { pool, db } from "../db";
import {
  approvedQuotationItems,
  quotationItems as quotationItemsTable,
  purchaseRequestItems,
} from "../../shared/schema";
import { eq, sql, and } from "drizzle-orm";
import {
  normalizeCurrencyCode,
  convertToBRL,
  roundCurrency,
  toNumber,
} from "../../shared/utils/currency-utils";

/**
 * Creates a Purchase Order from an approved supplier quotation.
 *
 * This logic was previously duplicated in:
 * - routes.ts approve-a2 handler (~L2273-2380)
 * - routes.ts create-purchase-order handler (~L3842-4004)
 *
 * Now centralized here for single responsibility.
 */
export interface CreatePurchaseOrderResult {
  purchaseOrder: any;
  itemsTotal: number;
  supplierQuotationTotal: number;
  discrepancy: number;
}

export async function createPurchaseOrderFromQuotation(
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
    observations: options?.purchaseObservations || null,
    approvedBy: null,
    approvedAt: null,
    createdBy: createdByUserId,
  };

  const purchaseOrder = await storage.createPurchaseOrder(purchaseOrderData);

  // Create purchase order items from supplier quotation items
  const quotationItemsList = await storage.getQuotationItems(quotation.id);
  const prItems = await storage.getPurchaseRequestItems(purchaseRequestId, true);
  const approvedSnapshotItems = await db
    .select({
      id: approvedQuotationItems.id,
      supplierQuotationItemId: approvedQuotationItems.supplierQuotationItemId,
      purchaseRequestItemId: approvedQuotationItems.purchaseRequestItemId,
    })
    .from(approvedQuotationItems)
    .where(eq(approvedQuotationItems.quotationId, quotation.id));
  let itemsTotal = 0;

  for (const si of supplierQuotationItems) {
    if (si.isAvailable === false) continue;

    let qi: any = quotationItemsList.find((q: any) => Number(q.id) === Number(si.quotationItemId));

    if (!qi) {
      const snapshotMatch = approvedSnapshotItems.find(
        (s) => Number(s.supplierQuotationItemId) === Number(si.id),
      );
      if (snapshotMatch?.purchaseRequestItemId) {
        const prItemMatch = prItems.find(
          (p: any) => Number(p.id) === Number(snapshotMatch.purchaseRequestItemId),
        );
        if (prItemMatch) {
          qi = {
            id: 0,
            quotationId: quotation.id,
            purchaseRequestItemId: prItemMatch.id,
            itemCode: prItemMatch.productCode || `ITEM-${si.id}`,
            description: prItemMatch.description || "",
            quantity: prItemMatch.requestedQuantity || si.availableQuantity || "1",
            unit: prItemMatch.unit || si.confirmedUnit || "UN",
            specifications: prItemMatch.technicalSpecification || "",
            deliveryDeadline: null,
          } as any;
        }
      }
    }

    if (!qi && si.quotationItemId && Number(si.quotationItemId) > 0) {
      const lookupQi = await db
        .select()
        .from(quotationItemsTable)
        .where(eq(quotationItemsTable.id, Number(si.quotationItemId)))
        .limit(1);
      if (lookupQi && lookupQi.length > 0) qi = lookupQi[0] as any;
    }

    const description = (() => {
      if (qi?.description && String(qi.description).trim() !== "") return qi.description;
      const prFromQi = qi?.purchaseRequestItemId
        ? prItems.find((p: any) => Number(p.id) === Number(qi.purchaseRequestItemId))
        : null;
      if (prFromQi?.description) return prFromQi.description;
      const prFromSnapshot = approvedSnapshotItems
        .filter((s) => Number(s.supplierQuotationItemId) === Number(si.id))
        .map((s) => prItems.find((p: any) => Number(p.id) === Number(s.purchaseRequestItemId)))
        .find(Boolean) as any;
      if (prFromSnapshot?.description) return prFromSnapshot.description;
      if (si.observations && si.observations.trim() !== "") {
        const short = si.observations.split("\n")[0].slice(0, 240);
        if (short.trim() !== "") return short;
      }
      const manualLabel =
        si.brand || si.model
          ? `Item Manual - ${[si.brand, si.model].filter(Boolean).join(" / ")}`
          : null;
      return manualLabel || "Item Incluído Manualmente";
    })();

    const unit = si.confirmedUnit || qi?.unit || "UN";
    const quantity = si.availableQuantity ?? qi?.quantity ?? "0";
    const unitPriceOrig = si.unitPrice || "0";
    const baseTotalOrig = (parseFloat(unitPriceOrig) || 0) * (parseFloat(quantity as any) || 0);

    let itemDiscountOrig = 0;
    let totalPriceOrig = baseTotalOrig;

    const itemDiscountType = String((si as any).discountType || 'none');
    const hasPctLegacy = si.discountPercentage && parseFloat(si.discountPercentage as any) > 0;
    const hasValueLegacy = si.discountValue && parseFloat(si.discountValue as any) > 0;

    if (itemDiscountType === 'percentage') {
      const pct = hasPctLegacy ? parseFloat(si.discountPercentage as any) : parseFloat(si.discountValue as any);
      if (!isNaN(pct) && pct > 0) itemDiscountOrig = (baseTotalOrig * pct) / 100;
    } else if (itemDiscountType === 'fixed') {
      const fxd = parseFloat(si.discountValue as any);
      if (!isNaN(fxd) && fxd > 0) itemDiscountOrig = fxd;
    } else {
      if (hasPctLegacy) {
        itemDiscountOrig = (baseTotalOrig * parseFloat(si.discountPercentage as any)) / 100;
      } else if (hasValueLegacy) {
        itemDiscountOrig = parseFloat(si.discountValue as any);
      }
    }

    totalPriceOrig = Math.max(0, baseTotalOrig - itemDiscountOrig);

    // REGRA CRÍTICA: PO é SEMPRE armazenado EM BRL.
    // Campos principais (unitPrice / totalPrice) = BRL convertido (Orig × taxa).
    // Campos redundantes (*Brl) = mesmo valor para consistência.
    const uPriceOrigNum = parseFloat(unitPriceOrig) || 0;
    const unitPriceBrlVal = roundCurrency(convertToBRL(uPriceOrigNum, winnerExchangeRate), 4);
    const totalPriceBrlVal = roundCurrency(convertToBRL(totalPriceOrig, winnerExchangeRate), 4);
    itemsTotal += totalPriceBrlVal;

    const purchaseOrderItemData = {
      purchaseOrderId: purchaseOrder.id,
      itemCode: qi?.itemCode || (si.brand ? `BRAND-${si.id}` : `ITEM-${si.id}`),
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
