# Análise: Conferência Fiscal — Multi-moeda e Compras Internacionais

- **Data da Análise**: 07/10/2026
- **Status**: Análise concluída — **manter como está por ora** (pendente implementação futura).
- **Objetivo**: Analisar a fase de Conferência Fiscal do módulo de Compras, validar integração com ERP/Contas a Pagar (envio de valores em BRL) e mapear gaps de compras internacionais (sem NF-e padrão brasileiro).

---

## 1. Situação Atual do Processo

### 1.1 Arquitetura de Valores (Fonte da Verdade)

O processo de Compras tem duas camadas de moeda:

| Fase | Campos Principais | Campos Secundários / Origem |
|---|---|---|
| Solicitação / Aprovação A1 | Sempre **BRL** (não há multi-moeda) | — |
| Cotação / Fornecedor | `supplier_quotation_items.unitPrice` — **moeda negociada (Orig)** | `exchangeRate` (taxa do fornecedor); `convertToBRL(Orig × taxa)` = BRL calculado em tela |
| Aprovação A2 | Totais de proposta — sempre comparados em **BRL** (via `resolveBRL`) | Orig exibido como secundário em parênteses |
| **Pedido de Compra (PO)** | `purchase_order_items.unitPrice / totalPrice` — **Sempre BRL (Orig × taxa)** | `*Orig` derivado via `BRL / taxa` em exibição |
| **Recebimentos / Fiscal** | `receipt_items.unitPrice / totalPrice` — **BRL (herdado do PO)** | **Não existem** campos de moeda (currencyCode / exchangeRate / Orig) na tabela `receipts` ou `receipt_items` |

**Conclusão da modelagem atual (correta):**
> As entidades de Recebimento (`receipts`, `receipt_items`, `receipt_installments`, `receipt_allocations`) operam **100% em BRL por construção**. A conversão para Real acontece **antes** da fase de Recebimento Físico, na criação/aprovação do Pedido de Compra. Isto simplifica a integração com o ERP e o Contábil (obrigações brasileiras em BRL).

---

## 2. Tipos de Documentos Fiscais — Hoje

### 2.1 Enum atual (shared/schema.ts:receipt_type)
```ts
receipt_type = pgEnum("receipt_type", ["produto", "servico", "avulso"]);
```

### 2.2 Funcionamento dos tipos

| Tipo | Descrição | Obrigatoriedades |
|---|---|---|
| `produto` | NF-e de mercadoria (modelo 55) | Número + Série + Chave Acesso (44 dígitos) + CNPJ emitente + Data Emissão |
| `servico` | NFS-e serviços | Igual produto, com ajustes de ICMS |
| `avulso` | Modo genérico sem NF (documentos fora padrão) | Apenas número documento + data emissão + valor + centro de custo + plano de contas (obrigatório) |

### 2.3 Modo Avulso — Características importantes
- O usuário **informa o Valor Total Manual** (`manualTotal`) manualmente.
- Itens são pré-carregados **automaticamente** do recebimento físico (quantidades × preços PO em BRL).
- Não pede chave NFe.
- Pode ser utilizado hoje (workaround) para compras internacionais (fatura DI/DSI/Invoice exterior).

**Risco detectado (baixo):** Ao usar "Avulso" internacional, o usuário pode digitar acidentalmente o valor em Orig (USD/EUR/GBP) ao invés de BRL. Mitigação atual: o card azul informativo no topo da tela já informa "Campos operam em BRL". Ver seção 6.2.

---

## 3. Integração ERP / Contas a Pagar — Verificação

### 3.1 Payload enviado ao ERP (LOCADOR)

Endpoint de confirmação fiscal: `POST /api/receipts/:id/confirm-fiscal` → [receipts.ts:836-894](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L836-L894)

| Campo Payload ERP | Fonte no código | É BRL? | Status Correto? |
|---|---|---|---|
| `nota_fiscal.valor_total` | L854-858 `totalAmount` (input confirm-fiscal OU rec.totalAmount) | ✅ Sim | 🟢 Correto |
| `itens[].preco_unitario` | L891 `Number(it.unitPrice)` (receipt_items.unitPrice) — copiado em L1528 de PO unitPrice (BRL) | ✅ Sim | 🟢 Correto |
| `condicoes_pagamento.parcelas_detalhes[].valor` | L880 `Number(dup.amount)` — input ReceiptFinancial (parcelas em BRL) | ✅ Sim | 🟢 Correto |
| `condicoes_pagamento.rateio[].valor` | L872 `Number(a.amount)` — input allocations em BRL | ✅ Sim | 🟢 Correto |
| `processFiscal` | L843 `effectiveProcessFiscal` (flag booleana) | N/A | 🟢 Correto |

### 3.2 Verificação de como itens chegam aos receipts

Em [routes/receipts.ts:1515-1532](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L1515-L1532):

```ts
// Recebimento físico — grava itens no receipt_items
for (const it of poItems) {  // it = purchase_order_items
  const qty = Number(receivedQuantities[it.id]);
  await db.insert(receiptItems).values({
    receiptId: receipt.id,
    purchaseOrderItemId: it.id,
    quantity: String(qty),
    unitPrice: it.unitPrice,    // (1) vem do PO — SEMPRE BRL após correção de 07/10
    totalPrice: String(qty * Number(it.unitPrice)), // (2) BRL
  });
}
```

**Conclusão integração ERP (2026-10-07):**
> **Todos os valores enviados ao ERP já estão em BRL de forma correta e consistente.** A correção da raiz no PO (gravação BRL nos campos principais) cascateia naturalmente até a Conferência Fiscal, sem necessidade de alterações de integração.

---

## 4. GAP Identificado — Compras Internacionais

### 4.1 Cenário Brasileiro de Compras no Exterior

| Documento | Finalidade | Tem Chave NFe / modelo 55? | Passa Siscomex? |
|---|---|---|---|
| NF-e Importação (modelo 55) | Quando importadora própria emite NF-e padrão | ✅ Sim | Nem sempre |
| **DI (Declaração de Importação)** | Documento de desembaraço aduaneiro principal | ❌ Não | ✅ Sim (SISCOMEX) |
| **DSI (Decl. Simpl. Importação)** | Até USD 3.000 via Courier (até USD 3k) | ❌ Não | ✅ Sim |
| **Invoice / Proforma** | Fatura comercial do fornecedor exterior — sem validade fiscal BR. Apenas como anexo suporte | ❌ Não | — |
| Packing List / Conhecimento de Carga | Relação de volumes | ❌ Não | — |
| BL / AWB (Conhec. Embarque) | Conhecimento de frete internacional marítimo/aéreo | ❌ Não | — |

### 4.2 Gap funcional hoje

- O sistema tem 3 tipos (produto/serviço/avulso) → **"Avulso" cobre DI/DSI/Invoice** apenas em nome genérico.
- Não há **classificação explícita** de documento internacional para relatórios, auditoria e filtros.
- Obrigatoriedades de chave NFe / CNPJ emitente aparecem desnecessariamente quando usuário não usa "Avulso" — elas só somem se usuário selecionar manualmente tipo Avulso.

### 4.3 Risco de UX (usuário preencher em USD sem querer)
Ao selecionar Avulso para uma compra internacional, não há validação explícita adicional que confirme "este valor é em Real?". Card azul topo já informa.

---

## 5. Propostas de Melhoria (Não Prioridade — Fase Futura)

### Proposta A — Expandir enum de tipos com subtipos (menor risco retrocompat)

**Opção 1 — Apenas documentar `document_type` Novo Campo (melhor abordagem)**

Adicionar coluna opcional `document_type` (texto / pgEnum) em `receipts` com valores:

```ts
document_type = pgEnum("receipt_document_type", [
  "nfe",                    // Nacional
  "nfse",                   // Serviço
  "di",                     // Declaração de Importação (SISCOMEX)
  "dsi",                    // Declaração Simplificada
  "invoice_exterior",       // Invoice fornecedor exterior
  "conhecimento_internacional",  // BL / AWB / CTRC internacional
  "outros"
]);
```

- ⚠️ **retrocompat**: Campo opcional, default `nfe`. Não quebra fluxos antigos.
- **UI**: No lugar do Select com 3 opções, apresentar duas perguntas em cascata:
  - Tipo (Produto / Serviço → já define rateio/CC)
  - **Natureza do Documento**: Nacional NF-e | **Importação (DI)** | **Importação (DSI)** | **Invoice Exterior** | Outros

### Proposta B — Validação condicional de campos obrigatórios

Ao selecionar **tipo documento internacional (DI, DSI, Invoice)**:

| Campo | Requisito? (Nacional) | Requisito? (Internacional DI/DSI) |
|---|---|---|
| Número Documento | ✅ Obrig | ✅ Obrig (número DI/DSI ou nº Invoice) |
| Série | ✅ Obrig | ⚪ Opcional |
| Chave Acesso NFe (44 dígitos) | ✅ Obrig (produto) | ❌ Remover obrigatoriedade |
| CNPJ Emitente | ✅ Obrig | ⚪ Opcional (CNPJ Importador pode ser a própria empresa) |
| Data Emissão | ✅ Obrig | ✅ Obrig (Data Registro DI ou Invoice) |
| País de Origem | ❌ N/A | ⚪ (Opcional para DI) |

### Proposta C — Valor total BRL sempre (com aviso amarelo)

Para `manualTotal` (Avulso/Internacional), ajustar label e helperText:

```
> ⚠️ IMPORTANTE: Informe o valor TOTAL em REAIS (BRL convertido).
> (O sistema não converte automaticamente moedas no recebimento fiscal.)
> Valor de referência total PO: R$ 499,00 (US$ 100,00 × 4,9900)
```

Além disso, validar com WARNING em verde/vermelho no botão Confirmar se `manualTotal` diverge do `PO.totalValue` em mais de 5% ou 10%.

### Proposta D — PDF / Auditoria

- Na conferência de tipo internacional, incluir no recibo / log o tipo (DI nº XXXX em YYYY-MM-DD) + taxa de câmbio e valores Orig / BRL para auditabilidade. Hoje já temos taxa e moeda em `purchase_orders`. Bastaria referenciar no PDF.

---

## 6. Estrutura de Decisão e Impactos de Implementação

| Item | Prioridade hoje (2026-10-07) | Impacto retrocompatibilidade |
|---|---|---|
| **A. Manter campos receipts só em BRL (não adicionar currencyCode etc.)** | ✅ Prioridade (correta) | Nenhum — é status atual |
| **B. Expandir tipos / adicionar `document_type` enum** | ⬜ Futuro | 🟢 BAIXO (campo opcional, default nfe, não quebra) |
| **C. Validação condicional (campos obrigatórios DI/DSI)** | ⬜ Futuro | 🟢 BAIXO (só front-end) |
| **D. Valor total: warning se diverge > 5% do PO em BRL** | ⬜ Futuro | 🟢 BAIXO |
| **E. Correção de valores para ERP** | ✅ **JÁ CONCLUÍDA** (07/10) via raiz PO unitPrice → BRL | Nenhuma |
| **F. Fallback / ajustes de display em tela Conferência Fiscal (dual currency)** | ✅ Já existe (card azul topo com moeda/taxa + total original) | Nenhuma |

---

## 7. Ações já validadas / confirmadas como ok

- ✅ Itens do receipt → copiados do PO unitPrice = BRL.
- ✅ Payload ERP → todos valores em BRL.
- ✅ Parcelas/Rateio → valores BRL (input do usuário / tela).
- ✅ Card azul informativo em Fiscal (conforme user input print da tela).
- ✅ Modo Avulso existente cobre DI/DSI (tipificação documental futura).
- ✅ Testes Jest `fiscal-conference-flow.test.ts`: estrutura mantida; nenhuma regressão após alterações de moeda.

---

## 8. Referências de Código

| Arquivo / Função | Link |
|---|---|
| Enum `receipt_type` + tabela receipts + itens | [schema.ts:L574-L665](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/shared/schema.ts#L574-L665) |
| Gravação itens recebimento físico (unitPrice BRL do PO) | [receipts.ts:L1515-L1532](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L1515-L1532) |
| Payload envio ERP confirm-fiscal | [receipts.ts:L836-L894](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/routes/receipts.ts#L836-L894) |
| Front-end ReceiptManualEntry (tipos Prod/Serviço/Avulso) | [ReceiptManualEntry.tsx:L143-L152](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/receipt/ReceiptManualEntry.tsx#L143-L152) |
| Front-end ReceiptFinancial baseTotalForAllocation BRL | [ReceiptFinancial.tsx:L45-L52](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/receipt/ReceiptFinancial.tsx#L45-L52) |
| Tela Fiscal Dashboard (card azul moeda/taxa) | [fiscal-conference-phase.tsx:L119-L131](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/client/src/features/receipts/components/fiscal-conference-phase.tsx#L119-L131) |
| Workflow service concluinte fiscal | [workflow-service.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/services/workflow-service.ts) |
| Receipt service finalização sem ERP | [receipt-service.ts:L335-L402](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/services/receipt-service.ts#L335-L402) |
| Testes Jest fluxo fiscal (mock ERP) | [server/tests/fiscal-conference-flow.test.ts](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/server/tests/fiscal-conference-flow.test.ts) |

---

## 9. Decisão Registro (07/10/2026)

> **Por decisão do usuário**: Manter a estrutura como está nesta data.
> Implementação de tipos de documento internacional (DI/DSI/Invoice), validações condicionais e warning de coerência de valor total (BRL vs. PO) ficam **registradas nesta análise para implementação futura**, quando houver demanda operacional ou ocasião de refatoração da tela de Conferência Fiscal.

Nenhuma alteração na persistência ou integração ERP é necessária **hoje** para multi-moeda em compras internacionais: o pipeline BRL desde o PO (corrigido 07/10) garante que a Conferência Fiscal receba e envie valores já convertidos corretamente para Real.
