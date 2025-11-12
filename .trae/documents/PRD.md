# PRD — Gestão de Compras

## 1. Visão do Produto
- Objetivos e propósito: digitalizar e padronizar o ciclo de compras (solicitação → cotação → aprovação → pedido → recebimento), reduzindo custos e tempo de ciclo, aumentando compliance e transparência.
- Público‑alvo: empresas com processos de compras internos (PMEs e médias), áreas operacionais que solicitam itens/serviços, equipes de Compras, gestores aprovadores e Financeiro/Contas a Pagar.
- Personas:
  - Solicitante Operacional: cria requisições e acompanha status.
  - Comprador: conduz cotações, compara propostas e emite pedidos.
  - Gestor de Compras: define políticas, aprova requisições e monitora indicadores.
  - Financeiro: confere pedidos/recebimentos, integra com contas a pagar.
  - Fornecedor: recebe convites de cotação e envia propostas.
- Proposta de valor: centralização do processo, redução de lead time, controle orçamentário e alçadas, melhor negociação via cotações comparativas, trilha de auditoria completa, UX moderna e integração nativa com sistemas existentes.

## 2. Escopo do Projeto
- Funcionalidades principais (priorização):
  - P0 (MVP):
    - Requisição de compra com validações e anexos.
    - Cotação com múltiplos fornecedores e comparação de propostas.
    - Workflow de aprovações por alçadas e centros de custo.
    - Emissão de Pedido de Compra (PC) e controle de status.
    - Recebimento e conferência (3‑way match básico: pedido, nota, recebimento).
    - Cadastro e qualificação de fornecedores.
    - Relatórios essenciais (lead time, economia, compliance de aprovações).
    - Autenticação, autorização (RBAC), sessões persistentes e trilha de auditoria.
  - P1:
    - Catálogos/contratos de fornecimento e itens padronizados.
    - Orçamento por unidade/centro de custo e bloqueios por excesso.
    - Portal do fornecedor simplificado (convites e propostas).
  - P2:
    - Analytics avançados (economia agregada, spend por categoria/fornecedor).
    - Integrações adicionais (ERP/contabilidade, SSO corporativo).
- Requisitos técnicos essenciais:
  - Frontend SPA com `React` + `Vite` e `Tailwind`.
  - Backend `Node.js`/`Express` com `TypeScript` e `Drizzle ORM`.
  - Banco `PostgreSQL` com migrações via `drizzle-kit`.
  - Sessões com `express-session` e store em PostgreSQL (`connect-pg-simple`).
  - WebSockets (`ws`) para atualizações em tempo real (status de solicitações/cotações).
  - Geração de documentos (PDF) e exportações (XLSX).
  - Observabilidade: logs estruturados, métricas, auditoria de eventos críticos.
  - Segurança: LGPD, criptografia de senhas (`bcryptjs`), validação com `zod`.
- Limitações e exclusões explícitas:
  - Não contempla gestão completa de estoque/almoxarifado (apenas conferência básica).
  - Não inclui marketplace público ou leilões reversos na versão MVP.
  - Aplicativo mobile nativo fora do escopo inicial (P2 pode considerar versão responsiva).
  - Integrações ERP avançadas podem exigir fase dedicada (P1/P2).

## 3. Especificações Detalhadas
- Fluxos de usuário (principais):
  - Requisição de Compra:
    1. Solicitante cria requisição (item/serviço, quantidade, justificativa, centro de custo, anexos).
    2. Validações: orçamento disponível, políticas de compra, campos obrigatórios.
    3. Envio para aprovação conforme alçada; notificações a aprovadores.
    4. Aprovado: vira demanda para Compras; Reprovado: retorna com justificativa.
  - Cotação e Seleção:
    1. Comprador seleciona fornecedores (cadastro prévio e/ou convites diretos).
    2. Fornecedores enviam propostas (preço, prazo, condições, anexos).
    3. Sistema consolida e compara (menor preço, melhor prazo, score composto).
    4. Comprador escolhe vencedor e registra justificativa.
  - Aprovação de Pedido:
    1. Pedido gerado com base na cotação vencedora.
    2. Fluxo de aprovação por política (valor, categoria, centro de custo).
    3. Aprovado: pedido emitido; comunicação ao fornecedor.
  - Recebimento e Conferência:
    1. Registro de recebimento com conferência quantitativa/qualitativa.
    2. Anexos (nota fiscal, comprovantes); divergências geram tarefas de ajuste.
    3. Integração com financeiro/contas a pagar (P1/P2).
  - Cadastro de Fornecedores:
    1. Inclusão/edição com dados fiscais, categorias atendidas, documentos.
    2. Avaliação/qualificação; bloqueios e status.
- Requisitos de UI/UX:
  - Design system com componentes Radix UI, `tailwindcss-animate` e ícones `lucide-react`.
  - Acessibilidade (WCAG AA), responsividade (desktop primeiro, mobile responsivo).
  - Padrões de feedback (toasts, estados de carregamento/vazio/erro).
  - Wireframes (alto nível):

```
[Nova Requisição]
------------------------------------------------------
| Título da Requisição      [input]                  |
| Centro de Custo           [select]                 |
| Categoria                 [select]                 |
| Itens (lista)             [+ Adicionar Item]       |
|  - Descrição  Quantidade  Unidade  Preço Ref       |
| Justificativa             [textarea]               |
| Anexos                    [upload]                 |
| [Salvar Rascunho]     [Enviar para Aprovação]      |
------------------------------------------------------
```

```
[Painel de Cotações]
--------------------------------------------------------------------
| Requisição #123   Status: Em Cotação     [Convidar Fornecedores] |
| Propostas Recebidas: 3                                          |
|------------------------------------------------------------------|
| Fornecedor | Preço | Prazo | Condições | Score | [Selecionar]    |
|-----------|-------|-------|-----------|-------|------------------|
| ABC Ltda  | 1000  | 7d    | FOB       | 82    | [✔]             |
| XYZ SA    | 980   | 10d   | CIF       | 78    | [ ]             |
| ...                                                          ... |
|------------------------------------------------------------------|
| [Gerar Pedido]   [Registrar Justificativa]                        |
--------------------------------------------------------------------
```

- Requisitos de desempenho e escalabilidade:
  - P95 de latência de páginas listas < 250 ms (backend), ações críticas < 400 ms.
  - Suporte inicial a 300 usuários simultâneos; escalável horizontalmente (stateless) no backend.
  - Uploads até 20 MB por anexo, varredura de tipos; armazenamento conforme política.
  - Jobs assíncronos para geração de PDFs, envios de e‑mail e integrações.

## 4. Critérios de Aceitação
- Métricas de sucesso:
  - Redução de lead time médio de compra em 25% no MVP.
  - Adoção: 80% das requisições iniciais feitas pelo sistema em 60 dias.
  - Economia média por cotação ≥ 5% vs. preço de referência.
  - Taxa de aprovações dentro de SLA ≥ 90%.
- Cenários de teste obrigatórios:
  - E2E: requisição → cotação → aprovação → pedido → recebimento.
  - Validações: orçamento/alçada, campos obrigatórios, anexos e formatos.
  - Segurança: autenticação, autorização por papéis, proteção contra OWASP Top 10.
  - Performance: testes de carga (300 usuários), P95 dentro dos limites.
  - Integrações: geração de PDFs, envios SMTP/SendGrid, exportações XLSX.
- Critérios de qualidade:
  - Cobertura de testes > 80% em módulos críticos do backend.
  - Acessibilidade AA; zero erros críticos de console no frontend.
  - Auditoria completa de eventos (criação, aprovação, emissão, recebimento).
  - Observabilidade ativa (logs estruturados, métricas e alertas de SLA).

## 5. Cronograma e Marcos
- Fase 0 — Descoberta e Planejamento (2025‑11‑17 → 2025‑11‑28)
  - Refinamento de requisitos, políticas de compra, alçadas e orçamentos.
  - Protótipos de UX, validação com usuários chave.
- Fase 1 — MVP Funcional (2025‑12‑01 → 2026‑01‑16)
  - Implementação P0; testes E2E; estabilização de performance.
  - Entregáveis: requisição, cotação, aprovação, pedido, recebimento, relatórios básicos.
- Fase 2 — Integrações e Catálogos (2026‑01‑20 → 2026‑02‑28)
  - Portal fornecedor simplificado, orçamentos, integrações ERP/financeiro.
- Datas críticas e dependências:
  - Disponibilidade de credenciais SMTP/SendGrid.
  - Acesso ao PostgreSQL e esquema de migrações aprovado.
  - Definição de políticas de aprovação e centros de custo.

## 6. Considerações Técnicas
- Arquitetura proposta:
  - Frontend SPA `React` + `Vite` + `Tailwind` consumindo APIs REST e eventos via WebSocket.
  - Backend `Express`/`TypeScript` com camadas: rotas → serviços → repositórios (`drizzle-orm`).
  - Sessões e RBAC (roles: solicitante, comprador, gestor, financeiro, admin).
  - Migrações e schema versionado (`drizzle-kit push`).
  - Geração de PDFs (via `puppeteer`/`html-pdf-node`) e exportações (`xlsx`).
  - Observabilidade e auditoria (logs, trilha de eventos e métricas).
  - Deploy: build (`vite` + `esbuild`) e cópia para `C:\Locador\webapps\compras`.
- Tecnologias a serem utilizadas (alinhadas ao projeto):
  - Frontend: `react`, `@vitejs/plugin-react`, `tailwindcss`, `radix-ui`, `wouter`.
  - Backend: `express`, `ts`, `esbuild`, `tsx`, `zod`, `ws`.
  - Banco de dados: `postgresql` via `pg` e `drizzle-orm`.
  - Infra/integrações: `nodemailer`/`@sendgrid/mail`, `puppeteer`, `xlsx`.
  - Testes: `jest`, `ts-jest`, `supertest`.
- Requisitos de integração com sistemas existentes:
  - ERP/Financeiro: exportações de pedidos/recebimentos e integração de faturas (P1/P2).
  - Autenticação/SSO: considerar OIDC/SAML em fases futuras.
  - SMTP/SendGrid: envio de notificações e convites de cotação.

## 7. Métricas e Análise
- KPIs a serem monitorados:
  - Lead time por etapa, taxa de reprovação/ajustes, economia por cotação, SLA de aprovação.
  - Adoção por área/unidade, spend por categoria/fornecedor, compliance de políticas.
- Mecanismos de coleta de dados:
  - Eventos de frontend (page views, ações chave) e logs de backend estruturados.
  - Tabelas de auditoria no PostgreSQL com carimbo de tempo, usuário e ação.
  - Exportações periódicas e dashboards (P2 para analytics avançados).
- Critérios para iterações futuras:
  - Ajustes de UX guiados por KPIs e feedback dos usuários.
  - Expansão de integrações (ERP/SSO) e funcionalidades avançadas conforme metas.

---

Este PRD é a fonte única de verdade do projeto de Gestão de Compras. Alterações devem ser versionadas e comunicadas às equipes envolvidas.
