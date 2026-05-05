import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function applyBackfill() {
  try {
    const migrationPath = path.join(process.cwd(), "migrations", "0021_backfill_legacy_receipts.sql");
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    
    console.log("Aplicando migração de backfill...");
    await db.execute(sql.raw(sqlContent));
    console.log("Migração aplicada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao aplicar migração:", error);
    process.exit(1);
  }
}

applyBackfill();
