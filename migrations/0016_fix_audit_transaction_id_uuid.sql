-- Migration: 0016_fix_audit_transaction_id_uuid.sql
-- Description: Harmoniza o tipo de transaction_id como UUID e atualiza a função de auditoria
-- Contexto: Erro 42804 ao inserir em detailed_audit_log porque a função usa BIGINT (txid_current)
-- enquanto a coluna transaction_id está como UUID em alguns ambientes

BEGIN;

-- Extensão necessária para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garantir que a coluna tenha tipo UUID (sem falhar se já for UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'detailed_audit_log'
      AND column_name = 'transaction_id'
      AND data_type <> 'uuid'
  ) THEN
    EXECUTE 'ALTER TABLE detailed_audit_log ALTER COLUMN transaction_id TYPE UUID USING gen_random_uuid()';
  END IF;
END $$;

-- Atualizar a função audit_trigger_function para usar UUID em transaction_id
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_context JSONB;
    old_record JSONB;
    new_record JSONB;
    field_name TEXT;
    old_val TEXT;
    new_val TEXT;
    current_tx BIGINT;
    current_tx_uuid UUID;
BEGIN
    audit_context := get_audit_context();
    current_tx := txid_current();
    current_tx_uuid := gen_random_uuid();

    IF TG_OP = 'DELETE' THEN
        old_record := to_jsonb(OLD);
        new_record := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_record := NULL;
        new_record := to_jsonb(NEW);
    ELSE
        old_record := to_jsonb(OLD);
        new_record := to_jsonb(NEW);
    END IF;

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
                current_tx_uuid,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation','field_insert','table',TG_TABLE_NAME,'txid_current',current_tx)
            );
        END LOOP;
    END IF;

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
                current_tx_uuid,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation','field_delete','table',TG_TABLE_NAME,'txid_current',current_tx)
            );
        END LOOP;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        FOR field_name IN SELECT key FROM jsonb_each_text(new_record) LOOP
            old_val := old_record ->> field_name;
            new_val := new_record ->> field_name;
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
                    current_tx_uuid,
                    audit_context ->> 'session_id',
                    (audit_context ->> 'ip_address')::INET,
                    audit_context ->> 'user_agent',
                    jsonb_build_object('operation','field_update','table',TG_TABLE_NAME,'field_type',pg_typeof(old_val)::text,'txid_current',current_tx),
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

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

