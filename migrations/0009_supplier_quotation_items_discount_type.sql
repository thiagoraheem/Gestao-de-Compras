-- Migração: adiciona coluna discount_type na tabela supplier_quotation_items
-- para permitir diferenciação de desconto por item (percentual % ou valor fixo $)
-- compatível com o padrão já existente no desconto global (supplier_quotations.discount_type).
--
-- Objetivo: restaurar funcionalidade perdida após alteração de layout da tela de cotação,
-- onde anteriormente os usuários podiam escolher % ou $ por item.
--
-- Executar em produção com superusuário. A coluna é adicionada com DEFAULT 'none' para
-- que itens antigos permaneçam consistentes (iremos inferir o tipo a partir dos valores
-- discount_percentage e discount_value já salvos, no carregamento do frontend).

ALTER TABLE supplier_quotation_items
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN supplier_quotation_items.discount_type
  IS 'none | percentage | fixed - define como o desconto do item é aplicado';

-- Backfill: tenta inferir desconto pré-existente a partir dos campos já preenchidos.
UPDATE supplier_quotation_items
SET discount_type = CASE
  WHEN (discount_percentage IS NOT NULL AND discount_percentage::numeric > 0)
    AND (discount_value IS NULL OR discount_value::numeric = 0)
  THEN 'percentage'
  WHEN (discount_value IS NOT NULL AND discount_value::numeric > 0)
    AND (discount_percentage IS NULL OR discount_percentage::numeric = 0)
  THEN 'fixed'
  WHEN (discount_percentage IS NOT NULL AND discount_percentage::numeric > 0)
    AND (discount_value IS NOT NULL AND discount_value::numeric > 0)
  THEN 'percentage'
  ELSE 'none'
END
WHERE discount_type IS NULL OR discount_type = 'none';
