-- Migration: Add Value-Based A2 Approval System
-- Description: Implements value-based approval rules with dual approval for high-value purchases

-- 1. Add CEO and Director fields to users table
ALTER TABLE users 
ADD COLUMN is_ceo BOOLEAN DEFAULT false,
ADD COLUMN is_director BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_users_ceo ON users(is_ceo) WHERE is_ceo = true;
CREATE INDEX idx_users_director ON users(is_director) WHERE is_director = true;
CREATE INDEX idx_users_approver_a2 ON users(is_approver_a2) WHERE is_approver_a2 = true;

-- Add constraint to prevent conflicting user roles
ALTER TABLE users ADD CONSTRAINT check_user_roles 
CHECK (
    -- Prevent a user from being CEO, Director, and Manager simultaneously
    NOT (is_ceo = true AND is_director = true AND is_manager = true)
);

-- 2. Create approval_configurations table
CREATE TABLE approval_configurations (
    id SERIAL PRIMARY KEY,
    value_threshold DECIMAL(15,2) NOT NULL DEFAULT 2500.00,
    is_active BOOLEAN DEFAULT true,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for approval configurations
CREATE INDEX idx_approval_config_active ON approval_configurations(is_active, effective_date);
CREATE INDEX idx_approval_config_threshold ON approval_configurations(value_threshold);

-- Insert default configuration
INSERT INTO approval_configurations (value_threshold, reason, created_by)
VALUES (2500.00, 'Configuração inicial do sistema - limite padrão para dupla aprovação', 1);

-- 3. Create configuration_history table for audit trail
CREATE TABLE configuration_history (
    id SERIAL PRIMARY KEY,
    configuration_id INTEGER REFERENCES approval_configurations(id),
    change_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'deactivate'
    previous_values JSONB,
    new_values JSONB NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for configuration history
CREATE INDEX idx_config_history_config_id ON configuration_history(configuration_id);
CREATE INDEX idx_config_history_changed_by ON configuration_history(changed_by);
CREATE INDEX idx_config_history_change_type ON configuration_history(change_type);
CREATE INDEX idx_config_history_changed_at ON configuration_history(changed_at DESC);

-- 4. Update purchase_requests table for dual approval support
ALTER TABLE purchase_requests 
ADD COLUMN requires_dual_approval BOOLEAN DEFAULT false,
ADD COLUMN first_approver_a2_id INTEGER REFERENCES users(id),
ADD COLUMN final_approver_id INTEGER REFERENCES users(id),
ADD COLUMN first_approval_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN final_approval_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN approval_configuration_id INTEGER REFERENCES approval_configurations(id);

-- Create indexes for purchase requests dual approval
CREATE INDEX idx_purchase_requests_dual_approval ON purchase_requests(requires_dual_approval);
CREATE INDEX idx_purchase_requests_first_approver ON purchase_requests(first_approver_a2_id);
CREATE INDEX idx_purchase_requests_final_approver ON purchase_requests(final_approver_id);

-- 5. Update approval_history table for enhanced tracking
ALTER TABLE approval_history 
ADD COLUMN approval_step VARCHAR(20) DEFAULT 'single',
ADD COLUMN approval_value DECIMAL(15,2),
ADD COLUMN requires_dual_approval BOOLEAN DEFAULT false,
ADD COLUMN ip_address INET,
ADD COLUMN user_agent TEXT;

-- Create indexes for approval history enhancements
CREATE INDEX idx_approval_history_step ON approval_history(approval_step);
CREATE INDEX idx_approval_history_value ON approval_history(approval_value);
CREATE INDEX idx_approval_history_dual ON approval_history(requires_dual_approval);

-- 6. Create audit trigger function for configuration changes
CREATE OR REPLACE FUNCTION audit_configuration_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO configuration_history (
        configuration_id, 
        change_type, 
        previous_values, 
        new_values, 
        changed_by
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'create'
            WHEN TG_OP = 'UPDATE' THEN 'update'
            WHEN TG_OP = 'DELETE' THEN 'deactivate'
        END,
        CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(NEW.created_by, OLD.created_by)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to approval_configurations table
CREATE TRIGGER trigger_audit_approval_configurations
    AFTER INSERT OR UPDATE OR DELETE ON approval_configurations
    FOR EACH ROW EXECUTE FUNCTION audit_configuration_changes();

-- 7. Create function to automatically determine approval type based on value
CREATE OR REPLACE FUNCTION determine_approval_type(request_value DECIMAL)
RETURNS TABLE(
    requires_dual BOOLEAN,
    threshold_value DECIMAL,
    config_id INTEGER
) AS $$
DECLARE
    current_config RECORD;
BEGIN
    -- Get the current active configuration
    SELECT * INTO current_config
    FROM approval_configurations 
    WHERE is_active = true 
    ORDER BY effective_date DESC 
    LIMIT 1;
    
    -- If no configuration found, use default
    IF current_config IS NULL THEN
        requires_dual := request_value > 2500.00;
        threshold_value := 2500.00;
        config_id := NULL;
    ELSE
        requires_dual := request_value > current_config.value_threshold;
        threshold_value := current_config.value_threshold;
        config_id := current_config.id;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to automatically set approval type when total_value is updated
CREATE OR REPLACE FUNCTION set_approval_type_on_value_change()
RETURNS TRIGGER AS $$
DECLARE
    approval_info RECORD;
BEGIN
    -- Only process if total_value has changed and is not null
    IF NEW.total_value IS NOT NULL AND (OLD.total_value IS NULL OR NEW.total_value != OLD.total_value) THEN
        -- Determine approval type based on value
        SELECT * INTO approval_info FROM determine_approval_type(NEW.total_value);
        
        -- Update the approval fields
        NEW.requires_dual_approval := approval_info.requires_dual;
        NEW.approval_configuration_id := approval_info.config_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to purchase_requests table
CREATE TRIGGER trigger_set_approval_type
    BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION set_approval_type_on_value_change();

-- 9. Grant necessary permissions
-- Grant basic read access to anon role for approval configurations
GRANT SELECT ON approval_configurations TO anon;

-- Grant full access to authenticated role for all new tables
GRANT ALL PRIVILEGES ON approval_configurations TO authenticated;
GRANT ALL PRIVILEGES ON configuration_history TO authenticated;
GRANT ALL PRIVILEGES ON SEQUENCE approval_configurations_id_seq TO authenticated;
GRANT ALL PRIVILEGES ON SEQUENCE configuration_history_id_seq TO authenticated;

-- 10. Add comments for documentation
COMMENT ON TABLE approval_configurations IS 'Stores configurable value thresholds for approval rules';
COMMENT ON TABLE configuration_history IS 'Audit trail for all changes to approval configurations';
COMMENT ON COLUMN users.is_ceo IS 'Indicates if user has CEO role for final approval in dual approval process';
COMMENT ON COLUMN users.is_director IS 'Indicates if user has Director role with Manager-level permissions';
COMMENT ON COLUMN purchase_requests.requires_dual_approval IS 'Automatically set based on total_value and current threshold';
COMMENT ON COLUMN purchase_requests.first_approver_a2_id IS 'First approver in dual approval process (non-CEO A2 approver)';
COMMENT ON COLUMN purchase_requests.final_approver_id IS 'Final approver in dual approval process (typically CEO)';
COMMENT ON COLUMN approval_history.approval_step IS 'Indicates step in approval process: single, first, final';

-- Migration completed successfully