CREATE TABLE IF NOT EXISTS units_of_measure (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Carga inicial de unidades padronizadas do sistema
INSERT INTO units_of_measure (code, description) VALUES
  ('UN', 'Unidade'),
  ('PC', 'Peça'),
  ('MT', 'Metro'),
  ('KG', 'Quilograma'),
  ('LT', 'Litro'),
  ('M2', 'Metro Quadrado'),
  ('M3', 'Metro Cúbico'),
  ('CX', 'Caixa'),
  ('PCT', 'Pacote'),
  ('CM', 'Centímetro'),
  ('PAR', 'Par'),
  ('KIT', 'Kit')
ON CONFLICT (code) DO NOTHING;

-- Importação / Migração de quaisquer unidades já existentes na tabela de itens de solicitação
INSERT INTO units_of_measure (code, description, active)
SELECT DISTINCT 
  TRIM(unit) AS code, 
  TRIM(unit) AS description,
  TRUE AS active
FROM purchase_request_items 
WHERE unit IS NOT NULL AND TRIM(unit) != '' AND TRIM(unit) NOT IN (SELECT code FROM units_of_measure)
ON CONFLICT (code) DO NOTHING;

-- Adição da restrição de chave estrangeira em purchase_request_items.unit (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_purchase_request_items_unit' 
      AND table_name = 'purchase_request_items'
  ) THEN
    ALTER TABLE purchase_request_items 
    ADD CONSTRAINT fk_purchase_request_items_unit 
    FOREIGN KEY (unit) REFERENCES units_of_measure(code) ON UPDATE CASCADE;
  END IF;
END $$;
