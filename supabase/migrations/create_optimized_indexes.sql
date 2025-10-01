-- =====================================================
-- OPTIMIZED INDEXES FOR KANBAN REAL-TIME SYSTEM
-- =====================================================
-- This migration creates optimized indexes for the Kanban system
-- to improve performance of real-time queries and WebSocket notifications
-- =====================================================

-- =====================================================
-- PURCHASE REQUESTS INDEXES
-- =====================================================

-- Primary index for kanban phase filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_phase_created 
ON purchase_requests (phase, created_at DESC);

-- Index for department-based filtering
CREATE INDEX IF NOT EXISTS idx_purchase_requests_department_phase 
ON purchase_requests (department_id, phase, created_at DESC);

-- Index for requester-based filtering
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester_phase 
ON purchase_requests (requester_id, phase, created_at DESC);

-- Index for urgency-based sorting (High > Medium > Low priority)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_urgency_delivery 
ON purchase_requests (urgency, ideal_delivery_date ASC, created_at DESC);

-- Composite index for complex kanban queries
CREATE INDEX IF NOT EXISTS idx_purchase_requests_kanban_composite 
ON purchase_requests (phase, department_id, urgency, ideal_delivery_date, created_at DESC);

-- Index for search functionality (number and description)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_search_number 
ON purchase_requests (number);

-- Full-text search index for description and justification
CREATE INDEX IF NOT EXISTS idx_purchase_requests_search_text 
ON purchase_requests USING gin(to_tsvector('portuguese', description || ' ' || COALESCE(justification, '')));

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status_phase 
ON purchase_requests (status, phase, created_at DESC);

-- Index for date range filtering
CREATE INDEX IF NOT EXISTS idx_purchase_requests_date_range 
ON purchase_requests (created_at, ideal_delivery_date);

-- =====================================================
-- QUOTATIONS INDEXES
-- =====================================================

-- Primary index for quotation-purchase request relationship
CREATE INDEX IF NOT EXISTS idx_quotations_purchase_request_status 
ON quotations (purchase_request_id, status, created_at DESC);

-- Index for quotation status filtering
CREATE INDEX IF NOT EXISTS idx_quotations_status_created 
ON quotations (status, created_at DESC);

-- Index for quotation expiry monitoring
CREATE INDEX IF NOT EXISTS idx_quotations_expiry_status 
ON quotations (expiry_date, status) WHERE status IN ('Pendente', 'Em Análise');

-- Index for quotation approval workflow
CREATE INDEX IF NOT EXISTS idx_quotations_approval_workflow 
ON quotations (status, total_value, created_at DESC) 
WHERE status IN ('Pendente Aprovação A1', 'Pendente Aprovação A2', 'Aprovada');

-- =====================================================
-- SUPPLIER QUOTATIONS INDEXES
-- =====================================================

-- Primary index for supplier quotation-quotation relationship
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_quotation_supplier 
ON supplier_quotations (quotation_id, supplier_id, created_at DESC);

-- Index for supplier-based filtering
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_supplier_status 
ON supplier_quotations (supplier_id, status, created_at DESC);

-- Index for price comparison queries
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_price_comparison 
ON supplier_quotations (quotation_id, total_value ASC, status);

-- Index for supplier performance tracking
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_performance 
ON supplier_quotations (supplier_id, status, delivery_time, total_value);

-- =====================================================
-- PURCHASE ORDERS INDEXES
-- =====================================================

-- Primary index for purchase order-purchase request relationship
CREATE INDEX IF NOT EXISTS idx_purchase_orders_purchase_request 
ON purchase_orders (purchase_request_id, status, created_at DESC);

-- Index for purchase order status filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_created 
ON purchase_orders (status, created_at DESC);

-- Index for supplier-based purchase order filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_status 
ON purchase_orders (supplier_id, status, created_at DESC);

-- Index for delivery tracking
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_tracking 
ON purchase_orders (expected_delivery_date, status) 
WHERE status IN ('Enviado', 'Em Trânsito', 'Entregue Parcial');

-- Index for financial tracking
CREATE INDEX IF NOT EXISTS idx_purchase_orders_financial 
ON purchase_orders (status, total_value, created_at DESC);

-- =====================================================
-- RECEIPTS INDEXES
-- =====================================================

-- Primary index for receipt-purchase order relationship
CREATE INDEX IF NOT EXISTS idx_receipts_purchase_order_status 
ON receipts (purchase_order_id, status, created_at DESC);

-- Index for receipt status filtering
CREATE INDEX IF NOT EXISTS idx_receipts_status_created 
ON receipts (status, created_at DESC);

-- Index for receipt date filtering
CREATE INDEX IF NOT EXISTS idx_receipts_received_date 
ON receipts (received_date DESC, status);

-- Index for partial receipt tracking
CREATE INDEX IF NOT EXISTS idx_receipts_partial_tracking 
ON receipts (purchase_order_id, status, received_date DESC) 
WHERE status IN ('Recebido Parcial', 'Pendente');

-- =====================================================
-- SUPPORTING TABLES INDEXES
-- =====================================================

-- Companies index for filtering
CREATE INDEX IF NOT EXISTS idx_companies_active_name 
ON companies (active, name) WHERE active = true;

-- Departments index for filtering
CREATE INDEX IF NOT EXISTS idx_departments_company_active 
ON departments (company_id, active, name) WHERE active = true;

-- Users index for authentication and filtering
CREATE INDEX IF NOT EXISTS idx_users_email_active 
ON users (email, active) WHERE active = true;

-- Users index for department-based filtering
CREATE INDEX IF NOT EXISTS idx_users_department_role 
ON users (department_id, role, active) WHERE active = true;

-- Suppliers index for quotation queries
CREATE INDEX IF NOT EXISTS idx_suppliers_active_name 
ON suppliers (active, name) WHERE active = true;

-- =====================================================
-- PURCHASE REQUEST ITEMS INDEXES
-- =====================================================

-- Index for purchase request items relationship
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request 
ON purchase_request_items (purchase_request_id, created_at DESC);

-- Index for item search functionality
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_search 
ON purchase_request_items USING gin(to_tsvector('portuguese', description || ' ' || COALESCE(specification, '')));

-- Index for quantity and value analysis
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_quantity_value 
ON purchase_request_items (purchase_request_id, quantity, unit_value);

-- =====================================================
-- QUOTATION ITEMS INDEXES
-- =====================================================

-- Index for quotation items relationship
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation 
ON quotation_items (quotation_id, created_at DESC);

-- Index for item-based quotation comparison
CREATE INDEX IF NOT EXISTS idx_quotation_items_comparison 
ON quotation_items (quotation_id, purchase_request_item_id, unit_value);

-- =====================================================
-- PERFORMANCE MONITORING INDEXES
-- =====================================================

-- Index for audit trail and change tracking
CREATE INDEX IF NOT EXISTS idx_purchase_requests_updated_at 
ON purchase_requests (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_updated_at 
ON quotations (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_quotations_updated_at 
ON supplier_quotations (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_updated_at 
ON purchase_orders (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipts_updated_at 
ON receipts (updated_at DESC);

-- =====================================================
-- STATISTICS AND REPORTING INDEXES
-- =====================================================

-- Index for kanban statistics by phase
CREATE INDEX IF NOT EXISTS idx_purchase_requests_stats_phase 
ON purchase_requests (phase, department_id, created_at::date);

-- Index for performance metrics
CREATE INDEX IF NOT EXISTS idx_purchase_requests_performance_metrics 
ON purchase_requests (created_at::date, phase, urgency, department_id);

-- Index for supplier performance analysis
CREATE INDEX IF NOT EXISTS idx_supplier_performance_analysis 
ON supplier_quotations (supplier_id, created_at::date, status, delivery_time);

-- =====================================================
-- REAL-TIME NOTIFICATION INDEXES
-- =====================================================

-- Indexes to optimize trigger performance for LISTEN/NOTIFY
CREATE INDEX IF NOT EXISTS idx_purchase_requests_notify_optimization 
ON purchase_requests (id, phase, department_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_quotations_notify_optimization 
ON quotations (id, purchase_request_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_supplier_quotations_notify_optimization 
ON supplier_quotations (id, quotation_id, supplier_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_notify_optimization 
ON purchase_orders (id, purchase_request_id, supplier_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_receipts_notify_optimization 
ON receipts (id, purchase_order_id, status, updated_at);

-- =====================================================
-- ANALYZE TABLES FOR OPTIMAL QUERY PLANNING
-- =====================================================

ANALYZE purchase_requests;
ANALYZE quotations;
ANALYZE supplier_quotations;
ANALYZE purchase_orders;
ANALYZE receipts;
ANALYZE purchase_request_items;
ANALYZE quotation_items;
ANALYZE companies;
ANALYZE departments;
ANALYZE users;
ANALYZE suppliers;

-- =====================================================
-- INDEX USAGE MONITORING
-- =====================================================

-- Create a view to monitor index usage (for future optimization)
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC, idx_tup_read DESC;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON INDEX idx_purchase_requests_phase_created IS 'Primary index for kanban phase filtering - most common query pattern';
COMMENT ON INDEX idx_purchase_requests_kanban_composite IS 'Composite index for complex kanban queries with multiple filters';
COMMENT ON INDEX idx_purchase_requests_search_text IS 'Full-text search index for description and justification fields';
COMMENT ON INDEX idx_quotations_approval_workflow IS 'Optimizes approval workflow queries by status and value';
COMMENT ON INDEX idx_supplier_quotations_price_comparison IS 'Optimizes price comparison queries across suppliers';
COMMENT ON INDEX idx_purchase_orders_delivery_tracking IS 'Optimizes delivery tracking and monitoring queries';

-- =====================================================
-- VACUUM AND REINDEX RECOMMENDATIONS
-- =====================================================

-- Note: These should be run periodically in production
-- VACUUM ANALYZE purchase_requests;
-- VACUUM ANALYZE quotations;
-- VACUUM ANALYZE supplier_quotations;
-- VACUUM ANALYZE purchase_orders;
-- VACUUM ANALYZE receipts;

-- =====================================================
-- END OF OPTIMIZED INDEXES MIGRATION
-- =====================================================