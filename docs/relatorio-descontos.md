Visão geral

- A coluna `Desconto` do Relatório de Solicitações de Compra consolida duas fontes:
  - Descontos aplicados por item (supplier_quotation_items)
  - Descontos aplicados na proposta do fornecedor vencedor (supplier_quotations)

Regra de cálculo

- Base original: soma de `original_total_price` dos itens do fornecedor vencedor.
- Desconto por item: soma de `max(0, original_total_price - discounted_total_price)` por item.
  - Se `discounted_total_price` estiver ausente, aplica `discount_percentage` e `discount_value` para obter o total do item após desconto.
- Subtotal após itens: soma dos totais dos itens após desconto.
- Desconto da proposta:
  - `percentage`: `subtotal_after_items * (discount_value / 100)`
  - `fixed`: valor fixo informado
  - Caso `final_value` e `subtotal_value` existam, usa `max(0, subtotal_value - final_value)`
- Total final: `subtotal_after_items - proposal_discount` (ou `final_value` se presente)
- Valor original exibido: soma dos originais dos itens; se indisponível, `subtotal_after_items + proposal_discount`.
- Desconto consolidado exibido: `max(0, original_value - final_value)`.

Compatibilidade e integridade

- Não altera dados persistidos; a consolidação é calculada na montagem do relatório.
- Mantém compatibilidade com relatórios que consomem `subtotal_value`/`final_value`, pois o total final permanece coerente.

Validações

- Todos os valores são convertidos para número e sanados para `>= 0`.
- Fallbacks garantem resultado mesmo sem itens ou sem desconto explícito.

Localizações relevantes

- Backend: `server/storage.ts:getPurchaseRequestsForReport`
- Testes: `tests/purchase-requests-discount-calculation.test.js`

