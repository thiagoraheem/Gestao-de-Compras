# Documentação Técnica: Processo de Cotação e Fluxo Detalhado

## 1. Visão Geral
O módulo de cotação gerencia o ciclo de vida da Solicitação de Cotação (RFQ - Request for Quotation), desde a criação baseada em uma Solicitação de Compra aprovada até a seleção do fornecedor vencedor, gestão de itens indisponíveis e geração do Pedido de Compra.

## 2. Diagrama de Estados e Fluxo

### 2.1. Status da Cotação (`quotations.status`)
O ciclo de vida principal da cotação segue os seguintes estados:
*   `draft`: Cotação criada, mas ainda não enviada aos fornecedores.
*   `sent`: RFQ enviada aos fornecedores (via e-mail ou liberação manual).
*   `received`: Pelo menos uma resposta de fornecedor foi registrada.
*   `analyzed`: Fase de análise comparativa de preços.
*   `approved`: Fornecedor vencedor selecionado e processo finalizado.
*   `rejected`: Cotação cancelada ou rejeitada.

### 2.2. Status da Cotação do Fornecedor (`supplier_quotations.status`)
Cada fornecedor possui um status individual:
*   `pending`: Aguardando envio.
*   `sent`: RFQ enviada.
*   `received`: Proposta recebida e preenchida.
*   `expired`: Prazo de resposta expirado.
*   `cancelled`: Cotação cancelada para este fornecedor.
*   `no_response`: Fornecedor marcado como "não respondeu" (excluído da matriz de decisão).

## 3. Detalhamento do Fluxo do Processo

### 3.1. Início: Solicitação de Compra -> Cotação
*   **Entrada**: Solicitação de Compra (PR) com status `cotacao`.
*   **Ação**: Comprador cria a cotação (`POST /api/quotations`).
*   **Dados**: Definição de `quotationDeadline` (prazo), `deliveryLocationId`, `termsAndConditions`.
*   **Associação**: Se a PR não tiver comprador (`buyerId`), o usuário atual é associado automaticamente.

### 3.2. Envio da RFQ (Request for Quotation)
*   **Rota**: `POST /api/quotations/:id/send-rfq`
*   **Opções**:
    *   `sendEmail: true`: Envia e-mail via `email-service` para fornecedores selecionados.
    *   `releaseWithoutEmail: true`: Apenas avança o status para `sent` sem disparo de e-mail.
*   **Lógica**:
    *   Sincroniza status de todos `supplier_quotations` para `sent`.
    *   Registra data de envio (`sentAt`).

### 3.3. Recebimento de Propostas e Gestão de Fornecedores
O sistema permite múltiplos cenários de resposta:
1.  **Entrada de Preços**: Comprador preenche valores unitários, descontos e frete manualmente na plataforma.
2.  **Fornecedor Sem Resposta**: Comprador marca fornecedor como `no_response`. Isso o remove do cálculo de recomendação, mas mantém o registro histórico.
3.  **Múltiplas Rodadas**: O sistema permite criar versões históricas da RFQ (Versioning) caso especificações mudem, notificando fornecedores.

### 3.4. Matriz de Decisão e Recomendação
O componente `supplier-comparison.tsx` implementa um algoritmo de recomendação ponderada:
*   **Fatores**: Preço Total, Prazo de Entrega, Condições de Pagamento.
*   **Destaques**: O sistema destaca visualmente o menor preço por item ("Vencedor do Item").
*   **Seleção**: O comprador pode acatar a recomendação ou escolher outro fornecedor manualmente, fornecendo `choiceReason`.

### 3.5. Finalização e Seleção do Vencedor (Crítico)
Esta é a etapa mais complexa, onde ocorre o fechamento da cotação e tratamento de exceções.

**Rota**: `POST /api/quotations/:quotationId/select-supplier`

#### Lógica de Execução:
1.  **Reset de Seleção**: Marca `isChosen = false` para todos os fornecedores da cotação.
2.  **Seleção do Vencedor**: Marca `isChosen = true` para o fornecedor indicado (`selectedSupplierId`).
3.  **Tratamento de Itens**:
    *   **Itens Indisponíveis**: Processa lista `unavailableItems` enviada pelo front (itens que o fornecedor não cotou).
    *   **Itens Não Selecionados**: Processa lista `nonSelectedItems` (itens que o comprador decidiu não comprar deste fornecedor).
    *   **Ação**: Atualiza `supplier_quotation_items` definindo `isAvailable = false` e gravando `unavailabilityReason`.
4.  **Recálculo**: Recalcula o valor total da cotação considerando *apenas* itens disponíveis. Aplica descontos globais e frete.

#### Lógica de Split (Divisão de Solicitação) - REQ-002:
Se houver itens marcados como indisponíveis (`isAvailable === false`), o sistema executa automaticamente:
1.  **Criação de Nova PR**: Gera uma nova Solicitação de Compra (clone da original) com status `solicitacao`.
    *   *Justificativa*: "[Item Indisponível] Derivado da solicitação X..."
2.  **Migração de Itens**:
    *   Cria os itens não atendidos na nova PR.
    *   Marca os itens na PR original como transferidos (`isTransferred = true`, `transferReason`).
3.  **Auditoria**: Registra log de auditoria do tipo `SPLIT_UNAVAILABLE`.
4.  **Validação de Bloqueio (REQ-001)**: Antes de finalizar, o backend verifica se *todos* os itens indisponíveis foram tratados (transferidos). Se sobrar algum item "pendente" sem destino, a operação é bloqueada com erro 400.

#### Snapshot de Itens Aprovados (Integridade):
*   Após a seleção, o sistema gera registros na tabela `approved_quotation_items`.
*   **Objetivo**: Congelar preços, quantidades e unidades aprovadas. Isso garante que alterações futuras na cotação ou no cadastro do fornecedor não alterem os dados do pedido já aprovado.
*   **Uso**: O Pedido de Compra (PO) é gerado a partir deste snapshot, não das tabelas dinâmicas.

### 3.6. Avanço para Aprovação A2
*   A Solicitação de Compra original avança para a fase `aprovacao_a2`.
*   Valores totais e ID do fornecedor escolhido são atualizados na PR.

## 4. Arquitetura de Dados (Schema)

### Entidades Principais (`shared/schema.ts`)

*   **`quotations`**:
    *   `status`: Estado atual do processo.
    *   `deliveryLocationId`, `paymentMethodId`: Condições comerciais.
*   **`supplier_quotations`**:
    *   `isChosen`: Booleano que indica o vencedor.
    *   `status`: Estado da resposta do fornecedor.
    *   `discountType`, `discountValue`: Descontos globais.
*   **`supplier_quotation_items`**:
    *   `unitPrice`, `totalPrice`: Valores financeiros.
    *   `isAvailable`: **Campo Crítico**. Se false, indica que o item não será fornecido e deve sofrer Split.
    *   `unavailabilityReason`: Motivo da indisponibilidade.
*   **`approved_quotation_items`**:
    *   Tabela de snapshot para garantir imutabilidade após aprovação.

## 5. Pontos de Extensão e Manutenção

*   **Adicionar novos status**: Requer alteração no enum do banco e no tipo TypeScript em `shared/schema.ts`.
*   **Lógica de Split**: Centralizada em `server/routes.ts` (rota `select-supplier`). Qualquer mudança na regra de negócio de itens indisponíveis deve ser feita neste bloco.
*   **Validação de Itens**: O frontend (`supplier-comparison.tsx`) pré-valida a seleção, mas a validação final de segurança (Bloqueio A2) ocorre no backend.
