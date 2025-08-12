import { defineConfig } from "drizzle-kit";

// Use development database URL
const databaseUrl = process.env.NODE_ENV === 'production' 
  ? process.env.DATABASE_URL 
  : process.env.DATABASE_URL_DEV || 'postgres://compras:Compras2025@54.232.194.197:5432/locador_compras';

if (!databaseUrl) {
  throw new Error("DATABASE_URL not found, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: false
  },
});
