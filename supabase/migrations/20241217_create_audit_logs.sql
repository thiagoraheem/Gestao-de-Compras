-- Create audit_logs table for tracking data correction actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    purchase_request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'audit', 'fix_orphaned_items', 'fix_references', 'fix_quantities', etc.
    action_description TEXT NOT NULL,
    performed_by INTEGER REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dry_run BOOLEAN DEFAULT FALSE,
    before_data JSONB,
    after_data JSONB,
    affected_tables TEXT[], -- Array of table names affected
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    metadata JSONB -- Additional context data
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_purchase_request_id ON audit_logs(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT USING (
        -- Only admins and super users can view audit logs
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_super_user = true)
        )
    );

CREATE POLICY "audit_logs_insert_policy" ON audit_logs
    FOR INSERT WITH CHECK (
        -- Only admins and super users can create audit logs
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.is_admin = true OR users.is_super_user = true)
        )
    );

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON audit_logs TO anon;
GRANT ALL PRIVILEGES ON audit_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Logs de auditoria para rastreamento de ações de correção de dados';
COMMENT ON COLUMN audit_logs.action_type IS 'Tipo de ação realizada (audit, fix_orphaned_items, etc.)';
COMMENT ON COLUMN audit_logs.action_description IS 'Descrição detalhada da ação realizada';
COMMENT ON COLUMN audit_logs.dry_run IS 'Indica se foi uma execução de teste (prévia)';
COMMENT ON COLUMN audit_logs.before_data IS 'Estado dos dados antes da correção';
COMMENT ON COLUMN audit_logs.after_data IS 'Estado dos dados após a correção';
COMMENT ON COLUMN audit_logs.affected_tables IS 'Tabelas afetadas pela ação';
COMMENT ON COLUMN audit_logs.metadata IS 'Dados adicionais de contexto da ação';