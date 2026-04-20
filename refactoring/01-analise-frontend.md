# Análise do Frontend (Cliente)

## 1. Visão Geral da Situação Atual
O projeto frontend, localizado em `client/src`, é construído com tecnologias modernas: **React 18**, **Vite**, **TypeScript**, **Tailwind CSS** (junto com Radix UI / Shadcn UI para componentes estruturais), **Wouter** (para roteamento) e **React Query / TanStack Query** (para gerenciamento de requisições e estado assíncrono do lado do servidor).

Embora a stack tecnológica seja excelente e muito atual, a organização estrutural do código cresceu de forma orgânica e monolítica, gerando sérios gargalos de manutenabilidade e leitura.

### 1.1 Principais Problemas Identificados

**Arquitetura Monolítica e Componentes "God" (Deus):**
- Muitos arquivos são excessivamente grandes e contêm demasiadas responsabilidades (UI, regras de negócio e consumo de estado). Exemplos críticos:
  - `conclusion-phase.tsx` (~80KB)
  - `supplier-comparison.tsx` (~62KB)
  - `update-supplier-quotation.tsx` (~54KB)
  - `dashboard.tsx` (~39KB)
  - `user-manual.tsx` (~65KB)
- Componentes complexos não estão sendo devidamente quebrados em partes menores e reaproveitáveis, misturando lógica de renderização pesada com side-effects (useEffect) e mutações complexas.

**Estrutura de Pastas Plana:**
- O projeto usa a abordagem tradicional (e básica) de separar por tipo: `components`, `pages`, `hooks`, `utils`. Isso funciona para projetos pequenos, mas para uma aplicação enterprise isso gera uma pasta `components` muito cheia (atualmente com 72 arquivos na raiz), misturando componentes de domínio, componentes genéricos e partes de páginas.

**Roteamento (App.tsx):**
- O arquivo `App.tsx` atua não apenas como raiz, mas gerencia layouts e um `Switch` massivo com diversas lógicas de redirecionamento, guardas de rota (Managers, Admins) e checagens relacionadas a senhas. Isso viola o Single Responsibility Principle (SRP).

**Lógicas de Negócio Vazando para a Camada de View:**
- Provavelmente, muitas chamadas de API, processamento dos dados recebidos do React Query e validações de formulário (React Hook Form + Zod) estão escritas diretamente dentro do escopo dos componentes React.

**Desempenho (Performance):**
- Arquivos de tamanho massivo como `kanban-board.tsx` (~50KB) e componentes que renderizam listas extensas costumam sofrer de renderizações excessivas (`re-renders`) caso não usem `React.memo`, `useMemo` ou `useCallback` corretamente e dependam e prop-drilling excessivo.

---

## 2. O Que Funciona Bem (Deve Ser Mantido)
- **Stack Tecnológica:** React + Vite + TypeScript é perfeito.
- **TanStack Query (React Query):** Padrão de indústria para caching, deve continuar sendo usado intensamente, mas abstraído corretamente.
- **Tailwind CSS e Shadcn UI:** A base de design e estilo é muito boa. A estilização deve continuar usando classes do Tailwind ao invés de CSS misturado ou refactoring drástico do visual.
- **Wouter:** Um roteador minimalista que atende bem à necessidade do projeto, ainda que as definições de rota precisem de organização.

---

## 3. Sugestões de Melhorias na Arquitetura e Padrões (Best Practices)

### A. Padrão "Feature-Sliced Design" (FSD) ou "Feature-Based"
Deixar de agrupar por "técnica" (`components`, `hooks`, `pages`) e passar a agrupar por "Domínio/Feature".
Exemplo de nova estrutura em vez da antiga:
```text
src/
 ├─ features/
 │   ├─ quotations/
 │   │   ├─ components/ (ex: SupplierComparison)
 │   │   ├─ hooks/      (ex: useFetchQuotations)
 │   │   ├─ types/
 │   │   └─ utils/
 │   ├─ suppliers/
 │   └─ users/
 ├─ shared/ (Antiga pasta genérica)
 │   ├─ ui/       (Botões, inputs, modais - componentes shadcn puros)
 │   ├─ hooks/    (useAuth, utilitários globais)
 │   └─ lib/
 └─ pages/        (Atuam puramente como agregadores das features e definição de rota)
```

### B. Separação de Responsabilidades (Smart vs. Dumb Components)
- **Container / Smart Components:** Lidam com Injeção de dependência (ex: usam React Query, acessam contexto). Devem ser muito enxutos, apenas passando dados.
- **Presentational / Dumb Components:** Recebem apenas `props` e disparam `callbacks`. Não acessam API e não fazem mutações no banco. São altamente testáveis e puros.
Isso ajuda a quebrar arquivos de 80KB.

### C. Extração de Custom Hooks para Business Logic
Qualquer componente que comece a construir lógicas complexas de cálculo de frete, checagens de validação fiscal do fornecedor, ou manipulação de arrays longos, deve delegar isso a um Custom Hook `use...` criado junto à feature.

### D. Refatoração do Roteamento
As rotas não devem ser definidas estruturalmente em uma única árvore no `App.tsx`. Deve-se externalizar as rotas para um array de mapeamento ou um componente isolado (`RouterProvider`/`AppRoutes`), e também implementar as proteções (Rotas privadas, admin) em wrappers de layout sem sujar a lógica inicial do auth.
