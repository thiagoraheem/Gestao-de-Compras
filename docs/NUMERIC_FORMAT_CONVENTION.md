# Convenção de Formatação Numérica

## Padrão Adotado
O sistema adota o padrão **Brasileiro (pt-BR)** como formato preferencial para entrada e exibição de dados numéricos, mas armazena e processa internamente no padrão **Internacional (en-US)**.

### Frontend
- **Entrada de Dados**: Componente `DecimalInput` com máscara em tempo real.
  - Exibe: `1.000,5000` (Separador de milhar: ponto, Decimal: vírgula, 4 casas decimais).
  - Retorna para o Form: `1000.5000` (String numérica padrão internacional).
- **Validação**: `zod` schema valida strings numéricas ou números.

### Backend
- **Parsing Universal**: `NumberParser` (`server/utils/number-parser.ts`).
  - Prioriza o formato BRL se houver ambiguidade (ex: vírgula como decimal).
  - Converte `1.000,50` -> `1000.50`.
  - Converte `1,000.50` -> `1000.50` (Suporte a formato US se detectado inequivocamente).
  - Remove símbolos de moeda (`R$`, `$`).
- **Precisão**: 4 casas decimais para valores unitários (`NUMERIC(12,4)` ou equivalente), 2 casas para totais monetários.

## Tratamento de Erros e Auditoria
- Valores inválidos são convertidos para `0` (zero) ou rejeitados dependendo do contexto de validação.
- Conversões críticas são logadas para auditoria (implementado nas rotas de atualização).
