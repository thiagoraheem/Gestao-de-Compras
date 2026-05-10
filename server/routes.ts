import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { config as appConfig } from "./config";
// Import modular routes
import { registerAllRoutes } from "./routes/index";
import { createCacheMiddleware } from "./cache";
import { initRealtime } from "./realtime";

// Session type declaration
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Validate required environment variables
  if (!process.env.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET environment variable is required for security. Please set a strong, random secret key.",
    );
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters long for security.",
    );
  }

  // Configure PostgreSQL session store
  const PgSession = connectPgSimple(session);

  // Configure session with PostgreSQL store
  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "sessions",
        createTableIfMissing: false,
      }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: process.env.NODE_ENV === 'production' ? "sessionId" : "sessionIdDev", // Distinct session names
      cookie: {
        secure: (() => {
          const env = (process.env.COOKIE_SECURE || "").toLowerCase();
          if (env === "true") return true;
          if (env === "false") return false;
          return appConfig.baseUrl.startsWith("https://");
        })(),
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        sameSite: ((process.env.COOKIE_SAMESITE || "lax") as "lax" | "strict" | "none"),
      },
      rolling: true, // Reset expiration on activity
    }),
  );

  // Apply cache middleware AFTER session is configured so we can use session ID in cache keys
  app.use('/api', createCacheMiddleware());

  // Initialize default data
  await storage.initializeDefaultData();

  // Initialize audit trigger if needed
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE OR REPLACE FUNCTION audit_trigger_function()
      RETURNS TRIGGER AS $$
      DECLARE
          audit_context JSONB;
          old_record JSONB;
          new_record JSONB;
          field_name TEXT;
          old_val TEXT;
          new_val TEXT;
          current_tx BIGINT;
          current_tx_uuid UUID;
      BEGIN
          audit_context := get_audit_context();
          current_tx := txid_current();
          current_tx_uuid := gen_random_uuid();
          IF TG_OP = 'DELETE' THEN
              old_record := to_jsonb(OLD);
              new_record := NULL;
          ELSIF TG_OP = 'INSERT' THEN
              old_record := NULL;
              new_record := to_jsonb(NEW);
          ELSE
              old_record := to_jsonb(OLD);
              new_record := to_jsonb(NEW);
          END IF;
          IF TG_OP = 'INSERT' THEN
              FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
                  new_val := new_record ->> field_name;
                  INSERT INTO detailed_audit_log (
                      table_name, record_id, operation_type, user_id, transaction_id, metadata
                  ) VALUES (
                      TG_TABLE_NAME,
                      (new_record ->> 'id')::INTEGER,
                      TG_OP,
                      (audit_context ->> 'user_id')::INTEGER,
                      current_tx_uuid,
                      jsonb_build_object(
                        'operation','field_insert',
                        'table',TG_TABLE_NAME,
                        'txid_current',current_tx,
                        'field',field_name,
                        'new_value',new_val
                      )
                  );
              END LOOP;
          END IF;
          IF TG_OP = 'DELETE' THEN
              FOR field_name IN SELECT key FROM jsonb_each_text(old_record) LOOP
                  old_val := old_record ->> field_name;
                  INSERT INTO detailed_audit_log (
                      table_name, record_id, operation_type, user_id, transaction_id, metadata
                  ) VALUES (
                      TG_TABLE_NAME,
                      (old_record ->> 'id')::INTEGER,
                      TG_OP,
                      (audit_context ->> 'user_id')::INTEGER,
                      current_tx_uuid,
                      jsonb_build_object(
                        'operation','field_delete',
                        'table',TG_TABLE_NAME,
                        'txid_current',current_tx,
                        'field',field_name,
                        'old_value',old_val
                      )
                  );
              END LOOP;
          END IF;
          IF TG_OP = 'UPDATE' THEN
              FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
                  old_val := old_record ->> field_name;
                  new_val := new_record ->> field_name;
                  IF old_val IS DISTINCT FROM new_val THEN
                      INSERT INTO detailed_audit_log (
                          table_name, record_id, operation_type, user_id, transaction_id, metadata, change_reason
                      ) VALUES (
                          TG_TABLE_NAME,
                          (new_record ->> 'id')::INTEGER,
                          TG_OP,
                          (audit_context ->> 'user_id')::INTEGER,
                          current_tx_uuid,
                          jsonb_build_object(
                            'operation','field_update',
                            'table',TG_TABLE_NAME,
                            'txid_current',current_tx,
                            'field',field_name,
                            'old_value',old_val,
                            'new_value',new_val
                          ),
                          CASE 
                              WHEN field_name LIKE '%quantity%' THEN 'Quantity adjustment'
                              WHEN field_name LIKE '%price%' THEN 'Price adjustment'
                              WHEN field_name LIKE '%approved%' THEN 'Approval status change'
                              ELSE 'Data update'
                          END
                      );
                  END IF;
              END LOOP;
          END IF;
          IF TG_OP = 'DELETE' THEN
              RETURN OLD;
          ELSE
              RETURN NEW;
          END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
  } catch {}

  // Register modular routes
  registerAllRoutes(app);

  const httpServer = createServer(app);
  if (!process.env.JEST_WORKER_ID && process.env.NODE_ENV !== "test") {
    initRealtime(httpServer);
  }
  return httpServer;
}
