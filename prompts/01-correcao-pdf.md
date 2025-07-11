
# Prompt: Correção do PDF de Pedido de Compra

## Objetivo
Corrigir a geração do PDF do Pedido de Compra no arquivo `server/pdf-service.ts` para resolver problemas identificados.

## Problemas Identificados

### 1. PROBLEMA - Solicitante não aparece
- O campo solicitante não está sendo exibido corretamente no PDF
- Verificar se `purchaseRequest.requesterName` está sendo populado ou se deve usar `purchaseRequest.requester.firstName` + `purchaseRequest.requester.lastName`
- Se necessário, ajustar a consulta no `storage.ts` para garantir que os dados do solicitante sejam incluídos

### 2. PROBLEMA - Prazo de Entrega
- Atualmente usa `purchaseRequest.idealDeliveryDate` (data ideal do solicitante)
- Deve usar o prazo de entrega negociado com o fornecedor selecionado
- Buscar de `selectedSupplierQuotation?.deliveryTerms` ou campo similar que contenha o prazo real

### 3. PROBLEMA - Condições de Pagamento
- Confirmar se está buscando corretamente de `selectedSupplierQuotation?.paymentTerms`
- Garantir que este campo está sendo populado quando o fornecedor é selecionado

### 4. REMOÇÃO OBRIGATÓRIA - Colunas desnecessárias
- Remover completamente as colunas "DESCONTO" e "VALOR FINAL" da tabela de itens
- Estas colunas não são usadas no sistema e estão sempre zeradas
- Ajustar o layout da tabela para ficar mais limpo

### 5. MELHORIAS ADICIONAIS
- Garantir que todos os campos obrigatórios estejam sendo preenchidos
- Verificar se os valores monetários estão formatados corretamente
- Confirmar se a estrutura da tabela fica bem organizada após remover as colunas

## Instruções de Implementação
Por favor, analise o método `generatePurchaseOrderHTML` e `generatePurchaseOrderPDF` no arquivo `server/pdf-service.ts` e faça todas as correções necessárias. Se precisar ajustar alguma consulta de dados, também modifique o arquivo `server/storage.ts` conforme necessário.

O objetivo é ter um PDF limpo, profissional e com todos os dados corretos do sistema.
