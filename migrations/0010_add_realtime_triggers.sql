-- Migration: Add PostgreSQL LISTEN/NOTIFY triggers for real-time Kanban updates
-- Created: 2025-01-25
-- Purpose: Enable real-time notifications for purchase_requests, quotations, and purchase_orders changes

-- =====================================================
-- NOTIFICATION FUNCTIONS
-- =====================================================

-- Function for purchase_requests notifications
CREATE OR REPLACE FUNCTION notify_purchase_request_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    -- Build payload with relevant information
    notification_payload := json_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'id', COALESCE(NEW.id, OLD.id),
        'current_phase', COALESCE(NEW.current_phase, OLD.current_phase),
        'old_phase', CASE WHEN TG_OP = 'UPDATE' THEN OLD.current_phase ELSE NULL END,
        'request_number', COALESCE(NEW.request_number, OLD.request_number),
        'requester_id', COALESCE(NEW.requester_id, OLD.requester_id),
        'company_id', COALESCE(NEW.company_id, OLD.company_id),
        'urgency', COALESCE(NEW.urgency, OLD.urgency),
        'category', COALESCE(NEW.category, OLD.category),
        'total_value', COALESCE(NEW.total_value, OLD.total_value),
        'chosen_supplier_id', COALESCE(NEW.chosen_supplier_id, OLD.chosen_supplier_id),
        'timestamp', extract(epoch from now()),
        'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    );

    -- Send notification
    PERFORM pg_notify('purchase_request_changes', notification_payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function for quotations notifications
CREATE OR REPLACE FUNCTION notify_quotation_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    notification_payload := json_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'id', COALESCE(NEW.id, OLD.id),
        'quotation_number', COALESCE(NEW.quotation_number, OLD.quotation_number),
        'purchase_request_id', COALESCE(NEW.purchase_request_id, OLD.purchase_request_id),
        'status', COALESCE(NEW.status, OLD.status),
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'quotation_deadline', COALESCE(NEW.quotation_deadline, OLD.quotation_deadline),
        'is_active', COALESCE(NEW.is_active, OLD.is_active),
        'timestamp', extract(epoch from now()),
        'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    );

    PERFORM pg_notify('quotation_changes', notification_payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function for supplier_quotations notifications
CREATE OR REPLACE FUNCTION notify_supplier_quotation_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    notification_payload := json_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'id', COALESCE(NEW.id, OLD.id),
        'quotation_id', COALESCE(NEW.quotation_id, OLD.quotation_id),
        'supplier_id', COALESCE(NEW.supplier_id, OLD.supplier_id),
        'status', COALESCE(NEW.status, OLD.status),
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'total_value', COALESCE(NEW.total_value, OLD.total_value),
        'is_chosen', COALESCE(NEW.is_chosen, OLD.is_chosen),
        'timestamp', extract(epoch from now())
    );

    PERFORM pg_notify('supplier_quotation_changes', notification_payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function for purchase_orders notifications
CREATE OR REPLACE FUNCTION notify_purchase_order_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    notification_payload := json_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'id', COALESCE(NEW.id, OLD.id),
        'order_number', COALESCE(NEW.order_number, OLD.order_number),
        'purchase_request_id', COALESCE(NEW.purchase_request_id, OLD.purchase_request_id),
        'supplier_id', COALESCE(NEW.supplier_id, OLD.supplier_id),
        'status', COALESCE(NEW.status, OLD.status),
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'total_value', COALESCE(NEW.total_value, OLD.total_value),
        'approved_by', COALESCE(NEW.approved_by, OLD.approved_by),
        'timestamp', extract(epoch from now()),
        'updated_at', COALESCE(NEW.updated_at, OLD.updated_at)
    );

    PERFORM pg_notify('purchase_order_changes', notification_payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function for receipts notifications
CREATE OR REPLACE FUNCTION notify_receipt_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    notification_payload := json_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'id', COALESCE(NEW.id, OLD.id),
        'receipt_number', COALESCE(NEW.receipt_number, OLD.receipt_number),
        'purchase_order_id', COALESCE(NEW.purchase_order_id, OLD.purchase_order_id),
        'status', COALESCE(NEW.status, OLD.status),
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'received_by', COALESCE(NEW.received_by, OLD.received_by),
        'quality_approved', COALESCE(NEW.quality_approved, OLD.quality_approved),
        'timestamp', extract(epoch from now())
    );

    PERFORM pg_notify('receipt_changes', notification_payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS CREATION
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS purchase_request_notify_trigger ON purchase_requests;
DROP TRIGGER IF EXISTS quotation_notify_trigger ON quotations;
DROP TRIGGER IF EXISTS supplier_quotation_notify_trigger ON supplier_quotations;
DROP TRIGGER IF EXISTS purchase_order_notify_trigger ON purchase_orders;
DROP TRIGGER IF EXISTS receipt_notify_trigger ON receipts;

-- Create triggers for purchase_requests
CREATE TRIGGER purchase_request_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION notify_purchase_request_change();

-- Create triggers for quotations
CREATE TRIGGER quotation_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON quotations
    FOR EACH ROW EXECUTE FUNCTION notify_quotation_change();

-- Create triggers for supplier_quotations
CREATE TRIGGER supplier_quotation_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON supplier_quotations
    FOR EACH ROW EXECUTE FUNCTION notify_supplier_quotation_change();

-- Create triggers for purchase_orders
CREATE TRIGGER purchase_order_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION notify_purchase_order_change();

-- Create triggers for receipts
CREATE TRIGGER receipt_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON receipts
    FOR EACH ROW EXECUTE FUNCTION notify_receipt_change();

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Indexes for purchase_requests (if not already exist)
CREATE INDEX IF NOT EXISTS idx_purchase_requests_current_phase ON purchase_requests(current_phase);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_company_phase ON purchase_requests(company_id, current_phase);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requester ON purchase_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_updated_at ON purchase_requests(updated_at DESC);

-- Indexes for quotations
CREATE INDEX IF NOT EXISTS idx_quotations_purchase_request ON quotations(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_active ON quotations(is_active);

-- Indexes for supplier_quotations
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_quotation ON supplier_quotations(quotation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_supplier ON supplier_quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_status ON supplier_quotations(status);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_chosen ON supplier_quotations(is_chosen);

-- Indexes for purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_request ON purchase_orders(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- Indexes for receipts
CREATE INDEX IF NOT EXISTS idx_receipts_purchase_order ON receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_received_by ON receipts(received_by);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION notify_purchase_request_change() IS 'Trigger function to notify purchase request changes via PostgreSQL LISTEN/NOTIFY';
COMMENT ON FUNCTION notify_quotation_change() IS 'Trigger function to notify quotation changes via PostgreSQL LISTEN/NOTIFY';
COMMENT ON FUNCTION notify_supplier_quotation_change() IS 'Trigger function to notify supplier quotation changes via PostgreSQL LISTEN/NOTIFY';
COMMENT ON FUNCTION notify_purchase_order_change() IS 'Trigger function to notify purchase order changes via PostgreSQL LISTEN/NOTIFY';
COMMENT ON FUNCTION notify_receipt_change() IS 'Trigger function to notify receipt changes via PostgreSQL LISTEN/NOTIFY';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify triggers are created
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_schema = 'public' 
-- AND trigger_name LIKE '%notify_trigger';

-- Test notification (uncomment to test)
-- LISTEN purchase_request_changes;
-- UPDATE purchase_requests SET current_phase = 'cotacao' WHERE id = 1;