# Empresa para Faturamento no Processo de Compras - Product Requirements Document

## Overview

- **Summary**: Implementar a capacidade de selecionar uma "Empresa para Faturamento" distinta da "Empresa Solicitante" ao longo do fluxo de compras, a partir da criação da Solicitação (e confirmada na fase de Cotação/RFQ). A empresa selecionada para faturamento será utilizada no cabeçalho do Pedido de Compra (dados completos: razão social, CNPJ, endereço, contato, informações fiscais), mantendo-se a empresa solicitante em campo separado para fins de rastreabilidade.
- **Purpose**: Viabilizar cenários onde uma filial/departamento solicita uma compra, porém a nota fiscal deve ser emitida para a matriz ou outra empresa do grupo (holdings, filiais com CNPJ distinto, centros de lucro independentes). Garante que o fornecedor emita a NF-e para o CNPJ correto e que o PDF do Pedido de Compra reflita essa distinção.
- **Target Users**: Compradores (selecionam/alteram a empresa de faturamento), Aprovadores A1/A2 (visualizam e validam a escolha), Fornecedores (emitem NF-e com base no PDF do PO), Financeiro/Contábil (reconciliação com ERP), Conferentes Fiscais (conferência de destinatário na NF-e).

## Goals

- Permitir ao comprador selecionar, durante a criação da Solicitação de Compra ou edição da RFQ, uma empresa de faturamento diferente da empresa solicitante.
- Persistir essa escolha na entidade principal (`purchase_requests`) como `billing_company_id`, com valor padrão igual ao `company_id` da solicitação (garantindo retrocompatibilidade 100%).
- Exibir e permitir edição (restrita a compradores/administradores) do campo tanto na criação da solicitação quanto durante a fase de Cotação (RFQ).
- No PDF do Pedido de Compra, substituir os dados de cabeçalho da empresa pelos dados da **empresa de faturamento** selecionada, e adicionar um bloco informativo separado com a "Empresa Solicitante" (origem) para rastreabilidade.
- Garantir validações: apenas empresas **ativas** (`companies.active = true`) podem ser selecionadas; perfis não-compradores visualizam o campo em modo somente leitura.

## Non-Goals

- Não permitir alterar a empresa de faturamento **após** a criação do Pedido de Compra (fase `pedido_compra` ou posteriores). Para correções, utilizar o mecanismo de "Retorno de Fase" de `pedido_compra` → `aprovacao_a2` (que já existe no sistema e exclui o PO existente).
- Não implementar múltiplas empresas de faturamento por item ou por linha do pedido (uma única empresa por solicitação/Pedido de Compra).
- Não realizar integração de envio da empresa de faturamento para o ERP Locador nesta primeira versão. O campo será persistido no banco e utilizado para o PDF; integração com o módulo de Contas a Pagar do ERP pode ser realizada em uma próxima entrega.
- Não alterar regras de aprovação, centro de custo ou departamento — estes permanecem vinculados à empresa solicitante (`company_id`). A empresa de faturamento afeta apenas o destinatário da NF-e e o cabeçalho do PDF.
- Não adicionar lógica de tributação ou retenção específica por empresa de faturamento nesta versão.

## Background & Context

O sistema atual ([schema.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts)) assume que a empresa que **solicita** a compra é a mesma que **receberá a fatura/CNPJ destinatário**. O relacionamento é via `purchase_requests.company_id → companies(id)`, e este valor é utilizado tanto para permissões/escopo quanto para:

- Renderizar o logo e dados da empresa no cabeçalho do PDF do Pedido de Compra ([pdf-service.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/pdf-service.ts));
- Definir o contexto da solicitação em telas como o Kanban ([kanban-board.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/kanban/kanban-board.tsx)).

A tabela `companies` já contém todos os dados necessários para o faturamento (razão social `name`, `trading_name`, `cnpj`, `address`, `phone`, `email`, `id_company_erp`, `active`), não sendo necessária a criação de tabelas auxiliares adicionais.

O sistema de permissões atual utiliza flags booleanas em `users`:

- `is_admin` → acesso total
- `is_buyer` → Comprador (responsável pela criação da RFQ e negociações)
- Demais perfis (`is_manager`, `is_approver_a1`, `is_approver_a2`, `is_receiver`) não alteram dados de faturamento.

### Fluxo de Fases Atual (do purchase_requests.currentPhase)

`solicitacao` → `aprovacao_a1` → `cotacao` → `aprovacao_a2` → `pedido_compra` → `recebimento` → `conf_fiscal` → `conclusao_compra` → `pedido_concluido`

A edição do `billing_company_id` será permitida nas fases:

- `solicitacao` (tela de criação/edição da solicitação)
- `cotacao` (edição da RFQ / Fase de Cotação)

E bloqueada (somente leitura) nas fases de `aprovacao_a1`, `aprovacao_a2`, e subsequentes.

## Functional Requirements

### 1. Estrutura de Dados (Banco + Schema Drizzle)

- **FR-1**: A tabela `purchase_requests` deve receber a coluna `billing_company_id` (INTEGER) com FK para `companies(id)`.
- **FR-2**: A tabela `quotations` deve receber a coluna `billing_company_id` (INTEGER) com FK para `companies(id)`, para permitir que cada versão de RFQ reflita explicitamente a escolha atual.
- **FR-3**: Na criação de uma nova solicitação (`purchase_requests`), o valor padrão de `billing_company_id` é definido igual ao `company_id` da solicitação (empresa solicitante).
- **FR-4**: Na criação de uma nova RFQ (`quotations`) a partir de uma `purchase_requests`, o valor de `billing_company_id` é copiado a partir do valor atual da `purchase_requests.billing_company_id`.
- **FR-5**: Backfill automático na migração SQL: para todos os registros históricos de `purchase_requests`, definir `billing_company_id = company_id`.
- **FR-6**: Todos os enriquecimentos (joins) em repositories relacionados a Purchase Request devem trazer tanto `company` (empresa solicitante) quanto `billingCompany` (empresa de faturamento) — exemplo: `getPurchaseRequestById`, `getAllPurchaseRequests`, `getPurchaseRequestsForBoard`.

### 2. Tela de Criação / Edição de Solicitação (Fase "solicitacao")

- **FR-7**: No formulário [enhanced-new-request-modal.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/shared/components/enhanced-new-request-modal.tsx), **imediatamente abaixo** do campo "Empresa" (atual `companyId`), adicionar um novo campo de seleção: **"Empresa para Faturamento *"**.
- **FR-8**: As opções do select de "Empresa para Faturamento" devem listar **apenas as empresas com `active = true`** (filtradas no carregamento do hook `useCompanies` ou via query param `?onlyActive=true` se existir).
- **FR-9**: O valor inicial do campo "Empresa para Faturamento" deve ser igual à empresa selecionada no campo "Empresa" (solicitante). Se o usuário alterar o campo "Empresa" (solicitante), o campo "Empresa para Faturamento" deve ser automaticamente sincronizado para o mesmo valor (a menos que o usuário já o tenha alterado manualmente).
- **FR-10**: Permissões:
  - Se `user.isBuyer === true` OU `user.isAdmin === true` → o campo é **editável**.
  - Qualquer outro perfil → o campo é renderizado em **modo somente leitura** (Select `disabled` ou valor fixo exibido).

### 3. Tela de Criação / Edição de RFQ (Fase "cotacao")

- **FR-11**: No componente [rfq-creation.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/quotations/components/rfq-creation.tsx) (modal de criação/edição da RFQ), adicionar uma seção "Dados da Empresa" ou incluir o campo "Empresa para Faturamento" ao lado das informações da solicitação.
- **FR-12**: Na tela [quotation-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/quotations/components/quotation-phase.tsx), no card de resumo da RFQ, exibir visualmente a "Empresa para Faturamento" atualmente selecionada (valor somente leitura para não-compradores; para compradores, exibir juntamente do botão "Editar RFQ" que abre o rfq-creation).
- **FR-13**: Ao alterar a "Empresa para Faturamento" dentro do modal `rfq-creation`, a alteração deve ser refletida tanto na `quotations.billing_company_id` quanto na `purchase_requests.billing_company_id` (mantendo sincronia).
- **FR-14**: Permissões: idêntico a FR-10 — apenas `isBuyer` ou `isAdmin` editam; demais perfis veem em modo somente leitura.
- **FR-15**: Validação: ao salvar a RFQ, o backend revalida se `billing_company_id` aponta para uma empresa com `active = true`; caso contrário, retorna erro HTTP 400 com mensagem amigável.

### 4. PDF do Pedido de Compra e Templates

- **FR-16**: No serviço [pdf-service.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/pdf-service.ts), no método `generatePurchaseOrderPDF(purchaseRequestId)`:
  - Buscar a empresa de faturamento (`billingCompany`) via `purchase_requests.billing_company_id → companies`.
  - Se `billing_company_id` for NULL (registro muito antigo não-migrado), fazer fallback para `company_id` (empresa solicitante).
- **FR-17**: No método `generatePurchaseOrderHTML` e no template [purchase-order.html](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/templates/pdf/purchase-order.html):
  - O **bloco principal de dados da empresa** (razão social, CNPJ, endereço, telefone, e-mail no canto superior esquerdo; e o logo) deve ser **substituído** pelos dados da `billingCompany`.
  - Adicionar um **campo separado e de destaque sutil** imediatamente abaixo dos dados de Fornecedor/Local de Entrega (ou próximo ao bloco "Solicitação" / "Comprador"):
    - **Empresa Solicitante (Origem)**: `{company.name} — CNPJ: {company.cnpj}`
    - Este campo garante rastreabilidade da origem.
- **FR-18**: O logo exibido no cabeçalho do PDF deve ser o logo da **empresa de faturamento** (`billingCompany.logo_base64` ou `billingCompany.logo_url`), e não mais da empresa solicitante.
- **FR-19**: Se `billingCompany.id === company.id` (empresa de faturamento igual à solicitante), omitir o campo separado "Empresa Solicitante" para não gerar redundância visual no PDF.

### 5. Validações, Permissões e Edge Cases

- **FR-20**: Validação no backend (middleware de endpoint) nos endpoints de POST/PUT de `purchase-requests` e `quotations`: verificar que `billing_company_id` (se fornecido) corresponde a `companies.active = true`.
- **FR-21**: Bloqueio de edição em fases avançadas: ao tentar atualizar `billing_company_id` com a solicitação em fase `aprovacao_a1`, `aprovacao_a2`, `pedido_compra`, `recebimento`, etc., o backend deve ignorar a alteração (e logar warning) ou retornar erro 409.
- **FR-22**: Retorno de Fase de `pedido_compra` → `aprovacao_a2`: já existe regra no sistema que exclui o PO existente. O `billing_company_id` é preservado nesta operação e pode ser alterado novamente nas fases de `cotacao`.
- **FR-23**: Relatórios (Invoices Report, Items Analysis Report): adicionar coluna "Empresa Faturamento" ou badge informativo (seguindo o padrão já implementado de badges de multimoeda) para indicar qual é o destinatário da NF-e.

## Non-Functional Requirements

- **NFR-1 – Retrocompatibilidade**: Toda solicitação existente é automaticamente migrada com `billing_company_id = company_id`; nenhuma tela ou PDF deve quebrar para registros históricos. Fallback adicional: se por algum motivo `billing_company_id` for NULL, usar `company_id`.
- **NFR-2 – Performance**: Adicionar índice `idx_purchase_requests_billing_company_id` em `purchase_requests(billing_company_id)` e `idx_quotations_billing_company_id` em `quotations(billing_company_id)` para evitar full scan em joins futuros.
- **NFR-3 – Integridade Referencial**: Ambas as FKs (`purchase_requests.billing_company_id` e `quotations.billing_company_id`) devem apontar para `companies(id)` com `ON DELETE SET NULL` ou `ON DELETE RESTRICT` (recomendado RESTRICT para não perder dados de faturamento ao tentar apagar uma empresa em uso).
- **NFR-4 – UX Não Intrusiva**: Para o usuário que sempre utiliza a empresa solicitante como faturamento, a mudança é invisível — o campo vem pré-preenchido e bloqueado por padrão (a menos que ele seja comprador e queira alterar).
- **NFR-5 – UX de Seleção**: No select da Empresa de Faturamento, cada opção deve exibir `Razão Social (CNPJ)` e as empresas inativas não devem aparecer (nem em fallback).
- **NFR-6 – Segurança de Dados**: Ao renderizar em modo somente leitura, não enviar apenas o valor textual; também validar no backend no momento do update que o usuário tem permissão para alterar `billing_company_id`.

## Constraints

- **Technical**: Stack existente Node.js + TypeScript + Drizzle ORM + PostgreSQL + React + Tailwind/Radix. Não introduzir novas bibliotecas (select já existe via `shared/ui/select.tsx`).
- **Business**:
  - O bloqueio de edição após `pedido_compra` é irrevogável sem retorno de fase.
  - Empresas inativas (`active=false`) nunca podem ser selecionadas nem aparecer em listas — isso garante conformidade com registros arquivados de empresas do grupo.
- **Dependencies**: A migração SQL deve ser executada antes de qualquer deploy; `shared/schema.ts` deve refletir as colunas novas para o TypeScript não quebrar.

## Assumptions

- Uma única empresa de faturamento por solicitação/Pedido de Compra é suficiente (não há necessidade de split por linha).
- A sincronia `quotations.billing_company_id = purchase_requests.billing_company_id` é desejada em 99% dos casos. Quando uma nova versão de RFQ for criada, o valor é herdado; se o comprador mudar em uma RFQ, a purchase_request é atualizada refletindo a escolha mais recente.
- A empresa solicitante (`company_id`) continua dirigindo permissões, centro de custo e departamento.
- Integração ERP: como mencionado em Non-Goals, o `id_company_erp` da empresa de faturamento pode ser usado em futuras integrações de Contas a Pagar, mas não é utilizado nesta entrega.

## Open Questions

- [ ] **OQ-1**: No PDF do PO, quando as empresas são diferentes, devemos também exibir o endereço completo da Empresa Solicitante além de razão social + CNPJ? Ou razão social + CNPJ é suficiente para rastreabilidade?
- [ ] **OQ-2**: O campo de empresa de faturamento deve ser **editável na fase de Aprovação A1/A2** pelos aprovadores (caso eles percebam que o comprador selecionou a errada) ou apenas compradores/administradores podem corrigir?
- [ ] **OQ-3**: No Kanban ([purchase-card.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/requests/components/kanban/purchase-card.tsx)), devemos adicionar um badge ou indicador visual quando `billing_company_id ≠ company_id` (ex: "Faturamento: Empresa X" em cinza no rodapé do card)?
- [ ] **OQ-4**: Para emissão de XML de NFC-e interna ou integrações futuras, devemos já incluir `billingCompany` no payload de exportação (mesmo sem enviar para o ERP agora)?

## Acceptance Criteria

### AC-1: Campo Persiste Corretamente com Valor Padrão

- **Type**: `rule`
- **Given**: Sou usuário logado, abro modal de Nova Solicitação e confirmo empresa da solicitação = "Empresa A"
- **When**: Crio a solicitação sem alterar o campo "Empresa para Faturamento"
- **Then**: `purchase_requests.billing_company_id == purchase_requests.company_id` (Empresa A); `purchase_requests.billing_company_id IS NOT NULL`
- **Pass Condition**: Registro em banco contém ambos valores iguais e não-nulos
- **Evidence**: `SELECT id, company_id, billing_company_id FROM purchase_requests ORDER BY id DESC LIMIT 1`

### AC-2: Edição por Comprador com Empresa Diferente Ativa

- **Type**: `rule`
- **Given**: Existem pelo menos duas empresas ativas "Empresa A" e "Empresa B" no cadastro; usuário logado é comprador
- **When**: Crio uma solicitação com empresa solicitante = A, depois altero "Empresa para Faturamento" para B e salvo
- **Then**: `billing_company_id = id(B)`, `company_id = id(A)`; ao abrir novamente a edição, o campo mostra "Empresa B" selecionado
- **Pass Condition**: Persistência e carregamento UI corretos após refresh
- **Evidence**: (1) Query SQL; (2) Screenshot do form aberto novamente mostrando B; (3) Payload HTTP do PUT

### AC-3: Restrição de Apenas Empresas Ativas

- **Type**: `rule`
- **Given**: Existe "Empresa C" com `active = false` no banco
- **When**: Tento (a) selecioná-la no dropdown UI via manipulação de DOM; (b) enviar payload HTTP POST/PUT com `billing_company_id = id(C)` diretamente no endpoint
- **Then**: (a) Empresa C não aparece nas opções do select; (b) Backend retorna HTTP 400 com mensagem "Empresa de faturamento selecionada está inativa ou não existe"
- **Pass Condition**: UI e backend bloqueiam seleção de empresas inativas
- **Evidence**: (1) Screenshot das opções de select sem a empresa C; (2) Request curl retornando 400

### AC-4: Permissões — Apenas Comprador/Admin Edita

- **Type**: `rule`
- **Given**: Solicitação existente em fase `solicitacao` ou `cotacao`; quatro perfis logados separadamente: (1) Admin, (2) Comprador, (3) Aprovador A1, (4) Recebedor
- **When**: Cada perfil acessa a tela de edição da solicitação ou RFQ
- **Then**: Campos editáveis apenas para (1) e (2); (3) e (4) veem o campo como disabled/readonly; envio HTTP de PUT com `billing_company_id` por (3) ou (4) é ignorado (campo não é atualizado no banco)
- **Pass Condition**: UI bloqueada e backend valida permissão antes de gravar
- **Evidence**: (1) Screenshots dos 4 perfis; (2) Log do servidor mostrando que update por A1 não alterou a coluna

### AC-5: PDF do PO Usa Dados da Empresa de Faturamento

- **Type**: `rule`
- **Given**: Solicitação com empresa solicitante = A; empresa de faturamento = B (diferentes); Aprovação A2 concluída com sucesso; Pedido de Compra gerado
- **When**: Gerar PDF do Pedido de Compra via botão de impressão
- **Then**: Cabeçalho do PDF exibe razão social, CNPJ, endereço, logo, telefone e email da **Empresa B**; em campo separado (abaixo do Fornecedor) lê-se "Empresa Solicitante (Origem): Empresa A — CNPJ XX.XXX.XXX/000X-XX"
- **Pass Condition**: Dados visuais do PDF batem com `billingCompany` e separado contém a origem
- **Evidence**: (1) Páginas do PDF (screenshot ou render); (2) Dados do HTML gerado em `generatePurchaseOrderHTML`

### AC-6: Retrocompatibilidade — Mesma Empresa (PDF Limpo)

- **Type**: `rule`
- **Given**: Solicitação existente onde `billing_company_id == company_id` ou registro histórico onde o campo foi migrado
- **When**: Gerar PDF do Pedido de Compra
- **Then**: Cabeçalho exibe a empresa normalmente; o campo "Empresa Solicitante (Origem)" **não aparece** (sem redundância visual)
- **Pass Condition**: PDF idêntico ao layout atual (sem duplicação de informação)
- **Evidence**: Comparação lado-a-lado: PDF antigo vs. PDF novo quando empresas são iguais

### AC-7: Bloqueio após Pedido de Compra + Retorno de Fase

- **Type**: `rule`
- **Given**: Solicitação em fase `pedido_compra` com `billing_company_id = B`; administrador força retorno para `aprovacao_a2` (mecanismo existente de retorno de fase que exclui PO anterior)
- **When**: Após retorno, comprador acessa fase Cotação e altera faturamento de B para C
- **Then**: Alteração é salva em `purchase_requests.billing_company_id = C`; novo PO gerado posteriormente contém empresa C no PDF. Antes do retorno (em `pedido_compra`), qualquer tentativa de update é bloqueada/ignorada.
- **Pass Condition**: Edição permitida após retorno e bloqueada durante `pedido_compra`
- **Evidence**: Query antes/depois do retorno e da edição confirmando a transição

### AC-8: Coerência Visual e Clareza

- **Type**: `rubric`
- **Dimension**: Clareza e posicionamento do campo "Empresa para Faturamento" nas telas e no PDF; ausência de quebras de layout; distinção visual entre modo editar/readonly
- **Scale**: 1-5
- **Anchors**:
  - 1 = Campo está escondido ou em local não intuitivo; nenhuma indicação visual de que é diferente da empresa solicitante; PDF exibe informações incorretas ou quebra de layout
  - 3 = Campo aparece e funciona, porém posicionado longe da empresa solicitante (sem relação visual); modo readonly não tem feedback claro; PDF exibe os dados mas com espaçamento inconsistente
  - 5 = Campo aparece imediatamente abaixo de "Empresa" (solicitante), com label claro "*Empresa para Faturamento*", tooltip explicativo se possível; modo readonly tem estilo "valor congelado" consistente com restante da aplicação; PDF possui dados completos sem quebras e com destaque sutil da rastreabilidade
- **Pass Threshold**: >= 4
- **Evidence**: (1) Screenshots da tela de criação/solicitação; (2) Screenshot da Fase de Cotação; (3) 2 páginas do PDF mostrando cabeçalho completo e bloco Empresa Solicitante
