import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test" || typeof process.env.JEST_WORKER_ID !== "undefined";

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
      ...(isTest ? { allowExitOnIdle: true } : {}),
    }
  : {
      connectionString: databaseUrl,
      ...(isTest ? { allowExitOnIdle: true } : {}),
    };

export const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });
