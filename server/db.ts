import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qtBpF7Lxkfl3@ep-lingering-wildflower-acwq645y-pooler.sa-east-1.aws.neon.tech/compras',
  ssl: {
    rejectUnauthorized: false
  }
});

export const db = drizzle(pool, { schema });