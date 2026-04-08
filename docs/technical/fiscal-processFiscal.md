# Flag processFiscal na Conferência Fiscal

## Visão Geral
Na tela de **Conferência Fiscal**, o usuário pode definir o valor da propriedade `processFiscal` que será enviada no payload de integração com o ERP (Locador) ao concluir a conferência.

Essa flag controla o comportamento do ERP ao receber o documento de compra/recebimento, influenciando se o ERP deve executar o processamento fiscal como parte do fluxo de integração.

## Campo na Interface
**Nome do campo:** Processar Fiscal no ERP  
**Local:** Rodapé da tela de Conferência Fiscal (Concluir Conferência Fiscal)

### Valores possíveis
- **Padrão (Sim)**: não envia o campo no request; o backend aplica o padrão `true`.
- **Sim**: envia `processFiscal: true`.
- **Não**: envia `processFiscal: false`.

## Validação
### Frontend
- O campo é controlado por seleção (valores fixos), garantindo que apenas `true`, `false` ou “padrão” possam ser escolhidos.
- Quando “Padrão (Sim)” está selecionado, o campo não é incluído no body do `POST`.

### Backend
- A rota valida `processFiscal` como booleano (aceita `true/false` e equivalentes comuns) quando enviado.
- Valores inválidos resultam em `400` com mensagem de validação.

## Integração com ERP
### Endpoint
- `POST /api/receipts/:id/confirm-fiscal`

### Payload (Locador)
O valor selecionado é propagado para o payload `PurchaseReceiveRequest`:
- `processFiscal: boolean`

### Comportamento padrão
Se o usuário não selecionar explicitamente, o backend usa:
- `processFiscal = true`

## Persistência/Auditoria
- A opção selecionada é persistida no `observations` do recebimento em `erpOptions.processFiscal` quando o valor é explicitamente informado.

## Testes
Os testes unitários cobrem:
- Inclusão de `processFiscal=false` no payload quando informado.
- Comportamento padrão `processFiscal=true` quando não informado.
- Rejeição (400) para valores inválidos.
