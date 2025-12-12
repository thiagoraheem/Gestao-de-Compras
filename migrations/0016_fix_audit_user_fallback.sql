-- Migration: 0016_fix_audit_user_fallback.sql
-- Description: Garantir que adjusted_by e performed_by nunca fiquem nulos nas funções de auditoria
-- Contexto: Correção para erro "null value in column \"adjusted_by\" of relation \"quantity_adjustment_history\""
-- Estratégia: 
-- 1) Atualizar get_audit_context() para sempre preencher 'user_id' com fallback válido
-- 2) Atualizar funções que usam audit_context para usar COALESCE em adjusted_by/performed_by

BEGIN;

-- 1) Atualiza get_audit_context para garantir fallback de user_id
CREATE OR REPLACE FUNCTION get_audit_context()
RETURNS JSONB AS $$
DECLARE
    context JSONB := '{}'::jsonb;
    v_user_id INTEGER;
BEGIN
    -- Tenta obter o usuário corrente da sessão; aplica fallback para um usuário válido (ex.: 1)
    BEGIN
        v_user_id := current_setting('app.current_user_id', true)::INTEGER;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    context := context || jsonb_build_object('user_id', COALESCE(v_user_id, 1));
    
    -- Obtém session_id
    BEGIN
        context := context || jsonb_build_object('session_id', current_setting('app.session_id', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('session_id', NULL);
    END;
    
    -- Obtém ip_address
    BEGIN
        context := context || jsonb_build_object('ip_address', current_setting('app.ip_address', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('ip_address', NULL);
    END;
    
    -- Obtém user_agent
    BEGIN
        context := context || jsonb_build_object('user_agent', current_setting('app.user_agent', true));
    EXCEPTION WHEN OTHERS THEN
        context := context || jsonb_build_object('user_agent', NULL);
    END;
    
    RETURN context;
END;
$$ LANGUAGE plpgsql;

-- 2) Atualiza enhanced_log_quantity_adjustment para aplicar COALESCE no adjusted_by e performed_by
CREATE OR REPLACE FUNCTION enhanced_log_quantity_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  audit_context JSONB;
  previous_qty NUMERIC := COALESCE(OLD.available_quantity, 0);
  new_qty NUMERIC := COALESCE(NEW.available_quantity, 0);
  percentage_change NUMERIC := CASE WHEN previous_qty > 0 THEN ((new_qty - previous_qty) / previous_qty) * 100 ELSE NULL END;
  adjustment_severity TEXT := CASE 
    WHEN percentage_change IS NULL THEN 'UNKNOWN'
    WHEN ABS(percentage_change) > 50 THEN 'HIGH'
    WHEN ABS(percentage_change) > 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END;
  sq RECORD;
BEGIN
  audit_context := get_audit_context();

  IF (OLD.available_quantity IS DISTINCT FROM NEW.available_quantity)
     OR (OLD.confirmed_unit IS DISTINCT FROM NEW.confirmed_unit) THEN

    SELECT * INTO sq FROM supplier_quotations WHERE id = NEW.supplier_quotation_id;

    INSERT INTO quantity_adjustment_history (
      supplier_quotation_item_id, quotation_id, supplier_id,
      previous_quantity, new_quantity,
      previous_unit, new_unit,
      adjustment_reason, adjusted_by, adjusted_at,
      previous_total_value, new_total_value,
      severity_level
    ) VALUES (
      NEW.id,
      sq.quotation_id,
      sq.supplier_id,
      COALESCE(previous_qty, 0),
      COALESCE(new_qty, 0),
      OLD.confirmed_unit,
      NEW.confirmed_unit,
      COALESCE(NEW.quantity_adjustment_reason, 'System adjustment'),
      COALESCE((audit_context ->> 'user_id')::INTEGER, 1),
      NOW(),
      COALESCE(OLD.total_price, 0),
      COALESCE(NEW.total_price, 0),
      adjustment_severity
    );

    INSERT INTO audit_logs (
      purchase_request_id, action_type, action_description,
      performed_by, before_data, after_data, affected_tables, performed_at
    ) VALUES (
      (SELECT pr.id FROM purchase_requests pr 
         JOIN quotations q ON q.purchase_request_id = pr.id 
       WHERE q.id = sq.quotation_id),
      'QUANTITY_ADJUSTMENT',
      format('Quantity adjustment: %s → %s units', COALESCE(previous_qty,0), COALESCE(new_qty,0)),
      COALESCE((audit_context ->> 'user_id')::INTEGER, 1),
      jsonb_build_object(
        'old_quantity', previous_qty,
        'old_unit', OLD.confirmed_unit,
        'old_total_price', OLD.total_price
      ),
      jsonb_build_object(
        'new_quantity', new_qty,
        'new_unit', NEW.confirmed_unit,
        'new_total_price', NEW.total_price
      ),
      ARRAY['supplier_quotation_items', 'quantity_adjustment_history'],
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Atualiza audit_trigger_function para aplicar COALESCE em changed_by
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
    audit_context := get_audit_context();
    current_transaction_id := txid_current();
    
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
                COALESCE((audit_context ->> 'user_id')::INTEGER, 1),
                TG_OP,
                current_transaction_id,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation', 'field_insert', 'table', TG_TABLE_NAME)
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
                COALESCE((audit_context ->> 'user_id')::INTEGER, 1),
                TG_OP,
                current_transaction_id,
                audit_context ->> 'session_id',
                (audit_context ->> 'ip_address')::INET,
                audit_context ->> 'user_agent',
                jsonb_build_object('operation', 'field_delete', 'table', TG_TABLE_NAME)
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
                    COALESCE((audit_context ->> 'user_id')::INTEGER, 1),
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
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;

