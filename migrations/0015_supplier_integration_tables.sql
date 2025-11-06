-- Migration: create tables for supplier integration runs and items

CREATE TABLE IF NOT EXISTS supplier_integration_runs (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMP DEFAULT now() NOT NULL,
  finished_at TIMESTAMP,
  total_suppliers INTEGER NOT NULL DEFAULT 0,
  processed_suppliers INTEGER NOT NULL DEFAULT 0,
  created_suppliers INTEGER NOT NULL DEFAULT 0,
  updated_suppliers INTEGER NOT NULL DEFAULT 0,
  ignored_suppliers INTEGER NOT NULL DEFAULT 0,
  invalid_suppliers INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_by INTEGER REFERENCES users(id),
  cancelled_by INTEGER REFERENCES users(id),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS supplier_integration_items (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES supplier_integration_runs(id) ON DELETE CASCADE,
  erp_id TEXT NOT NULL,
  erp_document TEXT,
  erp_name TEXT NOT NULL,
  action TEXT NOT NULL,
  match_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  selected BOOLEAN NOT NULL DEFAULT true,
  local_supplier_id INTEGER REFERENCES suppliers(id),
  payload JSONB NOT NULL,
  differences JSONB,
  issues JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_integration_items_run_idx
  ON supplier_integration_items(run_id);

CREATE INDEX IF NOT EXISTS supplier_integration_items_status_idx
  ON supplier_integration_items(status);

CREATE INDEX IF NOT EXISTS supplier_integration_items_erp_idx
  ON supplier_integration_items(erp_id);
