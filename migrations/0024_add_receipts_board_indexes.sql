-- 0024_add_receipts_board_indexes.sql
-- Índices críticos para otimizar /api/receipts/board e getPendingConference

-- ==================== receipts ====================
-- Filtro principal + ordenação do board (WHERE receipt_phase != 'cancelado' ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_receipts_phase_created
  ON receipts (receipt_phase, created_at DESC);

-- JOINs e subqueries por purchase_order_id / purchase_request_id
CREATE INDEX IF NOT EXISTS idx_receipts_purchase_order_id
  ON receipts (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_receipts_purchase_request_id
  ON receipts (purchase_request_id);

-- Para filtro por fornecedor (board + search)
CREATE INDEX IF NOT EXISTS idx_receipts_supplier_phase
  ON receipts (supplier_id, receipt_phase);

-- ==================== receipt_items ====================
-- FK obrigatória, usada em agregações de valores e quantidades recebidas
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id
  ON receipt_items (receipt_id);

-- JOIN entre receipt_items e purchase_order_items no cálculo de %
CREATE INDEX IF NOT EXISTS idx_receipt_items_purchase_order_item_id
  ON receipt_items (purchase_order_item_id);

-- Agregação por purchase_order (via JOIN receipts)
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id_qty_rcv
  ON receipt_items (receipt_id) INCLUDE (quantity_received, total_price);

-- ==================== purchase_order_items ====================
-- FK mais usada no board: agregações de qty total e valor total do pedido
CREATE INDEX IF NOT EXISTS idx_po_items_purchase_order_id
  ON purchase_order_items (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_po_items_purchase_order_id_incl
  ON purchase_order_items (purchase_order_id) INCLUDE (quantity, total_price);

-- ==================== purchase_orders ====================
-- JOIN purchase_orders -> purchase_requests (COALESCE na query)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_purchase_request_id
  ON purchase_orders (purchase_request_id);

-- ==================== purchase_requests ====================
-- Filtros comuns: categoria, urgência, departamento, solicitante
CREATE INDEX IF NOT EXISTS idx_purchase_requests_cost_center_id
  ON purchase_requests (cost_center_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester_id
  ON purchase_requests (requester_id);
