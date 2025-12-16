
-- Fix log_phase_transition function to remove reference to non-existent column affected_tables

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
            after_data
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
            jsonb_build_object('phase', NEW.current_phase)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
