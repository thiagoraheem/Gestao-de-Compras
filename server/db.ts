import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const isProduction = process.env.NODE_ENV === "production";

// Configuração do pool baseada no ambiente
const poolConfig = isProduction
  ? {
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://neondb_owner:npg_qtBpF7Lxkfl3@ep-lingering-wildflower-acwq645y-pooler.sa-east-1.aws.neon.tech/compras",
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      connectionString:
        process.env.DATABASE_URL_DEV ??
        "postgres://compras:Compras2025@54.232.194.197:5432/locador_compras",
    };

export const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });
