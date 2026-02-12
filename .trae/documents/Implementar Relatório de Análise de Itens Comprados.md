# Plano de Implementação: Relatório de Análise de Itens Comprados

## 1. Backend (API e Processamento de Dados)

Criar um novo endpoint `/api/reports/items-analysis` em `server/routes.ts` (ou um novo arquivo de rota se apropriado) para processar e agregar os dados.

### Lógica de Agregação

1. **Seleção de Dados**:

   * Buscar itens da tabela `purchase_order_items`.

   * Juntar com `purchase_orders` para filtrar por status (apenas pedidos confirmados/concluídos) e obter datas/fornecedores.

   * Juntar com `suppliers` para obter nomes dos fornecedores.

2. **Algoritmo de Agrupamento (Normalization)**:

   * Iterar sobre os itens brutos.

   * **Chave de Agrupamento**:

     * Se `itemCode` existir (não nulo/vazio): Usar `itemCode` como chave.

     * Se `itemCode` não existir: Usar `description` normalizada (Trim + UpperCase).

   * **Acumuladores por Chave**:

     * `totalQuantity`: Soma das quantidades.

     * `totalValue`: Soma de (`unitPrice` \* `quantity`).

     * `orderCount`: Contagem de pedidos únicos (`purchaseOrderId`).

     * `minPrice` / `maxPrice`: Rastrear variação de preço.

     * `suppliers`: Set/Lista de IDs e Nomes de fornecedores únicos.

     * `firstPurchaseDate` / `lastPurchaseDate`.

     * `rawDescriptions`: Lista de descrições originais (para identificar variações).

3. **Cálculo de Métricas Derivadas**:

   * `averagePrice`: `totalValue` / `totalQuantity`.

   * `averageOrderValue`: `totalValue` / `orderCount`.

   * `priceVolatility`: Diferença percentual entre `minPrice` e `maxPrice`.

4. **Resposta da API**:

   * Retornar lista ordenada (padrão: maior valor total gasto).

   * Incluir metadados de resumo (total geral gasto, total de itens únicos).

## 2. Frontend (Interface do Usuário)

Criar uma nova página `client/src/pages/items-analysis-report.tsx`.

### Componentes da Página

1. **Cabeçalho e Filtros**:

   * Seleção de Período (Data Inicial / Final).

   * Busca textual (por descrição ou código).

   * Filtro de "Apenas com Código ERP" vs "Sem Código".

2. **Cartões de KPI (Resumo)**:

   * Total Gasto no Período.

   * Itens Únicos Comprados.

   * Top Item (Maior Gasto).

   * Fornecedor Principal (Volume).

3. **Tabela de Detalhes (DataTable)**:

   * Colunas: Código (se houver), Descrição Principal (ou padronizada), Qtd Total, Valor Total, Preço Médio, Qtd Pedidos, Fornecedores (contagem ou lista popover).

   * Ordenação interativa.

   * Badge indicando qualidade do cadastro (ex: "Sem Código ERP").

4. **Visualização Gráfica (Opcional/Bônus)**:

   * Gráfico de barras para Top 10 Itens por Valor.

   * Gráfico de pizza para Distribuição com/sem Código ERP.

## 3. Navegação

* Adicionar link para o novo relatório na sidebar ou menu de relatórios existente.

## Passo a Passo de Execução

1. **Backend**: Implementar endpoint de agregação e lógica de normalização.
2. **Backend**: Testar endpoint com dados existentes para validar agrupamento.
3. **Frontend**: Criar estrutura da página e hook de fetch.
4. **Frontend**: Implementar tabela e filtros.
5. **Frontend**: Adicionar indicadores visuais de qualidade de dados.

