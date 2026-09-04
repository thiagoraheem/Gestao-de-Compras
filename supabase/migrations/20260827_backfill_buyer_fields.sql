-- ==============================================================
-- SCRIPT DE ATUALIZAÇÃO EM MASSA:
-- Preenche buyer_name, buyer_phone, buyer_email
-- dos Pedidos de Compra (purchase_orders) existentes
-- Fonte: createdBy (users.phone AGORA É PRIMÁRIO) + company (fallback)
-- Data: 2026-08-27
-- ==============================================================

-- PASSO 1: Atualização via createdBy (usuário que CRIOU o PO = Comprador)
UPDATE purchase_orders po
SET
  buyer_name = TRIM(
    COALESCE(NULLIF(u.first_name || ' ' || u.last_name, ' '), u.username, '')
  ),
  buyer_email = u.email,
  buyer_phone = COALESCE(
    NULLIF(u.phone, ''),                 -- NOVA PRIORIDADE: telefone DIRETO do usuário
    NULLIF(po.contact_phone, ''),        -- fallback: contact_phone do PO
    c.phone                              -- fallback: telefone da empresa do usuário
  )
FROM users u
LEFT JOIN companies c ON c.id = u.company_id
WHERE
  po.created_by IS NOT NULL
  AND u.id = po.created_by
  AND (po.buyer_name IS NULL OR TRIM(po.buyer_name) = '');

-- PASSO 2: Fallback via purchase_requests.requester_id (Solicitante)
UPDATE purchase_orders po
SET
  buyer_name = TRIM(
    COALESCE(NULLIF(u.first_name || ' ' || u.last_name, ' '), u.username, '')
  ),
  buyer_email = u.email,
  buyer_phone = COALESCE(
    NULLIF(u.phone, ''),
    NULLIF(po.contact_phone, ''),
    c.phone
  )
FROM purchase_requests pr
JOIN users u ON u.id = pr.requester_id
LEFT JOIN companies c ON c.id = u.company_id
WHERE
  pr.id = po.purchase_request_id
  AND pr.requester_id IS NOT NULL
  AND (po.buyer_name IS NULL OR TRIM(po.buyer_name) = '');
