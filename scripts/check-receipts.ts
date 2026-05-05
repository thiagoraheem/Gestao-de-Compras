import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT receipt_phase, COUNT(*) as count 
      FROM receipts 
      GROUP BY receipt_phase
    `);
    console.log("Receipts by phase:");
    console.log(res.rows);

    const hasItems = await db.execute(sql`
      SELECT COUNT(*) as count FROM receipt_items
    `);
    console.log("Total receipt items:", hasItems.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
