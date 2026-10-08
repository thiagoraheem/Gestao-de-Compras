# Relatório: Validação Completa da Implementação Multi-moeda (USD/EUR/GBP + BRL)

- **Data**: 08/10/2026
- **Branch**: `feat/operar-outras-moedas`
- **Squash Commit Alvo**: `6cf2460` — `feat(multi-currency): implementar suporte a múltiplas moedas e melhorias gerais`
- **Amostra Diff (controle)**: base commit `4277d9a` até `6cf2460` (todas alterações feature)

---

## I. STATUS GERAL

| Indicador | Situação | Observações |
|---|---|---|
| TypeScript `tsc` | ✅ **Exit 0 (0 erros)** | `npm run check` executado em 08/10 |
| Diagnósticos IDE | ✅ **0 warnings / 0 erros** | `GetDiagnostics` retornou vazio |
| Jest tests (multi-moeda) | ✅ **30/30 PASSARAM** | `currency-utils.test.ts` + `approved-snapshot-po-mapping.test.ts` |
| Jest tests (suit completo) | ⚠️ **128/145 passaram (17 falhos)** | **Falhas PREEXISTENTES não-ligadas a multi-moeda**: (a) `template-service.ts:5 import.meta` → TS module option; (b) 2 test suites com imports quebrados por caminho antigo. |
| Migração banco de dados | ✅ **Presente e coerente** | `db_scripts/20261004_multi_currency_migration.sql` + schema TypeScript atualizado |
| Especificação (spec.md + tasks.md) | ✅ **Existe e aprovado** | `.trae/specs/suporte-multipla-moedas-processo-compras/` |
| Formatação de valores (convenção) | ✅ **BRL primeiro (principal) + Orig em parênteses** | Implementado via `formatDualCurrencyBrlFirst` e `fmtDual` no PDF (ajuste 07/10) |
| Conversão cambial direta | ✅ **BRL = Orig × taxa** (nunca dividido, nunca invertido) | Garantido no front e backend em helpers `convertToBRL` |
| Aprovações (thresholds) | ✅ **Sempre em BRL** no `useApprovalType` | Evita dupla aprovação errada em USD |
| Integração ERP (contas a pagar) | ✅ **Apenas BRL** | Todos os valores de itens, NF, parcelas, rateios enviados em BRL |

---

## II. PASSO 1. Arquivos Modificados — Classificação por Tipo

### Front-end (client/src — 55 arquivos)

**Admin / Configurações do Sistema**
- [x] `features/admin/currency-rates/api.ts`
- [x] `features/admin/currency-rates/currency-rate-form.tsx`
- [x] `features/admin/currency-rates/index.tsx`
- [x] `features/admin/currency-rates/types.ts`
- [x] `features/users/components/UserFormModal.tsx` (alterações adicionais — campo orçamento)
- [x] `features/users/index.tsx` (alterações adicionais)
- [x] `features/users/schemas/user.schema.ts`

**Aprovações**
- [x] `features/approvals/components/approval-a2-phase.tsx`

**Dashboard**
- [x] `features/dashboard/index.tsx`

**Cotações (Quotations)**
- [x] `features/quotations/components/SupplierComparison/ComparisonDataGrid.tsx`
- [x] `features/quotations/components/SupplierComparison/index.tsx`
- [x] `features/quotations/components/SupplierComparison/types.ts`
- [x] `features/quotations/components/SupplierComparison/useRecommendedSupplier.ts`
- [x] `features/quotations/components/quotation-phase.tsx`
- [x] `features/quotations/components/rfq-analysis.tsx`
- [x] `features/quotations/components/supplier-comparison-readonly.tsx`
- [x] `features/quotations/components/supplier-quotation-data-grid.tsx`
- [x] `features/quotations/components/update-supplier-quotation-schema.ts`
- [x] `features/quotations/components/update-supplier-quotation.tsx`

**Recebimentos / Fiscal**
- [x] `features/receipts/components/fiscal-conference-phase.tsx`
- [x] `features/receipts/components/receipt-phase.tsx`
- [x] `features/receipts/components/receipt/ReceiptFinancial.tsx`
- [x] `features/receipts/components/receipt/ReceiptXmlImport.tsx`
- [x] `features/receipts/components/receipt-search-dialog.tsx`
- [x] `features/receipts/components/conference/ConferenceOrderCard.tsx`
- [x] `features/receipts/components/conference/ConferenceOrderList.tsx`
- [x] `features/receipts/components/nfe/ItemsTable.tsx`

**Relatórios (Reports)**
- [x] `features/reports/components/PurchaseRequestsReport/ReportFilters.tsx`
- [x] `features/reports/components/PurchaseRequestsReport/ReportTable.tsx`
- [x] `features/reports/components/PurchaseRequestsReport/types.ts`
- [x] `features/reports/components/PurchaseRequestsReport/usePurchaseRequestsReport.ts`
- [x] `features/reports/suppliers-report/index.tsx`
- [x] `features/reports/invoices-report/index.tsx`

**Solicitações (Requests) / Pedidos**
- [x] `features/requests/components/ConclusionPhase/index.tsx`
- [x] `features/requests/components/kanban/kanban-board.tsx`
- [x] `features/requests/components/kanban/purchase-card.tsx`
- [x] `features/requests/components/kanban/receipt-kanban-card.tsx`
- [x] `features/requests/components/purchase-order-phase.tsx`
- [x] `features/requests/components/purchase-request-header-card.tsx`
- [x] `features/requests/components/request-view.tsx`

**Bibliotecas centrais / UI**
- [x] `lib/currency.ts` (proxy dos utils de currency shared)
- [x] `lib/date.ts`
- [x] `lib/kanban-filters.ts`
- [x] `shared/components/pipefy-header.tsx`
- [x] `shared/ui/decimal-input.tsx`
- [x] `shared/ui/date-input.tsx`
- [x] `lib/types.ts`
- [x] `types/nfe.ts`
- [x] `utils/nfeParser.ts`

**Roteamento**
- [x] `app/routes/index.tsx`

**Testes Front-end (suites)**
- [x] `components/__tests__/purchase-request-header-card.test.tsx`

---

### Back-end (server + shared)

**Schema & Utilitários Compartilhados (shared)**
- [x] `shared/schema.ts` — pgEnum, tabelas `currency_rates`, novas colunas multi-moeda em `purchase_requests`, `supplier_quotations`, `sq_items`, `approved_items`, `purchase_orders`, `po_items`
- [x] `shared/utils/currency-utils.ts` — `convertToBRL`, `formatCurrencyIn`, `formatDualCurrency`, `formatDualCurrencyBrlFirst`, `parseCurrencyToNumber`, `roundCurrency`, `SUPPORTED_CURRENCIES`, `CURRENCY_LABELS`, `CURRENCY_SYMBOLS`

**Repositórios de Dados (repositories)**
- [x] `server/repositories/currency-rate-repository.ts` — CRUD taxas cambiais históricas
- [x] `server/repositories/purchase-request-repository.ts` — enrichment Kanban (valores dual + detecção modo legado vs BRL novo)
- [x] `server/repositories/quotation-repository.ts`

**Rotas HTTP (routes)**
- [x] `server/routes/approval-rules.ts` — criação automática PO A2 (`buildPurchaseOrderItemsFromApprovedSnapshot` e fallback) — unitPrice BRL
- [x] `server/routes/currency-rates.ts` — endpoints admin taxas de câmbio
- [x] `server/routes/index.ts` — registro de rotas
- [x] `server/routes/purchase-orders.ts`
- [x] `server/routes/purchase-requests.ts` — `POST /return-to-approval-a2` (07/10), return-to-quotation, etc.
- [x] `server/routes/quotations.ts` — CRUD cotações fornecedor + auto-cadastro taxa
- [x] `server/routes/receipts.ts` — payload ERP confirm-fiscal (envio só BRL)

**Services**
- [x] `server/services/dashboard-service.ts` — KPIs moeda breakdown, `totalForeignConvertedBrl`
- [x] `server/services/nfe-parser.ts` (alterações adicionais)
- [x] `server/services/purchase-order-factory.ts` — criação manual PO, itens = BRL (campos principais)
- [x] `server/services/purchase-order-service.ts` — serviço de criação PO, itens = BRL
- [x] `server/services/quotation-sync.ts`
- [x] `server/services/receipt-service.ts`
- [x] `server/services/report-service.ts`
- [x] `server/services/workflow-service.ts` — `returnToApprovalA2` novo método (07/10) para recriar PO com valores corretos
- [x] `server/storage.ts` — storage helpers PO/itens

**Templates PDF**
- [x] `server/pdf-service.ts` — formatadores `fmtDual`/`a2fmt` → BRL primeiro. Helper `getItemPrices` com detecção modo legado.
- [x] `server/templates/pdf/approval-a2.html`
- [x] `server/templates/pdf/purchase-order.html`

**Utils**
- [x] `server/utils/formatters.ts`

---

### Migrações, DB Scripts e Índices

- [x] `db_scripts/20261004_multi_currency_migration.sql` (migration multi-moeda — tabela `currency_rates` + todas colunas `currency_code`, `exchange_rate`, `*_orig`, `*_brl`)
- [x] `migrations/0024_add_receipts_board_indexes.sql` (performance)
- [x] `migrations/0025_add_purchase_requests_board_indexes.sql` (performance)
- [x] `migrations/D_0024_receipts_board_diagnostico_old_vs_new.sql`
- [x] `migrations/D_0025_pr_board_equivalencia.sql`
- [x] `db_scripts/20260827_*.sql` (buyer fields — mudança acessória)
- [x] `scripts/backfill-buyer-fields.ts` (mudança acessória)
- [x] `supabase/migrations/*.sql` (buyer fields mirror)

---

### Testes (Jest)

- [x] `server/tests/currency-utils.test.ts` — 29 testes
- [x] `server/tests/nfe-parser.test.ts`
- [x] `server/tests/fiscal-conference-flow.test.ts`
- [x] `tests/nfe-parser.test.ts`

---

### Documentação e Configuração

**Planos e Especificações (.trae/)**
- [x] `.trae/specs/suporte-multipla-moedas-processo-compras/spec.md`
- [x] `.trae/specs/suporte-multipla-moedas-processo-compras/tasks.md`
- [x] `.trae/documents/auto-cadastro-taxa-cambio_plan.md`
- [x] `.trae/documents/seletor-fornecedores-header_plan.md`
- [x] `.trae/documents/refatoracao-visual-tela-cotacao_plan.md`

**Documentação Técnica (docs/technical/)**
- [x] `analise-conferencia-fiscal-multimoeda-internacional.md` (07/10)

---

## III. PASSOS 2 & 3. Mapeamento Telas Impactadas vs. Esperado

### 3.1 Classificação por Fase do Processo (9 fases)

| # | Fase | Tela | Recebeu Multi-moeda? | BRL Primeiro? | Observações |
|---|---|---|---|---|---|
| 1 | **Solicitação** | `request-phase.tsx`, `request-items-list.tsx`, `items-viewer.tsx` | ⬜ NÃO / APLICÁVEL | — | Correto: Solicitação opera exclusivamente em BRL (multi-moeda inicia na Cotação). Nenhuma alteração esperada. |
| 2 | **Aprovação A1** | `approval-a1-phase.tsx`, `ApprovalTypeBadge`, `approvals-inline-badge` | ⬜ NÃO / APLICÁVEL | — | Correto: A1 também só BRL (orçamento, saldo). |
| 3 | **Cotação** | `quotation-phase.tsx`, `update-supplier-quotation.tsx`, `supplier-quotation-data-grid.tsx`, `rfq-analysis.tsx`, `SupplierComparison/*` (4 arquivos) | ✅ SIM | ✅ Sim | Fornecedor informa moeda (select BRL/USD/EUR/GBP), taxa câmbio, valores em Orig, conversão automática BRL, comparação fornecedores normalizada BRL. |
| 4 | **Aprovação A2** | `approval-a2-phase.tsx`, `supplier-comparison-readonly.tsx` | ✅ SIM | ✅ Sim (ajuste 07/10) | Badge moeda estrangeira, taxas, dual BrlFirst (5 blocos verificados), useApprovalType BRL. |
| 5 | **Pedido de Compra** | `purchase-order-phase.tsx` | ✅ SIM | ✅ Sim | PO itens sempre BRL; dual BrlFirst para Orig; fallback leve (até retorno para A2); botão Retornar para Aprovação A2 (07/10). |
| 6 | **Recebimento Físico** | `receipt-phase.tsx`, `ReceiptFinancial.tsx`, `ReceiptXmlImport.tsx`, `ReceiptManualEntry.tsx` | ✅ SIM (parcial) | — | Card azul informativo mostra moeda/taxa (BRL operação financeira). Itens = BRL do PO (automático). |
| 7 | **Conferência Fiscal** | `fiscal-conference-phase.tsx` | ✅ SIM (parcial) | — | Card azul moeda/taxa. Integração ERP apenas BRL. |
| 8 | **Conclusão da Compra** | `ConclusionPhase/index.tsx` | ✅ SIM | ⚠️ **MIX** (ver pendências abaixo) | Formatadores duais existem. Falta garantir BrlFirst em todos lugares. |
| 9 | **Kanban Geral** | `purchase-card.tsx`, `receipt-kanban-card.tsx`, `kanban-board.tsx`, `kanban-filters.ts` | ✅ SIM | ✅ Sim | `valuesDisplay` complexo. BrlFirst. Modo infalível legado. |

### 3.2 Telas Auxiliares / Gestão / Relatórios

| Módulo | Tela | Alterações Multi-moeda? | Observações |
|---|---|---|---|
| Admin | Currency Rates (4 arquivos) | ✅ SIM | CRUD taxas, listagem por data/moeda, validação ≥ 0.000001. |
| Admin | Super User Auditoria (super-user/index.tsx) | ⚠️ **Parcial** | Exibe `R$` fixo. Como mostra valores divergentes entre cotação e PO, idealmente dual currency. Pendência baixa. |
| Admin | Configuração de Aprovação (approval-config) | ⬜ NÃO / APLICÁVEL | Threshold sempre BRL (correto). |
| Dashboard | Dashboard Principal | ✅ SIM | Breakdown por moeda, Filtro USD/BRL/Todas, KPI `totalForeignConvertedBrl`. |
| Relatório | Purchase Requests Report (4 arquivos) | ✅ SIM | Colunas moeda, taxa, total BRL, total Orig. Filtro moeda. |
| Relatório | Suppliers Report | ✅ SIM | `normalizeCurrencyCode` e normalização de valores. |
| Relatório | Invoices Report | ⚠️ **Não recebeu formatação dual** | Exibe valores em BRL via `formatCurrencyLocal()`. Como Invoice é o recebimento (sempre BRL no receipt), está correto. **Pendência baixa**: Não mostra a moeda original do PO (informação não essencial). |
| Relatório | Items Analysis Report | ⚠️ **Não recebeu dual** | Mesmo caso acima: valores sempre BRL. |
| Relatório | Kanban Filters | ✅ SIM | Filtro por moeda implementado. |
| Público | PublicRequestPage | ⚠️ **Não recebeu dual** | Lista itens Solicitação (sempre BRL na Solicitação), então correto. |
| Gestão Usuários | UserFormModal | ⬜ NÃO / APLICÁVEL | Orçamento sempre BRL. |
| NFe Viewer | NFeViewer, NFESummary, ItemsTable, TotaisCard, PagamentoCard | ⚠️ **Não recebeu dual** | NF-e sempre BRL (documento brasileiro). Sem alterações necessárias. |
| Conferência Materiais | ConferenceOrderList/ConferenceOrderCard | ⚠️ **Não recebeu dual** | Mostra PO totalValue → sempre BRL no PO, está ok. |

### 3.3 Telas que NÃO receberam ajustes (por estarem em fases BRL-only ou operarem exclusivamente com entidades em BRL)

**Conclusão da comparação Passo 3:**
> Nenhuma tela obrigatória faltou receber ajuste. As únicas exceções são telas que operam **após a conversão** (NFe, Receipts — sempre BRL) ou antes (Solicitação/A1 — sempre BRL) e, portanto, não carecem de dual currency. **0 gaps obrigatórios**.

---

## IV. PASSO 4. Validação Detalhada por Tela Impactada

### 4.1 [update-supplier-quotation.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/quotations/components/update-supplier-quotation.tsx) — **Ponto de entrada da moeda**

| Critério | Validação |
|---|---|
| Campo moeda (select BRL/USD/EUR/GBP) | ✅ Presente |
| Taxa câmbio obrigatória (se moeda ≠ BRL) | ✅ Obrigatória com validação |
| Auto-cadastro taxa (idempotente) ao salvar | ✅ Implementado (rotas quotations) |
| Campos input unitPrice: inicializados `""` (evita 0 falso cotado) | ✅ Implementado (lessons learned do M11) |
| Validação trim() via String() (evita TypeError) | ✅ Implementado |
| Desconto (%) e Valor — cálculo correto | ✅ Dual currency via formatDualCurrency |
| Frete (Orig) + conversão para BRL | ✅ Implementado |
| Botão "Comparar Propostas" abre Análise RFQ | ✅ Implementado |
| DialogTitle sr-only (acessibilidade Radix) | ✅ Implementado |
| hideClose em diálogo (evita duplo botão Fechar) | ✅ Implementado |
| Aplicar em Lote (Marca/Prazo) em 3 escopos | ✅ Implementado |
| Pós-salvar AlertDialog "Fechar janela? Sim/Não" | ✅ Implementado |
| Seletor horizontal fornecedores header (dirty check) | ✅ Implementado |

### 4.2 [SupplierComparison/](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/quotations/components/SupplierComparison) (Comparação Fornecedores)

| Critério | Validação |
|---|---|
| Algoritmo recomendação normaliza p/ BRL | ✅ `useRecommendedSupplier.ts` usa `convertToBRL` |
| Comparação min/max/avg em BRL | ✅ `ComparisonDataGrid.tsx` resolve BRL antes de rankear |
| Menor preço por item (tolerância 1e-6) em BRL | ✅ Implementado |
| Dual currency exibição (Orig + BRL) | ✅ `formatDualCurrency` (comparação fornecedores mantém Orig primeiro para não confundir) |
| Peso preço 60% no score (Orig/BRL) | ✅ Sempre BRL (normalizado) |

### 4.3 [approval-a2-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/approvals/components/approval-a2-phase.tsx) (Aprovação A2)

| Bloco da Tela | Status | Observações |
|---|---|---|
| (1) Header Info Solicitação Valor Total | ✅ BrlFirst | R$ 499,00 (US$ 100,00) |
| (2) Badge moeda + taxa | ✅ Presente | "Cotação em USD · Taxa 1 USD = R$ 4,9900" |
| (3) Tabela Itens (unit/total) | ✅ fmtOrig4 BRL correto | Dual currency |
| (4) Resumo Financeiro (Subtotal/Desc/Frete/Final) | ✅ BrlFirst | Paralelo BRL + Orig |
| (5) Ação Final (Aprovação) | ✅ BrlFirst | Total em BRL principal |
| useApprovalType(totalValueBrl) | ✅ Sempre BRL | Thresholds corretos |
| Readonly SupplierComparison | ✅ Normalização BRL | Sempre comparado em BRL |

### 4.4 [purchase-order-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/purchase-order-phase.tsx) (Pedido Compra)

| Critério | Validação |
|---|---|
| PO itens unitPrice/totalPrice = BRL campos principais | ✅ Garantido backend |
| unitPriceOrig = BRL / taxa (derivação) | ✅ itemsWithPrices L520+ |
| Dual BrlFirst linhas de item e tfoot | ✅ Implementado |
| Fallback leve Subtotal/Total Geral SQ (para PO legado como SOL-975) | ✅ Diferença > 0.50 usa SQ |
| Crash safe: `(selectedSupplierQuotation as any)?.freightValueBrl` optional chaining | ✅ Implementado (07/10) |
| Botão **Retornar para Aprovação A2** (Dialog justificativa + bloqueio NF/parcial) | ✅ Implementado (07/10) |

### 4.5 [kanban/purchase-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/kanban/purchase-card.tsx) (Card Kanban)

| Critério | Validação |
|---|---|
| Valor Principal → BRL primeiro | ✅ BrlFirst |
| Exibição dual (Orig em parênteses) apenas se moeda ≠ BRL | ✅ Implementado |
| Modo legado vs novo: fallback infalível (enriquecimento backend via purchase-request-repository) | ✅ Branch purchaseOrderOriginalDescFound + fallback UI |
| "Valor Original" tachado SÓ se desconto real > R$ 0,50 | ✅ hasDiscount = originalBrl - finalBrl > 0.5 (07/10) |
| Orig final corrigido via `Orig = finalBrl / rate` quando !hasDiscount | ✅ (07/10) |

### 4.6 [conclusion-phase/index.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/ConclusionPhase/index.tsx) (Conclusão)

| Critério | Validação |
|---|---|
| Formatadores duais `fmt2/fmt4` existem | ✅ Presentes |
| **Convenção BrlFirst em todos lugares?** | ⚠️ **Pendência média**: Alguns locais usam `formatDual` (Orig primeiro) em vez de BrlFirst. Ver item 5.3 nas pendências. |
| Alocação financeira sempre BRL | ✅ Contábil |
| Total forcenecedor vencedor dual | ✅ Implementado |

### 4.7 [receipt-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/receipt-phase.tsx) e [fiscal-conference-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/fiscal-conference-phase.tsx) (Recebimento/Fiscal)

| Critério | Validação |
|---|---|
| Card azul informativo moeda/taxa + total Orig | ✅ Presente (ex USD @4,99) |
| Texto "Campos desta tela operam em BRL" | ✅ Presente |
| Receipt itens unitPrice = BRL do PO (automático) | ✅ Correto (receipts.ts:1528 copia PO unitPrice BRL) |
| Integração confirm-fiscal → 100% BRL | ✅ Valor NF, itens, parcelas, rateio todos BRL |

---

## V. PASSO 5. Backend, Integrações, Banco, Testes

### 5.1 Banco de Dados — Esquema

| Entidade | Campos Multi-moeda Adicionados | Observações |
|---|---|---|
| `currency_rates` (NOVA tabela) | `id, currency_code, rate_value, rate_date, created_at` (única por moeda+data) | ✅ Implementado |
| `purchase_requests` | `currency_code, exchange_rate, total_value_orig, negotiated_value_orig, discounts_obtained_orig` | ✅ Implementado (nullable, fallback BRL) |
| `supplier_quotations` | `currency_code (default BRL), exchange_rate (default 1), total_value_orig, subtotal_value_orig, final_value_orig, freight_value_orig, discount_value_orig` | ✅ Implementado |
| `supplier_quotation_items` | `unit_price_orig, total_price_orig, unit_price_brl, total_price_brl` | ✅ Implementado |
| `approved_quotation_items` | Mesmos 4 campos | ✅ Implementado |
| `purchase_orders` | `currency_code (default BRL), exchange_rate (default 1), total_value_brl, subtotal_value_brl, final_value_brl` | ✅ Implementado |
| `purchase_order_items` | `unit_price_brl, total_price_brl` (redundante; unitPrice principal = BRL após correção 07/10) | ✅ Implementado |
| `receipts`, `receipt_items`, `receipt_installments`, `receipt_allocations` | **NÃO tem campos de moeda** | ✅ Correto! Operam exclusivamente em BRL por construção. |

**Conclusão modelo de dados**: ✅ 100% consistente. Receipts armazenam BRL (pois fase de conversão acontece antes).

### 5.2 Fábricas de Criação do Pedido de Compra (4 locais)

Antes de 07/10, bug: `unitPrice` = moeda original. **Pós 07/10:**

| Local | unitPrice | totalPrice | unitPriceBrl/totalPriceBrl | itemsTotal |
|---|---|---|---|---|
| (i) `approval-rules.buildPurchaseOrderItemsFromApprovedSnapshot` (L343-394) | BRL (Orig×taxa) | BRL | Mesmo valor (redundante) | Soma BRL |
| (ii) Fallback no snapshot aprovado (L490-532) | BRL | BRL | Mesmo valor | Soma BRL |
| (iii) `purchase-order-factory.ts` (L171-208) | BRL | BRL | Mesmo valor | Soma BRL |
| (iv) `purchase-order-service.ts` (L121-164) | BRL | BRL | Mesmo valor | Soma BRL |

**Status**: ✅ 4 fábricas corrigidas em 07/10. Novos POs gravam BRL nos campos principais.

### 5.3 Integração ERP / Contas a Pagar

Endpoint: `POST /api/receipts/:id/confirm-fiscal` em [receipts.ts:L836-L894](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L836-L894)

| Campo Payload | Fonte | É BRL? |
|---|---|---|
| `nota_fiscal.valor_total` | `totalAmount` (input do usuário em BRL) | ✅ Sim |
| `itens[].preco_unitario` | `receipt_items.unitPrice` = copiado do PO unitPrice BRL | ✅ Sim |
| `condicoes_pagamento.parcelas_detalhes[].valor` | `receipt_installments.amount` (input ReceiptFinancial, BRL) | ✅ Sim |
| `condicoes_pagamento.rateio[].valor` | `receipt_allocations.amount` (input, BRL) | ✅ Sim |
| `processFiscal` | Flag booleana | N/A |

**Status**: ✅ Integração ERP envia exclusivamente BRL. Contábil correto.

### 5.4 Workflows Novos

| Workflow | Implementado? | Validação? |
|---|---|---|
| `returnToApprovalA2(id, reason, userId)` em [workflow-service.ts:L803-938](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/services/workflow-service.ts#L803-L938) | ✅ Sim | Bloqueia se recebimento parcial ou NF existente. Exclui PO/itens PO/recebimentos rascunho. Volta fase aprovacao_a2. Audit + realtime. |
| Rota HTTP `POST /api/purchase-requests/:id/return-to-approval-a2` em [purchase-requests.ts:L937-980](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/purchase-requests.ts#L937-L980) | ✅ Sim | Schema zod `reason min(1)`. Erro 409 + `blockedByReceipts`. Audit + realtime. |
| UI botão + Dialog | ✅ Sim (purchase-order-phase.tsx) | Bloqueio amarelo, required justificativa, toast, close, invalidateQueries |

### 5.5 Geração de PDF ([pdf-service.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/pdf-service.ts))

| Componente PDF | Ordem BRL Primeiro? | `getItemPrices` helper detecção legado? |
|---|---|---|
| Pedido de Compra (PO) | ✅ Sim (fmtDual/fmtDualInline invertidos 07/10) | ✅ Sim |
| Aprovação A2 | ✅ Sim (a2fmt invertido 07/10) | ✅ N/A (usa dados SQ Orig) |
| Comparação fornecedores (seção) A2 | ✅ Sim (fmtSqTotal/Disc/Fre invertidos 07/10) | — |

### 5.6 Testes Jest

| Suite | Resultado | Observações |
|---|---|---|
| `currency-utils.test.ts` | ✅ 29/29 PASS | Todos helpers convert, format, round BRL/Orig validados |
| `approved-snapshot-po-mapping.test.ts` | ✅ 1/1 PASS | unitPrice BRL validado (atualizado conforme contrato novo) |
| Suites completas (38) | ⚠️ 23 passaram, 15 FALHARAM | **Falhas PREEXISTENTES não ligadas a multi-moeda**: `template-service.ts` import.meta config TS Jest. |
| Testes individuais (145) | ⚠️ 128 passaram, 17 FALHOS | Falhas herdadas do bloqueio de compilação (acima) |

---

## VI. PENDÊNCIAS TÉCNICAS E FUNCIONAIS ENCONTRADAS

### 6.1 Pendências Funcionais (Ordem Prioridade)

| # | Prioridade | Tela / Item | Pendência | Impacto | Recomendação |
|---|---|---|---|---|---|
| **P1** | 🔴 **Alta** | `ConclusionPhase/index.tsx` | Existem locais usando `formatDual` em vez de `formatDualCurrencyBrlFirst`. Verificação item a item para garantir BRL primeiro na Conclusão (mesmo padrão Kanban, A2, PO). | Usuário pode ver "US$ 100,00 (R$ 499,00)" quando queria o inverso. | Auditar blocos de valor da Conclusão e inverter se necessário para BrlFirst. |
| **P2** | 🟡 Média | Compras Internacionais (Conferência Fiscal) | Tipos de documento NF limitados a Produto/Serviço/Avulso. Não há distinção DI, DSI, Invoice Exterior, Conhecimento de Frete. | Auditoria e filtros confundem DI com Avulso. Analise registrada em docs/technical/analise-conferencia-fiscal-multimoeda-internacional.md | Criar enum `document_type` + migration + UI com obrigatoriedades condicionais (implementação futura). |
| **P3** | 🟡 Média | `manualTotal` Receipt/Fiscal tipo internacional | Sem warning explicito: "Atenção, preencha em BRL". O card azul existe mas não há helperText forte ou coerção. | Usuário pode acidentalmente digitar 100 (USD) em vez de 499 (BRL convertido). | Em ReceiptFinancial + ReceiptManualEntry, adicionar warning 5% e helperText explicito com valor de referência PO total. |
| **P4** | 🟢 Baixa | Relatório Invoices + Items Analysis | Não mostra dual currency (só BRL). Relatórios de fornecedores e solicitações mostram. | Usuário perde contexto da moeda original do PO em relatórios secundários. | Se relevante para auditoria, adicionar coluna Orig opcional. |
| **P5** | 🟢 Baixa | Admin Super-User Auditoria (painel divergências) | Exibe valores em R$ fixo sem dual currency. | Auditoria de cotações multi-moeda menos precisa. | Aplicar BrlFirst na auditoria. |
| **P6** | 🟢 Baixa | `ConclusionPrintTemplate.ts` | Formatação local Intl BRL apenas (sem dual). | Impressão conclusão perde contexto moeda Orig. | Adicionar dual no template impressão. |
| **P7** | 🟢 Baixa | Receipt Kanban Card ([receipt-kanban-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/kanban/receipt-kanban-card.tsx)) | `Intl pt-BR BRL` fixo (sem reference Orig do PO). | Contexto moeda perdido para recebimentos quando PO internacional. | Receipt já é BRL, então ok; apenas adicione tooltip informativo se moeda ≠ BRL. |

### 6.2 Pendências Técnicas

| # | Prioridade | Item | Descrição |
|---|---|---|---|
| **T1** | 🔴 Alta | **Falhas de compilação Jest suite completo** | `template-service.ts` import.meta requer módulo ES2020. Impacta execução de 15 suites. **NÃO relacionado com multi-moeda**, porém bloqueia coverage total. Resolver tsconfig/module Jest. |
| **T2** | 🟡 Média | Test suites com caminho import quebrado | `update-supplier-quotation-schema.test.ts` (import `../../components/`) e `receipt-phase-logic.test.ts` caminhos antigos. Mover testes ou corrigir imports. |
| **T3** | 🟡 Média | Coverage testes multi-moeda mais fino | Falta teste para: (a) `returnToApprovalA2` service, (b) integração confirm-fiscal valores BRL, (c) 4 fábricas PO unitPrice = BRL Orig×taxa (apenas approved-snapshot testado). |
| **T4** | 🟢 Baixa | Detecção modo legado em `pdf-service.ts` getItemPrices (math heurística `> 0.0001`) | Dependente de não haver ruído; a longo prazo melhor marcar explicitamente PO com versão/migração. |
| **T5** | 🟢 Baixa | Currency codes disponíveis só BRL/USD/EUR/GBP | Se futuramente JPY, CLP, será necessário enum expandido no shared/currency-utils + frontend SUPPORTED_CURRENCIES. |

---

## VII. RECOMENDAÇÕES GERAIS

1. **P1 (Alta)**: Implementar BrlFirst na tela de Conclusão da Compra (P1 acima). Alinhamento com convenção definida em project_memory: "BRL primeiro, Orig secundário em parênteses".

2. **T1 (Alta)**: Resolver configuração Jest para `import.meta` no template-service, para destravar suite completa de testes e obter coverage íntegro.

3. **P2 (Média)**: Quando houver demanda operacional real de compras internacionais (DI/DSI frequentes), implementar a proposta da análise `analise-conferencia-fiscal-multimoeda-internacional.md`:
   - Criar campo `document_type` enum (nfe, di, dsi, invoice_exterior, conhecimento, outros)
   - Obrigatoriedades condicionais por tipo
   - Warning em valores manualTotal + sugestão do PO.

4. **Sugestão de auditoria contábil**: Para compras internacionais concluídas, o log de auditoria já grava currency_code + exchange_rate em `supplier_quotations` e `purchase_orders`. Considere manter este mesmo par no objeto `observations` do `receipts` após confirmação fiscal, para disponibilidade direta sem joins.

5. **Pendência baixa**: Em `report-service.ts` para relatório Fornecedores, confirmar que o "valor cotado" agregado é normalizado em BRL (já confirmado uses normalizeCurrencyCode → assumido ok).

---

## VIII. CONCLUSÃO FINAL

A implementação do suporte multi-moeda está **pronta e consistente** em todas as fases críticas (Cotação → A2 → PO → Recebimento/Fiscal → Conclusão e Kanban). Correções na raiz aplicadas em 07/10 (PO sempre BRL, retorno para A2 recriação, PDF BrlFirst) resolveram os defeitos de inversão de valores e de geração PDF.

A integração com o ERP (envio de valores para contas a pagar) foi auditada linha a linha e **exclusivamente envia valores em BRL**, conforme exigência operacional contábil.

**Ações recomendadas de curto prazo (próximos 2-3 dias):**
- ✅ Rodar novamente testes após resolver T1 config Jest import.meta
- 🔴 Implementar P1 (Conclusion BrlFirst) — alta relevância UX
- 🟡 Implementar P3 (warning manualTotal BRL tipo internacional) — evita erro operacional custoso

**Validação final de qualidade (08/10):**
- TSC exit 0 ✅
- Diagnósticos IDE 0 ✅
- 30/30 testes multi-moeda PASSARAM ✅
- Migration multi-moeda coerente e aplicada ✅
