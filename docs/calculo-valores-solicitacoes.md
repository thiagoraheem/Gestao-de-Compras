# Sistema de Cálculo de Valores das Solicitações de Compra

Esta documentação descreve a regra matemática padrão de negócios responsável por precificar e contabilizar os valores de uma Solução de Compra.
Esta regra foi centralizada na classe `CalculadoraValoresSolicitacao` presente no diretório `shared/utils`.

## Ordem e Priorização do Cálculo

Todo e qualquer relatório contábil destas solicitações no sistema deve obrigatoriamente expor 5 pilares:

### 1. Valor Itens (Bruto Total)
É a soma universal de todos os itens brutos adquiridos.
**Fórmula:** `Σ (Preço Original Unitário * Quantidade) de cada Item`
*(Notas: Caso o frete esteja incluso nos itens no ERP, o frete subirá também este valor)*

### 2. Desconto (Individual de Itens)
É a soma restrita dos descontos apontados na linha unitária de cada produto da cotação vinculada à solicitação. 
**Fórmula:** `Σ (Desconto individual atribuído em cada row de item)`

### 3. SubTotal
A diferença direta do Valor Bruto com o Desconto Unitário Aplicado.
**Fórmula:** `Valor Itens - Descontos Indivuduais`

### 4. Desconto Proposta (Global)
Dedução direta no orçamento total da solicitação, como acordos com fornecedores para o fechamento de um grande pacote de carrinho de compras.
**Fórmula:** `Desconto aplicado sobre o SubTotal (seja em % ou em Moeda R$)`

### 5. Valor Final
O custo líquido da operação para o caixa. Respeita a ordem exata matemática.
**Fórmula:** `SubTotal - Desconto Proposta`

> **IMPORTANTE**: É vedado no sistema a presença de Valores ou Descontos negativos que afetem matematicamente e invertam a positividade do caixa. A calculadora possui filtros automáticos de `Math.max(0, val)` e inibição do desconto não superar o limite original.
