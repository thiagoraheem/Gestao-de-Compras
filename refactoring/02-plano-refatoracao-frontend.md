# Planejamento e Cronograma de Refatoração Gradual

Este documento define um plano de ação passo-a-passo (faseado) focado na refatoração do Frontend do sistema, assegurando que o produto continue funcional. Devido ao tamanho monolítico de muitos componentes e risco natural das alterações, abordaremos este processo **gradualmente**.

## Fase 1: Fundação Estrutural e Camada Compartilhada

*Objetivo:* Preparar a estrutura base ("sandbox") para os novos padrões arquiteturais (sem quebrar os arquivos antigos por enquanto).

- [ ] **1.1. Criar a nova árvore de diretórios:**
  - Criar base para `src/features`, `src/shared/ui`, `src/shared/lib` e `src/app`.
- [ ] **1.2. Mover componentes de UI Genéricos (Shadcn/UI base):**
  - Mover gradativamente todos os componentes básicos e puros (ex: button, inputs, cards estáticos) da pasta monolítica de componentes para `src/shared/ui`. Atualizar os imports usando as facilidades do TS.
- [ ] **1.3. Ajustar `tsconfig.json` e atalhos absolutos:**
  - Garantir que aliases como `@/features`, `@/shared` estejam funcionando plenamente e de forma limpa.
- [ ] **1.4. Limpeza do App.tsx:**
  - Extrair o mapeamento do _Router_ e as verificações (`Router()`) para `src/app/routes/index.tsx` ou similar.
  - Abstrair ou refinar componentes High Order (HOC) como os wrappers de rotas protegidas (`ManagerRoute`, `AdminRoute`, etc) em subdiretórios menores e limpos (`src/shared/guards`).

---

## Fase 2: Abstração State Management (Data Fetching)

*Objetivo:* Desacoplar chamadas de rede e gestão de estado "do servidor" das _views_ puras, padronizando o uso do **React Query**.

- [ ] **2.1. Identificar e extrair chamadas assíncronas do React:**
  - Em componentes médios e grandes (visando primeiro páginas como Users, Departments e Companies), criar custom hooks para chamadas à API, devolvendo estado e mutators (ex: `useUsers()`, `useUpdateCompany()`).
- [ ] **2.2. Otimizar Caching e Invalidação de Queries:**
  - Revisar se o projeto possui chaves de query (Query Keys) fortes ou hardcoded e padronizá-las (`const queryKeys = { users: ['users'], user: (id) => ['users', id] }`).
- [ ] **2.3. Tratar Lógica Intermediária:**
  - Eliminar lógicas de formatação complexas (datas, moedas, transformações complexas vindas do backend) de dentro de loops de render e delegar isso aos callbacks de `select` do `useQuery`.

---

## Fase 3: Desintegração de Componentes "God" (Os Mastodontes)

*Objetivo:* Refatorar os piores gargalos do sistema, que acumularam de 2.000 a 3.000 linhas de código no mesmo arquivo.

Este é trabalho crítico e será testado extensamente após cada mini-fase.

- [ ] **3.1. `conclusion-phase.tsx` e Fases do Processo:**
  - Alocar este componente e as demais telas de fase do fluxo em `features/approvals` ou `features/requests`.
  - Dividir `conclusion-phase.tsx` em:
    - Um Container: `ConclusionPhaseContainer.tsx` (cuida dos dados/estado).
    - Várias Views puras: `ConclusionPhaseHeader`, `ConclusionPhaseForm`, `ConclusionPhaseSummary`.
- [ ] **3.2. `supplier-comparison.tsx` e Cotações:**
  - Alocar em `features/quotations`.
  - Extrair a Grid de dados para um componente sub-feature: `features/quotations/components/ComparisonDataGrid`.
  - Garantir que a renderização pesada destas listas passe por `React.memo` para que um re-render no parent não trave a rolagem e os cliques.
- [ ] **3.3. Refatorar Painéis de Controle (Dashboard / Relatórios):**
  - Mover `dashboard.tsx`, `purchase-requests-report.tsx` e afins para domínios específicos. Componentes de gráficos (Charts) misturados de maneira solta, devem ser encapsulados em módulos visuais independentes.

---

## Fase 4: Otimização, Clean Code e Finesse

*Objetivo:* Lapidação, simplificação e leitura.

- [ ] **4.1. Limpeza de prop-drilling:**
  - Remover passagem de N parâmetros através de vários níveis de componentes sem utilidade intermediária. Avaliar o React Context *apenas se necessário* no escopo da feature (Zustand em vez de Contexto pode ser considerado se a aplicação precisa de transições instantâneas não acopladas à UI, mas o React query cobre quase tudo).
- [ ] **4.2. Refatoração de Tipagens TS:**
  - Identificar os schemas e Type `Interfaces` espalhadas ao lado dos componentes React e unificá-las em camadas (`features/../types.ts` ou arquivos Zod apropriados para inference type). Eliminando usos de `any` ou typecast sem segurança (`as Type`).
- [ ] **4.3. Testes, Linters e Boas Práticas:**
  - Garantir consistência rodando e consertando todos os warnings do ESLint / TypeScript.

---

## 📈 Metodologia de Implementação (Boy Scout Rule)

> _"Deixe o acampamento mais limpo do que você o encontrou."_

A estratégia para não interromper o time de desenvolvimento é aplicar o **refactoring guiado por feature**.

**Regra Prática:** Se você vai adicionar uma nova funcionalidade (ex: uma nova validação no Comparativo de Fornecedores), **primeiro você quebra o arquivo gigante em partes (Fase 3.2)**, então aplica a funcionalidade no componente quebrado recém testado. Evite fazer o refactor _apenas pelo refactor_ em meses fechados, combine as refatorações de código das Fases com cards/tarefas reais para diluir o custo e testar com casos reais de uso.
