import { db } from "../db";
import { 
  quotations, 
  quotationItems, 
  supplierQuotations, 
  supplierQuotationItems, 
  approvedQuotationItems, 
  quantityAdjustmentHistory, 
  attachments, 
  quotationVersionHistory,
  suppliers,
  purchaseRequestItems
} from "../../shared/schema";
import { eq, desc, and, like, inArray } from "drizzle-orm";
import type { 
  Quotation, 
  InsertQuotation, 
  QuotationItem, 
  InsertQuotationItem, 
  SupplierQuotation, 
  InsertSupplierQuotation, 
  SupplierQuotationItem, 
  InsertSupplierQuotationItem, 
  ApprovedQuotationItem, 
  InsertApprovedQuotationItem 
} from "../../shared/schema";

export class QuotationRepository {
  // RFQ (Quotation) operations
  async getAllQuotations(): Promise<Quotation[]> {
    return await db
      .select()
      .from(quotations)
      .orderBy(desc(quotations.createdAt));
  }

  async getQuotationById(id: number): Promise<Quotation | undefined> {
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, id));
    return quotation || undefined;
  }

  async getQuotationByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation | undefined> {
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(
        and(
          eq(quotations.purchaseRequestId, purchaseRequestId),
          eq(quotations.isActive, true)
        )
      );
    return quotation || undefined;
  }

  async getRFQHistoryByPurchaseRequestId(
    purchaseRequestId: number,
  ): Promise<Quotation[]> {
    const quotationHistory = await db
      .select()
      .from(quotations)
      .where(eq(quotations.purchaseRequestId, purchaseRequestId))
      .orderBy(desc(quotations.createdAt));
    return quotationHistory;
  }

  async createQuotation(quotationData: InsertQuotation): Promise<Quotation> {
    // Check if there's an existing quotation for this purchase request
    const existingQuotations = await db
      .select()
      .from(quotations)
      .where(eq(quotations.purchaseRequestId, quotationData.purchaseRequestId))
      .orderBy(desc(quotations.rfqVersion));

    // If there's an existing quotation, deactivate it and create a new version
    let newVersion = 1;
    let parentQuotationId: number | undefined;

    if (existingQuotations.length > 0) {
      const currentQuotation = existingQuotations[0];
      newVersion = (currentQuotation.rfqVersion || 1) + 1;
      parentQuotationId = currentQuotation.id;

      // Deactivate the current quotation
      await db
        .update(quotations)
        .set({ isActive: false })
        .where(eq(quotations.id, currentQuotation.id));
    }

    // Generate quotation number
    const year = new Date().getFullYear();
    const quotationsThisYear = await db
      .select()
      .from(quotations)
      .where(like(quotations.quotationNumber, `COT-${year}-%`));

    // Find the highest number used this year
    let maxNumber = 0;
    quotationsThisYear.forEach((q) => {
      const match = q.quotationNumber.match(/COT-\d{4}-(\d{4})/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    });

    const quotationNumber = `COT-${year}-${String(maxNumber + 1).padStart(4, "0")}`;

    const [quotation] = await db
      .insert(quotations)
      .values({
        ...quotationData,
        quotationNumber,
        rfqVersion: newVersion,
        parentQuotationId,
        isActive: true,
      })
      .returning();
    return quotation;
  }

  async updateQuotation(
    id: number,
    quotationData: Partial<InsertQuotation>,
  ): Promise<Quotation> {
    const [quotation] = await db
      .update(quotations)
      .set({ ...quotationData, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    return quotation;
  }

  async deleteQuotation(id: number): Promise<void> {
    // 0. Update any quotation that has this one as parent to point to its parent (grandparent)
    // This avoids breaking the version chain and foreign key violations
    const targetQuotation = await this.getQuotationById(id);
    if (targetQuotation) {
      await db.update(quotations)
        .set({ parentQuotationId: targetQuotation.parentQuotationId || null })
        .where(eq(quotations.parentQuotationId, id));
    }

    // 1. Get all supplier quotations for this quotation
    const qSupplierQuotations = await db
      .select()
      .from(supplierQuotations)
      .where(eq(supplierQuotations.quotationId, id));

    for (const supplierQuotation of qSupplierQuotations) {
      // 2. Get all supplier quotation items IDs
      const sqItems = await db
        .select({ id: supplierQuotationItems.id })
        .from(supplierQuotationItems)
        .where(eq(supplierQuotationItems.supplierQuotationId, supplierQuotation.id));
      
      const sqItemIds = sqItems.map(i => i.id);

      if (sqItemIds.length > 0) {
          // 3. Delete quantity adjustment history for these items
          await db.delete(quantityAdjustmentHistory)
              .where(inArray(quantityAdjustmentHistory.supplierQuotationItemId, sqItemIds));
      }

      // 4. Delete attachments linked to supplier quotation
      await db.delete(attachments)
          .where(eq(attachments.supplierQuotationId, supplierQuotation.id));

      // 5. Delete supplier quotation items
      await db.delete(supplierQuotationItems)
          .where(eq(supplierQuotationItems.supplierQuotationId, supplierQuotation.id));
    }

    // 6. Delete supplier quotations
    await db.delete(supplierQuotations)
      .where(eq(supplierQuotations.quotationId, id));

    // 7. Delete approved quotation items (snapshot)
    await db.delete(approvedQuotationItems)
      .where(eq(approvedQuotationItems.quotationId, id));

    // 8. Delete quotation version history
    await db.delete(quotationVersionHistory)
      .where(eq(quotationVersionHistory.quotationId, id));

    // 9. Delete quotation items
    await db.delete(quotationItems)
      .where(eq(quotationItems.quotationId, id));

    // 10. Delete attachments linked to quotation
    await db.delete(attachments)
      .where(eq(attachments.quotationId, id));

    // 11. Delete the quotation itself
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  // Quotation Items operations
  async getQuotationItems(quotationId: number): Promise<QuotationItem[]> {
    const results = await db
      .select({
        quotationItem: quotationItems,
        purchaseRequestItem: {
          id: purchaseRequestItems.id,
          price: purchaseRequestItems.price,
          partNumber: purchaseRequestItems.partNumber,
          productCode: purchaseRequestItems.productCode,
          technicalSpecification: purchaseRequestItems.technicalSpecification,
        },
      })
      .from(quotationItems)
      .leftJoin(
        purchaseRequestItems,
        eq(quotationItems.purchaseRequestItemId, purchaseRequestItems.id),
      )
      .where(eq(quotationItems.quotationId, quotationId));

    const mapped = results.map((row) => ({
      ...row.quotationItem,
      purchaseRequestItem: row.purchaseRequestItem?.id ? row.purchaseRequestItem : undefined,
    }));

    const unlinkedItems = mapped.filter((item) => !item.purchaseRequestItem);
    if (unlinkedItems.length > 0) {
      const quotation = await this.getQuotationById(quotationId);
      if (quotation?.purchaseRequestId) {
        const prItems = await db
          .select({
            id: purchaseRequestItems.id,
            price: purchaseRequestItems.price,
            partNumber: purchaseRequestItems.partNumber,
            productCode: purchaseRequestItems.productCode,
            technicalSpecification: purchaseRequestItems.technicalSpecification,
            description: purchaseRequestItems.description,
          })
          .from(purchaseRequestItems)
          .where(eq(purchaseRequestItems.purchaseRequestId, quotation.purchaseRequestId));

        for (const item of unlinkedItems) {
          const matchedPrItem = prItems.find(
            (pr) =>
              (pr.productCode && item.itemCode && pr.productCode === item.itemCode) ||
              (pr.description && item.description && pr.description === item.description),
          );
          if (matchedPrItem) {
            item.purchaseRequestItem = {
              id: matchedPrItem.id,
              price: matchedPrItem.price,
              partNumber: matchedPrItem.partNumber,
              productCode: matchedPrItem.productCode,
              technicalSpecification: matchedPrItem.technicalSpecification,
            };
          }
        }
      }
    }

    return mapped as any[];
  }

  async createQuotationItem(
    itemData: InsertQuotationItem,
  ): Promise<QuotationItem> {
    const [item] = await db.insert(quotationItems).values(itemData).returning();
    return item;
  }

  async createQuotationItems(
    itemsData: InsertQuotationItem[],
  ): Promise<QuotationItem[]> {
    if (itemsData.length === 0) return [];
    return await db.insert(quotationItems).values(itemsData).returning();
  }

  async updateQuotationItem(
    id: number,
    itemData: Partial<InsertQuotationItem>,
  ): Promise<QuotationItem> {
    const [item] = await db
      .update(quotationItems)
      .set(itemData)
      .where(eq(quotationItems.id, id))
      .returning();
    return item;
  }

  async deleteQuotationItem(id: number): Promise<void> {
    await db.delete(quotationItems).where(eq(quotationItems.id, id));
  }

  // Supplier Quotations operations
  async getSupplierQuotations(
    quotationId: number,
  ): Promise<any[]> {
    const results = await db
      .select({
        id: supplierQuotations.id,
        quotationId: supplierQuotations.quotationId,
        supplierId: supplierQuotations.supplierId,
        status: supplierQuotations.status,
        sentAt: supplierQuotations.sentAt,
        receivedAt: supplierQuotations.receivedAt,
        totalValue: supplierQuotations.totalValue,
        subtotalValue: supplierQuotations.subtotalValue,
        finalValue: supplierQuotations.finalValue,
        discountType: supplierQuotations.discountType,
        discountValue: supplierQuotations.discountValue,
        includesFreight: supplierQuotations.includesFreight,
        freightValue: supplierQuotations.freightValue,
        paymentTerms: supplierQuotations.paymentTerms,
        deliveryTerms: supplierQuotations.deliveryTerms,
        warrantyPeriod: supplierQuotations.warrantyPeriod,
        observations: supplierQuotations.observations,
        createdAt: supplierQuotations.createdAt,
        isChosen: supplierQuotations.isChosen,
        choiceReason: supplierQuotations.choiceReason,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          cnpj: suppliers.cnpj,
          contact: suppliers.contact,
          address: suppliers.address,
          paymentTerms: suppliers.paymentTerms,
        },
      })
      .from(supplierQuotations)
      .leftJoin(suppliers, eq(supplierQuotations.supplierId, suppliers.id))
      .where(eq(supplierQuotations.quotationId, quotationId));

    // Recalculate totalValue to include freight when applicable
    return results.map(quotation => {
      let calculatedTotalValue = quotation.totalValue;
      
      // If includes freight and has freight value, ensure totalValue includes it
      if (quotation.includesFreight && quotation.freightValue) {
        const baseValue = quotation.finalValue || quotation.subtotalValue || quotation.totalValue;
        if (baseValue) {
          const baseAmount = parseFloat(baseValue);
          const freightAmount = parseFloat(quotation.freightValue);
          
          // Only add freight if it's not already included in totalValue
          // Check if totalValue is approximately equal to baseValue + freight
          const expectedTotal = baseAmount + freightAmount;
          const currentTotal = parseFloat(quotation.totalValue || '0');
          
          // If current total doesn't match expected total (with small tolerance for rounding)
          if (Math.abs(currentTotal - expectedTotal) > 0.01) {
            calculatedTotalValue = expectedTotal.toString();
          }
        }
      }
      
      return {
        ...quotation,
        totalValue: calculatedTotalValue
      };
    });
  }

  async getSupplierQuotationById(
    id: number,
  ): Promise<SupplierQuotation | undefined> {
    const [supplierQuotation] = await db
      .select()
      .from(supplierQuotations)
      .where(eq(supplierQuotations.id, id));
    return supplierQuotation || undefined;
  }

  async createSupplierQuotation(
    supplierQuotationData: InsertSupplierQuotation,
  ): Promise<SupplierQuotation> {
    const [supplierQuotation] = await db
      .insert(supplierQuotations)
      .values(supplierQuotationData)
      .returning();
    return supplierQuotation;
  }

  async updateSupplierQuotation(
    id: number,
    supplierQuotationData: Partial<InsertSupplierQuotation>,
  ): Promise<SupplierQuotation> {
    const [supplierQuotation] = await db
      .update(supplierQuotations)
      .set(supplierQuotationData)
      .where(eq(supplierQuotations.id, id))
      .returning();
    return supplierQuotation;
  }

  // Supplier Quotation Items operations
  async getSupplierQuotationItems(
    supplierQuotationId: number,
  ): Promise<SupplierQuotationItem[]> {
    return await db
      .select()
      .from(supplierQuotationItems)
      .where(
        eq(supplierQuotationItems.supplierQuotationId, supplierQuotationId),
      );
  }

  async createSupplierQuotationItem(
    itemData: InsertSupplierQuotationItem,
  ): Promise<SupplierQuotationItem> {
    const [item] = await db
      .insert(supplierQuotationItems)
      .values(itemData)
      .returning();
    return item;
  }

  async createSupplierQuotationItems(
    itemsData: InsertSupplierQuotationItem[],
  ): Promise<SupplierQuotationItem[]> {
    if (itemsData.length === 0) return [];
    return await db
      .insert(supplierQuotationItems)
      .values(itemsData)
      .returning();
  }

  async updateSupplierQuotationItem(
    id: number,
    itemData: Partial<InsertSupplierQuotationItem>,
  ): Promise<SupplierQuotationItem> {
    const [item] = await db
      .update(supplierQuotationItems)
      .set(itemData)
      .where(eq(supplierQuotationItems.id, id))
      .returning();
    return item;
  }

  // Approved Quotation Items operations
  async getApprovedQuotationItems(quotationId: number): Promise<ApprovedQuotationItem[]> {
    return await db
      .select()
      .from(approvedQuotationItems)
      .where(eq(approvedQuotationItems.quotationId, quotationId));
  }

  async createApprovedQuotationItem(item: InsertApprovedQuotationItem): Promise<ApprovedQuotationItem> {
    const [created] = await db
      .insert(approvedQuotationItems)
      .values(item)
      .returning();
    return created;
  }

  async clearApprovedQuotationItems(quotationId: number): Promise<void> {
    await db
      .delete(approvedQuotationItems)
      .where(eq(approvedQuotationItems.quotationId, quotationId));
  }
}

export const quotationRepository = new QuotationRepository();
