# Relatório de Engenharia Reversa e Sincronização do Modelo de Dados

## 1. Resumo Executivo
- Foi realizada engenharia reversa completa do banco (schema `public`) e gerado o documento `docs/db-estrutura-atual.md` com tabelas, colunas, tipos, PK/UK/FK, índices e funções.
- O modelo `shared/schema.ts` foi alinhado para refletir exatamente a estrutura atual do banco, removendo entidades não existentes e ajustando tipos e constraints.
- Erros de migração foram resolvidos ao eliminar divergências (enums e tabelas ausentes) e adequar tipos/precisões.

## 2. Principais Discrepâncias Encontradas
- `receipts` no projeto possuía campos fiscais (document_key, etc.) e relações (supplier, cost_center, chart_of_accounts) que não existem no banco atual.
- Tabelas `receipt_nf_xmls` e `receipt_installments` não existem no banco.
- `chart_of_accounts` não existe no banco.
- Precisões/escala de valores em `supplier_quotations`, `supplier_quotation_items`, `purchase_order_items` divergiam (banco usa escala 4 em vários campos de preço/subtotal/final).
- Campos com timezone e tipos `inet`/`varchar(50)` em `configuration_history` divergiam.
- Sessão: o banco possui `session` (json) e `sessions` (jsonb); o modelo só tinha `sessions`.

## 3. Alterações Realizadas no Modelo
- `shared/schema.ts`:
  - `companies`: adicionado `logo_url` para compatibilidade; mantido `logo_base64`.
  - `cost_centers`: removidos `external_id`, `is_active`, `updated_at` para alinhar ao banco.
  - `supplier_quotations`, `supplier_quotation_items`, `purchase_order_items`: ajustadas precisões/escala (campos de preço/subtotal/final com escala 4).
  - `quantity_adjustment_history`: adicionado `severity_level` (text).
  - `receipts`: reduzido ao conjunto mínimo existente (pedido, status, recebedor, datas, observações, aprovação), sem campos fiscais; relations atualizadas.
  - `receipt_items`: reduzido ao conjunto existente (vínculo ao pedido e recebimento + quantidades);
  - Removidas `receipt_nf_xmls` e `receipt_installments` e tipos/schemas associados.
  - `configuration_history`: `change_type` como `varchar(50)`, `ip_address` como `inet`, `changed_at` e demais com timezone onde aplicável.
  - `sessions` mantido; adicionada `session` compatível com connect-pg-simple.

- `server/routes/receipts.ts`:
  - Removidos usos de campos inexistentes; importação de XML agora retorna prévia parseada sem inserir no banco.
  - CRUD ajustado para usar o conjunto mínimo de campos do banco; validação atualizada.

- `server/routes/master-data.ts`:
  - Removida dependência de `chart_of_accounts` (retorno vazio por ora).

## 4. Migrações Aplicadas/Resultados
- `npm run db:push`: aplicado com sucesso após alinhamento; criação de `push_subscriptions` e `quotation_version_history` conforme modelo atual.
- Alertas de perda de dados foram exibidos para objetos fora do modelo; nenhuma exclusão destrutiva foi executada além do que o drizzle precisou para alinhar tipos/índices.

## 5. Impactos nas Funcionalidades Existentes
- Telas/fluxos que esperavam campos fiscais em `receipts` precisarão continuar usando prévia de XML e persistir dados mínimos exigidos pelo banco.
- Funcionalidade de armazenar XML e parcelas foi desativada no backend por inexistência de tabelas correspondentes; pode ser reintroduzida com migração específica.
- Endpoints de Master Data para plano de contas retornam vazio até que a tabela exista ou integração seja habilitada.

## 6. Migrações Necessárias (se desejarmos ampliar o banco)
- Adicionar tabelas `receipt_nf_xmls` e `receipt_installments` com FKs para `receipts`.
- Criar `chart_of_accounts` com `code`, `description` e índices adequados.
- Ampliar `receipts` com campos fiscais (`document_number`, `document_series`, `document_key`, etc.) e índices.
- Ajustar `purchase_orders` e `receipt_items` para suportar cenários de serviços/avulsos.

## 7. Recomendações para Evitar Problemas Futuros
- Manter engenharia reversa periódica e verificar diffs entre banco e modelo antes de `db:push`.
- Evitar introduzir enums no modelo sem migrações SQL de mapeamento de valores existentes (`USING CASE`).
- Centralizar tipos de valores monetários e padronizar escala/precisão (preferir `numeric(15,4)` quando o banco o usa).
- Documentar claramente quais tabelas são fonte de verdade (ex.: `receipts` mínimo atual) e quais serão expandidas via migrações futuras.

## 8. Plano de Implementação Gradual
- Fase 1: Operar com `receipts` mínimo, criar recebimentos com `purchase_order_id`, `received_by`, `received_at`, `status`, `receipt_number`.
- Fase 2: Introduzir `receipt_nf_xmls` e persistência do XML (migração controlada e API ajustada).
- Fase 3: Adicionar `receipt_items` ampliado e ajustes fiscais conforme necessidade.
- Fase 4: Introduzir `chart_of_accounts` e relacionamentos; atualizar frontend para seleção e validação.
- Fase 5: Migrar `receipts.status` para enum com mapeamento explícito, se desejado.

