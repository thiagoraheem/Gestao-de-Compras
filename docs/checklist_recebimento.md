---
metadata:
  data_de_criacao: "2025-12-12"
  autor: "Assistente IA"
  documento_referenciado: "docs/recebimento.md"
---

# Checklist Recebimento Compras × Locador

## 1. Itens Desenvolvidos
- [x] Banco de dados atualizado para suportar Recebimento (recebimento.md:626-633) — Status: concluído
- [x] Endpoint de importação de XML com parser NF-e (recebimento.md:635-637, 644-645) — Status: concluído
- [x] Endpoints auxiliares para Centro de Custo e Plano de Contas (recebimento.md:637-638) — Status: concluído
- [x] Rota frontend `/recebimentos/novo` e componente `ReceiptFormPage` (recebimento.md:640-642) — Status: concluído
- [x] Validações: chave NF-e duplicada e obrigatoriedade de CC/PC em serviço/avulso (recebimento.md:646-647, 590-597) — Status: concluído

## 2. Itens Pendentes
- [ ] Implementar sincronização de Centros de Custo e Plano de Contas (recebimento.md:307-310, 575-579) — Prioridade: média
- [ ] Implementar API Compras → Locador `POST /api/v1/recebimentos` e integração (recebimento.md:312-387, 389-396) — Prioridade: alta
- [ ] Implementar ações de `Validar Recebimento` e `Enviar para Locador` no frontend e backend (recebimento.md:532-548, 569-574) — Prioridade: alta
- [ ] Adequar base de dados do Locador: criar tabela de staging e procedures (recebimento.md:230-254) — Prioridade: alta
- [ ] Mapear produtos do Locador para itens de Produto quando necessário (recebimento.md:487-488, 598-603) — Prioridade: média
- [ ] Implementar consistência de totais no backend Compras (recebimento.md:541, 646-647) — Prioridade: média
- [ ] Marcar registros inativos de CC/PC ao sincronizar (recebimento.md:307-310) — Prioridade: baixa

## 3. Recomendações
- Para "API Compras → Locador":
  - Ação concreta: Implementar `locadorIntegrationService` com `sendReceipt` montando DTO conforme recebimento.md:320-386 e chamando `POST /api/v1/recebimentos`.
  - Estimativa de tempo: 6 horas
  - Recursos necessários: acesso à API do Locador, token de autenticação, documentação.
  - Dependências: status `validado_compras`; fornecedor mapeado; CC/PC preenchidos quando aplicável (recebimento.md:598-603).
- Para "Validar e Enviar no frontend/backend":
  - Ação concreta: Criar endpoints `POST /api/recebimentos/:id/validar` e `POST /api/recebimentos/:id/enviar-locador`; adicionar botões e estados na UI `ReceiptFormPage` (recebimento.md:532-548, 569-574).
  - Estimativa de tempo: 4 horas
  - Recursos necessários: design system existente, serviços HTTP.
  - Dependências: regras de negócio consolidadas (recebimento.md:581-603).
- Para "Sincronização de CC/PC":
  - Ação concreta: Implementar `POST /api/sync/centros-custo` e `POST /api/sync/plano-contas`; agendar job diário para atualização (recebimento.md:575-579, 307-310).
  - Estimativa de tempo: 3 horas
  - Recursos necessários: acesso à API do Locador, agendador de tarefas.
  - Dependências: tabelas `cost_centers` e `chart_of_accounts` ativas (recebimento.md:83-111).
- Para "Base de dados do Locador":
  - Ação concreta: Criar tabela `Compras_Recebimentos_Importacao` e procedures de processamento conforme recebimento.md:230-254; expor API `POST /api/v1/recebimentos`.
  - Estimativa de tempo: 8 horas
  - Recursos necessários: acesso ao SQL Server, desenvolvimento .NET, apoio de DBA.
  - Dependências: DTO definido no Compras; fluxo de integração validado (recebimento.md:64-78, 311-396).

