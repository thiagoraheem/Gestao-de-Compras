# Deck (Keyusers Operacionais) — Recebimentos Independentes por Solicitação

Objetivo: preparar o público operacional (Compras, Recebimento/Almoxarifado, Fiscal) para a mudança de fluxo e de telas, com foco no “como fazer” e no que muda no dia a dia.

***

## 1) Visão Geral

**O que muda**

- Antes: o card do Kanban era a solicitação e “andava” junto com recebimento/fiscal.
- Depois: a solicitação encerra o ciclo de compras no handoff e o trabalho de recebimento/fiscal acontece em **cards de recebimento (receipts)**.

**Por que muda**

- Para permitir recebimentos parciais e conferência fiscal com controle e histórico por remessa/nota, sem travar o fluxo de compras.

***

## 1.1) Visuais&#x20;

Kanban (referência):

!\[]\(./screenshots/03-kanban/03-kanban-detalhes.png null)

Tela de recebimento (referência):

!\[]\(./screenshots/08-recebimento/18-recebimento-form-01.png null)

***

## 2) Novos conceitos

**Solicitação (Compras)**

- Representa o processo de compra: aprovações, cotação, pedido.
- Ao passar para Recebimento, a solicitação é considerada “Concluída” no contexto de compras.

**Receipt (Card de Recebimento)**

- Representa uma remessa/nota/serviço/avulso.
- Tem seu próprio ciclo: Recebimento Físico → Conf. Fiscal → Concluído.
- Pode existir mais de um receipt para a mesma solicitação (recebimento parcial).

***

## 3) Fluxo operacional — ponta a ponta&#x20;

!\[]\(./diagrams/fluxo-operacional.png null)

```mermaid
flowchart LR
  A[Pedido de Compra] --> B[Handoff: criar/ativar Receipt]
  B --> C[Receipt: Recebimento Físico]
  C --> D[Receipt: Conf. Fiscal]
  D --> E[Receipt: Concluído]
```

Regra: o andamento do receipt não altera o status da solicitação.

***

## 4) Como trabalhar com Recebimentos Parciais

**Quando usar**

- Entregas em lotes
- Notas separadas por remessa
- Recebimento parcial por indisponibilidade

**Como fazer**

- Criar “Novo Recebimento” (novo receipt) para a mesma solicitação/PO.
- Em cada receipt, informar apenas as quantidades daquele lote.
- O sistema soma no saldo do pedido e impede receber acima do solicitado.

***

## 5) Recebimento Físico&#x20;

**Ações principais**

- Selecionar o receipt correto (lote/remessa/nota).
- Informar quantidades recebidas por item.
- Confirmar recebimento físico.

**Regras**

- Não é permitido exceder a quantidade do pedido.
- Itens totalmente recebidos ficam bloqueados para novas entradas.

***

## 6) Conferência Fiscal&#x20;

**Ações principais**

- Validar dados fiscais/financeiros do receipt.
- Finalizar com ERP (quando ativo) ou finalizar localmente (quando ERP desabilitado).

**Resultado**

- O receipt muda para “Concluído”.
- A solicitação permanece inalterada.

***

## 7) Exceções e correções&#x20;

**Reabertura / ajuste**

- Se o receipt já foi concluído, qualquer reabertura deve deixar trilha de auditoria (quem/quando/motivo).

**Cancelamento**

- Evitar “apagar” receipts: preferir cancelamento e criação de um novo receipt quando necessário.

***

## 8) Mudanças no Kanban e telas

**Kanban de Compras**

- Mostra o ciclo de compras (até o handoff).

**Kanban / Lista de Recebimentos**

- Mostra receipts em Recebimento Físico e Conf. Fiscal.
- Permite priorização e fila por receipt.

***

## 9) Boas práticas operacionais&#x20;

- Um receipt = um lote/remessa (ou uma nota/serviço).
- Preencher observações do receipt quando houver divergência.
- Preferir reabertura/cancelamento a deleção para manter rastreabilidade.
- Conferir sempre saldos antes de criar novo receipt (evita duplicidade).

***

## 10) Checklist de Go-live&#x20;

**Antes**

- Treinamento rápido por área (15–30 min) com casos reais.
- Validação de permissões (Compras / Recebimento / Fiscal).

**Durante**

- Canal de suporte dedicado (keyusers + TI).
- Monitoramento de erros de integração ERP por receipt.

**Depois**

- Revisão de métricas: backlog por fase, tempo de conclusão por receipt, retrabalho.

***

## Apontamentos técnicos (para quem precisar)

- Anexo técnico: [ANEXO\_EXECUTIVO\_DESACOPLAMENTO\_RECEBIMENTOS\_TECNICO.md](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/docs/ANEXO_EXECUTIVO_DESACOPLAMENTO_RECEBIMENTOS_TECNICO.md)
- Detalhamento técnico completo: [decouple-request-receipts-lifecycle.md](file:///c:/Projetos/Locador/webapps/Gestao-de-Compras/docs/technical/decouple-request-receipts-lifecycle.md)

