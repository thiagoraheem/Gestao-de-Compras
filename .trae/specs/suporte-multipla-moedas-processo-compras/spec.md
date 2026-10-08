# Suporte a Múltiplas Moedas no Processo de Compras - Product Requirements Document

## Overview
- **Summary**: Implementar suporte a múltiplas moedas (Dólar USD, Libra GBP, Euro EUR, além de Real BRL) em todo o fluxo de compras, a partir da fase de Cotação. Inclui cadastro diário de cotações de câmbio, entrada de valores de fornecedores em moeda estrangeira, persistência da taxa de câmbio utilizada, e exibição com distinção da moeda original e conversão para Real em todas as telas subsequentes do processo (Aprovação A2, Pedido de Compra, Recebimento, Conferência Fiscal, Conclusão, Kanban e Relatórios).
- **Purpose**: Viabilizar compras internacionais onde fornecedores cotam em moeda estrangeira, garantindo transparência, auditabilidade e consistência da conversão cambial ao longo de todo o processo.
- **Target Users**: Compradores (informam cotações em moeda estrangeira), Aprovadores A2 (analisam valores convertidos), Recebedores/Conferentes, Gestores (visualizam relatórios e dashboards), Administradores (mantêm cotações de câmbio).

## Goals
- Permitir ao comprador selecionar a moeda e informar a taxa de câmbio utilizada no momento do lançamento da cotação do fornecedor.
- Persistir, junto a cada cotação de fornecedor, o código da moeda e a taxa de câmbio (para BRL) aplicada naquele momento — garantindo auditabilidade histórica.
- Armazenar os valores brutos informados (na moeda original) e os convertidos para BRL em campos separados.
- Em todas as telas exibir, de forma clara e padronizada, o valor na **moeda original** e o **equivalente em Real (BRL)** quando a moeda não for BRL.
- Garantir que aprovações A2 baseadas em valor (regras de dupla aprovação por faixa) avaliem sempre o valor convertido em BRL.
- Manter compatibilidade retroativa com todo o histórico existente (todos os registros antigos são implicitamente BRL).
- Garantir que telas de Recebimento/Conferência Fiscal (que operam com NF-e em BRL) trabalhem sempre com valores em Real.

## Non-Goals
- Não implementar integração automática com APIs de taxas de câmbio nesta primeira versão (o cadastro é manual).
- Não alterar a moeda utilizada na fase de Solicitação e Aprovação A1 (essas fases permanecem exclusivamente em BRL, utilizando preço estimado/orçamento em Real).
- Não alterar valores já lançados em Recebimentos/Integrações ERP concluídas.
- Não implementar conversão de moeda nos relatórios exportados para Excel/CSV na primeira versão (colunas adicionais com a moeda original e taxa são incluídas, mas valores permanecem em BRL ou com coluna separada).
- Não adicionar moedas voláteis/exóticas; escopo inicial limitado a BRL, USD, EUR, GBP.

## Background & Context
O sistema atual ([schema.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts)) armazena todos os valores monetários como `DECIMAL` sem qualquer código de moeda associado, assumindo implicitamente Real (BRL). Todas as funções de formatação ([currency.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/currency.ts), [formatters.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/utils/formatters.ts)) fixam `currency: "BRL"`.

O fluxo atual do processo, conforme registrado na [project_memory.md](file:///c:/Users/t_mar/.trae/memory/projects/-c-Projetos-Locador-webapps-Gestao-de-Compras--p2-4f8080b3c73f9a2e02c0/project_memory.md), é:
`solicitacao (BRL)` → `aprovacao_a1 (BRL)` → `cotacao` → `aprovacao_a2` → `pedido_compra` → `recebimento (BRL fiscal)` → `conf_fiscal (BRL)` → `conclusao_compra` → `pedido_concluido`

A introdução de múltiplas moedas inicia na fase **Cotação** (`cotacao`), pois é onde o comprador negocia com fornecedores internacionais. A partir da escolha do fornecedor vencedor (A2), a moeda e a taxa de câmbio são propagadas para as fases seguintes.

A [CalculadoraValoresSolicitacao](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/utils/CalculadoraValoresSolicitacao.ts) opera em números puros (sem contexto de moeda) e hoje é usada tanto para cálculos de itens como para aprovações. Essa calculadora deve continuar operando na moeda base do contexto (BRL para A1, moeda original para cotação) e produzir os correspondentes convertidos.

## Functional Requirements
### Gerenciamento de Cotações de Câmbio
- **FR-1**: Deve existir uma tela administrativa para cadastro e manutenção da "cotação do dia" por moeda (Taxa BRL x Moeda).
- **FR-2**: Deve ser possível registrar múltiplas taxas no mesmo dia e visualizar histórico de alterações.
- **FR-3**: Ao lançar uma cotação de fornecedor em moeda estrangeira, o sistema deve sugerir automaticamente a taxa cadastrada para o dia, permitindo sobrescrever (com justificativa? Em branco inicialmente — apenas sobrescrita livre).
- **FR-4**: APIs REST completas (CRUD) para cotações de câmbio (`currency_rates`) protegidas por autenticação.

### Entrada de Cotação de Fornecedor (Fase Cotação)
- **FR-5**: No modal de atualização de cotação de fornecedor [update-supplier-quotation.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/quotations/components/update-supplier-quotation.tsx) deve ser adicionado:
  - Campo **"Moeda"** (select: BRL / USD / EUR / GBP). Padrão BRL para retrocompatibilidade.
  - Campo **"Taxa de Câmbio (para BRL)"** — visível e editável apenas quando moeda ≠ BRL; carrega automaticamente a taxa do dia; só aceita valores > 0.
- **FR-6**: Todos os preços unitários, descontos e frete informados pelo usuário nesse modal serão interpretados como estando na **moeda selecionada**.
- **FR-7**: Deve ser exibido um resumo visual (banner/quadro) com: Subtotal (moeda original), Descontos (moeda original), Frete (moeda original), Total (moeda original) e, abaixo, o Total Convertido (BRL) em destaque.

### Persistência dos Dados
- **FR-8**: A tabela `supplier_quotations` deve receber colunas:
  - `currency_code` (TEXT/VARCHAR, ex: "USD", "GBP")
  - `exchange_rate` (DECIMAL(15,6)) — taxa usada para converter para BRL; valor 1.000000 quando moeda é BRL
  - `total_value_brl` (DECIMAL(15,4)) — total convertido
  - `subtotal_value_brl`, `final_value_brl`, `freight_value_brl`, `discount_value_brl` (análogos)
- **FR-9**: A tabela `supplier_quotation_items` deve receber:
  - `unit_price_brl`, `total_price_brl`, `discount_value_brl`, `original_total_price_brl`, `discounted_total_price_brl` (todos DECIMAL(15,4)).
- **FR-10**: A tabela `purchase_orders` herda, no momento da geração a partir da cotação vencedora, o `currency_code` e `exchange_rate` (campos novos) e campos de totais em BRL (`total_value_brl`). A tabela `purchase_order_items` recebe `unit_price_brl`, `total_price_brl`.
- **FR-11**: A tabela `approved_quotation_items` (snapshot) deve incluir a duplicação de campos em BRL.
- **FR-12**: Na `purchase_requests`, os campos `negotiatedValue`, `discountsObtained`, `totalValue` passam a ser armazenados **sempre em BRL** (para fins de regras de aprovação). São adicionados campos novos `negotiated_value_orig`, `discounts_obtained_orig`, `total_value_orig` e `currency_code`, `exchange_rate` quando a cotação vencedora for em outra moeda.
- **FR-13**: `approval_history.approval_value` continua em BRL (coluna original preservada).

### Exibição em Telas do Processo
- **FR-14**: **Kanban Cards** ([purchase-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/kanban/purchase-card.tsx)) e cards de recebimento:
  - Para moeda ≠ BRL: exibir `Valor (USD/EUR/GBP): XXXX` em destaque normal e, **abaixo ou ao lado**, `(BRL: YYYY)` em verde (ou cor distinta) usando formatação apropriada.
  - Para moeda = BRL: manter exibição atual sem alterações.
- **FR-15**: **Modal detalhe da Solicitação** (todas as fases a partir de Cotação):
  - Itens de cotação/Pedido: duas colunas numéricas ("Unit. Orig.", "Total Orig.") e ("Unit. BRL", "Total BRL") ou o par no mesmo campo `$100 USD` (R$ 500).
  - Painéis de totais (subtotal, desconto, frete, total) com a mesma dupla exibição.
- **FR-16**: **Aprovação A2** ([approval-a2-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/approvals/components/approval-a2-phase.tsx)):
  - Mostrar badge com moeda e taxa usada ("Cotação em USD · Taxa 5,20").
  - Comparar valores convertidos em BRL com faixas de dupla aprovação.
- **FR-17**: **Pedido de Compra** ([purchase-order-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/purchase-order-phase.tsx)) e **PDF do Pedido**:
  - Exibir os totais na moeda original e em BRL no rodapé.
  - No PDF do pedido, incluir observação: "Valores convertidos para BRL usando taxa de câmbio X.XXX de DD/MM/AAAA".
- **FR-18**: **Recebimento e Conferência Fiscal**:
  - Trabalham **exclusivamente em BRL** (alinhado a NF-e brasileira). São exibidos os valores convertidos. Deve-se mostrar, em painel informativo (não editável): "Valores do pedido originalmente em USD @ 5,20 — convertidos automaticamente".
- **FR-19**: **Conclusão de Compra**: mesma regra da FR-18 + exibição do valor original para referência.

### Relatórios e Dashboard
- **FR-20**: Dashboard ([index.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/dashboard/index.tsx)):
  - Totais agregados sempre em BRL. Adicionar card "Total em Moeda Estrangeira (convertido)" e "Total em BRL nativo".
- **FR-21**: Relatórios (solicitações, itens, fornecedores, invoices):
  - Incluir colunas **Moeda** e **Taxa** onde aplicável.
  - Incluir coluna de **Valor Original** e **Valor BRL** para comparação.

### Utilitários Centrais de Formatação
- **FR-22**: Nova função utilitária `formatCurrencyWithConversion(originalValue, brlValue, currencyCode, exchangeRate?)` que retorna a string de exibição padronizada (ex: `USD 100,00 (R$ 520,00)`).
- **FR-23**: Refatorar `formatCurrency` ([currency.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/lib/currency.ts)) para aceitar código de moeda opcional e manter padrão BRL quando omitido.

## Non-Functional Requirements
- **NFR-1 – Retrocompatibilidade**: Todos os registros históricos existentes (sem `currency_code`) devem ser tratados implicitamente como `BRL` com taxa `1.0`, sem quebra de nenhuma tela ou relatório.
- **NFR-2 – Performance**: A duplicação de campos em BRL nas tabelas deve ser feita em `INSERT/UPDATE` tempo de escrita (nunca em tempo de leitura em queries de listagem).
- **NFR-3 – Auditabilidade**: Toda alteração em taxa de câmbio lançada deve ser registrada no `audit_logs`.
- **NFR-4 – Precisão**: Todas as conversões usam `DECIMAL(15,6)` para taxa e `DECIMAL(15,4)` para valores, com arredondamento HALF_UP (padrão brasileiro).
- **NFR-5 – UX Não Intrusiva**: Para o usuário que só opera em BRL, nada muda — os novos campos ficam invisíveis ou com valor padrão BRL/taxa=1.
- **NFR-6 – Testes Automatizados**: Incluir testes unitários para novas funções de conversão e formatação, e pelo menos um teste de integração cobrindo o fluxo completo "entrada USD → PO → exibição no kanban".

## Constraints
- **Technical**: Stack existente Node.js + TypeScript + Drizzle ORM + PostgreSQL + React + Tailwind/Radix. Não introduzir novas libs sem necessidade.
- **Business**:
  - Fases de Solicitação (orçamento disponível) e Aprovação A1 permanecem **apenas em BRL**.
  - NF-e e Recebimento são **sempre em BRL** (legislação brasileira).
  - Integração Locador/ERP: valores enviados para o ERP devem ser, nesta primeira versão, **apenas em BRL** (campos convertidos). Campos originais + moeda + taxa são adicionados como observação/adicional se o ERP aceitar.
- **Dependencies**: Migração de banco de dados deve ser a primeira tarefa (rodar antes das demais). Nenhuma feature de conversão deve ser deployada sem a migração ter sido aplicada.

## Assumptions
- Cada `supplier_quotation` (proposta de fornecedor) usa **uma única moeda**. Não é permitido itens com moedas diferentes dentro da mesma proposta de fornecedor.
- A taxa de câmbio é escolhida no momento do **lançamento da cotação** e congelada para aquele fornecedor — se as taxas mudarem posteriormente, isso não retroage sobre propostas já lançadas.
- Quando o fornecedor vencedor for em moeda estrangeira, o Pedido de Compra gerado mostra as duas moedas mas o compromisso financeiro/contábil permanece em BRL para fins de integração.
- Administradores têm permissão para cadastrar taxas; Compradores podem sobrescrever a taxa sugerida numa proposta específica sem permissão extra.
- Moedas inicialmente suportadas: BRL, USD, EUR, GBP. Outras adicionáveis via configuração futura.

## Acceptance Criteria
### AC-1: Cadastro de Taxa de Câmbio do Dia
- **Type**: `rule`
- **Given**: Sou um usuário Admin logado no sistema
- **When**: Acesso tela "Cotações de Moedas", seleciono moeda USD, informo taxa 5,30 para o dia corrente e salvo
- **Then**: (a) Registro é criado em `currency_rates`; (b) É listado no histórico; (c) Ao abrir uma cotação de fornecedor em USD no dia de hoje, o campo taxa é pré-preenchido com 5,30
- **Pass Condition**: Registro persistido e taxa sugerida corretamente em UI de cotação de fornecedor
- **Evidence**: (1) Query SQL retornando o registro inserido; (2) Screenshot da UI de cadastro; (3) Screenshot do modal de fornecedor com taxa pré-carregada

### AC-2: Lançamento de Proposta em USD
- **Type**: `rule`
- **Given**: Existe uma Solicitação em fase "Cotação" com RFQ aberto; existe cotação USD do dia cadastrada com 5,30
- **When**: Abro modal de atualização de fornecedor, seleciono moeda USD, confirmo taxa 5,30, informo 1 item com preço unitário 100, qtd 2, desconto 0, sem frete
- **Then**: (a) `supplier_quotations.currency_code='USD'`, `exchange_rate=5.30`; (b) Item `unit_price=100`, `unit_price_brl=530`, `total_price=200`, `total_price_brl=1060`; (c) total_value=200, total_value_brl=1060
- **Pass Condition**: Todos os campos em BRL e moeda original persistidos com valores corretos
- **Evidence**: (1) SELECT das tabelas após salvar; (2) Screenshot do modal mostrando dupla exibição; (3) Log do request HTTP com payload

### AC-3: Retrocompatibilidade com BRL Antigo
- **Type**: `rule`
- **Given**: Uma solicitação existente no banco de dados criada antes desta feature (campos `currency_code` todos NULL)
- **When**: Listar solicitações, abrir card do Kanban, abrir detalhes, exportar relatório
- **Then**: Tudo funciona exatamente como antes; valores são formatados como "R$ X,XX" (nenhuma dupla exibição aparece); nenhum erro de console nem exception
- **Pass Condition**: Nenhuma anomalia visual nem erro de execução para dados históricos
- **Evidence**: (1) Screenshot comparativo lado a lado antigo vs novo; (2) Console de navegador sem erros; (3) Teste de regressão E2E passando

### AC-4: Aprovação A2 Avalia BRL Convertido
- **Type**: `rule`
- **Given**: Regra de dupla aprovação configurada com faixa >= R$ 100.000,00; uma cotação vencedora em USD com total de 20.000 USD e taxa 5,30 (= BRL 106.000)
- **When**: Solicitação avança para Aprovação A2
- **Then**: (a) Sistema detecta que valor em BRL ultrapassa faixa e marca `requiresDualApproval=true`; (b) Interface exibe a dupla exibição ("Total: USD 20.000 (R$ 106.000)") e badge de dupla aprovação
- **Pass Condition**: Dupla aprovação ativada e valores exibidos corretamente
- **Evidence**: (1) Campo `requiresDualApproval` no banco = true; (2) Screenshot tela A2 mostrando badge e dupla exibição; (3) Log de cálculo no servidor

### AC-5: Pedido de Compra e PDF com Dupla Moeda
- **Type**: `rule`
- **Given**: Cotação vencedora em GBP (2.000 GBP · taxa 7,00 = BRL 14.000) e A2 aprovada
- **When**: Gerar Pedido de Compra e abrir tela / gerar PDF
- **Then**: Tela PO exibe itens com unitário em GBP e BRL; rodapé exibe "Total: GBP 2.000 (R$ 14.000)"; PDF gerado contém observação sobre taxa e as duas moedas; `purchase_orders.currency_code='GBP'` salvo
- **Pass Condition**: PO persistida e PDF exibe corretamente as duas moedas
- **Evidence**: (1) Registro em purchase_orders; (2) Screenshot tela PO; (3) Páginas do PDF mostrando dupla moeda

### AC-6: Recebimento Trabalha em BRL e Mostra Resumo Cambial
- **Type**: `rule`
- **Given**: Pedido em USD criado (total USD 1.000 · taxa 5,50 = BRL 5.500)
- **When**: Entrar na tela de Recebimento do pedido
- **Then**: (a) Todos os campos editáveis de valores são em BRL (5.500); (b) Painel informativo exibe: "Pedido original: USD 1.000 @ taxa 5,50" (read-only); (c) Conferência Fiscal e conclusão operam apenas em BRL
- **Pass Condition**: Tela de recebimento só aceita edição em BRL e mostra resumo cambial informativo
- **Evidence**: (1) Screenshot da tela de recebimento com painel informativo; (2) Tentativa de editar moeda na tela de recebimento = falha (campo não existe)

### AC-7: Dashboard e Relatórios Agregam em BRL
- **Type**: `rubric`
- **Dimension**: Completude e clareza da exibição monetária em Dashboards e Relatórios
- **Scale**: 1-5
- **Anchors**:
  - 1 = Nenhuma distinção de moeda; todos os valores são somados sem conversão (incorreto)
  - 3 = Dashboard só mostra BRL convertido, sem indicação de que parte veio de conversão; relatórios não possuem colunas extras
  - 5 = Dashboard mostra cards separados "Total em BRL nativo" e "Total Convertido (BRL)", com badge de contagem de pedidos em moeda estrangeira; relatórios incluem colunas Moeda, Taxa, Valor Orig., Valor BRL, com filtro por moeda
- **Pass Threshold**: >= 4
- **Evidence**: (1) Screenshot dashboard; (2) Exemplo de exportação CSV/Excel com as colunas extras; (3) Screencast demonstrando filtro por moeda no relatório

### AC-8: Precisão e Consistência da Conversão
- **Type**: `rubric`
- **Dimension**: Precisão numérica e consistência entre campos calculados ao longo do fluxo
- **Scale**: 1-5
- **Anchors**:
  - 1 = Divergências encontradas (total de itens não bate com total convertido; discrepâncias > R$ 0,01 ao longo das fases)
  - 3 = Conversão funciona mas existem pequenas divergências por arredondamento (<= R$ 0,01) documentadas e aceitáveis
  - 5 = Conversão consistente em todas as fases; arredondamento aplicado no total (não por item); valor BRL em qualquer tela bate com valor BRL da cotação original, sem qualquer divergência
- **Pass Threshold**: >= 4
- **Evidence**: (1) Planilha/script de teste com 50 casos (USD, EUR, GBP, BRL, com e sem desconto/frete) mostrando igualdade entre campos; (2) Teste unitário `toMatchPrecision` para conversões passando em 100%

## Open Questions
- [ ] **OQ-1**: Relatórios exportados (Excel/CSV): além das colunas extras em BRL e moeda original, devemos oferecer uma **segunda aba/sheet** com todos os valores convertidos apenas para BRL (formato atual, para compatibilidade com planilhas existentes dos gestores)?
- [ ] **OQ-2**: Integração ERP: como os dados de moeda e taxa devem ser enviados ao sistema ERP? (a) Somente valores em BRL + observação; (b) Campos adicionais no payload da integração; (c) Não enviamos moeda nesta primeira versão.
- [ ] **OQ-3**: Permissões: **Compradores** podem editar a taxa de câmbio sugerida para cada fornecedor livremente, ou só Admin pode cadastrar taxas (compradores apenas selecionam)?
- [ ] **OQ-4**: Quando retrocedemos uma solicitação (ex: de A2 para Cotação / recotação), a taxa de câmbio já utilizada deve ser **mantida** ou **atualizada para a taxa do dia**?
- [ ] **OQ-5**: Moedas: além de BRL, USD, EUR, GBP, existe necessidade imediata de outras moedas (ARS, CLP, MXN, JPY, CNY)?
