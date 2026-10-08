# Suporte a Múltiplas Moedas - Implementation Plan

## Task 1: Migração do Banco de Dados (Schema Drizzle + SQL)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Criar tabela `currency_rates` (id, currency_code, rate_date, rate_value, created_by, created_at, updated_at, unique(currency_code, rate_date))
  - Adicionar colunas em `supplier_quotations`: `currency_code`, `exchange_rate`, `total_value_brl`, `subtotal_value_brl`, `final_value_brl`, `freight_value_brl`, `discount_value_brl`
  - Adicionar colunas em `supplier_quotation_items`: `unit_price_brl`, `total_price_brl`, `discount_value_brl`, `original_total_price_brl`, `discounted_total_price_brl`
  - Adicionar colunas em `approved_quotation_items`: `unit_price_brl`, `total_price_brl`
  - Adicionar colunas em `purchase_orders`: `currency_code`, `exchange_rate`, `total_value_brl`
  - Adicionar colunas em `purchase_order_items`: `unit_price_brl`, `total_price_brl`
  - Adicionar colunas em `purchase_requests`: `currency_code`, `exchange_rate`, `total_value_orig`, `negotiated_value_orig`, `discounts_obtained_orig`
  - Atualizar `shared/schema.ts` com todas as novas tabelas e colunas Drizzle
  - Valores padrão: `currency_code='BRL'`, `exchange_rate=1` (apenas para novos; antigos NULL → BRL implícito via tratamento em código)
  - Criar arquivo SQL em `db_scripts/` com a migração correspondente
- **Acceptance Criteria Addressed**: AC-1 (estrutura), AC-2 (estrutura), AC-3 (trata NULL como BRL)
- **Test Requirements**:
  - `rule` TR-1.1: Rodar `drizzle-kit push` ou equivalente em ambiente de teste não produz erro; novas tabelas/colunas aparecem em `information_schema`
    - Evidence: Saída do comando push + query `SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN (...)`
  - `rule` TR-1.2: Inserir um registro em `supplier_quotations` com `currency_code='USD'` e demais campos novos não gera erro de constraint
    - Evidence: SQL de insert rodando com sucesso e SELECT de retorno mostrando os valores
  - `rubric` TR-1.3: Cobertura e padronização; escala 1-5; anchors 1=campos faltando em alguma tabela, 3=campos adicionados mas sem índices, 5=todas colunas + índices em currency_code + unique(currency_code, rate_date); threshold >= 4
    - Evidence: DDL final e plano de migração
- **Notes**: Fase crítica. Sem essa tarefa, nenhuma outra pode ser executada. Backfill não é necessário (NULL = BRL).

## Task 2: Camada Compartilhada - Utilitários de Moeda e Conversão
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Criar `shared/utils/currency-utils.ts` com:
    - Enum/lista de moedas suportadas (`SUPPORTED_CURRENCIES = ['BRL','USD','EUR','GBP']`)
    - Símbolos: `CURRENCY_SYMBOLS = { BRL: 'R$', USD: 'US$', EUR: '€', GBP: '£' }`
    - `roundCurrency(value: number, decimals = 2)` — HALF_UP
    - `convertToBRL(value: number, exchangeRate: number)`
    - `formatCurrencyIn(code: 'BRL'|'USD'|..., value: number|string)` — formata como "US$ 100,00"
    - `formatDualCurrency(originalValue: number|string, brlValue: number|string, currencyCode)` — retorna string "US$ 100,00 (R$ 520,00)" ou apenas "R$ X" para BRL
  - Refatorar `client/src/lib/currency.ts` para receber `currencyCode` opcional (default BRL).
  - Refatorar `server/utils/formatters.ts` para receber `currencyCode` opcional.
  - Adicionar testes unitários em `server/tests/currency-utils.test.ts`
- **Acceptance Criteria Addressed**: AC-2 (valores corretos), AC-8 (precisão)
- **Test Requirements**:
  - `rule` TR-2.1: Teste unitário `formatDualCurrency(100, 530, 'USD')` → retorna string contendo ambos valores e símbolos corretos
  - `rule` TR-2.2: Teste unitário `formatDualCurrency(100, 100, 'BRL')` → retorna apenas "R$ 100,00" sem dupla exibição
  - `rubric` TR-2.3: Precisão; escala 1-5; anchors 1=divergências, 3=2 decimais só em BRL, 5=4 decimais para preços unitários convertidos + 2 para totais; threshold >= 4

## Task 3: CRUD API de Cotações de Moeda (currency_rates)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Criar `server/repositories/currency-rate-repository.ts`
  - Criar rota em `server/routes/` ou `master-data-management.ts`:
    - `GET /api/currency-rates` (lista com filtros por data e moeda)
    - `GET /api/currency-rates/latest?code=USD` (retorna taxa mais recente)
    - `POST /api/currency-rates` (criar taxa)
    - `PUT /api/currency-rates/:id` (atualizar)
    - `DELETE /api/currency-rates/:id` (excluir)
  - Registro em `audit_logs` de criação/edição/exclusão de taxas.
  - Adicionar endpoint `GET /api/currency-rates/today?code=USD` que retorna a taxa do dia corrente.
- **Acceptance Criteria Addressed**: AC-1 (endpoints funcionando)
- **Test Requirements**:
  - `rule` TR-3.1: `POST /api/currency-rates` + `GET today` retorna a taxa correta
  - `rule` TR-3.2: `POST` sem permissão de admin retorna 403 (se restringirmos a admin; ver OQ-3)
  - `rubric` TR-3.3: Segurança e validações; escala 1-5; anchors 1=sem validação de rate>0, 3=validação mas sem audit log, 5=validação, audit log e rate>0; threshold >= 4

## Task 4: Tela Administrativa de Cadastro de Cotações de Moeda
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - Criar página em `client/src/features/admin/` (ex: `currency-rates/`) ou dentro de `locador-config`
  - Listar taxas cadastradas com filtros por moeda e período
  - Formulário para cadastrar/editar: moeda (select), data (datepicker), taxa (decimal > 0), observações (opcional)
  - Registro de data automático (hoje padrão) e possibilidade de cadastrar datas retroativas
  - Integração com React Query + Toast feedback
- **Acceptance Criteria Addressed**: AC-1 (UI cadastro)
- **Test Requirements**:
  - `rule` TR-4.1: Cadastro via UI chama POST corretamente e recarrega lista
  - `rubric` TR-4.2: UX; escala 1-5; anchors 1=difícil uso, 3=funcional, 5=atalhos, validação visual em tempo real; threshold >= 3

## Task 5: Endpoint Atualização de Cotação de Fornecedor (Persistência da Moeda)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Atualizar `shared/schema.ts` `updateSupplierQuotationSchema` (e o do client) para incluir `currencyCode` e `exchangeRate`
  - Atualizar `PUT /api/quotations/:id/supplier-quotations/:supplierId` (rota em quotations.ts / storage.ts) para:
    - Receber e validar currencyCode e exchangeRate
    - Se moeda ≠ BRL, exchangeRate é obrigatório e > 0
    - Calcular e persistir campos *unit_price_brl*, *total_price_brl*, *subtotal_value_brl*, *total_value_brl* no insert/update
    - Usar `CalculadoraValoresSolicitacao` na moeda original e depois converter o resultado final
  - Retornar, no payload de resposta, os campos brl além dos originais
- **Acceptance Criteria Addressed**: AC-2 (persistência), AC-4 (base para aprovação)
- **Test Requirements**:
  - `rule` TR-5.1: PUT com currency=USD exchange=5.30 unit_price=100 qty=2 → unit_price_brl=530 e total_price_brl=1060 gravados
  - `rule` TR-5.2: PUT sem currency (undefined/null) → mantém como BRL e não quebra (retrocompatibilidade)

## Task 6: Modal update-supplier-quotation (Entrada de Moeda)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 5
- **Description**:
  - Adicionar no cabeçalho do modal (antes dos itens) o grupo de campos:
    - **Moeda**: Select BRL / USD / EUR / GBP (padrão BRL)
    - **Taxa (→ BRL)**: DecimalInput; `disabled` quando moeda = BRL (fixo 1,00); ao trocar moeda, buscar via query `/api/currency-rates/latest?code=X` e preencher automaticamente
  - Atualizar resumo de totais (painel calculadora) para usar `formatDualCurrency`
  - Adicionar validação: se moeda ≠ BRL e taxa não fornecida → erro
  - Atualizar supplier-quotation-data-grid para exibir duas linhas/células por valor (ou valor único com dupla formatação)
- **Acceptance Criteria Addressed**: AC-1 (sugestão de taxa), AC-2 (entrada)
- **Test Requirements**:
  - `rule` TR-6.1: Selecionar USD → campo taxa carrega a taxa do dia automaticamente
  - `rule` TR-6.2: Após preencher item em USD com quantidade e preço, resumo mostra dupla moeda
  - `rubric` TR-6.3: UX clarity; escala 1-5; threshold >= 4

## Task 7: Aprovação A2 - Comparação em BRL e Exibição
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 5
- **Description**:
  - Atualizar `useApprovalType` hook (se usado) e lógica em `approval-a2-phase.tsx` para usar *valor BRL* quando calcular `requiresDualApproval`
  - Atualizar tela de A2 para exibir badge com "Moeda: USD · Taxa 5,30"
  - Exibir valores com `formatDualCurrency` em todos os locais relevantes (escolha do fornecedor, negociação, comparação)
  - Garantir que `negotiated_value_brl` e `discounts_obtained_brl` sejam calculados e persistidos em `purchase_requests` no momento da escolha do fornecedor
- **Acceptance Criteria Addressed**: AC-4 (A2 valida BRL)
- **Test Requirements**:
  - `rule` TR-7.1: Cenário de AC-4 → requiresDualApproval === true no payload após a atualização
  - `rule` TR-7.2: Valor escolhido em USD é convertido e salvo em negotiatedValue (coluna BRL legacy)

## Task 8: Pedido de Compra (Factory + Tela + PDF)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 7
- **Description**:
  - Atualizar `purchase-order-factory.ts` / `purchase-order-service.ts` para copiar `currency_code`, `exchange_rate` da `supplier_quotations` vencedora
  - Calcular e persistir `total_value_brl`, `unit_price_brl`, `total_price_brl` em `purchase_orders` e `purchase_order_items`
  - Atualizar tela `purchase-order-phase.tsx` para usar `formatDualCurrency`
  - Atualizar `server/pdf-service.ts` (template PO e A2) para incluir observação de taxa + rodapé com dupla moeda
  - Permitir edição de dados do comprador continua; Moeda/taxa não são editáveis no PO
- **Acceptance Criteria Addressed**: AC-5 (PO com dupla moeda)
- **Test Requirements**:
  - `rule` TR-8.1: Gerar PO a partir de cotação USD → campos currency_code e exchange_rate = valores corretos; total_value = original, total_value_brl = convertido
  - `rule` TR-8.2: PDF gerado contém texto com taxa e dupla moeda (ver PDF output)

## Task 9: Kanban Cards e Request View (Exibição Geral)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Atualizar `purchase-request-repository.ts` (enriquecimento com valores calculados) para retornar currencyCode, exchangeRate, originalValue, brlValue quando disponíveis
  - Atualizar `purchase-card.tsx` para exibir dupla formatação quando currency ≠ BRL; quando currency = BRL ou NULL, renderiza exatamente como hoje
  - Atualizar `request-view.tsx`, `request-list.tsx`, `items-viewer.tsx` para usar utilitário de dupla moeda
  - Atualizar approval-a1-phase (permanece BRL — sem mudança visual, apenas garantia de não quebrar)
- **Acceptance Criteria Addressed**: AC-3 (retrocompatibilidade), AC-4 (badge A2)
- **Test Requirements**:
  - `rule` TR-9.1: Card com request antiga (currency NULL) → exibição idêntica à atual (mesmo HTML de antes)
  - `rule` TR-9.2: Card com request em USD → exibe "USD XXXX (R$ YYYY)" sem quebrar layout
  - `rubric` TR-9.3: Layout stability; escala 1-5; anchors 1=overflow do card, 3=ok mas espaçamento inconsistente, 5=pixel perfect; threshold >= 4

## Task 10: Recebimento e Conferência Fiscal
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - Tela de recebimento: Carregar moeda e taxa do PO
  - Adicionar `<Card>` informativo no topo (read-only): "Valores do Pedido Original: USD @ 5,30 · Conversão aplicada automaticamente para BRL"
  - Garantir que todos os campos de valor são formatados apenas em BRL (edição e exibição)
  - TotaisCard, ItemsTable, ReceiptFinancial etc. usam apenas valores em BRL do PO
  - Mesmo para conferência fiscal e conclusão
- **Acceptance Criteria Addressed**: AC-6 (recebimento BRL)
- **Test Requirements**:
  - `rule` TR-10.1: Ao criar recebimento para PO em USD, os campos de total do recebimento operam apenas em BRL e o painel informativo aparece
  - `rule` TR-10.2: Valor BRL do recebimento (conferência) bate com total_value_brl do PO

## Task 11: Relatórios e Dashboard
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 2
- **Description**:
  - Dashboard:
    - Adicionar 2 cards: "Total em BRL (nativo)" e "Total Convertido (Moeda Estrang. → BRL)"
    - Badge contador de solicitações em moeda estrangeira
  - Relatório de Solicitações de Compra:
    - Adicionar colunas: **Moeda**, **Taxa**, **Total Original**, **Total (BRL)**
    - Filtro por moeda (select BRL/USD/EUR/GBP/Todas)
  - Demais relatórios (itens, fornecedores, invoices) adicionar colunas correspondentes
- **Acceptance Criteria Addressed**: AC-7 (rubrica relatórios)
- **Test Requirements**:
  - `rule` TR-11.1: Filtrar relatório por USD → só mostra solicitações em USD; colunas Taxa e Total Original aparecem preenchidas
  - `rubric` TR-11.2: Completude; escala 1-5; threshold >= 4 (per AC-7)

## Task 12: Fluxo de Retrocesso, Exclusão e Casos Limite
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5 a Task 10
- **Description**:
  - Ao retroceder de A2 para Cotação (recotação): Decisão em OQ-4 — implementar a opção escolhida
  - Ao excluir um supplier_quotation: remover também dados de moeda não são necessários (cascade normal; novas colunas já são removidas)
  - Ao gerar nova versão de RFQ: manter ou resetar moeda? Decidir e implementar
  - Garantir que `workflow-service.ts`, `quotation-versioning.ts`, `audit-service.ts` continuem funcionando
- **Acceptance Criteria Addressed**: AC-3 (retrocompatibilidade operacional)
- **Test Requirements**:
  - `rule` TR-12.1: Retroceder fase de cotação vencedora USD → não apaga dados de moeda e taxa; ao recotar, usam-se novas configurações

## Task 13: Testes Automatizados e Smoke Test End-to-End
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Todas
- **Description**:
  - Ampliar testes existentes:
    - `calculadora-valores-solicitacoes.test.ts`: adicionar casos com moeda estrangeira
    - `update-supplier-quotation-schema.test.ts`: novos campos currencyCode/exchangeRate
  - Criar `currency-utils.test.ts` já na Task 2
  - Criar `multimoeda-fluxo.test.ts` (integração): insere taxa USD, cria solicitação → aprova A1 → cria RFQ → lança fornecedor em USD → aprova A2 → gera PO → verifica todos campos
  - Rodar `npm run test` e `npm run check` (tsc) no final
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5, AC-6, AC-8
- **Test Requirements**:
  - `rule` TR-13.1: `npm run test` passa em 100% dos testes novos e existentes (ou justificadas falhas não relacionadas)
  - `rule` TR-13.2: `npm run check` (tsc) passa sem erros TypeScript
  - `rubric` TR-13.3: Cobertura; escala 1-5; threshold >= 4
