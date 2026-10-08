# Seletor Horizontal de Fornecedores no Header + Confirmação Fechar pós-Salvamento Implementation Plan

## Repository Research

### Componente atual (update-supplier-quotation.tsx)
- **Props**: `{quotationId, supplierId, supplierName}` — componente renderiza **apenas UM fornecedor por vez**, com useQuery `/api/quotations/:id/supplier-quotations/:supplierId`. Mudar de fornecedor hoje requer fechar a modal e abrir em outro.
- **Header atual (linhas 890–1010)**: Contém 3 linhas visuais (1. título + fornecedor dropdown inline + Moeda/Câmbio; 2. chips RFQ/Prazo/Comprador; 3. toolbar tabela).
- **useState locais**: `viewMode`, `currencyDialogOpen`, `isUploading`; existe **apenas um `AlertDialog` (currencyDialogOpen)**. Podemos reutilizar o mesmo padrão para 2 novos diálogos: `AlertDialog confirmCloseDialogOnSave` (pergunta "Sim/Não fechar após salvar").
- **`updateMutation.onSuccess` (linhas 596–626)**: fluxo atual = `setInternalOpen(false) ; reset + close() ; onSuccess()`. **Vamos SUBSTITUIR o fechamento automático** aqui por abrir o AlertDialog de confirmação **somente se mutation bem sucedido**. `onError` não mostra nada mantém toast e usuário fica na tela.
- **`useQuery key = supplierId`**: Alterar supplierId local (via `setActiveSupplierId`) invalida as queries `/supplier-quotations/:supplierId` e `/attachments`, fornecendo carga instantânea do fornecedor clicado sem redirecionar.
- **API já existente**: Rota `/api/quotations/:quotationId/supplier-quotations` (LIST) lista fornecedores participantes com status / total. Usar para montar os chips.

### UI Modelo da imagem (horizontal bar)
- **Barra "FORNECEDORES PARTICIPANTES:" (uppercase bold) c/ ícone grupo 22px azul esquerdo**.
- **N chips inline flex items-center gap-2, overflow-x-auto**:
  - **Ativo selecionado (PROTMASTER)**: `bg-blue-600/90 text-white font-semibold` pill com (a) ponto verde status 6px (recebido) / âmbar (pendente), (b) nome curto truncado 14 chars, (c) total `R$ 3.840,00` BRL badge bg-black/20, (d) Badge status "Recebida" / "Pendente" (verde/âmbar).
  - **Não ativos**: `bg-surface-card/70 text-slate-300 hover:text-white hover:bg-slate-700/40` pill com mesmo conteúdo mas opaco.
  - **Overflow**: botão seta direita "Mais 3" (`` > Comparar 4 fornecedores restantes ``) clicável mostra dropdown com todos os 4+ restantes.

## Files and Modules
1. **`client/src/features/quotations/components/update-supplier-quotation.tsx`** — arquivo único. Alterações:
   a. **Novos props opcionais**: (mantém os de baixo `supplierId/supplierName` defaults) — adicionar chamadas externas? Não, usar os mesmos props.
   b. **Novo state**: `activeSupplierId:number = supplierId`, `activeSupplierName:string = supplierName`, `confirmCloseOnSaveDialogOpen:boolean = false`, `savedSuccessFlag = false` (limpar quando clicar em outro fornecedor).
   c. **Nova query**: `useQuery('/api/quotations/${quotationId}/supplier-quotations')` — carrega lista de fornecedores participantes para chips.
   d. **Nova handler `handleSelectSupplier(nextId, nextName)`**:
      - Pergunta se tem alterações não salvas: `if (form.formState.isDirty) → toast warning "Salve antes de trocar" ou diálogo? Ver notas`.
      - Senão: `setActiveSupplierId(nextId) ; setActiveSupplierName(nextName) ; form.reset() ; setSelectedFiles([]) ; queryClient.invalidateQueries(['/api/quotations/…supplier-quotations/' + nextId]).
   e. **Render dos chips**: Injetar `<div>` "FORNECEDORES PARTICIPANTES:" + ScrollArea HStack dos chips no header **antes** da toolbar de filtro/tabela (imagem mostra exatamente essa posição na linha 2 entre o header e a toolbar).
   f. **Diálogo "Fechar janela após salvar?"**: `<AlertDialog confirmCloseOnSaveDialogOpen>` — título "Cotação salva com sucesso!", descrição "Deseja fechar a janela atual ou permanecer na tela para fazer mais ajustes?", botão `Cancel/Não` (fechar diálogo permanecer) e `Action/Sim, Fechar` (executa o antigo onSuccess flow = close/reset/onSuccess).
   g. **Alterar `updateMutation.onSuccess`**: remover `setInternalOpen(false) / form.reset()/ onClose() / onSuccess()` — substituí-los por `setSavedSuccessFlag(true); setConfirmCloseOnSaveDialogOpen(true)`. Manter apenas os `queryClient.refetchQueries` e set de cache optimistic (antes do diálogo).
   h. **Alterar `updateMutation.onError`**: Não abrir diálogo; manter toast atual "Erro" = ok.

## Implementation Steps
1. **State + query adicionais**: adicionar `activeSupplierId` (começa com prop `supplierId`), `activeSupplierName` (começa com prop `supplierName`), `confirmCloseOnSaveDialogOpen`, `savedSuccess`. Trocar todas as referências de props `supplierId/supplierName` por state `activeSupplierId/activeSupplierName` nos keys das useQueries detalhe/anexos e no corpo submit.
2. **Buscar lista fornecedores participantes**: adicionar `useQuery('/quotations/:id/supplier-quotations')` habilitado `isOpen && quotationId`.
3. **Handler `handleSelectSupplier(id,name)`**: troca states, reseta formulário, invalida queries do fornecedor.
4. **Montar barra "FORNECEDORES PARTICIPANTES" + chips no header**: exatamente na linha após as metas (RFQ · Prazo · Comprador) e antes da toolbar de filtro (igual imagem). Incluir ícone `Users` (lucide), chips ativos/inativos com `formatCurrencyIn(BRL, totalValue)`, badge status, ponto indicador, overflow Mais N.
5. **Substituir fluxo `updateMutation.onSuccess`**: parar fechar automaticamente. Em vez disso, setar dialog open `confirmCloseOnSaveDialogOpen = true`.
6. **Criar novo AlertDialog (3o diálogo do return)**: Confirmação fechar com botões "Não" (fecha diálogo só) / "Sim" (executa `close window flow` original).
7. **Alinhar título header "Fornecedor (X de Y)" no header primeira linha**: trocar texto `FORNECEDOR` existente para incluir posição e total (imagem "Fornecedor (1 de 4): Nome Badge").

## Dependencies and Considerations
- **Todas as 4 referências a `supplierId` prop precisam trocar para state `activeSupplierId`** (query key supplier-quotations, attachments, mutation optimistic update map, upload supplierId body + toast). Fazer grep global `supplierId` no arquivo e substituir 1 a 1 para não quebrar submit do fornecedor errado.
- **Não permitir fechar com dirty form ao trocar**: usar `form.formState.isDirty` no clique de outro chip — exibir `toast({description:"Salve as alterações antes de trocar de fornecedor.", variant:"destructive"})` e não realizar a troca.
- **`supplierName` no título do chip**: extrair nome curto truncado 14 caracteres; fallback para "Fornecedor " + id se `supplierName` não vier na list route.
- **Fragment wrapper**: return do arquivo atualmente tem 2 AlertDialog (troca moeda + novo confirmação salvar). Total: 3 AlertDialogs + 1 Dialog. Manter `<>` wrapper no topo (já existe).

## Validation
1. **TypeScript check**: `npm run check` exit 0.
2. **Diagnostics**: GetDiagnostics = 0.
3. **Smoke chip-seletor**:
   - Tela abre com 4 chips, 1 azul ativo (corresponde ao supplierId inicial)
   - Clicar chip "STRUTURAL" = sem dirty → troca instantânea, dados carregados (moeda/taxa e itens refazem fetch)
   - Clicar chip 2 com dirty form → toast destructive "Salve antes" NÃO troca
4. **Smoke diálogo pós-salvamento**:
   - **Caso sucesso**: clicar Salvar Atualizar → mutate onSuccess → abre AlertDialog "Cotação salva com sucesso. Deseja fechar?"
   - Clicar "Não" → diálogo some, usuário continua na tela mesma janela, campos permanecem salvos.
   - Clicar "Sim" → janela fecha, onSuccess/onClose chamados, formulário reset.
   - **Caso erro**: mutate onError → NÃO aparece diálogo, só toast vermelho "Erro" como antes.
5. **Testes**: se disponível rodar `npm run test --testPathPattern=currency-utils (garantir 29/29 passando; não temos testes Jest para React components neste módulo).

## Risks
- **Risco: `activeSupplierId` inconsistência com props no reabrir**: Mitigação: `useEffect([isOpen, supplierId, supplierName])` sempre que modal abrir ou prop mudar → reset states para os props (garante que componente pai mude).
- **Risco: duplicar AlertDialog JSX dentro `<>` sem keys em siblings**: Mitigação: manter ordem no return: `<Dialog>` sempre primeiro + 3 AlertDialogs separados no final = Fragment funciona sem key.
- **Risco: form.reset() ao trocar de fornecedor não limpa anexos**: Mitigação: resetar também `setSelectedFiles([])` + invalidar attachments query ao trocar.
- **Risco: optimistic update do mutation usa supplierId antigo**: Mitigação: substituir props `supplierId` todo por `activeSupplierId` no arquivo.
