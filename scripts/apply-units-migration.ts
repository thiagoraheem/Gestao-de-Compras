import { db } from "../server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function applyUnitsMigration() {
  try {
    const migrationPath = path.join(process.cwd(), "migrations", "0023_units_of_measure.sql");
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    
    console.log("Aplicando migração de unidades de medida...");
    await db.execute(sql.raw(sqlContent));
    console.log("Migração de unidades de medida aplicada com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("Erro ao aplicar migração de unidades de medida:", error);
    process.exit(1);
  }
}

applyUnitsMigration();
