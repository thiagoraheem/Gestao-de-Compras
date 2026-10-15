# Opção "Não gerar saldo ERP" na Conferência Fiscal - Plano de Implementação

## Pesquisa do Repositório

### Comportamento atual
- A tela de **Conferência Fiscal** ([fiscal-conference-phase.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/fiscal-conference-phase.tsx)) possui um campo **"Processar Fiscal no ERP"** (Select com opções Padrão/Sim/Não) que controla a flag `processFiscal` no nível raiz do payload enviado ao ERP.
- O estado `processFiscal` (`boolean | null`) reside no [ReceiptContext.tsx](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/receipt/ReceiptContext.tsx), sendo persistido e restaurado de `observations.erpOptions.processFiscal`.
- A mutação `confirmFiscalMutation` envia `processFiscal` no body apenas quando o valor é explícito (`!== null`).
- A rota backend `POST /api/receipts/:id/confirm-fiscal` ([receipts.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L620)) lê `processFiscal`, valida com `parseOptionalBoolean`, persiste em `observations.erpOptions.processFiscal` e inclui `processFiscal: effectiveProcessFiscal` no payload raiz do ERP.
- Os **itens** do payload são montados em `receipts.ts` (linhas ~908-916) via `items.map(...)`. A interface `PurchaseItem` em [purchase-receive-service.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/integracao_locador/services/purchase-receive-service.ts) **não possui** o campo `IsToProcess`.
- **Não existe** nenhuma ocorrência de `IsToProcess` no código atualmente.
- A rota legada `enviar-locador` também monta itens, mas **não** é usada pela tela de Conferência Fiscal (que usa apenas `confirm-fiscal`, inclusive no reenvio).

### O que o usuário quer
- Adicionar uma opção **"Não gerar saldo ERP"** ao lado de "Processar Fiscal no ERP".
- Quando selecionada, todos os itens enviados ao ERP devem ter `IsToProcess: false`.

## Arquivos e Módulos

1. **`client/src/features/receipts/components/receipt/ReceiptContext.tsx`**
   - Adicionar estado `noErpBalance: boolean` (padrão `false`) + setter.
   - Restaurar valor de `observations.erpOptions.noErpBalance` no carregamento do recebimento.
   - Exportar no valor do contexto.

2. **`client/src/features/receipts/components/fiscal-conference-phase.tsx`**
   - Adicionar um `Checkbox` "Não gerar saldo ERP" ao lado do Select "Processar Fiscal no ERP" (na mesma linha de ações).
   - Incluir `noErpBalance` no body da `confirmFiscalMutation`.

3. **`server/routes/receipts.ts`** (rota `confirm-fiscal`)
   - Ler `noErpBalance` do body.
   - Validar com `parseOptionalBoolean`.
   - Persistir em `observations.erpOptions.noErpBalance`.
   - Ao montar os itens (`items.map`), se `noErpBalance === true`, adicionar `IsToProcess: false` em cada item.

4. **`server/integracao_locador/services/purchase-receive-service.ts`**
   - Adicionar `IsToProcess?: boolean` à interface `PurchaseItem`.

## Passos de Implementação (ordem de dependência)

1. **Backend - contrato do payload**: Adicionar `IsToProcess?: boolean` à interface `PurchaseItem` em `purchase-receive-service.ts`.
2. **Backend - rota `confirm-fiscal`**:
   - Destruturar `noErpBalance` do `req.body`.
   - Fazer `parseOptionalBoolean(noErpBalance)` (com tratamento de erro de validação igual ao `processFiscal`).
   - Persistir em `erpOptions` dentro de `newObs` (apenas quando o valor for booleano explícito).
   - No `items.map`, condicionalmente adicionar `IsToProcess: false` quando `noErpBalance` for `true`.
3. **Frontend - ReceiptContext**:
   - Adicionar tipo `noErpBalance: boolean` e `setNoErpBalance` na interface do contexto.
   - Criar estado `useState<boolean>(false)`.
   - Restaurar de `obs.erpOptions.noErpBalance` nos dois pontos de carregamento (linhas ~350 e ~402).
   - Exportar no objeto de valor do contexto.
4. **Frontend - fiscal-conference-phase.tsx**:
   - Importar `Checkbox` de `@/shared/ui/checkbox`.
   - Obter `noErpBalance` e `setNoErpBalance` do `useReceipt()`.
   - Renderizar o Checkbox ao lado do Select "Processar Fiscal no ERP" com label "Não gerar saldo ERP".
   - Adicionar `noErpBalance` ao body da mutação.

## Dependências e Considerações

- **Comportamento padrão preservado**: Quando "Não gerar saldo ERP" **não** estiver marcado, o campo `IsToProcess` será **omitido** dos itens (preservando o comportamento atual do ERP). Apenas quando marcado, `IsToProcess: false` é adicionado a todos os itens.
- **Escopo limitado a `confirm-fiscal`**: A rota legada `enviar-locador` não será alterada, pois não é utilizada pela tela de Conferência Fiscal e não possui a flag `processFiscal`.
- **Persistência**: O valor será persistido em `observations.erpOptions.noErpBalance`, seguindo o mesmo padrão do `processFiscal`, permitindo restauração ao reabrir a conferência.
- **Reenvio**: Como o botão "Reenviar ao ERP" reutiliza a mesma mutação `confirmFiscalMutation`, a opção também será aplicada em reenvios.
- **Validação**: Usar `parseOptionalBoolean` (já existente) para aceitar `true/false`, `1/0`, `"true"/"false"`.

## Validação

- Verificar TypeScript compila sem erros (`tsc --noEmit` ou build do projeto).
- Testar manualmente na tela de Conferência Fiscal:
  - Confirmar que o Checkbox "Não gerar saldo ERP" aparece ao lado de "Processar Fiscal no ERP".
  - Marcar a opção e concluir a conferência; inspecionar o payload enviado (log do servidor `Submitting purchase receive`) e confirmar que cada item possui `IsToProcess: false`.
  - Desmarcar a opção e concluir; confirmar que os itens **não** possuem `IsToProcess` (comportamento padrão).
  - Reabrir uma conferência já salva com a opção marcada e confirmar que o Checkbox é restaurado como marcado.
- Executar testes existentes de validação fiscal (`server/tests/fiscal-validation.test.ts`) para garantir não regressão.

## Riscos

- **Risco**: O ERP pode esperar `IsToProcess` sempre presente (mesmo `true`). **Mitigação**: Iniciar omitindo o campo quando a opção não estiver marcada (preservando comportamento atual); se o ERP exigir o campo sempre, ajustar para enviar `IsToProcess: true` por padrão.
- **Risco**: Rota `enviar-locador` não receber a mesma lógica. **Mitigação**: Confirmar com o usuário se a opção deve também se aplicar a essa rota (atualmente fora de escopo por não ser usada na tela de Conferência Fiscal).
