
import { Router } from "express";
import { db } from "../db";
import { purchaseOrderItems, purchaseOrders, suppliers } from "../../shared/schema";
import { eq, and, gte, lte, or, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/api/reports/items-analysis", async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const conditions = [];

    // Filter by date range if provided
    if (startDate) {
      conditions.push(gte(purchaseOrders.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      // Add one day to include the end date fully
      const end = new Date(endDate as string);
      end.setDate(end.getDate() + 1);
      conditions.push(lte(purchaseOrders.createdAt, end));
    }

    // Default to completed/confirmed/sent orders if no status specified
    // We want valid orders that represent actual purchases
    // Including 'draft' and 'approved' to ensure data visibility in development environments
    const validStatuses = ['confirmed', 'completed', 'sent', 'received', 'partial_received', 'draft', 'approved'];
    
    if (status) {
        conditions.push(eq(purchaseOrders.status, status as string));
    } else {
        conditions.push(or(...validStatuses.map(s => eq(purchaseOrders.status, s))));
    }

    const results = await db
      .select({
        item: purchaseOrderItems,
        order: purchaseOrders,
        supplier: suppliers,
      })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions));

    // Aggregation Logic
    interface GroupData {
      id: string;
      type: 'ERP' | 'DESC';
      itemCode: string | null;
      description: string;
      normalizedDescription: string | null;
      totalQuantity: number;
      totalValue: number;
      orderCount: number;
      orderIds: Set<number>;
      suppliers: Map<number, string>;
      minPrice: number;
      maxPrice: number;
      firstPurchaseDate: Date;
      lastPurchaseDate: Date;
      descriptions: Set<string>;
    }

    const groups: Record<string, GroupData> = {};

    for (const row of results) {
      const item = row.item;
      const order = row.order;
      const supplier = row.supplier;

      let key: string;
      let groupType: 'ERP' | 'DESC';

      if (item.itemCode && item.itemCode.trim() !== '') {
        key = `CODE:${item.itemCode.trim()}`;
        groupType = 'ERP';
      } else {
        // Normalization: Trim and Uppercase
        const normalizedDesc = item.description.trim().toUpperCase();
        key = `DESC:${normalizedDesc}`;
        groupType = 'DESC';
      }

      if (!groups[key]) {
        groups[key] = {
          id: key,
          type: groupType,
          itemCode: item.itemCode || null,
          description: item.description, // Keep the first description found as display
          normalizedDescription: groupType === 'DESC' ? key.substring(5) : null,
          totalQuantity: 0,
          totalValue: 0,
          orderCount: 0,
          orderIds: new Set<number>(),
          suppliers: new Map<number, string>(), // id -> name
          minPrice: Number(item.unitPrice),
          maxPrice: Number(item.unitPrice),
          firstPurchaseDate: new Date(order.createdAt || Date.now()),
          lastPurchaseDate: new Date(order.createdAt || Date.now()),
          descriptions: new Set<string>(), // Track variations
        };
      }

      const group = groups[key];

      // Update metrics
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      const value = qty * price;

      group.totalQuantity += qty;
      group.totalValue += value;
      group.orderIds.add(order.id);
      group.descriptions.add(item.description);

      if (supplier) {
        const supplierName = supplier.name || 'Desconhecido';
        group.suppliers.set(supplier.id, supplierName);
      }

      if (price < group.minPrice) group.minPrice = price;
      if (price > group.maxPrice) group.maxPrice = price;

      const orderDate = new Date(order.createdAt || Date.now());
      if (orderDate < group.firstPurchaseDate) group.firstPurchaseDate = orderDate;
      if (orderDate > group.lastPurchaseDate) group.lastPurchaseDate = orderDate;
    }

    // Convert to array and format for response
    const reportData = Object.values(groups).map(group => {
      return {
        id: group.id,
        type: group.type,
        itemCode: group.itemCode,
        description: group.description, // Primary display description
        variationCount: group.descriptions.size, // How many different descriptions were grouped
        totalQuantity: group.totalQuantity,
        totalValue: group.totalValue,
        orderCount: group.orderIds.size,
        averagePrice: group.totalQuantity > 0 ? group.totalValue / group.totalQuantity : 0,
        minPrice: group.minPrice,
        maxPrice: group.maxPrice,
        priceVolatility: group.minPrice > 0 ? ((group.maxPrice - group.minPrice) / group.minPrice) * 100 : 0,
        supplierCount: group.suppliers.size,
        suppliers: Array.from(group.suppliers.entries()).map(([id, name]) => ({ id, name })),
        firstPurchaseDate: group.firstPurchaseDate,
        lastPurchaseDate: group.lastPurchaseDate,
      };
    });

    // Sort by Total Value descending by default
    reportData.sort((a, b) => b.totalValue - a.totalValue);

    // Summary Statistics
    const summary = {
      totalSpent: reportData.reduce((sum, item) => sum + item.totalValue, 0),
      uniqueItems: reportData.length,
      itemsWithCode: reportData.filter(i => i.type === 'ERP').length,
      itemsWithoutCode: reportData.filter(i => i.type === 'DESC').length,
    };

    res.json({
      summary,
      items: reportData
    });

  } catch (error) {
    console.error("Error generating items analysis report:", error);
    res.status(500).json({ message: "Internal server error generating report" });
  }
});

export default router;
