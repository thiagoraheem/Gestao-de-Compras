# Refatoração Visual Tela de Cotação (Update Supplier Quotation) Implementation Plan

## Repository Research

### Proposta de Design (code.html + screen.png)
A proposta de redesign segue o padrão **Slate Dark Enterprise UI** com um modal de tela quase cheia, layout em **duas colunas fixas** e elementos densos e organizados:

#### Elementos-chave da proposta:
1. **Modal Container**: 96% viewport width, 93% viewport height (máx 1720×1050px), bordas arredondadas `rounded-2xl`, sombra 2xl, fundo `slate-900`.
2. **Header (slate-850, 48–56px)**:
   - Esquerda: Ícone monetário verde, título com nome do fornecedor, Badge status "Pendente" âmbar, sub-meta chips: RFQ, Prazo p/ Resposta, Comprador.
   - Direita: Barra compacta "Moeda:" (select inline) + "Câmbio:" (taxa com badge), botão fullscreen, botão fechar.
3. **Layout de duas colunas**:
   - **COLUNA ESQUERDA 68%**: Seção da tabela de itens.
     - Toolbar: Search input (lupa), View Toggle "Todos (5)/Pendentes (0)" (segmentado), 3 botões: "Aplicar em Lote", "Colunas", "Planilha Excel".
     - Tabela densa (text-xs) com header sticky (`bg-slate-850/95 backdrop-blur`), 6 colunas:
       1. Item & Especificações (34%): Badge código azul [Sxxxx] + nome em negrito, linha inferior "Solicitado: X UN" (chip) + Part/Ref
       2. Preço Unitário (16%, dir): Input com símbolo de moeda à esquerda absolutamente posicionado + texto "Total Orig:" abaixo
       3. Desconto (14%, centro): Input agrupado com sufixo "%" + texto do valor em esmeralda abaixo (-R$ X)
       4. Prazo & Qtd. (18%): Grid 2x2 [Prazo(d) | Qtd Disp.] + [select unidade col-span-2]
       5. Total Final (10%, dir): Valor grande em esmeralda font-bold mono + "Unit:" abaixo
       6. Disp. (8%, centro): Checkbox laranja + label "Disp." abaixo
     - Sub-bar rodapé da tabela: Itens cotados X de Y, Prazo médio entrega, Subtotal dos itens.
   - **COLUNA DIREITA 32% (sidebar)**: 3 cards empilhados com `divide-y`:
     1. **Resumo Financeiro**: Cabeçalho uppercase bold, Badge moeda topo, **destaque valor total** (p-4, gradient from-emerald-950/40 via-surface-card to-slate-900, borda esmeralda, font-black 2xl mono). Abaixo breakdown:
        - Soma dos itens (right-aligned)
        - Desconto Global: Select "Sem desconto / % / Valor Fixo" + input
        - Checkbox Frete Incluso (ícone Truck) + label "Grátis" em esmeralda
     2. **Condições Comerciais**: Input Pagamento, grid [Entrega | Garantia], Observações textarea 2 rows.
     3. **Anexar Proposta Original**: Dropzone dashed (upload ícone + "Clique para enviar ou arraste...") + file item (ícone PDF / Nome / MB / Tempo + ações visualizar/remover).
4. **Footer (slate-850)**:
   - Esquerda: Status "ponto verde pulse" + "Todos os N itens foram preenchidos e validados."
   - Direita: 3 botões → "Salvar como Rascunho" (secundário), "Cancelar" (ghost), "Salvar e Atualizar Cotação" (primário gradient laranja #f97316 + marca ✓).

### Componente Atual (update-supplier-quotation.tsx ~1570 linhas + supplier-quotation-data-grid.tsx)
- **Estrutura atual**: Modal único coluna `max-w-5xl` com overflow-y-auto, conteúdo empilhado em 7 Cards (Moeda | Itens | Desconto/Frete | Condições Comerciais | Observações | Anexos | Histórico) + sticky footer.
- **Fornecedor de estilos**: Usa sistema shadcn/ui (Dialog, Card, Badge, Button, Form components) com tema light/dark do Tailwind padrão.
- **Funcionalidades críticas NÃO PODEM SER QUEBRADAS**:
  - Formulário React Hook Form + Zod schema (UpdateSupplierQuotationData)
  - Campos Moeda + Taxa de câmbio com `handleCurrencyChange` + diálogo de confirmação (AlertDialog currencyDialogOpen)
  - Cálculos de subtotal, desconto, frete, total (`calculateSubtotal`, `calculateFinalTotal`, `calculateTotalValue`)
  - DataGrid @tanstack/react-table com edição inline de itens
  - Upload de arquivos + anexos existentes
  - Mutations optimistic updates do React Query
  - Toggle viewMode edit/view com base em `existingSupplierQuotation.status === 'received'`
  - AlertDialog + Dialog de confirmação troca moeda

## Files and Modules
1. `client/src/features/quotations/components/update-supplier-quotation.tsx` — **Alteração completa de estrutura**: substituir layout 1-coluna empilhado → layout full-screen duas colunas (68/32), reorganizar Header, Coluna Esquerda (tabela), Coluna Direita (Sidebar 3 cards), Footer, mantendo toda a lógica intacta.
2. `client/src/features/quotations/components/supplier-quotation-data-grid.tsx` — **Adaptação de rendering**: atualizar estilo das células e cabeçalho da tabela para coincidir com proposta (colunas densas, badge código, chip "Solicitado", inputs compactos, layout Prazo+Qtd grid, Total Final destacado).

## Implementation Steps
1. **Etapa 1: Wrapper Modal Fullscreen + Layout Base (update-supplier-quotation.tsx)**
   - Trocar `DialogContent` classes: de `max-w-5xl overflow-y-auto p-0 sm:rounded-lg block` para wrapper `w-[96vw] max-w-[1720px] h-[93vh] max-h-[1050px] rounded-2xl border border-[#263352] shadow-2xl flex flex-col overflow-hidden text-sm bg-slate-900`
   - Remover múltiplos `<Card>` de seções; criar estrutura Header + Main (col 68% + col 32%) + Footer (flex-col vertical)
   - Mover AlertDialog de troca moeda após o Dialog principal (manter <> fragment wrapper)

2. **Etapa 2: Novo Header do Modal**
   - Criar `header` com fundo `bg-[#111726] (slate-850 custom)` px-6 py-3.5 flex items-center justify-between
   - Esquerda: Ícone Currency Dollar (span verde bg-emerald-500/10), título com supplierName, Badge status "Pendente/Recebida" âmbar/sucesso, sub meta chips RFQ + Prazo resposta + Comprador (usar quotationId + existingSupplierQuotation.receivedAt + usuário atual se possível)
   - Direita: Barra compacta `hidden md:flex items-center bg-surface-card rounded-lg border px-3 py-1.5 gap-3` com Select Moeda e Input Taxa inline (render usando campos do form, integrar com handleCurrencyChange)
   - Botão fullscreen (opcional: não funcional apenas visual) + DialogClose como "X"

3. **Etapa 3: Toolbar da Tabela (Coluna Esquerda)**
   - Injetar acima do SupplierQuotationDataGrid a toolbar:
     - Input Search (buscar por item description/código - usar columnFilters já existente do @tanstack react-table)
     - View Toggle segmentado "Todos / Pendentes" (contar itens com preenchimento vs vazios)
     - 3 botões: Aplicar em Lote (placeholder visual), Colunas (DropdownMenu colunas já implementado no data-grid), Planilha Excel (export XLSX já tem no data-grid)

4. **Etapa 4: SupplierQuotationDataGrid redesign (supplier-quotation-data-grid.tsx)**
   - Coluna "Item": aplicar badge azul estilo `bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/40` para código; adicionar chip "Solicitado: X UN" abaixo; mover especificações para linha como texto 11px regular
   - Coluna Preço Unitário: transformar DecimalInput em input com símbolo moeda absoluto esquerdo `R$` / `$`; texto Total Orig abaixo
   - Coluna Desconto: manter input, adicionar grupo com sufixo "%"; texto do valor economizado em esmeralda abaixo
   - Criar nova coluna agrupada "Prazo & Qtd." (grid 2x2): deliveryDays + availableQuantity + confirmedUnit select
   - Coluna Total Final: destacar em esmeralda negrito mono; texto "Unit:" abaixo
   - Coluna Disponibilidade: manter Checkbox, adicionar texto "Disp." verde abaixo
   - Header sticky `bg-slate-850/95 backdrop-blur z-10` uppercase tracking-wider
   - Sub-bar da tabela: contagem itens + prazo médio + subtotal calculado via calculateSubtotal

5. **Etapa 5: Sidebar Direita 32% (3 cards empilhados)**
   - **Card 1 Resumo Financeiro**:
     - Destacar Valor Total em caixa de gradient com ícone de dinheiro
     - Breakdown linha a linha: Subtotal dos itens, Desconto Global (render FormField com grid cols-2), Checkbox Inclui Frete + label valor frete "Grátis/R$ X"
   - **Card 2 Condições Comerciais**: render FormFields Condições de Pagamento (textarea), grid Condição Entrega / Garantia, Observações textarea.
   - **Card 3 Anexos**: Dropzone estilizado com UploadCloud, lista anexos existentes e arquivos pendentes selecionados com ações visualizar/remover.

6. **Etapa 6: Footer Novo**
   - Esquerda: status verde pulsante + texto "Todos os N itens foram preenchidos e validados" (contar itens cotados)
   - Direita: 3 botões: Salvar Rascunho (variant secondary), Cancelar (variant ghost), Salvar Atualizar (gradient laranja)
   - Manter integração com handlers do form (handleSubmit)

7. **Etapa 7: Ajustes de tema e modo (slate custom palette + modo dark forced)**
   - Aplicar customizações de cor via classes arbitrárias Tailwind (`bg-[#161c28]`, `border-[#263352]`, `bg-[#0b101a]` para inputs, textos esmeralda-400, laranja brand #f97316)
   - Responsividade: breakpoint lg para dividir colunas; abaixo lg fallback para 1-coluna com rolagem
   - Garantir retrocompatibilidade modo view: inputs readOnly, botões disabled

## Dependencies and Considerations
- **Preservar 100% da lógica existente**: TODO o código de state, handlers, mutations, cálculos, queries, integração RHF, validation Zod, AlertDialog currency deve permanecer; apenas JSX/layout será reestruturado.
- **SupplierQuotationDataGrid já usa @tanstack/react-table**: Vamos reutilizar a arquitetura de columns existente, alterando apenas o render dos cells, não a estrutura de dados.
- **Funcionalidade multi-moeda (currencyCode + exchangeRate)**: Integrar o Select e o DecimalInput compactos do header diretamente com os mesmos fields do form; render `formatDualCurrency` nas células de valor.
- **Paleta custom não existe no tailwind.config padrão**: Usar classes arbitrárias do Tailwind (`bg-[#HEX]`, `text-[#HEX]`, `border-[#HEX]`) para evitar tocar na config global e colidir com outros módulos.
- **Responsividade**: lg breakpoint (1024px) para layout 2 colunas; abaixo disso empilhar com overflow-auto.

## Validation
1. **TypeScript Check**: `npm run check` deve retornar exit code 0.
2. **Diagnostics**: `GetDiagnostics` sem erros.
3. **Testes específicos de currency**: `npm run test -- --testPathPattern="currency-utils|approved-snapshot"` deve continuar 30/30 passando.
4. **Smoke visual checklist (manual code review)**:
   - Cabeçalho possui título, fornecedor, status badge, meta chips (RFQ/Prazo/Comprador), moeda + taxa compactos, X fechar.
   - Coluna 68% com toolbar completa, tabela 6 colunas densas, sub-bar com contagem/subtotal.
   - Sidebar 32% com Resumo Financeiro (destaque gradient esmeralda), Condições Comerciais, Anexos com Dropzone.
   - Footer com status verde + 3 botões (Rascunho/Cancelar/Salvar Gradiente Laranja)
   - Nenhum campo do schema UpdateSupplierQuotationData foi perdido (currencyCode, exchangeRate, items, discountType/Value, includesFreight, freightValue, paymentTerms, deliveryTerms, warrantyPeriod, observations)
5. **Regressão funcional**:
   - Troca de moeda abre diálogo se existir preços preenchidos.
   - Calculos subtotal/desconto/frete atualizam em tempo real no Resumo.
   - Upload de arquivos persiste (campo existingAttachments, selectedFiles)
   - viewMode view desativa todos os inputs.

## Risks
- **Risco: JSX muito longo → risco de erros de sintaxe/TS2657**: Mitigação: manter wrapper Fragment <> no return; evitar editar a lógica do return de cálculos, só reestruturar o markup; validar em cada etapa com GetDiagnostics incremental.
- **Risco: Campos de formulário perdidos na reorganização**: Mitigação: checklist explícito de todos os 13 campos do UpdateSupplierQuotationData; mapear cada FormField do markup atual para nova posição.
- **Risco: SupplierQuotationDataGrid props incompatíveis**: Mitigação: manter props form, quotationItems, viewMode, currencyCode, exchangeRate com mesmos tipos; só alterar implementação interna de columnDefs cell renders.
- **Risco: Scroll travado por overflow incorreto (container 93vh overflow-hidden)**: Mitigação: corrigir overflow apenas nas sub-divs (tabela e sidebar) com `min-h-0` e `overflow-y-auto` nas colunas; manter flex layout correto (header flex-shrink-0, main flex-1 min-h-0, footer flex-shrink-0).
