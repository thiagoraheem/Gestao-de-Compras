CREATE TABLE IF NOT EXISTS detailed_audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    field_name VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users(id),
    user_id INTEGER,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT,
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    operation_type VARCHAR(50) NOT NULL,
    transaction_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_table_record ON detailed_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_changed_by ON detailed_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_changed_at ON detailed_audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_field_name ON detailed_audit_log(field_name);
