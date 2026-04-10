# Anexo Técnico — Desacoplamento do Ciclo de Vida de Solicitações e Recebimentos

Este anexo complementa o deck executivo com o detalhamento técnico necessário para times de TI/Arquitetura/Segurança.

Referência principal (documento completo): [decouple-request-receipts-lifecycle.md](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/docs/technical/decouple-request-receipts-lifecycle.md)

---

## A1. Arquitetura Atual (pontos de acoplamento)

### A1.1. Frontend (Kanban)

- O Kanban é renderizado a partir de `purchase_requests.currentPhase` ([kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx)).
- Existe “dupla presença” de cards via `hasPendingFiscal`, derivado de `receipts.status='conf_fisica'` no backend ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L934-L950)).

### A1.2. Backend (rotas com efeito colateral na solicitação)

- Confirmação fiscal por request conclui a solicitação:
  - `POST /api/purchase-requests/:id/confirm-fiscal` atualiza `purchase_requests.currentPhase='conclusao_compra'` ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3364-L3432)).
- Fluxo fiscal por receipt também conclui a solicitação quando não há pendentes:
  - Atualização de `purchase_requests.currentPhase` condicionada por “não haver receipts pendentes” ([receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L690-L716)).
- Rollback fiscal→recebimento altera solicitação e pode deletar receipts:
  - `storage.returnToPhysicalReceipt` ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L2388-L2467)).

### A1.3. Banco (triggers/funções)

- Trigger de auditoria de transição de fase em `purchase_requests`:
  - `trigger_log_phase_transition` ([0013_enhanced_audit_system.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0013_enhanced_audit_system.sql#L354-L394)).
- Não há trigger no DB concluindo `purchase_requests` por receipts; a regra é aplicada no backend.

---

## A2. Modelo alvo (entidades e campos)

### A2.1. Solicitação: separar fase do Kanban de compras de “estado de encerramento”

Recomendação:
- `purchase_requests.procurement_status` (ex.: `aberta|concluida|cancelada`)
- `purchase_requests.procurement_concluded_at` / `purchase_requests.procurement_concluded_by_id`

Objetivo:
- manter `currentPhase` como fase do processo de compras (até o handoff),
- encerrar o ciclo de compras sem depender de receipts.

### A2.2. Recebimentos: receipts como “cards independentes”

Recomendação:
- `receipts.purchase_request_id` (FK direta para rastreabilidade e performance)
- `receipts.receipt_phase` (novo enum) para mapear colunas de trabalho operacional:
  - `recebimento_fisico` | `conf_fiscal` | `concluido` | `cancelado`

Observação:
- `receipts.status` pode permanecer como status de integração/operacional (ex.: `erro_integracao`, `integrado_locador`), desde que exista mapeamento claro `phase ↔ status`.

---

## A3. Regras de negócio (implementáveis)

### A3.1. Handoff (Pedido de Compra → Recebimentos)

No movimento para recebimento:
- set `procurement_status='concluida'`
- criar/ativar 1 receipt inicial em `recebimento_fisico` (ou manter existentes)
- não depender de `physicalReceiptAt/fiscalReceiptAt` para o status da solicitação

### A3.2. Recebimento físico por receipt

Ao confirmar físico:
- gravar itens e quantidades no receipt
- somar saldo em `purchase_order_items.quantity_received`
- atualizar `purchase_orders.fulfillment_status`
- mover receipt para `conf_fiscal`
- não atualizar `purchase_requests.currentPhase`

### A3.3. Conferência fiscal por receipt

Ao concluir fiscal:
- atualizar status/phase do receipt para final
- integração ERP por receipt (ou finalização local)
- não atualizar `purchase_requests` (exceto auditoria vinculada)

---

## A4. Superfície de API (criar/alterar)

Recomendação (resumo):
- `GET /api/receipts/board`
- `POST /api/purchase-requests/:id/receipts`
- `PATCH /api/receipts/:id/update-phase`
- `POST /api/receipts/:id/confirm-physical`
- Ajustar `POST /api/receipts/:id/finish-without-erp` para não mexer em request

Deprecar/re-semantizar:
- `POST /api/purchase-requests/:id/confirm-fiscal` (por request)
- `POST /api/purchase-requests/:id/confirm-physical` (por request)
- `POST /api/requests/:id/return-to-receipt` (rollback do request)

---

## A5. Impactos obrigatórios (relatórios, dashboard, PDFs)

### A5.1. Relatórios/Dashboard por fase

Itens a ajustar por hoje dependerem de `purchase_requests.currentPhase`:
- Dashboard executivo (filtros e contagens por fase).
- Relatório de solicitações (`pr.current_phase` no SQL).

Estratégia:
- manter métricas de compras por `currentPhase` (até o handoff),
- introduzir métricas de recebimentos por `receipts.receipt_phase`/`status`.

### A5.2. PDFs públicos e “Resumo de Conclusão”

Há endpoints que condicionam por `currentPhase`. Após desacoplar:
- trocar gates por regra baseada em “existência de PO”, “estado de aprovação” e “procurement_status”.

---

## A6. Migração e compatibilidade

Estratégia recomendada:

1) Migração additive:
- adicionar colunas novas (`procurement_status`, `receipts.purchase_request_id`, etc.)

2) Backfill:
- preencher `receipts.purchase_request_id` via `purchase_orders.purchase_request_id`
- marcar `procurement_status='concluida'` para requests já em recebimento/fiscal/conclusão

3) Feature flag:
- alternar comportamento novo sem quebrar usuários em andamento

4) Corte:
- descontinuar rotas antigas; remover efeitos colaterais `receipt → request`

---

## A7. Auditoria e conformidade

Requisitos mínimos:
- eventos por receipt (criação, físico, fiscal, integração, erro, reabertura/cancelamento)
- vínculo obrigatório ao `purchase_request_id` e `receipt_id`
- evitar deletes físicos após eventos fiscais/integracionais (preferir cancelamento/reabertura)

Implementação sugerida:
- estender `audit_logs` com `receipt_id` e `action_scope`, ou tabela dedicada para receipts (consolidada no timeline por request).

