# Implementação — Desacoplamento de Solicitação e Recebimentos

## Objetivo

Implementar a arquitetura desacoplada (solicitação encerra ciclo de compras no handoff; recebimentos viram cards independentes) com rollout seguro via feature flag.

Documento técnico completo: [decouple-request-receipts-lifecycle.md](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/docs/technical/decouple-request-receipts-lifecycle.md)

---

## Setup de desenvolvimento

### Pré-requisitos

- Node.js (LTS)
- PostgreSQL acessível (variáveis já usadas pelo projeto)

### Comandos

- Rodar backend+frontend (modo dev):
  - `npm run dev`
- Rodar testes:
  - `npm test`
- Aplicar schema no banco (Drizzle Kit):
  - `npm run db:push`

### Feature flag (legado)

- O rollout via `FEATURE_DECOUPLE_RECEIPTS_LIFECYCLE` foi utilizado durante a fase de transição.
- O comportamento atual do fluxo desacoplado (Fluxo 1: Aquisição, Fluxo 2: Recebimento) não depende mais desta flag para:
  - criação/atualização de receipts;
  - carregamento do board de receipts;
  - exibição do Fluxo 2 no Kanban principal.

---

## Entregas incrementais (marcos)

### Marco 1 — Dados e compatibilidade

Entregas:
- Novos campos em `purchase_requests`:
  - `procurement_status`, `procurement_concluded_at`, `procurement_concluded_by_id`
- Novos campos em `receipts`:
  - `purchase_request_id`, `receipt_phase`
- Ajuste de auditoria:
  - `audit_logs.receipt_id`, `audit_logs.action_scope`
- Backfill histórico para o novo vínculo request↔receipt

Critérios de aceitação:
- Migração aplicada sem perda de dados.
- `receipts.purchase_request_id` preenchido para receipts existentes com PO vinculado.
- `purchase_requests.procurement_status` calculado para requests em fases de recebimento/fiscal/conclusão.

### Marco 2 — Backend (novo ciclo por receipt)

Entregas:
- Endpoints para board e ciclo do receipt.
- Ajuste de endpoints fiscais para não alterar solicitação quando flag ativa.

Critérios de aceitação:
- Concluir fiscal (ERP on/off) muda somente receipt (quando flag ativa).
- Rollbacks/reaberturas (quando existirem) atuam em receipt e registram auditoria.

### Marco 3 — Handoff (solicitação concluída no recebimento)

Entregas:
- Ao mover solicitação para “Recebimento” (Kanban), marcar `procurement_status='concluida'` e criar receipt inicial (se não existir).

Critérios de aceitação:
- Mover card de `pedido_compra` → `recebimento` conclui o ciclo de compras da solicitação (sem depender de receipts).
- Recebimentos parciais permitem criar múltiplos receipts para a mesma solicitação.

### Marco 4 — UI (Kanban de receipts)

Entregas:
- (Quando implementado) uma visão/board de receipts para “Recebimento Físico” e “Conf. Fiscal”.
- Ajustes de relatórios e PDFs que dependem de `currentPhase`.

Critérios de aceitação:

---

## Kanban principal (Fluxo 2 no Kanban)

- O Kanban principal exibe duas faixas de colunas:
  - Fluxo 1 (Aquisição): colunas baseadas em `purchase_requests.current_phase` até `pedido_concluido`.
  - Fluxo 2 (Recebimento): colunas baseadas em `receipts.receipt_phase` (`recebimento_fisico`, `conf_fiscal`, `concluido`).
- Fonte de dados do Fluxo 2:
  - endpoint único: `GET /api/receipts/board`
  - utilizado tanto na tela dedicada de Recebimentos quanto no Kanban principal para evitar divergência de dados.
- Cache do frontend:
  - a query usa uma chave compartilhada (`["receipts-board"]`) para que alterações feitas em uma tela reflitam na outra sem depender de refetch manual.
- Rotas:
  - endpoints de detalhes de receipt usam parâmetro numérico (`/api/receipts/:id(\\d+)`) para não conflitar com rotas estáticas como `/api/receipts/board`.
- Recebimentos fantasma:
  - um receipt pode existir sem vínculo com solicitação (sem `purchase_request_id` e sem PO válido), tipicamente por legado/importação.
  - o Kanban exibe estes cards com alerta visual e permite exclusão apenas para Admin/Gerente, com confirmação.
  - a exclusão remove dados dependentes (`receipt_items`, `receipt_allocations`, `receipt_installments`, `receipt_nf_xmls`) e registra auditoria (`ghost_receipt_deleted`).
- Backlog fiscal é visível e mensurável por receipt (não por solicitação).
- PDFs públicos e relatórios usam regras baseadas em dados (PO/aprovação/procurement_status), não apenas fase.
