# Implementação (As Built) — Desacoplamento de Solicitação (Fluxo 1) e Recebimentos (Fluxo 2)

Documento de referência para:

- Entender exatamente o que foi implementado (backend, frontend, schema, testes).
- Reproduzir o processo do zero com o menor risco possível.
- Depurar regressões típicas (rotas, cache, DnD, filtros, Suspense).

Arquitetura e decisões: [decouple-request-receipts-lifecycle.md](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/docs/technical/decouple-request-receipts-lifecycle.md)

---

## Resultado entregue (comportamento do produto)

### Dois fluxos independentes no mesmo Kanban

- **Fluxo 1 (Aquisição)**: o card continua sendo a **solicitação** (`purchase_requests`) e percorre as fases de compra até **Pedido Concluído** / **Arquivado**.
- **Fluxo 2 (Recebimento)**: o card passa a ser o **receipt** (`receipts`) e percorre:
  - `recebimento_fisico` → `conf_fiscal` → `concluido`
- O Kanban principal exibe os dois fluxos em colunas separadas no mesmo board: [kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L626-L972).

### Handoff: encerramento do Fluxo 1 e início do Fluxo 2

- Ao concluir o pedido (mover `pedido_compra` → `pedido_concluido`) o sistema:
  - marca `purchase_requests.procurement_status='concluida'`;
  - marca `purchase_requests.sent_to_physical_receipt=true`;
  - cria um receipt inicial em `recebimento_fisico` se ainda não existir.
- Implementação no endpoint do Kanban de requests: [routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5250-L5569), bloco específico: [routes.ts:L5457-L5491](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5457-L5491).

### Board de recebimentos reutilizado (fonte única)

- Tanto a tela dedicada quanto o Kanban principal usam o mesmo endpoint:
  - `GET /api/receipts/board` em [routes.ts:L3388-L3474](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3388-L3474)
- A query retorna, por receipt:
  - `receiptPhase`, `status`, `receiptNumber`, `supplier`, `document*`, `totalAmount`, `receivedAt`, etc;
  - vínculo com solicitação via `purchase_request_id` ou via PO quando necessário;
  - `requestFound` (para identificar “recebimentos fantasma”);
  - `purchaseOrderNumber`;
  - `receivingPercent` (percentual recebido calculado no agregado do PO).

### Recebimentos fantasma (sem solicitação vinculada)

- UI indica com badge “Solicitação não encontrada” e estado de alerta.
- Usuários Admin/Gerente podem excluir com confirmação.
- Implementação:
  - Backend (delete + auditoria + deleção de dependências): [routes.ts:L3476-L3522](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3522)
  - UI (card + botão lixeira + ring): [receipt-kanban-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipt-kanban-card.tsx#L74-L242), dialog: [kanban-board.tsx:L1002-L1062](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L1002-L1062)

### Estados finais (bloqueio de movimentação + estilo)

- Request (Fluxo 1): `pedido_concluido` e `arquivado` não podem ser movidos.
- Receipt (Fluxo 2): `concluido` não pode ser movido.
- DnD bloqueado:
  - no início do drag: [kanban-board.tsx:L642-L684](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L642-L684)
  - no drop/commit: [kanban-board.tsx:L686-L841](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L686-L841)
- Estilo final (classes globais `card-final-state` / `card-disabled`): [index.css](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/index.css)

### Filtro “Nº Solicitação/Pedido/Recebimento” aplicado aos dois fluxos

- O filtro numérico/textual unifica match de:
  - `requestNumber` (SOL-…)
  - `purchaseOrderNumber` (PO-…)
  - `receiptNumber` (REC-…)
- Implementação: [kanban-filters.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/kanban-filters.ts#L15-L139)
- O Kanban destaca (ring laranja) requests e receipts filtrados:
  - requests: [kanban-board.tsx:L395-L467](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L395-L467)
  - receipts: [kanban-board.tsx:L905-L938](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L905-L938)

---

## Setup de desenvolvimento

### Pré-requisitos

- Node.js (LTS)
- PostgreSQL acessível (variáveis já usadas pelo projeto)

### Comandos

- Rodar backend+frontend (modo dev): `npm run dev`
- Rodar testes: `npm test`
- Aplicar schema no banco (Drizzle Kit): `npm run db:push`

### Feature flag (legado)

- O rollout via `FEATURE_DECOUPLE_RECEIPTS_LIFECYCLE` foi utilizado na transição.
- O fluxo atual do board (criação/board/movimentação de receipts e exibição do Fluxo 2 no Kanban principal) não depende mais desta flag.

---

## Checklist para refazer do zero (passo a passo)

### 1) Banco de dados (schema + migrações + backfill)

#### 1.1. Campos adicionados em `purchase_requests`

- `procurement_status` (default `aberta`)
- `procurement_concluded_at`
- `procurement_concluded_by_id`
- `sent_to_physical_receipt` (default `false`)

Definição do schema: [schema.ts:L190-L259](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L190-L259)

Migração específica do flag: [0020_add_sent_to_physical_receipt_flag.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0020_add_sent_to_physical_receipt_flag.sql)

#### 1.2. Campos e enum adicionados em `receipts`

- `purchase_request_id` (FK → `purchase_requests.id`)
- `receipt_phase` (enum `receipt_phase` com valores):
  - `recebimento_fisico`, `conf_fiscal`, `concluido`, `cancelado`

Definição: [schema.ts:L516-L575](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L516-L575)

#### 1.3. Auditoria (`audit_logs`) estendida para receipts

- `receipt_id` (FK → `receipts.id`)
- `action_scope` (`REQUEST`/`RECEIPT`/`FLOW` etc)

Definição: [schema.ts:L644-L663](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L644-L663)

#### 1.4. Backfill recomendado (histórico)

Objetivo: garantir `receipts.purchase_request_id` quando o PO existir, e marcar procurement concluído para requests que já estavam “do lado do recebimento” no legado.

Exemplo de backfill (ajustar conforme estratégia do time e histórico):

```sql
UPDATE receipts r
SET purchase_request_id = po.purchase_request_id
FROM purchase_orders po
WHERE r.purchase_order_id = po.id
  AND r.purchase_request_id IS NULL
  AND po.purchase_request_id IS NOT NULL;
```

---

### 2) Backend (rotas, permissões, invariantes)

#### 2.1. Endpoints “core” do Fluxo 2 (board e Kanban)

**Board de receipts**

- `GET /api/receipts/board`
  - Autenticação: `isAuthenticated`
  - Filtros opcionais: `phase`, `purchaseRequestId`, `purchaseOrderId`
  - Retorno: lista de `ReceiptKanbanRow` enriquecida (inclui `supplier`, `request`, `purchaseOrderNumber`, `receivingPercent`, `requestFound`)
  - Implementação: [routes.ts:L3388-L3469](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3388-L3469)

**Alterar fase do receipt (DnD)**

- `PATCH /api/receipts/:id/update-phase`
  - Autenticação: `isAuthenticated`
  - Payload: `{ newPhase: "recebimento_fisico"|"conf_fiscal"|"cancelado" }`
  - Validações principais:
    - `concluido` é bloqueado via este endpoint (conclusão é automática após fiscal)
    - permissões para `conf_fiscal` (Receiver/Admin/Manager)
    - `cancelado` apenas Admin
  - Auditoria: `receipt_phase_changed`
  - Implementação: [routes.ts:L3574-L3633](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3574-L3633)

**Excluir recebimento fantasma**

- `DELETE /api/receipts/:id(\d+)`
  - Autenticação: `isAuthenticated`
  - Permissão: Admin ou Manager
  - Regra: só permite excluir se não houver solicitação vinculada (ghost)
  - Remove dependências: `receipt_items`, `receipt_allocations`, `receipt_installments`, `receipt_nf_xmls`
  - Auditoria: `ghost_receipt_deleted`
  - Implementação: [routes.ts:L3476-L3522](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3522)

#### 2.2. Handoff do Fluxo 1 → Fluxo 2 (criação automática de receipt)

O “ponto de handoff” implementado é a transição para `pedido_concluido`.

**Kanban de solicitações (endpoint principal)**

- `PATCH /api/purchase-requests/:id/update-phase`
  - Se `newPhase === "pedido_concluido"`:
    - seta procurement concluído + flag `sentToPhysicalReceipt`
    - cria receipt inicial (se não existir)
    - auditoria `flow2_started`
  - Implementação: [routes.ts:L5250-L5605](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5250-L5605), bloco: [routes.ts:L5457-L5491](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5457-L5491)

**Endpoint alternativo (legado/auxiliar)**

- `POST /api/purchase-requests/:id/advance-to-receipt`
  - Também conclui o pedido (move para `pedido_concluido`), marca procurement concluído e cria receipt inicial.
  - Implementação inicia em: [routes.ts:L5607](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5607)

**Endpoint “repair/garantia”**

- `POST /api/purchase-requests/:id/start-receiving`
  - Cenário: a request já está em `pedido_concluido` e deveria ter receipt criado, mas não tem.
  - Permissão: Receiver/Admin/Manager
  - Implementação: [routes.ts:L5705-L5760](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5705-L5760)

#### 2.3. Endpoint de criação manual de novo card de receipt (parcialidade)

- `POST /api/purchase-requests/:id/receipts`
  - Cria receipt “rascunho” em `recebimento_fisico` para a solicitação.
  - Implementação: [routes.ts:L3524-L3572](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3524-L3572)

#### 2.4. Rotas de detalhes e colisão com `/board`

Problema clássico: rota dinâmica capturar `board` como `:id`. A correção exigida é restringir o parâmetro para numérico.

- Backend (routes.ts): [routes.ts:L3476-L3478](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3478)
- Backend (receipts.ts): [receipts.ts:L530](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L530)

---

### 3) Frontend (Kanban principal, cards, cache, navegação)

#### 3.1. Fonte única de dados do Fluxo 2 e cache

- Query do board de receipts: `queryKey: ["receipts-board"]`, `queryFn: GET /api/receipts/board`:
  - Kanban principal: [kanban-board.tsx:L120-L129](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L120-L129)
  - Tela dedicada: [receipts-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipts-board.tsx)

Invariante: qualquer ação que muda receipt (fase, físico, fiscal, delete ghost) deve invalidar `["receipts-board"]` (e, quando relevante, `["/api/purchase-requests"]`).

#### 3.2. DnD: separação rígida entre Fluxo 1 e Fluxo 2

- IDs de DnD usam prefixos:
  - `request-<id>` para requests
  - `receipt-<id>` para receipts
- No drop:
  - receipt só pode ir para fases de receipt (`recebimento_fisico|conf_fiscal|concluido`)
  - request não pode ser movido para fases de receipt (mensagem “Fluxo de Recebimento é independente”)
- Implementação: [kanban-board.tsx:L686-L841](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L686-L841)

#### 3.3. Navegação: clicar em receipt concluído abre detalhes do pedido (não a conferência fiscal)

- Caso `receiptPhase === "concluido"`, o clique abre o modal de `Pedido Concluído` do Fluxo 1.
- Implementação: [kanban-board.tsx:L143-L192](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L143-L192)

#### 3.4. Correção de Suspense/startTransition ao abrir receipt

Ao abrir componentes lazy (ex.: conferência fiscal), o Kanban usa `startTransition` para evitar erro de “suspendeu durante input síncrono”.

- Implementação: [kanban-board.tsx:L143-L192](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L143-L192)

#### 3.5. UI do card de receipt (layout e dados)

Renderiza:

- Identificadores: SOL/PO no badge principal + `receiptNumber` (REC-…) em badge secundário.
- Dados: justificativa, urgência, categoria, fornecedor, valor, solicitante.
- Em `conf_fiscal`: documento/série/data de entrada/valor do documento.
- Percentual recebido (`receivingPercent`) com barra de progresso.
- Ghost: alerta + botão excluir (se permitido).

Implementação: [receipt-kanban-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipt-kanban-card.tsx#L74-L242)

#### 3.6. Filtro aplicado ao Fluxo 2 + highlight

- O filtro “purchaseOrder” no Kanban aplica `matchesPurchaseOrderFilter` em requests e receipts.
- A lógica evita falso-positivo quando o filtro contém letras (ex.: `po-2026` não vira “2026” genérico): [kanban-filters.ts:L15-L44](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/kanban-filters.ts#L15-L44)

---

### 4) Testes adicionados/ajustados

Client:

- Filtros e regressão do match numérico: [kanban-filters.test.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/__tests__/kanban-filters.test.ts)
- Regras de estado final (request/receipt): [kanban-final-state.test.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/__tests__/kanban-final-state.test.ts)
- Navegação de receipt concluído: [receipt-navigation.test.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/__tests__/receipt-navigation.test.ts)
- Card de receipt (highlight e estado final): [receipt-kanban-card.test.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/__tests__/receipt-kanban-card.test.tsx)

Server:

- Ajustes de comportamento do receipt-service (quando aplicável): [receipt-service.test.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/tests/receipt-service.test.ts)

---

## Troubleshooting (falhas típicas e correções)

### `/api/receipts/board` retornando erro ou sendo capturado por rota dinâmica

- Sintoma: API responde `{ message: "Error" }` ou 500; o Kanban não carrega.
- Causa: rota `GET /api/receipts/:id` capturando `board` como parâmetro.
- Correção: restringir `:id` para numérico `:id(\\d+)` (em todos os locais onde a rota exista):
  - [routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3478)
  - [receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L530)

### Erro React “A component suspended while responding to synchronous input”

- Causa: abrir modal que renderiza componente lazy sem `Suspense`/`startTransition`.
- Correção: envolver abertura de modal em `startTransition` e garantir `Suspense` no conteúdo lazy.

### Cards “sumindo” entre Kanban e tela Recebimentos

- Causa: queryKey diferente ou invalidation incompleta.
- Correção: padronizar em `["receipts-board"]` e sempre invalidar após mutações.

### Filtro `po-2026` selecionando tudo

- Causa: transformar texto em número (`2026`) e aplicar match amplo.
- Correção: só aplicar “match numérico” quando o filtro não contém letras: [kanban-filters.ts:L32-L41](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/kanban-filters.ts#L32-L41)
