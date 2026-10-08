-- 0025_add_purchase_requests_board_indexes.sql
-- Índices complementares para otimizar /api/purchase-requests (Kanban)
-- Onde a query principal é:
--   SELECT ... FROM purchase_requests pr
--     LEFT JOIN users requester
--     LEFT JOIN users approver_a1
--     LEFT JOIN cost_centers cc
--     LEFT JOIN departments d
--     LEFT JOIN suppliers s
--     LEFT JOIN purchase_orders po
--   WHERE [company + restrição de departamento/usuário]
--   ORDER BY pr.created_at DESC
-- Além dos EXISTS/Subqueries de hasQuotation e hasPendingFiscal.

-- ============================================================
-- purchase_requests
-- ============================================================
-- ORDER BY principal do Kanban + restrição por data/fases
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at_desc
  ON purchase_requests (created_at DESC);

-- Filtros por fase (futuro filtro server-side e agregação por colunas)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_current_phase_created_desc
  ON purchase_requests (current_phase, created_at DESC);

-- Restrição por department (via cost_center JOIN)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_cost_center_id
  ON purchase_requests (cost_center_id);

-- Restrição por criador (usuário não aprovador/recebedor)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester_id
  ON purchase_requests (requester_id);

-- Filtro de empresa (multi-company)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_company_id_created_desc
  ON purchase_requests (company_id, created_at DESC);

-- ============================================================
-- purchase_orders (JOIN + fallback de totalValue)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_purchase_orders_purchase_request_id
  ON purchase_orders (purchase_request_id);

-- ============================================================
-- quotations (EXISTS de hasQuotation)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quotations_purchase_request_id
  ON quotations (purchase_request_id);

-- ============================================================
-- supplier_quotations (DISTINCT ON purchase_request_id, supplier_id, created_at DESC)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_quotation_supplier_created_desc
  ON supplier_quotations (quotation_id, supplier_id, created_at DESC);

-- ============================================================
-- supplier_quotation_items (JOIN batch por supplier_quotation_id)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_supplier_quotation_items_supplier_quotation_id
  ON supplier_quotation_items (supplier_quotation_id);

-- ============================================================
-- purchase_order_items (fallback de totalValue e batch enriquecimento)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_purchase_order_id_incl
  ON purchase_order_items (purchase_order_id) INCLUDE (unit_price, quantity, total_price);

-- ============================================================
-- receipts (EXISTS hasPendingFiscal)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_receipts_purchase_order_id_status_conf_fisica
  ON receipts (purchase_order_id, status)
  WHERE status = 'conf_fisica';
