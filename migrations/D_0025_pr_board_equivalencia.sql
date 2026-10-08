-- ============================================================
-- DIAGNÓSTICO DE EQUIVALÊNCIA: /api/purchase-requests
-- Compara a query BASE (sem o enriquecimento pós-query)
-- OLD vs a estrutura usada no board:
--   - hasQuotation
--   - hasPendingFiscal
--   - totalValue (fallback COALESCE / NULLIF)
-- A contagem por fase deve ser IDÊNTICA entre os dois métodos.
-- Se houver diferença em valores, o diff é mostrado.
-- ============================================================

WITH
  -- (A) Projeção idêntica à query base ------------------------------------------------
  base AS (
    SELECT
      pr.id                                                AS id,
      pr.current_phase,
      pr.request_number,
      pr.currency_code,
      pr.exchange_rate,
      pr.total_value_orig,
      pr.chosen_supplier_id,
      pr.has_pendency,

      -- hasQuotation
      EXISTS(SELECT 1 FROM quotations q
             WHERE q.purchase_request_id = pr.id)            AS has_quotation,

      -- hasPendingFiscal (por PO)
      EXISTS(SELECT 1 FROM receipts r
             WHERE r.purchase_order_id = po.id
               AND r.status = 'conf_fisica')                 AS has_pending_fiscal,

      -- totalValue (fallback, mesmas regras do SELECT do drizzle)
      COALESCE(
        NULLIF(pr.total_value, 0),
        (SELECT SUM(poi.total_price)
         FROM purchase_order_items poi
         WHERE poi.purchase_order_id = po.id),
        0
      )::text                                               AS total_value_computed

    FROM purchase_requests pr
    LEFT JOIN purchase_orders po
      ON po.purchase_request_id = pr.id
  )

-- (B) Resumo 1: Contagem por FASE (deve ser 100% = versão antiga)
SELECT current_phase            AS fase,
       COUNT(*)::int            AS total,
       SUM(CASE WHEN has_quotation THEN 1 ELSE 0 END)::int          AS com_cotacao,
       SUM(CASE WHEN has_pendency THEN 1 ELSE 0 END)::int           AS com_pendencia,
       SUM(CASE WHEN has_pending_fiscal THEN 1 ELSE 0 END)::int     AS com_fiscal_pendente
FROM base
GROUP BY 1
ORDER BY 1;

-- -----------------------------------------------------------
-- (C) Resumo 2: Diferenças de totalValue / campos booleanos
-- Descomente para ver detalhes linha a linha quando houver divergências.
-- -----------------------------------------------------------
/*
SELECT id,
       request_number,
       current_phase,
       has_quotation,
       has_pending_fiscal,
       has_pendency,
       total_value_computed  AS tv_computed,
       total_value_orig      AS tv_stored_orig,
       chosen_supplier_id    AS supplier_id,
       currency_code,
       exchange_rate
FROM base
ORDER BY current_phase, id
LIMIT 500;
*/
