
import { db, pool } from "../server/db";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Starting migration process...");
  
  const migrationFile = path.join(process.cwd(), "migrations", "populate_approved_items.sql");
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found at: ${migrationFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(migrationFile, "utf-8");

  try {
    console.log("Executing SQL script...");
    const client = await pool.connect();
    try {
      await client.query(sqlContent);
      console.log("Migration executed successfully!");
    } finally {
      client.release();
    }

    // Run a verification query using Drizzle just to double check connection and state
    const result = await db.execute(sql`SELECT count(*) as count FROM approved_quotation_items`);
    console.log(`Current record count in approved_quotation_items: ${result.rows[0].count}`);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
