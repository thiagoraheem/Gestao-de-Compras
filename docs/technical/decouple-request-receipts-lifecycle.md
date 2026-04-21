# Arquitetura e Implementação (As Built) — Desacoplamento do Ciclo de Vida da Solicitação (Fluxo 1) e dos Recebimentos (Fluxo 2)

## 1. Objetivo e Escopo

Este documento descreve:

- O desenho do desacoplamento e o racional técnico/de negócio.
- O estado final entregue (as built): modelo de dados, endpoints, regras de UI e comportamento do Kanban.
- Referências diretas para o código, para permitir manutenção e reimplementação.

Documento de implementação (passo a passo e troubleshooting): [decouple-receipts-implementation.md](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/docs/technical/decouple-receipts-implementation.md)

Requisitos-alvo (resumo):

1. A solicitação deve ser finalizada automaticamente (status “Concluída”) ao ser movida para **Recebimento**, independentemente do status dos recebimentos físicos.
2. Cards de recebimento devem ser entidades independentes, com ciclo de vida próprio.
3. Múltiplos cards de recebimento devem poder ser criados a partir de uma única solicitação para recebimentos parciais.
4. Movimentar um card de recebimento para **Conf. Fiscal** não deve afetar o status da solicitação original.
5. Cada recebimento deve ser concluído individualmente após passar por **Conf. Fiscal**.

---

## 2. Estado atual (Implementado)

### 2.1. Princípios entregues

1) **Dois ciclos de vida explícitos**

- Fluxo 1 (Aquisição): o card é a solicitação (`purchase_requests`) e termina em **Pedido Concluído** / **Arquivado**.
- Fluxo 2 (Recebimento): o card é o receipt (`receipts`) e percorre **Recebimento Físico → Conf. Fiscal → Conclusão**.
- Kanban principal exibe os dois fluxos no mesmo board: [kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L626-L972)

2) **Handoff que encerra compras e inicia recebimento**

- Ao mover a solicitação para `pedido_concluido` (via Kanban do Fluxo 1), o backend:
  - marca `procurement_status='concluida'`;
  - marca `sent_to_physical_receipt=true`;
  - cria um receipt inicial em `receipt_phase='recebimento_fisico'` se ainda não existir.
- Implementação: [routes.ts:L5457-L5491](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5457-L5491)

3) **Receipts em “Conf. Fiscal” e “Conclusão” aparecem no Kanban principal**

- A fonte do Fluxo 2 é única (`GET /api/receipts/board`) e alimenta:
  - Kanban principal
  - Tela dedicada de recebimentos
- Backend: [routes.ts:L3388-L3474](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3388-L3474)
- Frontend: query `["receipts-board"]` no Kanban: [kanban-board.tsx:L120-L129](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L120-L129)

4) **Estado final e imutabilidade visual/operacional**

- Request final: `pedido_concluido`, `arquivado`
- Receipt final: `concluido`
- Bloqueio de DnD no drag-start e drag-end: [kanban-board.tsx:L642-L841](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L642-L841)
- Estilo final: [index.css](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/index.css)

5) **Filtro por número aplicado também aos receipts**

- Implementação do filtro unificado request/PO/receipt: [kanban-filters.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/kanban-filters.ts#L15-L139)
- Aplicação no Kanban: receipts filtrados e destacados: [kanban-board.tsx:L905-L938](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L905-L938)

### 2.2. Modelo de dados (as built)

#### 2.2.1. `purchase_requests` (campos de procurement)

- `procurement_status` (`aberta|concluida|...`)
- `procurement_concluded_at`
- `procurement_concluded_by_id`
- `sent_to_physical_receipt` (flag de handoff/garantia)

Schema: [schema.ts:L190-L259](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L190-L259)  
Migração do flag: [0020_add_sent_to_physical_receipt_flag.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0020_add_sent_to_physical_receipt_flag.sql)

#### 2.2.2. `receipts` (campos para “card do Fluxo 2”)

- `purchase_request_id` (FK direta)
- `receipt_phase` (enum `receipt_phase`): `recebimento_fisico|conf_fiscal|concluido|cancelado`

Schema: [schema.ts:L516-L575](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L516-L575)

#### 2.2.3. `audit_logs` (escopo por receipt)

- `receipt_id` + `action_scope` para permitir timeline/auditoria por receipt.

Schema: [schema.ts:L644-L663](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L644-L663)

### 2.3. Backend (endpoints e invariantes)

#### 2.3.1. Board de receipts (fonte única)

- `GET /api/receipts/board`
  - inclui `requestFound` (ghost), `purchaseOrderNumber`, `receivingPercent` e `request` enriquecida.
  - join do request usa `COALESCE(receipts.purchase_request_id, purchase_orders.purchase_request_id)` para tolerar legado.
  - Implementação: [routes.ts:L3388-L3469](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3388-L3469)

#### 2.3.2. Handoff no Kanban de requests (fluxo principal)

- `PATCH /api/purchase-requests/:id/update-phase`
  - bloqueia fases do legado de recebimento (`recebimento`, `conf_fiscal`, `conclusao_compra`) para manter separação: [routes.ts:L5280-L5293](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5280-L5293)
  - ao mover para `pedido_concluido`: encerra procurement e cria receipt inicial: [routes.ts:L5457-L5491](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5457-L5491)

#### 2.3.3. Ciclo do receipt (movimentação no Kanban do Fluxo 2)

- `PATCH /api/receipts/:id/update-phase`
  - valida fases permitidas e permissões (Receiver/Admin/Manager para fiscal, Admin para cancelamento)
  - bloqueia `concluido` manual (conclusão é consequência da conferência fiscal)
  - Implementação: [routes.ts:L3574-L3633](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3574-L3633)

#### 2.3.4. Recebimentos fantasma (exclusão controlada)

- `DELETE /api/receipts/:id(\d+)` (somente ghost + Admin/Manager)
- Implementação: [routes.ts:L3476-L3522](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3522)

#### 2.3.5. Conflito de rotas (`/api/receipts/board` vs `/api/receipts/:id`)

- `GET /api/receipts/:id` deve ser numérica (`:id(\d+)`) para não capturar `/board`.
- Implementação:
  - [routes.ts:L3476-L3478](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3478)
  - [receipts.ts:L530](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L530)

### 2.4. Frontend (Kanban, UI, navegação e filtros)

#### 2.4.1. Board principal com duas trilhas

- Requests (Fluxo 1) e receipts (Fluxo 2) são renderizados em colunas distintas e com DnD separado: [kanban-board.tsx:L626-L972](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L626-L972)

#### 2.4.2. Regra de navegação em receipt concluído

- Ao clicar num receipt em `concluido`, abre o modal de detalhes do pedido (`Pedido Concluído`) e não a conferência fiscal.
- Implementação: [kanban-board.tsx:L143-L192](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L143-L192)

#### 2.4.3. UI de receipt card (layout e dados)

- Implementação: [receipt-kanban-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipt-kanban-card.tsx#L74-L242)

#### 2.4.4. Filtro unificado e prevenção de falso-positivo

- O filtro aplica match por texto e match numérico apenas quando não há letras (evita `po-2026` virar match amplo por “2026”): [kanban-filters.ts:L32-L41](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/kanban-filters.ts#L32-L41)

#### 2.4.5. Cache e consistência entre telas (React Query)

- Query única do board de receipts: `["receipts-board"]`
  - Kanban principal: [kanban-board.tsx:L120-L129](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L120-L129)
  - Tela de recebimentos: [receipts-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipts-board.tsx)
- Mutations relevantes invalidam `["receipts-board"]` e, quando necessário, `["/api/purchase-requests"]`:
  - mudança de fase do receipt (optimistic update): [kanban-board.tsx:L365-L393](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L365-L393)
  - exclusão de ghost (optimistic update): [kanban-board.tsx:L194-L219](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L194-L219)

#### 2.4.6. DnD (separação por prefixo e validações)

- IDs:
  - requests: `request-<id>`
  - receipts: `receipt-<id>`
- Regras no drop:
  - receipt só pode cair em fases de receipt (Fluxo 2)
  - request não pode cair em fases de receipt (mensagem de “Fluxo independente”)
- Implementação do commit: [kanban-board.tsx:L686-L841](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L686-L841)

#### 2.4.7. Modal e Suspense ao abrir receipts

- Ao abrir receipt, a navegação é “fase-dependente”:
  - `concluido`: abre detalhes de pedido (Pedido Concluído)
  - demais fases: abre modal do receipt
- Para evitar erro de Suspense em input síncrono, a abertura é envolvida em `startTransition`: [kanban-board.tsx:L143-L192](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L143-L192)

#### 2.4.8. Recebimentos fantasma (UX + governança)

- Detecção no board via `requestFound` (e/ou ausência de `request.requestNumber`).
- Card exibe:
  - badge “Solicitação não encontrada”
  - badge de status “atenção”
  - botão de exclusão (se Admin/Gerente)
- UI: [receipt-kanban-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipt-kanban-card.tsx#L95-L163)
- Backend valida “ghost-only” e remove dependências com auditoria: [routes.ts:L3476-L3522](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3476-L3522)

### 2.5. Limitações e pontos de atenção (as built)

1) Alguns endpoints legados do módulo de receipts ainda atualizam campos na solicitação (ex.: `current_phase`/datas fiscais) em cenários específicos de conferência fiscal local sem ERP e rotinas de desfazer.

- Exemplo (ERP desabilitado): [receipts.ts:L675-L720](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L675-L720)

2) O Kanban principal trata fases legadas de recebimento em requests como “Pedido Concluído” para manter consistência visual e evitar “reentrada” do Fluxo 2 no Fluxo 1:

- Implementação: [kanban-board.tsx:L887-L898](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L887-L898)

---

## 3. Histórico (antes do desacoplamento) — Arquitetura anterior e proposta original

Esta seção mantém o material de contexto e especificação que orientou a implementação. Ela descreve o acoplamento original, riscos, e o desenho-alvo que foi aplicado incrementalmente.

## 3.1. Arquitetura anterior (Visão Geral)

### 3.1.1. Entidades principais e acoplamento vigente

Antes do desacoplamento, o Kanban era **centrado na entidade `purchase_requests`**. As colunas do Kanban eram renderizadas a partir de `purchase_requests.currentPhase` no frontend.

Os recebimentos existem como entidades (`receipts`, `receipt_items`, etc.), mas são tratados como parte “interna” do fluxo da solicitação: em múltiplos pontos o backend altera `purchase_requests.currentPhase` com base em `receipts.status` e/ou ações de conferência.

Consequência: o “card” de solicitação fica acoplado ao avanço/rollback e conclusão fiscal (o que conflita com o objetivo de permitir recebimentos independentes).

### 3.1.2. Frontend: Kanban e fases

- Página: [kanban.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/pages/kanban.tsx)
- Board: [kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx)
- Colunas: [types.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/types.ts#L1-L33) define:
  - `pedido_compra` → “Pedido de Compra”
  - `recebimento` → “Recebimento Físico”
  - `conf_fiscal` → “Conf. Fiscal”

No board:
- `GET /api/purchase-requests` carrega os cards e agrupa por `currentPhase`.
- Drag-and-drop usa `PATCH /api/purchase-requests/:id/update-phase` ([kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L181-L259)).
- Ao abrir detalhes do card:
  - “Pedido de Compra” → [purchase-order-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/purchase-order-phase.tsx)
  - “Recebimento Físico” → [receipt-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipt-phase.tsx)
  - “Conf. Fiscal” → [fiscal-conference-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/fiscal-conference-phase.tsx)

Detalhe relevante: o Kanban usa um “atalho” de exibição paralela em Conf. Fiscal:
- `hasPendingFiscal` pode fazer um card aparecer em “Conf. Fiscal” mesmo que a fase principal não seja essa ([kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx#L674-L701)).
- Esse campo é derivado pelo backend via `EXISTS` em `receipts.status='conf_fisica'` ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L934-L950)).

### 3.1.3. Backend: rotas críticas do fluxo (acopladas a `purchase_requests.currentPhase`)

#### 3.1.3.1. Pedido de Compra → Recebimento

- `POST /api/purchase-requests/:id/receive-material` move `purchase_requests.currentPhase = 'recebimento'` ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L4005-L4022)).
- `POST /api/purchase-requests/:id/advance-to-receipt` também move para `recebimento` e registra `approval_history` de tipo MOVEMENT ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5160-L5217)).

#### 3.1.3.2. Recebimento Físico (confirmação) → Conf. Fiscal

- `POST /api/purchase-requests/:id/confirm-physical`:
  - Atualiza quantidades em `purchase_order_items.quantityReceived`.
  - Atualiza `purchase_orders.fulfillmentStatus` (`pending|partial|fulfilled`).
  - Cria `receipts` (somente em cenário de NF manual: `manualNFNumber`).
  - Se **tudo recebido**, atualiza a solicitação para `currentPhase='conf_fiscal'` e grava `physicalReceiptAt/ById` ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3210-L3356)).

#### 3.1.3.3. Conf. Fiscal → Conclusão (acoplamento por request)

- `POST /api/purchase-requests/:id/confirm-fiscal`:
  - Opcionalmente tenta enviar recebimento ao Locador.
  - Força `purchase_requests.currentPhase='conclusao_compra'` e grava `fiscalReceiptAt/ById` ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3364-L3432)).

#### 3.1.3.4. Conf. Fiscal (por receipt) → Conclusão (acoplamento por receipts)

No fluxo fiscal que opera por `receipt` (módulo de recebimentos):
- Quando a integração ERP está desabilitada, `POST ...` (finalização local) muda `receipts.status='fiscal_conferida'` e, se não houver mais receipts pendentes para o PO, atualiza a solicitação para `currentPhase='conclusao_compra'` ([receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L690-L716)).
- O mesmo padrão ocorre quando integra com sucesso e marca `receipts.status='integrado_locador'`, também concluindo a solicitação se não houver pendentes ([receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L863-L887)).

#### 3.1.3.5. Rollback Conf. Fiscal → Recebimento (apaga receipts e altera fase da solicitação)

- `POST /api/requests/:id/return-to-receipt` chama `storage.returnToPhysicalReceipt(...)` ([receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L1199-L1227)).
- `storage.returnToPhysicalReceipt`:
  - Pode apagar receipts e dependências (items, allocations, installments, xmls).
  - Zera `purchase_order_items.quantityReceived` em rollback total.
  - Volta `purchase_requests.currentPhase='recebimento'` e limpa `fiscalReceiptAt/ById` (e possivelmente físico) ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L2388-L2467)).

### 2.4. DB: triggers/funções/procedures relevantes

Não há trigger/procedure no banco responsável por “finalizar” solicitação com base em receipts. A finalização é predominantemente **aplicacional** (rotas do Node).

Objetos DB relevantes existentes:

- Auditoria de alterações de fase (`purchase_requests.current_phase`):
  - Função `log_phase_transition()` e trigger `trigger_log_phase_transition` em `purchase_requests` ([0013_enhanced_audit_system.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0013_enhanced_audit_system.sql#L354-L394)).
- Auditoria detalhada (trigger genérica) aplicada a tabelas críticas, incluindo `purchase_requests` e `purchase_request_items` ([0013_enhanced_audit_system.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0013_enhanced_audit_system.sql#L72-L224)).
- Trigger de aprovação por valor, que pode mudar tipo/necessidade de aprovação ao alterar total (`purchase_requests.total_value`) ([0010_add_value_based_approval_system.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0010_add_value_based_approval_system.sql#L117-L172)).

Implicação: a mudança proposta exigirá alterar lógica no backend e, opcionalmente, **novos triggers de auditoria** para rastrear transições de status/etapas do recebimento, caso desejado.

---

## 3. Modelo de Dados Atual (Mapeamento de Tabelas Envolvidas)

### 3.1. Solicitações e itens

Base:
- `purchase_requests` (campos relevantes do fluxo):
  - `current_phase` (fase Kanban atual)
  - `has_pendency`, `pendency_reason`
  - `physical_receipt_at/by_id`, `fiscal_receipt_at/by_id`
  - `received_date/by_id`
  - referências de aprovação e valores
  - Migrações principais: [0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L104-L136) + extensões em [0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L262-L279).
- `purchase_request_items`:
  - Itens da solicitação e campos de transferência (`is_transferred`, `transferred_to_request_id`, etc.) ([0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L82-L95), [0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L256-L261)).

Histórico:
- `approval_history` (aprovações e movimentos “MOVEMENT”) ([0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L1-L9)).
- `audit_logs` (log geral de ações e transições) ([0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L36-L47)).
- `detailed_audit_log` (auditoria de campo, via trigger genérica) ([0013_enhanced_audit_system.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0013_enhanced_audit_system.sql#L72-L224)).

### 3.2. Pedido de Compra (PO)

- `purchase_orders`:
  - Vínculo com solicitação via `purchase_request_id`
  - `status` e `fulfillment_status` (atendimento) ([0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L60-L80), [0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L255-L256)).
- `purchase_order_items`:
  - `quantity` e `quantity_received` (controle de recebimento parcial/total) ([0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L45-L58), [0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L254-L255)).

### 3.3. Recebimentos (NF/Serviço/Avulso) e dependências fiscais/financeiras

Cabeçalho e itens:
- `receipts`:
  - FK `purchase_order_id`
  - `status` (enum `receipt_status`), `receipt_type`, `supplier_id`, dados de documento e integração ([0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L175-L188), [0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L303-L318)).
- `receipt_items`:
  - FK `receipt_id`, vínculo a `purchase_order_item_id` e detalhes do item; quantidades e valores ([0000_omniscient_zuras.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0000_omniscient_zuras.sql#L164-L173), [0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L284-L302)).

Anexos e financeiro:
- `receipt_nf_xmls` (XML) ([0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L181-L188)).
- `receipt_installments` (parcelas) ([0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L173-L179)).
- `receipt_allocations` (rateio CC/Plano de Contas) ([0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L161-L171)).

Enums:
- `receipt_status`, `receipt_type` ([0002_blue_texas_twister.sql](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/migrations/0002_blue_texas_twister.sql#L1-L2)).

---

## 4. Problema Técnico (Por que o modelo atual conflita com o objetivo)

### 4.1. A solicitação e o recebimento competem pelo controle do “estado do card”

Hoje, `purchase_requests.currentPhase` serve ao mesmo tempo para:

- representar o **estado do processo de compras** (solicitação → aprovações → cotação → pedido de compra);
- representar o **estado do recebimento/conferência fiscal** (recebimento → conf fiscal → conclusão).

Isso força o fluxo de recebimento a “mexer” no estado da solicitação. Exemplo direto:
- Em [receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L690-L716), quando o último receipt de um PO é concluído, o backend atualiza `purchase_requests.currentPhase='conclusao_compra'`.

Esse acoplamento é exatamente o que os requisitos 1, 4 e 5 querem eliminar.

### 4.2. Rollbacks e deleções “por fase” causam perda de rastreabilidade

O rollback Conf. Fiscal → Recebimento pode apagar registros de receipt e dependências ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L2388-L2467)). Em um modelo onde recebimentos são entidades independentes, deleção/rollback deve ser:

- restrita;
- sempre auditada com granularidade por receipt;
- preferencialmente modelada via “cancelamento” (soft delete) e não via delete físico.

### 4.3. Inconsistências potenciais em validação de fases no Kanban

O endpoint `PATCH /api/purchase-requests/:id/update-phase` valida um conjunto fixo de fases e não inclui `conf_fiscal` na lista (apesar de existir lógica específica para `newPhase === 'conf_fiscal'`) ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L4916-L4997)). Isso reforça que a fase fiscal está sendo tratada como “exceção” e não como first-class no controle do Kanban.

---

## 5. Modelo Alvo (Desacoplado)

### 5.1. Princípio: dois ciclos de vida distintos

1) **Ciclo de vida da Solicitação (Procurement Lifecycle)**  
Encerra-se quando a solicitação entra no “ponto de handoff” para recebimento. A partir daí, a solicitação deve ficar “Concluída” do ponto de vista do Kanban de compras, sem depender de recebimentos.

2) **Ciclo de vida do Recebimento (Receiving Lifecycle)**  
Cada receipt/card segue seu próprio ciclo:
- Em Recebimento Físico
- Em Conf. Fiscal
- Concluído (por receipt), com integração ERP e auditoria próprias

### 5.2. Entidade recomendada para “card de recebimento”

Recomendação: **reaproveitar `receipts` como card**, mas evoluindo a modelagem para cobrir os estados “antes de NF” e garantindo vínculo direto com a solicitação.

Isso minimiza a criação de novas tabelas, pois `receipts` já agrega:
- dados fiscais (NF/serviço/avulso),
- integrações (Locador),
- itens e rateio,
- e já suporta múltiplos registros por PO.

#### Novos campos recomendados em `receipts`

1) `purchase_request_id` (FK → `purchase_requests.id`)  
Motivos:
- simplifica consultas e auditoria sem depender de join com `purchase_orders`;
- melhora rastreabilidade e consistência ao longo do tempo;
- facilita board de “receipts” sem custo de joins complexos.

2) `workflow_phase` (ou reutilizar `status` com mapeamento claro para colunas do Kanban fiscal)  
Opções:
- (Preferível) adicionar `receipt_phase` enum para fase Kanban (ex.: `recebimento_fisico`, `conf_fiscal`, `concluido`, `cancelado`) e manter `status` para estado operacional/integracional.
- (Alternativa) padronizar `receipts.status` como “fase + substatus”, formalizando o mapeamento.

3) `source_type` / `created_from` (opcional)  
Ex.: `created_from='physical_receipt'|'xml_import'|'manual'`. Ajuda auditoria e relatórios.

4) `is_cancelled` + `cancelled_at/by` (se for necessário substituir deletes físicos por cancelamento).

#### Vinculação com parcialidades (itens e quantidades)

O controle de “quanto já foi recebido” deve continuar em `purchase_order_items.quantity_received` (saldo total atendido), mas cada receipt deve carregar:
- os itens/quantidades da remessa (`receipt_items.quantity_received` ou `receipt_items.quantity` conforme convenção adotada);
- garantia de validação: soma de recebimentos por item não pode exceder `purchase_order_items.quantity`.

Esse padrão já existe em parte na validação de `confirm-physical` ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3221-L3283)).

### 5.3. Estado “Concluída” da solicitação

Recomendação: introduzir uma camada explícita de “status de encerramento” para a solicitação, evitando reuso ambíguo de `current_phase`.

Opções:

- Opção A (compatível e segura): adicionar campos:
  - `purchase_requests.procurement_status` (ex.: `aberta|concluida|cancelada`)
  - `purchase_requests.procurement_concluded_at/by_id`
  - Manter `current_phase` apenas para fases de compras até `pedido_compra` (ou manter para histórico, mas não depender dele para recebimento).

- Opção B (mudança maior): adicionar uma fase `concluida` em `current_phase` e parar de usar `current_phase` para recebimento/conf fiscal.

Este documento assume a Opção A como recomendação, por reduzir impacto em filtros/relatórios e permitir transição gradual.

---

## 6. Regras de Negócio (Modelo Alvo)

### 6.1. Handoff: Pedido de Compra → Recebimento (conclusão automática da solicitação)

Quando a solicitação for movida para “Recebimento”:

- A solicitação deve ser marcada como “Concluída” (novo `procurement_status='concluida'`) imediatamente.
- A solicitação deixa de ser controlada pelos status dos receipts.
- Devem ser criados 1..N cards de recebimento (receipts) conforme regra:
  - padrão: criar 1 receipt “aberto”/em `recebimento_fisico` (ou status equivalente).
  - se já houver receipts associados ao PO, não criar duplicado; apenas garantir consistência do vínculo e fase.

### 6.2. Criação de cards de recebimento (recebimentos parciais)

Permitir múltiplos receipts associados à mesma solicitação/PO:

- “Novo Recebimento” cria um novo receipt em fase `recebimento_fisico`.
- Cada receipt representa uma remessa/nota/serviço/avulso independente.
- Regras de consistência:
  - O receipt deve referenciar `purchase_order_id` e `purchase_request_id`.
  - O receipt pode existir sem NF (rascunho) e ser complementado posteriormente.

### 6.3. Recebimento Físico (por receipt)

Ao confirmar recebimento físico de um receipt:

- Registrar itens e quantidades do lote naquele receipt.
- Atualizar `purchase_order_items.quantity_received` somando o lote.
- Atualizar `purchase_orders.fulfillment_status` com base no saldo total.
- Transicionar o receipt para fase `conf_fiscal` (ou status equivalente).
- Registrar auditoria do evento por receipt e no histórico da solicitação.

### 6.4. Conf. Fiscal (por receipt)

Ao concluir conferência fiscal de um receipt:

- Atualizar status/fase do receipt para `concluido` (ou status final equivalente: `integrado_locador` / `fiscal_conferida`).
- A solicitação **não deve** ser alterada.
- Se ERP estiver ativo:
  - enviar integração por receipt e persistir o resultado (`integration_message`, `locador_receipt_id`, etc.).
- Se ERP estiver desabilitado:
  - concluir localmente por receipt (sem afetar solicitação).

### 6.5. Rollbacks e correções

Principais ajustes no modelo:

- “Voltar para Recebimento” deve atuar **no receipt** (card), não na solicitação.
- Evitar deleção física automática de receipts e dependências; preferir:
  - marcação de cancelamento,
  - ou “reabertura” do receipt (revertendo fase/status), mantendo trilha completa.

---

## 7. Pontos de Integração a Modificar (Mapeamento Completo)

### 7.1. Backend (rotas e serviços)

Rotas que hoje acoplam request ↔ receipts e devem ser alteradas:

- `POST /api/purchase-requests/:id/confirm-physical`  
  - Hoje: atualiza `purchase_requests.currentPhase` quando tudo recebido.  
  - Novo: não deve mexer na solicitação; deve operar por receipt e transicionar somente o receipt.
  - Ref atual: [routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3210-L3356)

- `POST /api/purchase-requests/:id/confirm-fiscal`  
  - Hoje: conclui a solicitação (`currentPhase='conclusao_compra'`).  
  - Novo: deve ser removido/obsoleto (ou convertido para operar no receipt, sem tocar na solicitação).
  - Ref atual: [routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L3364-L3432)

- Finalização por receipt (sem ERP/ERP):
  - Hoje: conclui a solicitação se não houver pendentes.
  - Novo: não deve concluir a solicitação; apenas o receipt.
  - Ref: [receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L690-L716) e [receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L863-L887)

- `POST /api/requests/:id/return-to-receipt` e `storage.returnToPhysicalReceipt`
  - Hoje: rollback altera fase da solicitação e apaga receipts.
  - Novo: rollback deve operar em receipt, com regras de cancelamento/reabertura e auditoria.
  - Ref: [receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L1199-L1227) e [storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L2388-L2467)

Query de Kanban:
- `GET /api/purchase-requests` hoje injeta `hasPendingFiscal` via receipts.status ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L934-L950)).  
No modelo alvo, a visualização fiscal deve vir do board de receipts.

### 7.2. Frontend (Kanban, modais e páginas)

Componentes que mudam de forma estrutural:

- Board: [kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/kanban-board.tsx)
  - Hoje: só renderiza cards de `purchase_requests`.
  - Novo: precisa renderizar:
    - cards de solicitação em “Pedido de Compra” (e fases anteriores),
    - cards de recebimento em “Recebimento Físico” e “Conf. Fiscal”,
    - e manter filtros e permissões coerentes.
  - Alternativa de menor risco: criar uma aba/board específico de Recebimentos.

- Recebimento: [receipt-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/receipt-phase.tsx)
  - Hoje: confirma recebimento físico “por request” (`/confirm-physical`).
  - Novo: confirma recebimento físico “por receipt card”.

- Conf. Fiscal: [fiscal-conference-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/components/fiscal-conference-phase.tsx)
  - Hoje: lista receipts do PO e muda receipts.status, com efeitos colaterais no request.
  - Novo: opera igual, porém sem efeitos no request, e com navegação baseada no receipt card.

### 7.3. Notificações, Realtime e Auditoria

- Notificação de conclusão da solicitação é disparada no backend ao mover para `conclusao_compra` (ex.: [routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5137-L5144)).
- No modelo alvo:
  - notificação “solicitação concluída” deve disparar no handoff Pedido de Compra → Recebimento (procurement concluído);
  - notificação “receipt concluído” pode ser nova, opcional, e disparar por receipt.

Realtime:
- Hoje, mudanças de fase publicam em canal de purchase requests ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L5146-L5150)).
- Novo: deve existir canal/eventos para receipts (criado, fase alterada, concluído).

Auditoria:
- Hoje há logs variados em `audit_logs`, mas alguns caminhos usam `purchase_request_id` incorreto (ex.: inserção com `0` em fluxo fiscal local) ([receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L718-L721)).
- Novo: receipt events devem carregar:
  - `purchase_request_id` correto,
  - `receipt_id`,
  - antes/depois de fase/status,
  - usuário e timestamp.

---

## 8. Especificação de API (Criar/Modificar)

### 8.1. Endpoints recomendados (modelo alvo)

#### Board de Recebimentos (cards)

- `GET /api/receipts/board?filters...`
  - Retorna receipts (cards) com campos de board:
    - `id`, `purchaseRequestId`, `purchaseOrderId`, `phase/status`, `supplier`, `receiptNumber`, `createdAt`, `updatedAt`, indicadores (pendências, erro integração).

#### Criação de receipt card (parcial)

- `POST /api/purchase-requests/:id/receipts`
  - Cria um receipt “vazio” (rascunho) em fase `recebimento_fisico`.
  - Opcional: parâmetros iniciais (tipo, fornecedor, observações).

#### Movimento do receipt card no Kanban fiscal

- `PATCH /api/receipts/:id/update-phase`
  - Muda fase do receipt card (`recebimento_fisico` ⇄ `conf_fiscal` ⇄ `concluido`), com validações:
    - não permitir ir para `conf_fiscal` sem confirmação de físico;
    - não permitir concluir sem fiscal (salvo fluxo “sem ERP”).

#### Confirmação de recebimento físico por receipt

- `POST /api/receipts/:id/confirm-physical`
  - Payload: `receivedQuantities`, `observations`, etc.
  - Atualiza `purchase_order_items.quantity_received`, `receipt_items`, e seta fase/status do receipt para `conf_fiscal`.
  - Não altera `purchase_requests`.

#### Confirmação fiscal por receipt (ERP ou sem ERP)

- `POST /api/receipts/:id/confirm-fiscal` (ERP ativo)  
- `POST /api/receipts/:id/finish-without-erp` (já existe; ajustar para não mexer em request)

### 8.2. Endpoints que devem ser descontinuados ou re-semantizados

- `POST /api/purchase-requests/:id/confirm-fiscal` (por request) deve ser removido/obsoleto.
- `POST /api/purchase-requests/:id/confirm-physical` deve ser movido para receipt.
- `POST /api/requests/:id/return-to-receipt` deve virar rollback do receipt (não do request).

---

## 9. Impacto em Relatórios e Dashboards

### 9.1. Impacto principal: `purchase_requests.currentPhase` deixa de representar recebimento/fiscal

Pontos que dependem de `currentPhase` e precisarão de ajuste:

- Dashboard executivo filtra e contabiliza por `currentPhase` ([dashboard.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/pages/dashboard.tsx#L110-L136), [routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L7814-L7997)).
- Relatório de solicitações usa `pr.current_phase` no SQL e filtro por fase ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L1147-L1257)).

No modelo alvo:
- Solicitações podem parar em “Pedido de Compra” como fase do processo e ter `procurement_status='concluida'`.
- Métricas de recebimento/fiscal passam a ser calculadas por receipts:
  - contagem por fase/status do receipt;
  - lead time físico/fiscal por receipt;
  - backlog em Conf. Fiscal por receipt.

### 9.2. Relatórios específicos de NF/receipts

O relatório de notas (Invoices) já é receipt-centrado e tende a sofrer pouco impacto, exceto por novos status/fases ([invoices-report.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/pages/invoices-report.tsx#L53-L68), [receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L67-L119)).

### 9.3. Impacto em PDFs públicos e “Resumo de Conclusão”

Há endpoints de PDF que hoje usam `purchase_requests.currentPhase` como gate/regra de disponibilidade; com o desacoplamento, essas regras precisam migrar para condições baseadas em dados (existência de PO, evidência de aprovação, status de procurement), senão o sistema pode:

- negar PDF publicamente mesmo com PO existente; ou
- liberar/ocultar PDF em fase incorreta.

Pontos a ajustar:

- PDF público do pedido:
  - `GET /api/public/purchase-request/:id/pdf` condiciona por `currentPhase ∈ {pedido_compra, conclusao_compra, recebimento, arquivado}` ([routes/index.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/index.ts#L113-L165)).
  - `GET /api/public/purchase-request/:id` expõe `hasPurchaseOrderPdf` com a mesma regra ([routes/index.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/index.ts#L26-L111)).
  - Recomendação: trocar a regra por “existe PO para a request” (e, se necessário, status do PO), não por `currentPhase`.

- PDF de aprovação A2:
  - `GET /api/purchase-requests/:id/approval-a2-pdf` hoje condiciona por fase ([routes/index.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/index.ts#L167-L234)).
  - Recomendação: condicionar por evidência de aprovação A2 (campos `approvedA2/approvalDateA2` e/ou `approval_history`), não por `currentPhase`.

- PDF de “Resumo de Conclusão”:
  - `GET /api/purchase-requests/:id/completion-summary-pdf` usa `storage.getCompleteTimeline` ([routes.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes.ts#L8554-L8613)).
  - O timeline hoje identifica “conclusão” por `request.currentPhase` ([storage.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/storage.ts#L2764-L2797)).
  - Recomendação: migrar para o novo estado de encerramento do ciclo de compras (`procurement_status`), mantendo receipts como eventos independentes no timeline.

---

## 10. Plano de Migração de Dados (Histórico → Modelo Alvo)

### 10.1. Objetivos da migração

- Preservar rastreabilidade histórica da solicitação.
- Garantir que solicitações não sejam mais “re-finalizadas” por eventos de receipt.
- Garantir que recebimentos já existentes sejam reconhecidos como cards independentes.

### 10.2. Estratégia em fases

1) **Adicionar colunas/tabelas sem alterar comportamento** (deploy 1)
- Adicionar `purchase_requests.procurement_status` e `procurement_concluded_at/by`.
- Adicionar `receipts.purchase_request_id` (preenchido por join via `purchase_orders.purchase_request_id`).
- Adicionar (opcional) tabela/eventos `receipt_events` ou padronizar `audit_logs` para receipts.

2) **Backfill histórico**
- `UPDATE receipts SET purchase_request_id = purchase_orders.purchase_request_id FROM purchase_orders WHERE receipts.purchase_order_id = purchase_orders.id AND receipts.purchase_request_id IS NULL`.
- Para `purchase_requests` em fases `recebimento|conf_fiscal|conclusao_compra`:
  - definir `procurement_status='concluida'` e `procurement_concluded_at` com melhor aproximação disponível (ex.: `purchase_date` ou `received_date`, ou `updated_at`).
- Garantir que `audit_logs` existentes sejam reprocessáveis para timeline (sem apagar histórico).

3) **Trocar comportamento (feature flag)**
- Parar de atualizar `purchase_requests.currentPhase` em fluxos de receipt/fiscal.
- Handoff para recebimento passa a marcar procurement como concluído.
- UI passa a exibir board de receipts.

4) **Remover/obsoletar rotas antigas**
- Descontinuar endpoints “por request” de fiscal/físico e rollback.

### 10.3. Migração de timeline/histórico

Recomendação:
- Estender `storage.getCompleteTimeline(purchaseRequestId)` para incluir:
  - eventos de receipts (criado, físico confirmado, fiscal concluído, erro integração, cancelado/reaberto),
  - com link direto para o receipt.
- Se usar `audit_logs` para receipts, padronizar `action_type` (ex.: `RECEIPT_CREATED`, `RECEIPT_PHYSICAL_CONFIRMED`, etc.) e preencher `purchase_request_id` corretamente.

---

## 11. Critérios de Aceitação e Casos de Teste

### 11.1. Critérios de aceitação

1) Ao mover solicitação de “Pedido de Compra” para “Recebimento”, a solicitação:
   - fica marcada como “Concluída” no contexto de procurement;
   - não muda seu status por eventos de receipts/fiscal.
2) Um mesmo PO/solicitação permite criar múltiplos receipts/cards.
3) Cada receipt pode:
   - avançar para “Conf. Fiscal” sem afetar a solicitação;
   - ser concluído individualmente.
4) Rollback/reabertura de um receipt não altera o status da solicitação e preserva rastreabilidade.
5) Validação estrita impede recebimento acima do pedido (somatório de receipts por item).
6) Auditoria registra todos os eventos críticos (quem/quando/antes/depois) para solicitação e receipts.

### 11.2. Casos de teste (alto nível)

- **T01 — Handoff conclui solicitação**
  - Dado: solicitação em `pedido_compra` com PO criado.
  - Quando: usuário move para recebimento.
  - Então: `procurement_status='concluida'`, e criação (ou ativação) de um receipt card em `recebimento_fisico`.

- **T02 — Recebimento parcial cria múltiplos cards**
  - Dado: item de PO com quantidade 10.
  - Quando: criar 2 receipts e receber 4 no primeiro e 6 no segundo.
  - Então: `quantity_received=10`, `fulfillment_status='fulfilled'`, e ambos receipts concluíveis fiscalmente.

- **T03 — Mover receipt para Conf. Fiscal não altera solicitação**
  - Dado: solicitação concluída e receipt em físico.
  - Quando: receipt avança para `conf_fiscal`.
  - Então: nenhum update em `purchase_requests` (exceto auditoria vinculada).

- **T04 — Concluir fiscal por receipt (ERP off)**
  - Dado: receipt em `conf_fiscal`, ERP desabilitado.
  - Quando: finalizar local.
  - Então: receipt marcado como finalizado e solicitação inalterada.

- **T05 — Undo/reabertura de receipt preserva histórico**
  - Dado: receipt concluído.
  - Quando: ação administrativa de reabertura.
  - Então: receipt retorna para fase anterior com auditoria completa e sem deleção física.

- **T06 — Regressão: solicitação não finaliza incorretamente**
  - Dado: recebimento concluído fiscalmente.
  - Quando: concluir receipt.
  - Então: não existe update em `purchase_requests.currentPhase` relacionado a receipt.

---

## 12. Requisitos de Auditoria e Conformidade

### 12.1. Eventos auditáveis mínimos

Para cada receipt:
- Criação do receipt (incluindo origem).
- Confirmação de recebimento físico (itens/quantidades).
- Mudança de fase (físico → fiscal → concluído).
- Resultado da integração ERP (sucesso/erro + payload mínimo, sem dados sensíveis).
- Reabertura/cancelamento.

Para cada solicitação:
- Handoff para recebimento (encerramento procurement).
- Qualquer alteração manual de status de procurement.
- Associação/desassociação de receipts.

### 12.2. Estrutura recomendada para auditoria

Opção recomendada:
- Estender `audit_logs` para suportar receipts com campos adicionais:
  - `receipt_id`,
  - `action_scope` (`REQUEST`/`RECEIPT`),
  - `before_data`, `after_data` com `phase/status`.

Alternativa:
- Criar `receipt_audit_logs` separado e consolidar no timeline por `purchase_request_id`.

### 12.3. Requisitos de imutabilidade

- Evitar deleções físicas em receipts após qualquer integração ou conclusão fiscal.
- Se necessário “corrigir”, registrar como nova versão (novo receipt) ou reabertura com trilha completa.

---

## 13. Decisões de Design em Aberto (para alinhamento interno)

1) Kanban único (misturando cards de request e receipt) vs dois boards (Compras e Recebimentos).
2) “Concluída” como coluna/fase de `purchase_requests.current_phase` vs `procurement_status` independente.
3) Introdução de enum `receipt_phase` vs padronização do `receipt_status`.
4) Política de rollback: reabertura/cancelamento vs delete físico.

Este documento recomenda:
- dois ciclos de vida explícitos,
- `procurement_status` em `purchase_requests`,
- `purchase_request_id` em `receipts`,
- e receipts como cards independentes do board fiscal.
