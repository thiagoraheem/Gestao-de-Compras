-- Migration: Backfill legacy receipts from purchase_requests
-- This script ensures all legacy receiving data is properly mapped to the new Flow 2 (Receipts)

-- 1. Atualizar recebimentos EXISTENTES para herdar a fase correta da Solicitação de Compra
-- O script 0020 adicionou a coluna receipt_phase com default 'recebimento_fisico'.
-- Precisamos mover os recebimentos cujas solicitações já avançaram.
UPDATE receipts r
SET receipt_phase = 
  CASE 
    WHEN pr.current_phase = 'recebimento' THEN 'recebimento_fisico'::receipt_phase
    WHEN pr.current_phase = 'conf_fiscal' THEN 'conf_fiscal'::receipt_phase
    WHEN pr.current_phase = 'conclusao_compra' THEN 'concluido'::receipt_phase
    ELSE r.receipt_phase
  END,
  status = 
  CASE 
    WHEN pr.current_phase = 'recebimento' THEN 'nf_pendente'
    WHEN pr.current_phase = 'conf_fiscal' THEN 'nf_confirmada'
    WHEN pr.current_phase = 'conclusao_compra' THEN 'recebimento_confirmado'
    ELSE r.status
  END
FROM purchase_requests pr
WHERE r.purchase_request_id = pr.id
  AND pr.current_phase IN ('recebimento', 'conf_fiscal', 'conclusao_compra');

-- 2. Criar recebimentos sintéticos para solicitações legadas que NÃO possuam nenhum recebimento
INSERT INTO receipts (
  receipt_number,
  purchase_order_id,
  purchase_request_id,
  status,
  receipt_phase,
  received_by,
  received_at,
  approved_by,
  approved_at,
  created_at
)
SELECT 
  'REC-MIG-' || pr.id || '-' || COALESCE(po.id, 0),
  po.id,
  pr.id,
  CASE 
    WHEN pr.current_phase = 'recebimento' THEN 'nf_pendente'
    WHEN pr.current_phase = 'conf_fiscal' THEN 'nf_confirmada'
    WHEN pr.current_phase = 'conclusao_compra' THEN 'recebimento_confirmado'
    ELSE 'rascunho'
  END as status,
  CASE 
    WHEN pr.current_phase = 'recebimento' THEN 'recebimento_fisico'::receipt_phase
    WHEN pr.current_phase = 'conf_fiscal' THEN 'conf_fiscal'::receipt_phase
    WHEN pr.current_phase = 'conclusao_compra' THEN 'concluido'::receipt_phase
    ELSE 'recebimento_fisico'::receipt_phase
  END as receipt_phase,
  pr.received_by_id,
  COALESCE(pr.physical_receipt_at, pr.received_date, pr.updated_at),
  pr.fiscal_receipt_by_id,
  COALESCE(pr.fiscal_receipt_at, pr.updated_at),
  COALESCE(pr.physical_receipt_at, pr.received_date, pr.updated_at)
FROM purchase_requests pr
LEFT JOIN purchase_orders po ON pr.id = po.purchase_request_id
WHERE pr.current_phase IN ('recebimento', 'conf_fiscal', 'conclusao_compra')
  AND NOT EXISTS (
    SELECT 1 FROM receipts r WHERE r.purchase_request_id = pr.id
  );
