import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'receipts'
    `);
    console.log("Columns in receipts table:");
    console.log(res.rows.map(r => r.column_name));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
