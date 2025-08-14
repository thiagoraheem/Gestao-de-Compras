import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const isProduction = process.env.NODE_ENV === "production";

// Configuração do pool baseada no ambiente
const databaseUrl = isProduction ? process.env.DATABASE_URL : process.env.DATABASE_URL_DEV;

if (!databaseUrl) {
  const envVar = isProduction ? 'DATABASE_URL' : 'DATABASE_URL_DEV';
  throw new Error(`${envVar} not found. Please set the appropriate database URL in your environment variables.`);
}

const poolConfig = isProduction
  ? {
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      connectionString: databaseUrl,
    };

export const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });
