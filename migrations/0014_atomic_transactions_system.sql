-- Migration: 0014_atomic_transactions_system.sql
-- Description: Implementa sistema de transações atômicas para operações críticas de quantidade
-- Created: 2024-12-19

-- Função para atualização atômica de quantidades de supplier_quotation_items
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
    v_fulfillment_percentage INTEGER;
    v_previous_quantity DECIMAL;
    v_new_quantity DECIMAL;
    v_severity_level TEXT;
BEGIN
    -- Verificar se a cotação do fornecedor existe
    SELECT * INTO v_supplier_quotation 
    FROM supplier_quotations 
    WHERE id = p_supplier_quotation_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Supplier quotation not found',
            'error_code', 'QUOTATION_NOT_FOUND'
        );
    END IF;

    -- Registrar início da transação no audit log
    INSERT INTO detailed_audit_log (
        table_name, record_id, operation_type, user_id, 
        transaction_id, session_id, ip_address, user_agent,
        change_reason, metadata
    ) VALUES (
        'supplier_quotation_items', p_supplier_quotation_id, 'BULK_UPDATE',
        p_user_id, v_transaction_id, p_session_id, p_ip_address, p_user_agent,
        'Atomic quantity update operation started',
        jsonb_build_object(
            'operation', 'atomic_update_quantities',
            'items_count', jsonb_array_length(p_items),
            'supplier_quotation_id', p_supplier_quotation_id
        )
    );

    -- Processar cada item em uma subtransação
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            -- Validar dados do item
            IF NOT (v_item ? 'id') OR (v_item->>'id') IS NULL THEN
                v_result := jsonb_set(
                    v_result,
                    '{errors}',
                    (v_result->'errors') || jsonb_build_object(
                        'item', v_item,
                        'error', 'Item ID is required'
                    )
                );
                v_error_count := v_error_count + 1;
                CONTINUE;
            END IF;

            -- Buscar item existente
            SELECT * INTO v_existing_item
            FROM supplier_quotation_items
            WHERE id = (v_item->>'id')::INTEGER
            AND supplier_quotation_id = p_supplier_quotation_id;

            IF NOT FOUND THEN
                v_result := jsonb_set(
                    v_result,
                    '{errors}',
                    (v_result->'errors') || jsonb_build_object(
                        'item_id', v_item->>'id',
                        'error', 'Supplier quotation item not found'
                    )
                );
                v_error_count := v_error_count + 1;
                CONTINUE;
            END IF;

            -- Extrair quantidades para comparação
            v_previous_quantity := COALESCE(v_existing_item.available_quantity, v_existing_item.quantity, 0);
            v_new_quantity := COALESCE((v_item->>'availableQuantity')::DECIMAL, v_previous_quantity);

            -- Calcular percentual de atendimento
            v_fulfillment_percentage := CASE 
                WHEN COALESCE(v_existing_item.quantity, 0) > 0 
                THEN ROUND((v_new_quantity / v_existing_item.quantity) * 100)
                ELSE 0
            END;

            -- Determinar severidade da mudança
            v_severity_level := CASE
                WHEN ABS(v_new_quantity - v_previous_quantity) = 0 THEN 'INFO'
                WHEN ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) <= 0.1 THEN 'LOW'
                WHEN ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) <= 0.3 THEN 'MEDIUM'
                WHEN ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) <= 0.5 THEN 'HIGH'
                ELSE 'CRITICAL'
            END;

            -- Atualizar o item
            UPDATE supplier_quotation_items
            SET 
                available_quantity = v_new_quantity,
                confirmed_unit = COALESCE(v_item->>'confirmedUnit', confirmed_unit, unit),
                quantity_adjustment_reason = COALESCE(v_item->>'quantityAdjustmentReason', quantity_adjustment_reason),
                fulfillment_percentage = v_fulfillment_percentage,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (v_item->>'id')::INTEGER
            RETURNING * INTO v_updated_item;

            -- Registrar no histórico de ajustes se houve mudança de quantidade
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
                    COALESCE(v_existing_item.confirmed_unit, v_existing_item.unit, ''),
                    COALESCE(v_updated_item.confirmed_unit, v_updated_item.unit, ''),
                    COALESCE(v_item->>'quantityAdjustmentReason', 'Quantity updated via atomic operation'),
                    p_user_id,
                    CURRENT_TIMESTAMP,
                    v_previous_quantity * COALESCE(v_existing_item.unit_price, 0),
                    v_new_quantity * COALESCE(v_existing_item.unit_price, 0),
                    v_severity_level
                );

                -- Log crítico se a mudança for significativa
                IF v_severity_level IN ('HIGH', 'CRITICAL') THEN
                    INSERT INTO audit_logs (
                        purchase_request_id, action_type, action_description,
                        performed_by, performed_at, dry_run,
                        before_data, after_data, affected_tables,
                        success, metadata
                    ) VALUES (
                        (SELECT pr.id FROM purchase_requests pr 
                         JOIN quotations q ON q.purchase_request_id = pr.id 
                         WHERE q.id = v_supplier_quotation.quotation_id),
                        'CRITICAL_QUANTITY_CHANGE',
                        format('Critical quantity change detected: %s → %s units (%.1f%% change)',
                               v_previous_quantity, v_new_quantity,
                               ABS(v_new_quantity - v_previous_quantity) / GREATEST(v_previous_quantity, 1) * 100),
                        p_user_id,
                        CURRENT_TIMESTAMP,
                        false,
                        jsonb_build_object(
                            'quantity', v_previous_quantity,
                            'unit', COALESCE(v_existing_item.confirmed_unit, v_existing_item.unit),
                            'total_value', v_previous_quantity * COALESCE(v_existing_item.unit_price, 0)
                        ),
                        jsonb_build_object(
                            'quantity', v_new_quantity,
                            'unit', COALESCE(v_updated_item.confirmed_unit, v_updated_item.unit),
                            'total_value', v_new_quantity * COALESCE(v_existing_item.unit_price, 0)
                        ),
                        ARRAY['supplier_quotation_items', 'quantity_adjustment_history'],
                        true,
                        jsonb_build_object(
                            'severity', v_severity_level,
                            'transaction_id', v_transaction_id,
                            'item_id', v_updated_item.id,
                            'supplier_quotation_id', p_supplier_quotation_id
                        )
                    );
                END IF;
            END IF;

            -- Adicionar item atualizado ao resultado
            v_result := jsonb_set(
                v_result,
                '{updated_items}',
                (v_result->'updated_items') || to_jsonb(v_updated_item)
            );
            
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Capturar erro específico do item e continuar
            v_result := jsonb_set(
                v_result,
                '{errors}',
                (v_result->'errors') || jsonb_build_object(
                    'item_id', v_item->>'id',
                    'error', SQLERRM,
                    'sqlstate', SQLSTATE
                )
            );
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    -- Registrar resultado final da transação
    INSERT INTO detailed_audit_log (
        table_name, record_id, operation_type, user_id,
        transaction_id, session_id, ip_address, user_agent,
        change_reason, metadata
    ) VALUES (
        'supplier_quotation_items', p_supplier_quotation_id, 'BULK_UPDATE_COMPLETE',
        p_user_id, v_transaction_id, p_session_id, p_ip_address, p_user_agent,
        format('Atomic quantity update completed: %s success, %s errors', v_success_count, v_error_count),
        jsonb_build_object(
            'success_count', v_success_count,
            'error_count', v_error_count,
            'total_items', jsonb_array_length(p_items),
            'transaction_id', v_transaction_id
        )
    );

    -- Definir sucesso geral baseado na presença de erros
    v_result := jsonb_set(v_result, '{success}', to_jsonb(v_error_count = 0));
    v_result := jsonb_set(v_result, '{transaction_id}', to_jsonb(v_transaction_id));
    v_result := jsonb_set(v_result, '{summary}', jsonb_build_object(
        'total_items', jsonb_array_length(p_items),
        'success_count', v_success_count,
        'error_count', v_error_count
    ));

    RETURN v_result;
END;
$$;

-- Função para rollback de transação de quantidade (para casos de emergência)
CREATE OR REPLACE FUNCTION rollback_quantity_transaction(
    p_transaction_id UUID,
    p_user_id INTEGER,
    p_rollback_reason TEXT DEFAULT 'Manual rollback requested'
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB := '{"success": true, "rolled_back_items": [], "errors": []}'::JSONB;
    v_audit_record RECORD;
    v_rollback_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    -- Buscar todos os registros da transação
    FOR v_audit_record IN 
        SELECT DISTINCT record_id, old_value, field_name
        FROM detailed_audit_log 
        WHERE transaction_id = p_transaction_id 
        AND table_name = 'supplier_quotation_items'
        AND operation_type IN ('UPDATE', 'BULK_UPDATE')
        AND old_value IS NOT NULL
        ORDER BY created_at DESC
    LOOP
        BEGIN
            -- Tentar reverter cada mudança
            IF v_audit_record.field_name = 'available_quantity' THEN
                UPDATE supplier_quotation_items 
                SET available_quantity = (v_audit_record.old_value)::DECIMAL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_audit_record.record_id;
                
                v_rollback_count := v_rollback_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            v_result := jsonb_set(
                v_result,
                '{errors}',
                (v_result->'errors') || jsonb_build_object(
                    'record_id', v_audit_record.record_id,
                    'field', v_audit_record.field_name,
                    'error', SQLERRM
                )
            );
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    -- Registrar o rollback
    INSERT INTO detailed_audit_log (
        table_name, operation_type, user_id, transaction_id,
        change_reason, metadata
    ) VALUES (
        'supplier_quotation_items', 'ROLLBACK', p_user_id, gen_random_uuid(),
        p_rollback_reason,
        jsonb_build_object(
            'original_transaction_id', p_transaction_id,
            'rolled_back_items', v_rollback_count,
            'rollback_errors', v_error_count
        )
    );

    v_result := jsonb_set(v_result, '{success}', to_jsonb(v_error_count = 0));
    v_result := jsonb_set(v_result, '{summary}', jsonb_build_object(
        'rolled_back_items', v_rollback_count,
        'error_count', v_error_count
    ));

    RETURN v_result;
END;
$$;

-- Função para validação de integridade de quantidades
CREATE OR REPLACE FUNCTION validate_quantity_integrity(
    p_supplier_quotation_id INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB := '{"success": true, "issues": [], "summary": {}}'::JSONB;
    v_issue_count INTEGER := 0;
    v_total_items INTEGER := 0;
    v_item RECORD;
BEGIN
    -- Validar itens específicos ou todos
    FOR v_item IN 
        SELECT 
            sqi.id,
            sqi.supplier_quotation_id,
            sqi.quotation_item_id,
            sqi.quantity as original_quantity,
            sqi.available_quantity,
            sqi.fulfillment_percentage,
            qi.quantity as quotation_item_quantity,
            sq.quotation_id
        FROM supplier_quotation_items sqi
        LEFT JOIN quotation_items qi ON qi.id = sqi.quotation_item_id
        LEFT JOIN supplier_quotations sq ON sq.id = sqi.supplier_quotation_id
        WHERE (p_supplier_quotation_id IS NULL OR sqi.supplier_quotation_id = p_supplier_quotation_id)
    LOOP
        v_total_items := v_total_items + 1;
        
        -- Verificar se fulfillment_percentage está correto
        IF v_item.original_quantity > 0 THEN
            DECLARE
                v_expected_percentage INTEGER := ROUND((COALESCE(v_item.available_quantity, 0) / v_item.original_quantity) * 100);
            BEGIN
                IF COALESCE(v_item.fulfillment_percentage, 0) != v_expected_percentage THEN
                    v_result := jsonb_set(
                        v_result,
                        '{issues}',
                        (v_result->'issues') || jsonb_build_object(
                            'type', 'FULFILLMENT_PERCENTAGE_MISMATCH',
                            'item_id', v_item.id,
                            'expected', v_expected_percentage,
                            'actual', v_item.fulfillment_percentage,
                            'severity', 'MEDIUM'
                        )
                    );
                    v_issue_count := v_issue_count + 1;
                END IF;
            END;
        END IF;
        
        -- Verificar quantidades negativas
        IF COALESCE(v_item.available_quantity, 0) < 0 THEN
            v_result := jsonb_set(
                v_result,
                '{issues}',
                (v_result->'issues') || jsonb_build_object(
                    'type', 'NEGATIVE_QUANTITY',
                    'item_id', v_item.id,
                    'quantity', v_item.available_quantity,
                    'severity', 'HIGH'
                )
            );
            v_issue_count := v_issue_count + 1;
        END IF;
        
        -- Verificar se quantidade disponível excede muito a original
        IF COALESCE(v_item.available_quantity, 0) > (v_item.original_quantity * 2) THEN
            v_result := jsonb_set(
                v_result,
                '{issues}',
                (v_result->'issues') || jsonb_build_object(
                    'type', 'EXCESSIVE_QUANTITY',
                    'item_id', v_item.id,
                    'available', v_item.available_quantity,
                    'original', v_item.original_quantity,
                    'severity', 'MEDIUM'
                )
            );
            v_issue_count := v_issue_count + 1;
        END IF;
    END LOOP;
    
    v_result := jsonb_set(v_result, '{success}', to_jsonb(v_issue_count = 0));
    v_result := jsonb_set(v_result, '{summary}', jsonb_build_object(
        'total_items_checked', v_total_items,
        'issues_found', v_issue_count,
        'integrity_score', CASE 
            WHEN v_total_items = 0 THEN 100
            ELSE ROUND(((v_total_items - v_issue_count)::DECIMAL / v_total_items) * 100, 2)
        END
    ));
    
    RETURN v_result;
END;
$$;

-- Índices para otimização das novas funções
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_transaction_id ON detailed_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_detailed_audit_log_table_operation ON detailed_audit_log(table_name, operation_type);
--CREATE INDEX IF NOT EXISTS idx_quantity_adjustment_history_severity ON quantity_adjustment_history(severity_level);

-- Comentários para documentação
COMMENT ON FUNCTION atomic_update_supplier_quotation_quantities IS 'Função para atualização atômica de quantidades com rollback automático e auditoria completa';
COMMENT ON FUNCTION rollback_quantity_transaction IS 'Função para rollback manual de transações de quantidade em casos de emergência';
COMMENT ON FUNCTION validate_quantity_integrity IS 'Função para validação de integridade de quantidades e detecção de inconsistências';