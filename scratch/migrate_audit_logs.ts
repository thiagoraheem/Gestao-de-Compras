import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("Applying migration to audit_logs...");
    await db.execute(sql`ALTER TABLE audit_logs ALTER COLUMN purchase_request_id DROP NOT NULL;`);
    console.log("Migration applied successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
