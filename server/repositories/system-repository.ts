import { db, pool } from "../db";
import { 
  attachments, 
  quantityAdjustmentHistory, 
  purchaseRequests, 
  purchaseRequestItems, 
  quotations, 
  supplierQuotations, 
  purchaseOrders, 
  receipts, 
  auditLogs,
  supplierQuotationItems,
  approvedQuotationItems,
  quotationVersionHistory,
  quotationItems,
  paymentMethods,
  deliveryLocations
} from "../../shared/schema";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import type { 
  Attachment, 
  InsertAttachment, 
  PaymentMethod, 
  InsertPaymentMethod, 
  DeliveryLocation, 
  InsertDeliveryLocation 
} from "../../shared/schema";

export class SystemRepository {
  async getCompleteTimeline(purchaseRequestId: number): Promise<any[]> {
    // This is a complex query that aggregates data from multiple tables
    // For now, I'll keep the logic here but eventually it might move to a service
    const auditEntries = await db.select().from(auditLogs).where(eq(auditLogs.purchaseRequestId, purchaseRequestId));
    const approvalEntries = await db.select().from(sql`approval_history`).where(eq(sql`purchase_request_id`, purchaseRequestId));
    
    // Combine and format timeline (simplified for this migration)
    const timeline = [
      ...auditEntries.map(e => ({ type: 'audit', ...e, timestamp: e.performedAt })),
      ...approvalEntries.map((e: any) => ({ type: 'approval', ...e, timestamp: e.createdAt }))
    ];
    
    return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db
      .insert(attachments)
      .values(attachmentData)
      .returning();
    return attachment;
  }

  async getAttachmentsByPurchaseRequestId(purchaseRequestId: number): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(eq(attachments.purchaseRequestId, purchaseRequestId));
  }

  async createQuantityAdjustmentHistory(history: any): Promise<any> {
    try {
      const [result] = await db
        .insert(quantityAdjustmentHistory)
        .values({
          supplierQuotationItemId: history.supplierQuotationItemId,
          quotationId: history.quotationId,
          supplierId: history.supplierId,
          previousQuantity: history.previousQuantity,
          newQuantity: history.newQuantity,
          previousUnit: history.previousUnit,
          newUnit: history.newUnit,
          adjustmentReason: history.adjustmentReason,
          adjustedBy: history.adjustedBy,
          adjustedAt: history.adjustedAt,
          previousTotalValue: history.previousTotalValue,
          newTotalValue: history.newTotalValue,
          createdAt: new Date(),
        })
        .returning();
      return result;
    } catch (error) {
      console.error("Error creating quantity adjustment history:", error);
      throw error;
    }
  }

  async getDistinctItemDescriptions(query?: string): Promise<string[]> {
    try {
      let sqlQuery = `SELECT DISTINCT description FROM purchase_request_items`;
      const params: any[] = [];
      
      if (query && query.trim()) {
        sqlQuery += ` WHERE description ILIKE $1`;
        params.push(`%${query.trim()}%`);
      }
      
      sqlQuery += ` ORDER BY description ASC LIMIT 50`;
      
      const result = await pool.query(sqlQuery, params);
      return result.rows.map((row: any) => row.description);
    } catch (error) {
      console.error("Error fetching item descriptions:", error);
      return [];
    }
  }

  async getAllPaymentMethods(): Promise<PaymentMethod[]> {
    return await db.select().from(paymentMethods);
  }

  async createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod> {
    const [newPaymentMethod] = await db
      .insert(paymentMethods)
      .values(paymentMethod)
      .returning();
    return newPaymentMethod;
  }

  async getAllDeliveryLocations(): Promise<DeliveryLocation[]> {
    return await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.active, true));
  }

  async getDeliveryLocationById(id: number): Promise<DeliveryLocation | undefined> {
    const [location] = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.id, id));
    return location || undefined;
  }

  async createDeliveryLocation(deliveryLocation: InsertDeliveryLocation): Promise<DeliveryLocation> {
    const [newLocation] = await db
      .insert(deliveryLocations)
      .values(deliveryLocation)
      .returning();
    return newLocation;
  }

  async updateDeliveryLocation(id: number, deliveryLocation: Partial<InsertDeliveryLocation>): Promise<DeliveryLocation> {
    const [updatedLocation] = await db
      .update(deliveryLocations)
      .set({ ...deliveryLocation, updatedAt: new Date() })
      .where(eq(deliveryLocations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteDeliveryLocation(id: number): Promise<void> {
    await db
      .update(deliveryLocations)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(deliveryLocations.id, id));
  }

  async cleanupDatabase(): Promise<void> {
      // NOTE: This is a destructive operation used for testing/resetting
      await db.delete(auditLogs);
      await db.delete(attachments);
      await db.delete(quantityAdjustmentHistory);
      await db.delete(receipts);
      await db.delete(purchaseOrders);
      await db.delete(supplierQuotations);
      await db.delete(quotations);
      await db.delete(purchaseRequestItems);
      await db.delete(purchaseRequests);
  }
}

export const systemRepository = new SystemRepository();
