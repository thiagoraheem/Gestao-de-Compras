-- Migration: 0015_fix_quantity_triggers.sql
-- Description: Corrige funções/trigger de ajuste de quantidade em supplier_quotation_items
-- Issue: Funções referenciavam colunas inexistentes (quantity, unit) em supplier_quotation_items

BEGIN;

-- Corrigir função de log de ajuste de quantidade
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
      (audit_context ->> 'user_id')::INTEGER,
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
      (audit_context ->> 'user_id')::INTEGER,
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

-- Corrigir função atômica de atualização de quantidades
CREATE OR REPLACE FUNCTION atomic_update_supplier_quotation_quantities(
    p_supplier_quotation_id INTEGER,
    p_items JSONB,
    p_user_id INTEGER,
    p_session_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB := '{"success": true, "updated_items": [], "errors": []}'::JSONB;
    v_item JSONB;
    v_existing_item RECORD;
    v_updated_item RECORD;
    v_transaction_id UUID := gen_random_uuid();
    v_supplier_quotation RECORD;
    v_error_count INTEGER := 0;
    v_success_count INTEGER := 0;
    v_fulfillment_percentage NUMERIC := 0;
    v_previous_quantity NUMERIC := 0;
    v_new_quantity NUMERIC := 0;
    v_base_quantity NUMERIC := 0;
    v_severity_level TEXT;
BEGIN
    SELECT * INTO v_supplier_quotation 
    FROM supplier_quotations 
    WHERE id = p_supplier_quotation_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Supplier quotation not found', 'error_code', 'QUOTATION_NOT_FOUND');
    END IF;

    INSERT INTO detailed_audit_log (table_name, record_id, operation_type, user_id, transaction_id, session_id, ip_address, user_agent, change_reason, metadata)
    VALUES ('supplier_quotation_items', p_supplier_quotation_id, 'BULK_UPDATE', p_user_id, v_transaction_id, p_session_id, p_ip_address, p_user_agent,
            'Atomic quantity update operation started', jsonb_build_object('operation', 'atomic_update_quantities', 'items_count', jsonb_array_length(p_items), 'supplier_quotation_id', p_supplier_quotation_id));

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        BEGIN
            IF NOT (v_item ? 'id') OR (v_item->>'id') IS NULL THEN
                v_result := jsonb_set(v_result, '{errors}', (v_result->'errors') || jsonb_build_object('item', v_item, 'error', 'Item ID is required'));
                v_error_count := v_error_count + 1;
                CONTINUE;
            END IF;

            SELECT * INTO v_existing_item
            FROM supplier_quotation_items
            WHERE id = (v_item->>'id')::INTEGER
              AND supplier_quotation_id = p_supplier_quotation_id;
            IF NOT FOUND THEN
                v_result := jsonb_set(v_result, '{errors}', (v_result->'errors') || jsonb_build_object('item_id', v_item->>'id', 'error', 'Supplier quotation item not found'));
                v_error_count := v_error_count + 1;
                CONTINUE;
            END IF;

            SELECT qi.quantity INTO v_base_quantity FROM quotation_items qi WHERE qi.id = v_existing_item.quotation_item_id;
            v_previous_quantity := COALESCE(v_existing_item.available_quantity, 0);
            v_new_quantity := COALESCE((v_item->>'availableQuantity')::DECIMAL, v_previous_quantity);

            IF COALESCE(v_base_quantity, 0) > 0 THEN
                v_fulfillment_percentage := ROUND((v_new_quantity / v_base_quantity) * 100);
            ELSE
                v_fulfillment_percentage := 0;
            END IF;

            v_severity_level := CASE
                WHEN ABS(v_new_quantity - v_previous_quantity) = 0 THEN 'INFO'
                WHEN ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) <= 0.1 THEN 'LOW'
                WHEN ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) <= 0.3 THEN 'MEDIUM'
                WHEN ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) <= 0.5 THEN 'HIGH'
                ELSE 'CRITICAL'
            END;

            UPDATE supplier_quotation_items
            SET 
                available_quantity = v_new_quantity,
                confirmed_unit = COALESCE(v_item->>'confirmedUnit', confirmed_unit),
                quantity_adjustment_reason = COALESCE(v_item->>'quantityAdjustmentReason', quantity_adjustment_reason),
                fulfillment_percentage = v_fulfillment_percentage,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (v_item->>'id')::INTEGER
            RETURNING * INTO v_updated_item;

            IF v_new_quantity != v_previous_quantity THEN
                INSERT INTO quantity_adjustment_history (
                    supplier_quotation_item_id, quotation_id, supplier_id,
                    previous_quantity, new_quantity,
                    previous_unit, new_unit,
                    adjustment_reason, adjusted_by, adjusted_at,
                    previous_total_value, new_total_value,
                    severity_level
                ) VALUES (
                    v_updated_item.id,
                    v_supplier_quotation.quotation_id,
                    v_supplier_quotation.supplier_id,
                    v_previous_quantity,
                    v_new_quantity,
                    v_existing_item.confirmed_unit,
                    v_updated_item.confirmed_unit,
                    COALESCE(v_item->>'quantityAdjustmentReason', 'Quantity updated via atomic operation'),
                    p_user_id,
                    CURRENT_TIMESTAMP,
                    v_previous_quantity * COALESCE(v_existing_item.unit_price, 0),
                    v_new_quantity * COALESCE(v_existing_item.unit_price, 0),
                    v_severity_level
                );
            END IF;

            v_result := jsonb_set(v_result, '{updated_items}', (v_result->'updated_items') || to_jsonb(v_updated_item));
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_result := jsonb_set(v_result, '{errors}', (v_result->'errors') || jsonb_build_object('item_id', v_item->>'id', 'error', SQLERRM, 'sqlstate', SQLSTATE));
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    INSERT INTO detailed_audit_log (table_name, record_id, operation_type, user_id, transaction_id, session_id, ip_address, user_agent, change_reason, metadata)
    VALUES ('supplier_quotation_items', p_supplier_quotation_id, 'BULK_UPDATE_COMPLETE', p_user_id, v_transaction_id, p_session_id, p_ip_address, p_user_agent,
            format('Atomic quantity update completed: %s success, %s errors', v_success_count, v_error_count), jsonb_build_object('success_count', v_success_count, 'error_count', v_error_count, 'total_items', jsonb_array_length(p_items), 'transaction_id', v_transaction_id));

    v_result := jsonb_set(v_result, '{success}', to_jsonb(v_error_count = 0));
    v_result := jsonb_set(v_result, '{transaction_id}', to_jsonb(v_transaction_id));
    v_result := jsonb_set(v_result, '{summary}', jsonb_build_object('total_items', jsonb_array_length(p_items), 'success_count', v_success_count, 'error_count', v_error_count));

    RETURN v_result;
END;
$$;

COMMIT;

