
import { db } from "../db";
import { purchaseOrders } from "../../shared/schema";
import { sql } from "drizzle-orm";

async function checkOrders() {
  try {
    const count = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
    console.log("Total orders:", count[0].count);

    const orders = await db.select().from(purchaseOrders).limit(10);
    console.log("Sample orders:", JSON.stringify(orders, null, 2));

    const statuses = await db.select({ 
      status: purchaseOrders.status, 
      count: sql<number>`count(*)` 
    })
    .from(purchaseOrders)
    .groupBy(purchaseOrders.status);
    
    console.log("Orders by status:", statuses);

    // Check dates range
    const dates = await db.select({
      minDate: sql`min(${purchaseOrders.createdAt})`,
      maxDate: sql`max(${purchaseOrders.createdAt})`
    }).from(purchaseOrders);
    console.log("Date range:", dates);

  } catch (error) {
    console.error("Error checking orders:", error);
  }
  process.exit(0);
}

checkOrders();
