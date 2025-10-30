-- Migration: Enhanced Audit System for Purchase Order Processing
-- Creates detailed audit logging system with automatic triggers for quantity changes

-- Create detailed_audit_log table for comprehensive change tracking
CREATE TABLE IF NOT EXISTS detailed_audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    operation_type VARCHAR(10) NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    transaction_id BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_table_record ON detailed_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_changed_by ON detailed_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_changed_at ON detailed_audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_field_name ON detailed_audit_log(field_name);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_transaction_id ON detailed_audit_log(transaction_id);

-- Function to get current user context
CREATE OR REPLACE FUNCTION get_audit_context()
RETURNS JSONB AS $$
DECLARE
    context JSONB := '{}'::jsonb;
BEGIN
    -- Try to get user ID from session
    BEGIN
        context := context || jsonb_build_object('user_id', 
            COALESCE(current_setting('app.current_user_id', true)::INTEGER, NULL));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('user_id', NULL);
    END;
    
    -- Try to get session ID
    BEGIN
        context := context || jsonb_build_object('session_id', 
            current_setting('app.session_id', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('session_id', NULL);
    END;
    
    -- Try to get IP address
    BEGIN
        context := context || jsonb_build_object('ip_address', 
            current_setting('app.ip_address', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('ip_address', NULL);
    END;
    
    -- Try to get user agent
    BEGIN
        context := context || jsonb_build_object('user_agent', 
            current_setting('app.user_agent', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('user_agent', NULL);
    END;
    
    RETURN context;
END;
$$ LANGUAGE plpgsql;

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_context JSONB;
    old_record JSONB;
    new_record JSONB;
    field_name TEXT;
    old_val TEXT;
    new_val TEXT;
    current_transaction_id BIGINT;
BEGIN
    -- Get audit context
    audit_context := get_audit_context();
    current_transaction_id := txid_current();
    
    -- Convert records to JSONB for comparison
    IF TG_OP = 'DELETE' THEN
        old_record := to_jsonb(OLD);
        new_record := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_record := NULL;
        new_record := to_jsonb(NEW);
    ELSE -- UPDATE
        old_record := to_jsonb(OLD);
        new_record := to_jsonb(NEW);
    END IF;
    
    -- For INSERT operations, log all fields
    IF TG_OP = 'INSERT' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
            new_val := new_record ->> field_name;
            
            INSERT INTO detailed_audit_log (
                table_name, record_id, field_name, old_value, new_value,
                changed_by, operation_type, transaction_id, session_id,
                ip_address, user_agent, metadata
            ) VALUES (
                TG_TABLE_NAME, 
                (new_record ->> 'id')::INTEGER,
                field_name,
                NULL,
                new_val,
                (audit_context ->> 'user_id')::INTEGER,
                TG_OP,
                current_transaction_id,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation', 'field_insert', 'table', TG_TABLE_NAME)
            );
        END LOOP;
    END IF;
    
    -- For DELETE operations, log all fields
    IF TG_OP = 'DELETE' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(old_record) LOOP
            old_val := old_record ->> field_name;
            
            INSERT INTO detailed_audit_log (
                table_name, record_id, field_name, old_value, new_value,
                changed_by, operation_type, transaction_id, session_id,
                ip_address, user_agent, metadata
            ) VALUES (
                TG_TABLE_NAME,
                (old_record ->> 'id')::INTEGER,
                field_name,
                old_val,
                NULL,
                (audit_context ->> 'user_id')::INTEGER,
                TG_OP,
                current_transaction_id,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation', 'field_delete', 'table', TG_TABLE_NAME)
            );
        END LOOP;
    END IF;
    
    -- For UPDATE operations, log only changed fields
    IF TG_OP = 'UPDATE' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
            old_val := old_record ->> field_name;
            new_val := new_record ->> field_name;
            
            -- Only log if values are different
            IF old_val IS DISTINCT FROM new_val THEN
                INSERT INTO detailed_audit_log (
                    table_name, record_id, field_name, old_value, new_value,
                    changed_by, operation_type, transaction_id, session_id,
                    ip_address, user_agent, metadata, change_reason
                ) VALUES (
                    TG_TABLE_NAME,
                    (new_record ->> 'id')::INTEGER,
                    field_name,
                    old_val,
                    new_val,
                    (audit_context ->> 'user_id')::INTEGER,
                    TG_OP,
                    current_transaction_id,
                    audit_context ->> 'session_id',
                    (audit_context ->> 'ip_address')::INET,
                    audit_context ->> 'user_agent',
                    jsonb_build_object(
                        'operation', 'field_update', 
                        'table', TG_TABLE_NAME,
                        'field_type', pg_typeof(old_val)::text
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
    
    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for critical tables
CREATE TRIGGER audit_purchase_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_purchase_request_items_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_request_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_quotation_items_trigger
    AFTER INSERT OR UPDATE OR DELETE ON quotation_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_supplier_quotation_items_trigger
    AFTER INSERT OR UPDATE OR DELETE ON supplier_quotation_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_purchase_order_items_trigger
    AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_approval_history_trigger
    AFTER INSERT OR UPDATE OR DELETE ON approval_history
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Enhanced quantity adjustment logging function
CREATE OR REPLACE FUNCTION enhanced_log_quantity_adjustment()
RETURNS TRIGGER AS $$
DECLARE
    audit_context JSONB;
    quotation_info RECORD;
    adjustment_severity TEXT;
    percentage_change DECIMAL;
BEGIN
    -- Get audit context
    audit_context := get_audit_context();
    
    -- Only proceed if quantity-related fields have changed
    IF (OLD.available_quantity IS DISTINCT FROM NEW.available_quantity) OR 
       (OLD.quantity IS DISTINCT FROM NEW.quantity) OR
       (OLD.confirmed_unit IS DISTINCT FROM NEW.confirmed_unit) THEN
        
        -- Get quotation information for context
        SELECT q.id, q.request_number, pr.request_number as pr_number, s.name as supplier_name
        INTO quotation_info
        FROM supplier_quotations sq
        JOIN quotations q ON q.id = sq.quotation_id
        JOIN purchase_requests pr ON pr.id = q.purchase_request_id
        JOIN suppliers s ON s.id = sq.supplier_id
        WHERE sq.id = NEW.supplier_quotation_id;
        
        -- Calculate severity of change
        IF OLD.available_quantity IS NOT NULL AND NEW.available_quantity IS NOT NULL THEN
            percentage_change := ABS((NEW.available_quantity - OLD.available_quantity) / OLD.available_quantity * 100);
            
            IF percentage_change > 50 THEN
                adjustment_severity := 'HIGH';
            ELSIF percentage_change > 20 THEN
                adjustment_severity := 'MEDIUM';
            ELSE
                adjustment_severity := 'LOW';
            END IF;
        ELSE
            adjustment_severity := 'UNKNOWN';
        END IF;
        
        -- Enhanced logging in quantity_adjustment_history
        INSERT INTO quantity_adjustment_history (
            supplier_quotation_item_id,
            quotation_id,
            supplier_id,
            previous_quantity,
            new_quantity,
            previous_unit,
            new_unit,
            adjustment_reason,
            adjusted_by,
            previous_total_value,
            new_total_value
        )
        SELECT 
            NEW.id,
            sq.quotation_id,
            sq.supplier_id,
            COALESCE(OLD.available_quantity, OLD.quantity),
            COALESCE(NEW.available_quantity, NEW.quantity),
            OLD.confirmed_unit,
            NEW.confirmed_unit,
            COALESCE(NEW.quantity_adjustment_reason, 'System adjustment'),
            (audit_context ->> 'user_id')::INTEGER,
            OLD.total_price,
            NEW.total_price
        FROM supplier_quotations sq
        WHERE sq.id = NEW.supplier_quotation_id;
        
        -- Log critical quantity changes in audit_logs for high-level tracking
        IF adjustment_severity IN ('HIGH', 'MEDIUM') THEN
            INSERT INTO audit_logs (
                purchase_request_id,
                action_type,
                action_description,
                performed_by,
                before_data,
                after_data,
                affected_tables,
                metadata
            )
            SELECT 
                pr.id,
                'QUANTITY_ADJUSTMENT',
                format('Critical quantity adjustment: %s → %s units (%.2f%% change) for supplier %s',
                    COALESCE(OLD.available_quantity, OLD.quantity),
                    COALESCE(NEW.available_quantity, NEW.quantity),
                    percentage_change,
                    quotation_info.supplier_name
                ),
                (audit_context ->> 'user_id')::INTEGER,
                jsonb_build_object(
                    'old_quantity', COALESCE(OLD.available_quantity, OLD.quantity),
                    'old_unit', OLD.confirmed_unit,
                    'old_total_price', OLD.total_price
                ),
                jsonb_build_object(
                    'new_quantity', COALESCE(NEW.available_quantity, NEW.quantity),
                    'new_unit', NEW.confirmed_unit,
                    'new_total_price', NEW.total_price
                ),
                ARRAY['supplier_quotation_items', 'quantity_adjustment_history'],
                jsonb_build_object(
                    'severity', adjustment_severity,
                    'percentage_change', percentage_change,
                    'quotation_id', quotation_info.id,
                    'supplier_name', quotation_info.supplier_name,
                    'request_number', quotation_info.pr_number,
                    'session_id', audit_context ->> 'session_id'
                )
            FROM quotations q
            JOIN purchase_requests pr ON pr.id = q.purchase_request_id
            WHERE q.id = quotation_info.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace existing quantity adjustment trigger with enhanced version
DROP TRIGGER IF EXISTS trigger_log_quantity_adjustment ON supplier_quotation_items;
CREATE TRIGGER trigger_enhanced_log_quantity_adjustment
    AFTER UPDATE ON supplier_quotation_items
    FOR EACH ROW
    EXECUTE FUNCTION enhanced_log_quantity_adjustment();

-- Function to track phase transitions
CREATE OR REPLACE FUNCTION log_phase_transition()
RETURNS TRIGGER AS $$
DECLARE
    audit_context JSONB;
BEGIN
    -- Get audit context
    audit_context := get_audit_context();
    
    -- Log phase changes
    IF OLD.current_phase IS DISTINCT FROM NEW.current_phase THEN
        INSERT INTO audit_logs (
            purchase_request_id,
            action_type,
            action_description,
            performed_by,
            before_data,
            after_data,
            affected_tables,
            metadata
        ) VALUES (
            NEW.id,
            'PHASE_TRANSITION',
            format('Phase changed from %s to %s for request %s',
                OLD.current_phase,
                NEW.current_phase,
                NEW.request_number
            ),
            (audit_context ->> 'user_id')::INTEGER,
            jsonb_build_object('phase', OLD.current_phase),
            jsonb_build_object('phase', NEW.current_phase),
            ARRAY['purchase_requests'],
            jsonb_build_object(
                'request_number', NEW.request_number,
                'transition_timestamp', NOW(),
                'session_id', audit_context ->> 'session_id'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for phase transitions
CREATE TRIGGER trigger_log_phase_transition
    AFTER UPDATE ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION log_phase_transition();

-- Add comments for documentation
COMMENT ON TABLE detailed_audit_log IS 'Sistema de auditoria detalhado para rastreamento completo de alterações em campos específicos';
COMMENT ON COLUMN detailed_audit_log.table_name IS 'Nome da tabela onde ocorreu a alteração';
COMMENT ON COLUMN detailed_audit_log.record_id IS 'ID do registro alterado';
COMMENT ON COLUMN detailed_audit_log.field_name IS 'Nome do campo alterado';
COMMENT ON COLUMN detailed_audit_log.old_value IS 'Valor anterior do campo';
COMMENT ON COLUMN detailed_audit_log.new_value IS 'Novo valor do campo';
COMMENT ON COLUMN detailed_audit_log.operation_type IS 'Tipo de operação (INSERT, UPDATE, DELETE)';
COMMENT ON COLUMN detailed_audit_log.transaction_id IS 'ID da transação para agrupamento de alterações relacionadas';
COMMENT ON COLUMN detailed_audit_log.metadata IS 'Metadados adicionais sobre a alteração';

-- Create view for quantity adjustment analysis
CREATE OR REPLACE VIEW quantity_adjustment_analysis AS
SELECT 
    qah.id,
    qah.quotation_id,
    pr.request_number,
    s.name as supplier_name,
    qah.previous_quantity,
    qah.new_quantity,
    (qah.new_quantity - qah.previous_quantity) as quantity_difference,
    CASE 
        WHEN qah.previous_quantity > 0 THEN 
            ROUND(((qah.new_quantity - qah.previous_quantity) / qah.previous_quantity * 100), 2)
        ELSE NULL 
    END as percentage_change,
    qah.adjustment_reason,
    u.first_name || ' ' || u.last_name as adjusted_by_name,
    qah.adjusted_at,
    CASE 
        WHEN ABS((qah.new_quantity - qah.previous_quantity) / NULLIF(qah.previous_quantity, 0) * 100) > 50 THEN 'HIGH'
        WHEN ABS((qah.new_quantity - qah.previous_quantity) / NULLIF(qah.previous_quantity, 0) * 100) > 20 THEN 'MEDIUM'
        ELSE 'LOW'
    END as severity_level
FROM quantity_adjustment_history qah
JOIN quotations q ON q.id = qah.quotation_id
JOIN purchase_requests pr ON pr.id = q.purchase_request_id
JOIN suppliers s ON s.id = qah.supplier_id
LEFT JOIN users u ON u.id = qah.adjusted_by
ORDER BY qah.adjusted_at DESC;

-- Create view for audit trail summary
CREATE OR REPLACE VIEW audit_trail_summary AS
SELECT 
    dal.table_name,
    dal.record_id,
    COUNT(*) as total_changes,
    COUNT(DISTINCT dal.changed_by) as unique_users,
    MIN(dal.changed_at) as first_change,
    MAX(dal.changed_at) as last_change,
    array_agg(DISTINCT dal.field_name ORDER BY dal.field_name) as changed_fields,
    array_agg(DISTINCT dal.operation_type ORDER BY dal.operation_type) as operations
FROM detailed_audit_log dal
GROUP BY dal.table_name, dal.record_id
ORDER BY MAX(dal.changed_at) DESC;

COMMIT;