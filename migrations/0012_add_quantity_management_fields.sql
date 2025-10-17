-- Migration: Add quantity management fields to supplier_quotation_items and create quantity_adjustment_history table
-- Adapted for PostgreSQL traditional (removed Supabase-specific features)

-- Add new fields to supplier_quotation_items table
ALTER TABLE supplier_quotation_items 
ADD COLUMN available_quantity DECIMAL(10,3),
ADD COLUMN confirmed_unit TEXT,
ADD COLUMN quantity_adjustment_reason TEXT,
ADD COLUMN fulfillment_percentage DECIMAL(5,2);

-- Create quantity_adjustment_history table for auditing
CREATE TABLE quantity_adjustment_history (
    id SERIAL PRIMARY KEY,
    supplier_quotation_item_id INTEGER NOT NULL REFERENCES supplier_quotation_items(id),
    quotation_id INTEGER NOT NULL REFERENCES quotations(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    previous_quantity DECIMAL(10,3),
    new_quantity DECIMAL(10,3),
    previous_unit TEXT,
    new_unit TEXT,
    adjustment_reason TEXT,
    adjusted_by INTEGER NOT NULL REFERENCES users(id),
    adjusted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    previous_total_value DECIMAL(15,2),
    new_total_value DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create function to calculate fulfillment percentage
CREATE OR REPLACE FUNCTION calculate_fulfillment_percentage()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate fulfillment percentage based on available quantity vs requested quantity
    IF NEW.available_quantity IS NOT NULL THEN
        SELECT 
            CASE 
                WHEN qi.quantity > 0 THEN 
                    ROUND((NEW.available_quantity / qi.quantity) * 100, 2)
                ELSE 0 
            END
        INTO NEW.fulfillment_percentage
        FROM quotation_items qi
        WHERE qi.id = NEW.quotation_item_id;
    END IF;
    
    -- Recalculate total_price based on available quantity if provided
    IF NEW.available_quantity IS NOT NULL AND NEW.unit_price IS NOT NULL THEN
        NEW.total_price = NEW.available_quantity * NEW.unit_price;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate fulfillment percentage and recalculate totals
CREATE TRIGGER trigger_calculate_fulfillment_percentage
    BEFORE INSERT OR UPDATE ON supplier_quotation_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_fulfillment_percentage();

-- Create function to log quantity adjustments
CREATE OR REPLACE FUNCTION log_quantity_adjustment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if quantity-related fields have changed
    IF (OLD.available_quantity IS DISTINCT FROM NEW.available_quantity) OR 
       (OLD.confirmed_unit IS DISTINCT FROM NEW.confirmed_unit) THEN
        
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
            OLD.available_quantity,
            NEW.available_quantity,
            OLD.confirmed_unit,
            NEW.confirmed_unit,
            NEW.quantity_adjustment_reason,
            COALESCE(current_setting('app.current_user_id', true)::INTEGER, 1), -- Default to user 1 if not set
            OLD.total_price,
            NEW.total_price
        FROM supplier_quotations sq
        WHERE sq.id = NEW.supplier_quotation_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to log quantity adjustments
CREATE TRIGGER trigger_log_quantity_adjustment
    AFTER UPDATE ON supplier_quotation_items
    FOR EACH ROW
    EXECUTE FUNCTION log_quantity_adjustment();

-- Create indexes for better performance
CREATE INDEX idx_quantity_adjustment_history_supplier_quotation_item 
ON quantity_adjustment_history(supplier_quotation_item_id);

CREATE INDEX idx_quantity_adjustment_history_quotation 
ON quantity_adjustment_history(quotation_id);

CREATE INDEX idx_quantity_adjustment_history_supplier 
ON quantity_adjustment_history(supplier_id);

CREATE INDEX idx_supplier_quotation_items_available_quantity 
ON supplier_quotation_items(available_quantity) WHERE available_quantity IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE quantity_adjustment_history IS 'Tabela para auditoria de ajustes de quantidade em itens de cotação de fornecedores';
COMMENT ON COLUMN quantity_adjustment_history.supplier_quotation_item_id IS 'ID do item de cotação do fornecedor que foi ajustado';
COMMENT ON COLUMN quantity_adjustment_history.quotation_id IS 'ID da cotação relacionada';
COMMENT ON COLUMN quantity_adjustment_history.supplier_id IS 'ID do fornecedor';
COMMENT ON COLUMN quantity_adjustment_history.previous_quantity IS 'Quantidade anterior antes do ajuste';
COMMENT ON COLUMN quantity_adjustment_history.new_quantity IS 'Nova quantidade após o ajuste';
COMMENT ON COLUMN quantity_adjustment_history.adjustment_reason IS 'Motivo do ajuste de quantidade';
COMMENT ON COLUMN quantity_adjustment_history.adjusted_by IS 'ID do usuário que realizou o ajuste';

COMMENT ON COLUMN supplier_quotation_items.available_quantity IS 'Quantidade disponível do item pelo fornecedor';
COMMENT ON COLUMN supplier_quotation_items.confirmed_unit IS 'Unidade confirmada pelo fornecedor';
COMMENT ON COLUMN supplier_quotation_items.quantity_adjustment_reason IS 'Motivo do ajuste de quantidade';
COMMENT ON COLUMN supplier_quotation_items.fulfillment_percentage IS 'Percentual de atendimento da quantidade solicitada';