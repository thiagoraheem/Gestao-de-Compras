-- Migracao: adiciona coluna billing_company_id nas tabelas purchase_requests e quotations
-- para diferenciar "Empresa Solicitante" (company_id) de "Empresa para Faturamento" (destinataria da NF-e).
--
-- Objetivo: viabilizar cenarios de holding/filiais onde a solicitacao origina-se em uma empresa
-- do grupo, mas a nota fiscal deve ser emitida para outra empresa do mesmo grupo (matriz,
-- centro de lucro independente, etc.).
--
-- Regras de valor padrao e retrocompatibilidade:
--   * Novos registros: billing_company_id sera definido igual a company_id no momento da criacao
--     (garantido no backend pelo repositorio).
--   * Registros historicos: backfill abaixo define billing_company_id = company_id para todos
--     os registros existentes, garantindo 100% de retrocompatibilidade.
--
-- Integridade referencial: ON DELETE RESTRICT evita exclusao acidental de empresas em uso
-- em pedidos de compra ativos ou historicos.

ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS billing_company_id INTEGER
  REFERENCES companies(id) ON DELETE RESTRICT;

COMMENT ON COLUMN purchase_requests.billing_company_id
  IS 'Empresa destinataria da NF-e / faturamento. Padrao = company_id (empresa solicitante). Alteravel apenas por Compradores/Admin nas fases de solicitacao e cotacao.';

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS billing_company_id INTEGER
  REFERENCES companies(id) ON DELETE RESTRICT;

COMMENT ON COLUMN quotations.billing_company_id
  IS 'Copia do billing_company_id da purchase_request no momento da criacao da RFQ. Sincronizado de volta com a PR ao editar a RFQ.';

-- Backfill: garante retrocompatibilidade 100% com dados historicos.
UPDATE purchase_requests
SET billing_company_id = company_id
WHERE billing_company_id IS NULL;

UPDATE quotations q
SET billing_company_id = pr.company_id
FROM purchase_requests pr
WHERE q.purchase_request_id = pr.id
  AND q.billing_company_id IS NULL;

-- Indices para performance de joins e filtros futuros (relatorios, dashboard).
CREATE INDEX IF NOT EXISTS idx_purchase_requests_billing_company_id
  ON purchase_requests(billing_company_id);

CREATE INDEX IF NOT EXISTS idx_quotations_billing_company_id
  ON quotations(billing_company_id);
