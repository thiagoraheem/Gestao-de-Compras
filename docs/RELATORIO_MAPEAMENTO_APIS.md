# Relatório de Mapeamento de APIs (Frontend ↔ Backend)

Este relatório mapeia, página a página, as chamadas de API realizadas no frontend e compara com os endpoints realmente disponíveis no backend. Para cada chamada, são descritos caminho, método, parâmetros, formato esperado de resposta e contexto de uso. Ao final, há uma análise de discrepâncias e recomendações.

## Abordagem
- Fonte frontend: arquivos em `client/src/pages`, `client/src/components`, `client/src/hooks` (varredura por `apiRequest(...)` e `fetch(...)`).
- Fonte backend: arquivos em `server/routes.ts` e `server/routes/*` (varredura por `app.get|post|put|delete`).
- Referências de código são dadas no formato `file_path:line_number`.

---

## Mapeamento por Página/Componente

### suppliers-report.tsx
- Endpoint: `/api/suppliers` (GET)
  - Parâmetros: nenhum
  - Resposta: `Supplier[]` com ao menos `id`, `name`
  - Contexto: preencher lista de fornecedores para seleção (`client/src/pages/suppliers-report.tsx:72-77`)
  - Backend: `server/routes.ts:838` (GET, protegido `isAuthenticated`)
- Endpoint: `/api/reports/suppliers?supplierId={id}&startDate={yyyy-mm-dd}&endDate={yyyy-mm-dd}` (GET)
  - Parâmetros: `supplierId` obrigatório; `startDate`/`endDate` opcionais quando período = "range"
  - Resposta: `SupplierReportResponse` com `supplier`, `metrics`, `quotations` (vide tipos no frontend em `client/src/pages/suppliers-report.tsx:40-62`)
  - Contexto: gerar relatórios e indicadores para fornecedor selecionado (`client/src/pages/suppliers-report.tsx:79-96`)
  - Backend: `server/routes.ts:6911-6933` (GET, sem `isAuthenticated`, requer `supplierId` numérico)

### receipt-form.tsx
- Endpoint: `/api/centros-custo` (GET)
  - Parâmetros: nenhum
  - Resposta: `CostCenter[]`
  - Contexto: popular seleção de centros de custo (`client/src/pages/receipt-form.tsx:57-60`)
  - Backend: `server/routes/master-data.ts:6-9` (GET, sem `isAuthenticated`)
- Endpoint: `/api/plano-contas` (GET)
  - Parâmetros: nenhum
  - Resposta: esperado: lista de contas contábeis; atual: `[]`
  - Contexto: popular seleção de plano de contas (`client/src/pages/receipt-form.tsx:57-60`)
  - Backend: `server/routes/master-data.ts:11-13` (GET, sem `isAuthenticated`, retorna `[]`)
- Endpoint: `/api/purchase-orders/{id}` (GET)
  - Parâmetros: `id` na URL
  - Resposta: objeto de pedido de compra
  - Contexto: carregar PO para comparação com NF (`client/src/pages/receipt-form.tsx:76-81`)
  - Backend: `server/routes.ts:2359-2373` (GET, sem `isAuthenticated`)
- Endpoint: `/api/purchase-orders/{id}/items` (GET)
  - Parâmetros: `id` na URL
  - Resposta: lista de itens do pedido de compra
  - Contexto: comparar itens do PO com itens do XML (`client/src/pages/receipt-form.tsx:76-81`)
  - Backend: `server/routes.ts:2394-2402` (GET, sem `isAuthenticated`)
- Endpoint: `/api/recebimentos` (POST)
  - Parâmetros: body JSON com dados do formulário (ver `schema` em `client/src/pages/receipt-form.tsx:17-33`)
  - Resposta: sucesso genérico JSON
  - Contexto: salvar rascunho de recebimento (`client/src/pages/receipt-form.tsx:94-106`)
  - Backend: `server/routes/receipts.ts:75-86` (POST, sem `isAuthenticated`)
- Endpoint: `/api/recebimentos/import-xml` (POST)
  - Parâmetros: `multipart/form-data` com arquivo `file` (XML)
  - Resposta: `{ preview: { header, items, installments, totals } }` ou `preview` direto
  - Contexto: importar NF-e e pré-preencher dados (`client/src/pages/receipt-form.tsx:108-136`)
  - Backend: `server/routes/receipts.ts:44-73` (POST, sem `isAuthenticated`)

### users.tsx
- Endpoint: `/api/users` (GET)
  - Parâmetros: nenhum
  - Resposta: lista de usuários
  - Contexto: carregar usuários para CRUD (`client/src/pages/users.tsx:71-74`)
  - Backend: `server/routes.ts:300-307` (GET, protegido)
- Endpoint: `/api/departments` (GET) / `/api/cost-centers` (GET)
  - Parâmetros: nenhum
  - Resposta: listas respectivas
  - Contexto: popular selects e validações (`client/src/pages/users.tsx:75-81`)
  - Backend: `server/routes.ts:609-617` (departments GET, protegido), `server/routes.ts:694-702` (cost-centers GET, protegido)
- Endpoint: `/api/users` (POST) ou `/api/users/{id}` (PUT)
  - Parâmetros: body JSON conforme formulário + `costCenterIds`
  - Resposta: usuário criado/atualizado
  - Contexto: criar/editar usuário (`client/src/pages/users.tsx:103-117`)
  - Backend: `server/routes.ts:329-383` (POST, protegido/admin), `server/routes.ts:386-472` (PUT, protegido/admin)
- Endpoint: `/api/users/{id}/can-delete` (GET)
  - Parâmetros: `id`
  - Resposta: `{ canDelete: boolean, reason?: string, associatedRequests?: number }`
  - Contexto: validar exclusão antes de confirmar (`client/src/pages/users.tsx:204-219`)
  - Backend: `server/routes.ts:473-490` (GET, protegido)
- Endpoint: `/api/users/{id}` (DELETE)
  - Parâmetros: `id`
  - Resposta: `{ success: true }` ou erro detalhado
  - Contexto: exclusão de usuário (`client/src/pages/users.tsx:232-266`)
  - Backend: `server/routes.ts:492-554` (DELETE, protegido/admin)
- Endpoint: `/api/users/{id}/cost-centers` (GET)
  - Parâmetros: `id`
  - Resposta: `number[]` de centros de custo
  - Contexto: carregar vínculos durante edição (`client/src/pages/users.tsx:290-291`)
  - Backend: `server/routes.ts:597-606` (GET, protegido)

### companies.tsx
- Endpoints: `/api/companies` (GET/POST), `/api/companies/{id}` (PUT/DELETE)
  - Parâmetros: CRUD padrão
  - Resposta: entidades de empresas
  - Contexto: gestão de empresas (`client/src/pages/companies.tsx:36-93`)
  - Backend: `server/routes.ts:136-243` (GET/POST/PUT/DELETE, protegidos; POST/PUT/DELETE exigem admin)

### delivery-locations.tsx
- Endpoints: `/api/delivery-locations` (GET/POST), `/api/delivery-locations/{id}` (PUT/DELETE)
  - Parâmetros: CRUD padrão
  - Resposta: locais de entrega
  - Contexto: gestão de locais (`client/src/pages/delivery-locations.tsx:34-88`)
  - Backend: `server/routes.ts:1138-1243` (GET/POST/PUT/DELETE, protegidos; escrita exige admin)

### approval-config.tsx
- Endpoints: `/api/approval-rules/config` (GET/POST), `/api/approval-rules/config/history` (GET)
  - Parâmetros: config de regras de aprovação
  - Resposta: config atual e histórico
  - Contexto: configuração A1/A2 (`client/src/pages/approval-config.tsx:75-98`)
  - Backend: `server/routes/approval-rules.ts:27-35` (GET), `server/routes/approval-rules.ts:302-320` (POST), `server/routes/approval-rules.ts:322-330` (GET histórico) — protegidos e partes exigem admin

### admin-super-user.tsx
- Endpoint: `/api/admin/purchase-requests/search/{requestNumber}` (GET)
  - Parâmetros: `requestNumber`
  - Resposta: solicitação encontrada
  - Contexto: busca avançada (`client/src/pages/admin-super-user.tsx:54`)
  - Backend: `server/routes.ts:2405-2419` (GET, protegido/admin)
- Endpoint: `/api/admin/purchase-requests/{id}` (PUT)
  - Parâmetros: `id`, body com alterações
  - Resposta: solicitação atualizada
  - Contexto: edição administrativa (`client/src/pages/admin-super-user.tsx:101-112`)
  - Backend: presente em blocos de atualização de `purchase-requests` (ex.: `server/routes.ts:1376-1491`)

### admin-cleanup.tsx
- Endpoint: `/api/admin/cleanup-purchase-data` (POST)
  - Parâmetros: `{ confirmationText: "CONFIRMAR LIMPEZA" }`
  - Resposta: `{ message, details: { removed[], maintained[] } }`
  - Contexto: limpeza de dados de compra (`client/src/pages/admin-cleanup.tsx:25`)
  - Backend: `server/routes.ts:6545-6587` (POST, protegido/admin)

### dashboard.tsx
- Endpoint: `/api/dashboard` (GET)
  - Parâmetros: `period`, `department`, `status`, `startDate`, `endDate`, `dateFilterType`
  - Resposta: `DashboardData`
  - Contexto: visão executiva com filtros (`client/src/pages/dashboard.tsx:128-136`)
  - Backend: `server/routes.ts:5874-6333` (GET, protegido)
- Endpoint: `/api/dashboard/export-pdf` (GET)
  - Parâmetros: mesmos filtros
  - Resposta: `application/pdf` (binário)
  - Contexto: exportação de PDF (`client/src/pages/dashboard.tsx:142-167`)
  - Backend: `server/routes.ts:6333-6488` (GET, protegido)

### Auth e Perfil
- Endpoint: `/api/auth/forgot-password` (POST)
  - Contexto: recuperar senha (`client/src/pages/forgot-password.tsx:26`)
  - Backend: `server/routes/auth.ts:142-184`
- Endpoint: `/api/auth/validate-reset-token` (POST) e `/api/auth/reset-password` (POST)
  - Contexto: reset de senha (`client/src/pages/reset-password.tsx:44-56`)
  - Backend: `server/routes/auth.ts:185-212`
- Endpoint: `/api/users/{id}/change-password` (POST)
  - Contexto: alterar senha (`client/src/pages/change-password.tsx:39`)
  - Backend: presente no bloco de usuários (rota de mudança de senha)
- Endpoint: `/api/auth/check` (GET)
  - Contexto: validação de sessão (invalidado pós atualização de perfil) (`client/src/pages/profile.tsx:43`)
  - Backend: `server/routes/auth.ts:110-140`

### Público
- Endpoint: `/api/public/purchase-request/{id}` (GET) e `/api/public/purchase-request/{id}/pdf` (GET)
  - Contexto: visualização pública de solicitação e PDF (`client/src/pages/public-request-view.tsx:70-84`)
  - Backend: `server/routes/index.ts:22-108` (ambos GET, públicos)

### RFQ e Cotações
- Endpoints: `/api/quotations/{id}` (GET), `/api/quotations/{id}/items` (GET), `/api/quotations/{id}/supplier-quotations` (GET)
  - Contexto: análise de RFQ (`client/src/pages/rfq-analysis.tsx:10-30`)
  - Backend: `server/routes.ts:3747-3831` (GETs, protegidos)

### Kanban e Listas
- Endpoints: `/api/departments` (GET), `/api/users` (GET), `/api/suppliers` (GET)
  - Contexto: filtros e dados de suporte (`client/src/pages/kanban.tsx:37-49`, `client/src/pages/list.tsx:35-47`, `client/src/pages/kanban-ios.tsx:36-48`)
  - Backend: `server/routes.ts:609-617`, `server/routes.ts:300-307`, `server/routes.ts:838-869` (GETs, protegidos)

### Notificações e Aprovações
- Endpoint: `/api/approvals/pending-count` (GET)
  - Contexto: badge de pendências (`client/src/hooks/useApprovalsBadge.ts:5-9`)
  - Backend: `server/routes/approvals.ts:8-14` (GET, protegido)
- Endpoint: `/api/notifications/vapid-public-key` (GET) e `/api/notifications/subscribe` (POST)
  - Contexto: push notifications (`client/src/hooks/useApprovalsBadge.ts:11-18`, `85-91`)
  - Backend: `server/routes/notifications.ts:10-25` (protegidos)

---

## Comparação e Discrepâncias

- Autenticação/Middleware
  - Observado: diversos endpoints críticos estão sem `isAuthenticated` no backend.
    - `GET /api/centros-custo` (`server/routes/master-data.ts:6-9`) — público
    - `GET /api/plano-contas` (`server/routes/master-data.ts:11-13`) — público
    - `GET /api/purchase-orders/{id}` (`server/routes.ts:2359-2373`) — público
    - `GET /api/purchase-orders/{id}/items` (`server/routes.ts:2394-2402`) — público
    - `GET /api/reports/suppliers` (`server/routes.ts:6911-6933`) — público
  - Risco: exposição indevida de dados internos; recomenda-se adicionar `isAuthenticated` onde apropriado.

- Endpoints faltantes ou incompletos
  - `GET /api/plano-contas`: retorna `[]` (placeholder). O frontend espera dados reais para seleção de contas. Implementar retorno correto e/ou sync (`server/routes/master-data.ts:11-13`).

- Compatibilidade de dados
  - Recebimentos XML: o frontend espera `preview` com `header`, `items`, `installments`, `totals` e está em conformidade com o backend (`server/routes/receipts.ts:44-73`).
  - Relatório de fornecedores: frontend exige `supplierId` e o backend valida como obrigatório; compatível (`client/src/pages/suppliers-report.tsx:81-96`, `server/routes.ts:6911-6933`).
  - Exportação PDF: frontend usa `fetch`/`blob` e backend devolve binário; compatível (`client/src/pages/dashboard.tsx:142-167`, `server/routes.ts:6333-6488`).

- Padrões de resposta
  - `apiRequest(...)` supõe JSON em sucesso/erro; rotas que retornam binário (PDF) devem usar `fetch` direto como já feito.

---

## Recomendações
- Proteger endpoints públicos indevidos adicionando `isAuthenticated`:
  - `purchase-orders` (GET por id e itens)
  - `reports/suppliers`
  - `master-data` (`centros-custo`, possivelmente `plano-contas`) se os dados forem internos
- Implementar `GET /api/plano-contas` retornando dados reais e adicionar um fluxo de sincronização via ERP se necessário.
- Padronizar mensagens de erro JSON com `{ message }` para coesão com `apiRequest` (`client/src/lib/queryClient.ts:16-40`).
- Revisar consistência de permissões (admin vs. buyer vs. receiver) nas rotas de escrita.

---

## Referências de Código
- Frontend
  - `client/src/pages/suppliers-report.tsx:72-96`
  - `client/src/pages/receipt-form.tsx:57-136`
  - `client/src/pages/users.tsx:71-219,232-266,290-291`
  - `client/src/pages/companies.tsx:36-93`
  - `client/src/pages/delivery-locations.tsx:34-88`
  - `client/src/pages/approval-config.tsx:75-98`
  - `client/src/pages/admin-super-user.tsx:54,101-112`
  - `client/src/pages/admin-cleanup.tsx:25`
  - `client/src/pages/dashboard.tsx:128-136,142-167`
  - `client/src/pages/public-request-view.tsx:70-84`
  - `client/src/pages/rfq-analysis.tsx:10-30`
  - `client/src/pages/kanban.tsx:37-49`, `client/src/pages/list.tsx:35-47`, `client/src/pages/kanban-ios.tsx:36-48`
  - `client/src/hooks/useApprovalsBadge.ts:5-18,85-91`
- Backend
  - `server/routes.ts:838-869` (suppliers)
  - `server/routes.ts:6911-6933` (reports/suppliers)
  - `server/routes/master-data.ts:6-13` (centros-custo, plano-contas)
  - `server/routes.ts:2359-2402` (purchase-orders)
  - `server/routes/receipts.ts:44-119` (recebimentos)
  - `server/routes.ts:300-606` (users)
  - `server/routes.ts:1138-1243` (delivery-locations)
  - `server/routes/approval-rules.ts:27-35,302-330` (approval-rules)
  - `server/routes.ts:2405-2419` (admin search)
  - `server/routes.ts:6545-6587` (admin cleanup)
  - `server/routes.ts:5874-6488` (dashboard)
  - `server/routes/index.ts:22-108` (public)
  - `server/routes.ts:3722-3831` (quotations)
  - `server/routes/approvals.ts:8-14` (approvals badge)
  - `server/routes/notifications.ts:10-25` (notifications)

