# Auto-Cadastro de Taxa de Câmbio na Tabela `currency_rates` Implementation Plan

## Repository Research

### Comportamento atual
- **Rota**: `POST /api/quotations/:quotationId/update-supplier-quotation` ([quotations.ts:458–782)](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/quotations.ts#L458-L782) — recebe `currencyCode` + `exchangeRate` do body, valida ambos (>0 quando moeda ≠ BRL, salva os dois campos na tabela `supplier_quotations`.
- **Busca automática no frontend**: ao abrir a modal, `useEffect chama `/api/currency-rates/latest/:code` ([currency-rate-repository.ts getLatestRate:58-66](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/repositories/currency-rate-repository.ts#L58-L66) (ordena `rateDate DESC, id DESC) e traz a taxa mais recente cadastrada — se houver, pré-preenche o input Câmbio do header.
- **Aviso exibido (print vermelho alerta "Nenhuma cotação cadastrada para USD; informe a taxa manualmente": UI mostra hoje quando a busca `getLatestRate` retorna undefined.
- **Storage de taxas `currency_rates` tabela**: `id, currency_code UNIQUE(date+rate_date, rate_value (DECIMAL 15,6), rate_date (DATE), observations, created_by, updated_at, created_at`. CreatedBy é foreign key `users.id`.

### Objetivo
Quando o usuário informa manualmente um valor de taxa de câmbio (BRL/USD/EUR/GBP) e salva a cotação do fornecedor, se **NÃO EXISTIR** ainda hoje nenhum registro na tabela `currency_rates` para o par `(currency_code, data_atual = CURRENT_DATE)`, inserir automaticamente uma nova linha em `currency_rates` com `rate_value = exchangeRate`, `createdBy = userId da sessão atual, observations = "Criado automaticamente ao salvar cotação de fornecedor - RFQ #N". Próxima cotação já recupera via `getLatestRate` e vem pré-preenche o input automático.

## Files and Modules
1. `server/routes/quotations.ts` (único arquivo a modificar.
- Adicionar `import { currencyRateRepository } from "../repositories/currency-rate-repository"` linha 29 após imports existentes.
- Injetar bloco de lógica de auto-cadastro APÓS validação `exchangeRate, APÓS todas as validações (linha 502 do handler) + validar:
- Se `currencyCode` ≠ `BRL` e `exchangeRate` > 0:
  1. Busca `todayRate = currencyRateRepository.getTodayRate(currencyCode)`
  2. Se `!todayRate` então `currencyRateRepository.createRate({currencyCode, rateDate: new Date() (hoje truncado meia-noite, rateValue: exchangeRate, observations: "Criado automaticamente ao salvar cotação RFQ-" + quotationId, createdBy: currentUser.id})
  3. Se `createRate deve ser idempotente: se hoje já tem uma taxa para hoje, não duplicatas.
- Envelopar bloco em try/catch para que falha no cadastro de taxa não bloqueia fluxo principal de salvar cotação (feature degradê).

## Implementation Steps
1. **Importar currencyRateRepository no topo de quotations.ts (após imports existentes)
2. **Injetar bloco de lógica após linha 502 (após o exchangeRate ter sido validado e ter sucesso) e antes do getQuotationById (linha 504):
- validação: apenas se `currencyCode !== 'BRL' && exchangeRate > 0`
- busca todayRate = await today rateDate == null
- se `await currencyRateRepository.createRate`
3. **Ação segura try/catch com console.warn: `// Auto - catch impede que erro ao gravar
4. **Enviar warning no console mas permite execução normal.
## Dependencies and Considerations
- **Idempotência por data**: Se `getTodayRate` (hoje não insere, senão evita duplicatas.
- **CreatedBy obrigatório** (FK): `currentUser.id` é sessão req.session.userId autenticada `isAuthenticated` middleware garante isso.
- **Data rateDate** = CURRENT DATE de hoje; usar `new Date()` objeto.
- **Não aborta o flow principal**: todo try/catch em torno do `createRate` e `getTodayRate`.
- currencyRateRepository.getTodayRate existente já usa `CURRENT_DATE = ` via sql``.
- `currency_rates.currency_code` tabela tem unique não existe em (currency_code,rate_date`) no shared/schema.
## Validation
- ✅** **npm run check` TypeScript check → exit 0.
- **smoke scenario: `GET /api/currency-rates/latest/USD` hoje → hoje retorna 404/vazio → POST /api/quotations/X/update-supplier-quotation (currencyCode="USD",exchangeRate=5.3) → 200 OK → em seguida GET /api/currency-rates/latest/USD retorna 5.3 com observations e createdBy correto.
- **Segunda chamada mesmo dia**: repetir POST → não cria nova linha (verificado COUNT = 1).
- **BRL nunca grava**: currencyCode="BRL", exchangeRate qualquer → COUNT tabela unchanged.
- **Diagnósticos do workspace**: GetDiagnostics = 0.

## Risks
- **Risco unique key violation duplicate insert** na tabela `currency_rates(currency_code, rate_date)` se rodar 2 requisições simultâneas hoje mesmo segundo: mitigation: hoje fazer wrap try/catch e verifica existir sem exceção; não se já tem.
- **Risco: getTodayRate retorna undefined mas o banco retorna taxa de hoje mas causa.
Mitigation: try/catch em torno do insert; ignora erro, não bloqueia o flow.
- **Risco performance de usuário pode bloquear o salvar cotação**: mitigation: o bloco de cadastro **jamais aborta a função.
