-- ============================================================
-- DIAGNÓSTICO: Comparativo entre cálculo OLD e CTE/NEW
-- Endpoint impactado: /api/receipts/board
-- Problema relatado: Recebimento Físico 27 → 5 (22 ocultos)
-- Regra de ocultação:
--   filterReceipts oculta quando:
--     receivingPercent >= 100
--     AND receiptPhase = 'recebimento_fisico'
--     AND status IN ('nf_pendente', 'rascunho')
-- ============================================================

WITH
  -- (A) CTEs da estratégia NEW (otimizada) ====================
  receipt_totals AS (
    SELECT receipt_id, SUM(total_price) AS total_receipt
    FROM receipt_items GROUP BY receipt_id
  ),
  po_totals AS (
    SELECT purchase_order_id,
           SUM(total_price) AS total_po,
           SUM(quantity)    AS qty_po
    FROM purchase_order_items GROUP BY purchase_order_id
  ),
  po_received AS (
    SELECT r_all.purchase_order_id,
           COALESCE(SUM(ri_all.quantity_received), 0) AS qty_rcv
    FROM receipt_items ri_all
    JOIN receipts r_all ON ri_all.receipt_id = r_all.id
    WHERE r_all.receipt_phase != 'cancelado'
      AND r_all.purchase_order_id IS NOT NULL
    GROUP BY r_all.purchase_order_id
  ),
  single_received AS (
    SELECT ri_single.receipt_id,
           COALESCE(SUM(ri_single.quantity_received), 0) AS qty_rcv,
           COALESCE(SUM(poi_single.quantity), 0)          AS qty_ordered
    FROM receipt_items ri_single
    JOIN purchase_order_items poi_single
      ON ri_single.purchase_order_item_id = poi_single.id
    GROUP BY ri_single.receipt_id
  ),

  -- (B) Comparação por receipt ================================
  base AS (
    SELECT
      r.id                                         AS receipt_id,
      r.receipt_phase,
      r.status,
      r.purchase_order_id,
      r.purchase_request_id,
      r.total_amount,
      r.receipt_number,

      -- ====== totalAmount (OLD vs NEW) =====================
      COALESCE(
        NULLIF(r.total_amount, 0),
        (SELECT SUM(total_price) FROM receipt_items WHERE receipt_id = r.id),
        (SELECT SUM(total_price) FROM purchase_order_items WHERE purchase_order_id = r.purchase_order_id),
        pr.total_value,
        0
      )                                            AS total_old,
      COALESCE(
        NULLIF(r.total_amount, 0),
        rt.total_receipt,
        pt.total_po,
        pr.total_value,
        0
      )                                            AS total_new,

      -- ====== receivingPercent (OLD) ========================
      CASE
        WHEN r.purchase_order_id IS NOT NULL THEN
          COALESCE(LEAST(100.0,
            (SELECT
               COALESCE(SUM(ri_all.quantity_received), 0) * 100.0 /
               NULLIF((SELECT SUM(poi.quantity)
                       FROM purchase_order_items poi
                       WHERE poi.purchase_order_id = r.purchase_order_id), 0)
             FROM receipt_items ri_all
             JOIN receipts r_all ON ri_all.receipt_id = r_all.id
             WHERE r_all.purchase_order_id = r.purchase_order_id
               AND r_all.receipt_phase != 'cancelado')), 0)
        ELSE
          COALESCE(LEAST(100.0,
            (SELECT
               COALESCE(SUM(ri_single.quantity_received), 0) * 100.0 /
               NULLIF(SUM(poi_single.quantity), 0)
             FROM receipt_items ri_single
             JOIN purchase_order_items poi_single
               ON ri_single.purchase_order_item_id = poi_single.id
             WHERE ri_single.receipt_id = r.id)), 0)
      END                                          AS pct_old,

      -- ====== receivingPercent (NEW / CTE) =================
      CASE
        WHEN r.purchase_order_id IS NOT NULL THEN
          COALESCE(LEAST(100.0,
            prc.qty_rcv * 100.0 / NULLIF(pt.qty_po, 0)), 0)
        ELSE
          COALESCE(LEAST(100.0,
            sr.qty_rcv * 100.0 / NULLIF(sr.qty_ordered, 0)), 0)
      END                                          AS pct_new,

      -- ====== Debug de partes do cálculo NEW ===============
      prc.qty_rcv                                  AS new_po_qty_rcv,
      pt.qty_po                                    AS new_po_qty_po,
      sr.qty_rcv                                   AS new_single_qty_rcv,
      sr.qty_ordered                               AS new_single_qty_ordered
    FROM receipts r
    LEFT JOIN purchase_orders po ON r.purchase_order_id = po.id
    LEFT JOIN purchase_requests pr
           ON COALESCE(r.purchase_request_id, po.purchase_request_id) = pr.id
    LEFT JOIN receipt_totals rt ON rt.receipt_id = r.id
    LEFT JOIN po_totals pt      ON pt.purchase_order_id = r.purchase_order_id
    LEFT JOIN po_received prc   ON prc.purchase_order_id = r.purchase_order_id
    LEFT JOIN single_received sr ON sr.receipt_id = r.id
    WHERE r.receipt_phase != 'cancelado'
  )

-- (C) Resultado principal: focar em RECEBIMENTO FÍSICO, os casos
--     que provavelmente estavam divergindo (5 vs 27).
--     Mostra só as linhas em que OLD != NEW OU que são suspeitas.
SELECT
  receipt_id,
  receipt_phase,
  status,
  purchase_order_id IS NOT NULL                  AS po_based,
  pct_old,
  pct_new,
  (pct_new - pct_old)                            AS pct_diff,
  total_old,
  total_new,
  (total_new - total_old)                        AS total_diff,
  new_po_qty_rcv,
  new_po_qty_po,
  new_single_qty_rcv,
  new_single_qty_ordered,
  receipt_number,
  CASE
    WHEN receipt_phase = 'recebimento_fisico'
     AND status IN ('nf_pendente', 'rascunho')
     AND pct_old < 100 AND pct_new >= 100
    THEN 'SIM: ocultado indevidamente por CTE'
    WHEN receipt_phase = 'recebimento_fisico'
     AND status IN ('nf_pendente', 'rascunho')
     AND pct_old >= 100 AND pct_new < 100
    THEN 'Oposto: OLD ocultaria, NEW manteria'
    ELSE 'ok'
  END                                            AS diagnostico
FROM base
WHERE receipt_phase = 'recebimento_fisico'
  AND (
    ABS(COALESCE(pct_old,0) - COALESCE(pct_new,0)) > 0.01 OR
    ABS(COALESCE(total_old,0) - COALESCE(total_new,0)) > 0.01
  )
ORDER BY diagnostico = 'SIM: ocultado indevidamente por CTE' DESC,
         pct_diff DESC,
         receipt_id
LIMIT 500;
