import { defineConfig } from "drizzle-kit";

// Use environment-specific database URL
const databaseUrl = process.env.NODE_ENV === 'production' 
  ? process.env.DATABASE_URL 
  : process.env.DATABASE_URL_DEV;

if (!databaseUrl) {
  const envVar = process.env.NODE_ENV === 'production' ? 'DATABASE_URL' : 'DATABASE_URL_DEV';
  throw new Error(`${envVar} not found. Please set the appropriate database URL in your environment variables.`);
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
