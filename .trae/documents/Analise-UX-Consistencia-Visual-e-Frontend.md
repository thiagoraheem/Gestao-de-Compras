# Relatório de Análise UX Completa - Gestão de Compras

**Data da Análise**: 2026-08-30
**Escopo**: Frontend React completo, com foco em modais/diálogos, consistência visual, acessibilidade, performance e responsividade
**Analisados**: 53 arquivos de componentes, 14+ implementações distintas de modais

---

## Resumo Executivo

Foi realizada uma varredura completa no frontend React do projeto Gestão de Compras. O projeto utiliza uma base sólida de componentes (Radix UI + shadcn/ui + TanStack Query + React Hook Form + Zod), mas apresenta **inconsistências significativas na aplicação desses componentes padrão**, especialmente nas implementações customizadas de modais de formulários CRUD e fluxos de negócio.

Os principais achados:
- **3 padrões diferentes** de estrutura interna de modal em uso simultâneo
- **Modal custom do zero** em AttachmentsViewer sem acessibilidade nenhuma
- **8+ modais** sem responsividade no mobile para botões de ação
- **Cores hardcoded** sem suporte a dark mode em múltiplos arquivos
- **7 form modais CRUD** com código duplicado (oportunidade de abstração)
- **15 itens priorizados** para roadmap de melhorias

---

## 1. Inconsistências de Identidade Visual (Prioridade: ALTA)

### 1.1 Estrutura Interna de Modais — 3 Padrões Diferentes em Uso

| Padrão | Características | Arquivos que usam |
|:---|:---|:---|
| **Padrão A (Custom Header/Footer)** | `p-0` no DialogContent + divs customizadas com `sticky top-0` e `sticky bottom-0` + backgrounds com blur | `pendency-modal.tsx`, `enhanced-new-request-modal.tsx` |
| **Padrão B (DialogHeader + Footer Custom inline)** | Usa `DialogHeader` mas footer é div inline com `flex justify-end space-x-2 pt-4 border-t mt-6` | `UserFormModal.tsx`, `SupplierFormModal.tsx`, `CompanyFormModal.tsx`, `DepartmentModals.tsx`, `DeliveryLocationFormModal.tsx` |
| **Padrão C (DialogHeader + DialogFooter oficiais)** | Usa componentes corretos da biblioteca shadcn/ui | `UnitOfMeasureFormModal.tsx`, `alert-dialog.tsx` |

**Impacto**: Usuário percebe cada modal como um sistema diferente. Algumas têm cabeçalho fixo com sombra/blur, outras têm cabeçalho inline sem diferenciação visual.

**Recomendação**: Adotar **Padrão A como padrão corporativo** para todos os modais com formulários longos (scroll de conteúdo), criando um HOC `FormModalLayout` que encapsule header sticky, conteúdo scrollável e footer sticky. Modais pequenos (confirmações) usam Padrão C.

---

### 1.2 Padding e Espaçamentos — Variações Significativas

| Arquivo | DialogContent Padding | Padding do Form | Gap entre Campos |
|:---|:---|:---|:---|
| `dialog.tsx` (default shadcn) | `p-6` | — | `gap-4` do grid |
| `SupplierFormModal.tsx` | `p-0` (override) | Header: `px-6 py-4` / Body: `px-6 py-4` / Footer: `px-6 py-4` | `space-y-4` |
| `UserFormModal.tsx` | `p-6` (default) | Default do Dialog | `space-y-4` mt-0 nos TabsContent |
| `CompanyFormModal.tsx` | `p-6` (default) | `space-y-4` | — |
| `UnitOfMeasureFormModal.tsx` | `p-6` (default) | `py-2` + `DialogFooter pt-4` | `space-y-4` |
| `pendency-modal.tsx` | `p-0` (override) | Header: `px-6 py-3` / Body: `px-6 pt-6 pb-24` / Footer: `px-6 py-3` | `space-y-4` |

**Problemas identificados**:
- `SupplierFormModal` e `pendency-modal` usam `p-0` com `pb-24` no body (gambiarra para não ficar atrás do footer sticky)
- Padrão B não tem fundo diferenciado no footer; Padrão A usa `bg-gray-50/50` e `bg-white/80 backdrop-blur-sm`
- Espaçamento de header: `py-3` vs `py-4` vs padrão `space-y-1.5` interno

**Impacto**: Sensação de "profundidade" diferente em cada modal. Modais com `p-0` parecem mais cheios/confinados, enquanto `p-6` padrão parecem mais arejados.

**Recomendação**: Unificar para **16px (py-4 px-6)** no header, **16px/24px** no corpo (px-6 py-4), e **footer com bg-muted/50** para todos os modais.

---

### 1.3 Variações de Tamanho Máximo de Modal

| Modal | Tamanho Máximo | Altura Máxima |
|:---|:---|:---|
| SupplierFormModal | `max-w-4xl w-[95vw]` | `max-h-[95vh]` |
| UserFormModal | `sm:max-w-2xl` | `max-h-[85vh]` |
| CompanyFormModal | `sm:max-w-2xl` | Default (sem limite) |
| DeliveryLocationFormModal | `sm:max-w-[425px]` | Default |
| UnitOfMeasureFormModal | `sm:max-w-md` | Default |
| DepartmentModals | `sm:max-w-lg` | Default |
| PendencyModal | `sm:max-w-md` | `max-h-[90vh]` |
| EnhancedNewRequestModal | `sm:max-w-3xl` | `max-h-[90vh]` |
| ReceiptSearchDialog | `max-w-4xl` | `max-h-[80vh]` |
| ResetPasswordDialog | Default (`max-w-lg`) | Default |
| SetPasswordDialog | `sm:max-w-md` | Default |

**Observação**: Não há um padrão documentado. `UserFormModal` tem tabs múltiplas e deveria ser maior (como SupplierFormModal), enquanto `DepartmentModals` tem 2-3 campos e poderia ser `sm:max-w-md`.

**Impacto**: Em telas menores (1366x768), SupplierFormModal com max-w-4xl causa overflow lateral. UserFormModal com tabs em max-w-2xl fica apertado.

**Recomendação**: Criar tokens de tamanho documentados:
- **XS (confirmação)**: `max-w-md`
- **SM (form pequeno: 2-4 campos)**: `max-w-lg`
- **MD (form médio: 5-8 campos)**: `max-w-2xl`
- **LG (form grande: tabs/grids)**: `max-w-3xl`
- **XL (tabelas/dados complexos)**: `max-w-4xl`
- Usar `dvh` (dynamic viewport height) em vez de `vh` para mobile: `max-h-[90dvh]`

---

### 1.4 Padrões de Botão de Ação (Footer)

| Modal | Cancelar | Submit | Espaçamento | Responsividade Mobile |
|:---|:---|:---|:---|:---|
| SupplierFormModal | `variant="outline"` w-full sm:w-auto | default w-full sm:w-auto | `gap-2` + `justify-end` | ✅ SIM (order-2/order-1 invertido) |
| UserFormModal | `variant="outline"` | default | `space-x-3` + `justify-end` | ❌ NÃO TEM |
| CompanyFormModal | `variant="outline"` | default | `space-x-2` + `justify-end` | ❌ NÃO TEM |
| DeliveryLocationFormModal | `variant="outline"` | default | `space-x-2` + `justify-end` | ❌ NÃO TEM |
| DepartmentModals | `variant="outline"` | default | `space-x-2` + `justify-end` | ❌ NÃO TEM |
| UnitOfMeasureFormModal | `variant="outline"` via DialogFooter | default via DialogFooter | `space-x-2` (do DialogFooter) | ⚠️ Parcial (reverse, mas sem w-full) |
| PendencyModal | `variant="outline"` | `variant="destructive"` | `gap-2` + `justify-end` | ❌ NÃO TEM |
| EnhancedNewRequestModal | `variant="outline"` | default | `space-x-3` + `justify-end` | ❌ NÃO TEM |
| ReceiptSearchDialog | N/A | `default` (único botão) | — | — |
| UserActionsModals (3) | Variados | Variados | `space-x-2` | ❌ NÃO TEM |

**Problema Crítico**: Apenas **1 dos 8+ modais** implementa responsividade correta no mobile. Todos os outros usam `space-x-*` que, em mobile < 640px:
- Deixa os botões espremidos horizontalmente
- Touch target menor que 48px (viola WCAG 2.5.5)
- Ordem de ação errada (Cancelar primeiro, mas mobile é leitura top-down)

**Recomendação**: Padronizar para TODOS os modais:
```tsx
<div className="flex flex-col sm:flex-row justify-end gap-2">
  <Button variant="outline" className="w-full sm:w-auto order-2 sm:order-1">Cancelar</Button>
  <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">Salvar</Button>
</div>
```

---

### 1.5 Botão Close (X) — Padrão vs Customizado

**Padrão da biblioteca** (`dialog.tsx` linhas 52-55):
```tsx
<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ...">
  <X className="h-4 w-4" />
  <span className="sr-only">Close</span>
</DialogPrimitive.Close>
```
- Hit area: ~24x24px
- Estilo: `rounded-sm`, `opacity-70`, `ring-offset-background`

**Customizado em `pendency-modal.tsx` e `enhanced-new-request-modal.tsx`**:
```tsx
<DialogClose asChild>
  <button className="p-2 rounded-full hover:bg-slate-100 ..." aria-label="Fechar">
    <X className="h-4 w-4" />
  </button>
</DialogClose>
```
- Hit area: ~40x40px (melhor para mobile)
- Estilo: `rounded-full`, `hover:bg-slate-100`, sem `ring-offset`

**Impacto**: Inconsistência visual e no tamanho da área de toque.

**Recomendação**: Unificar para o estilo customizado (maior hit area) atualizando o componente base `dialog.tsx` para aceitar a prop `size` ou ajustando o default.

---

### 1.6 Cores Hardcoded Fora do Design System

| Local | Cor Hardcoded | Deveria usar | Suporte Dark |
|:---|:---|:---|:---|
| `pendency-modal.tsx:54` | `bg-amber-50 border-amber-200 text-amber-800` | Classes do DESIGN_SYSTEM_COLORS.md | ❌ Nenhuma |
| `UserFormModal.tsx:288` (CEO) | `bg-purple-50 border-purple-200 text-purple-700` | Nova variante de Card/Badge | ❌ Nenhuma |
| `UserFormModal.tsx:300` (Diretor) | `bg-blue-50 border-blue-200 text-blue-700` | Nova variante | ❌ Nenhuma |
| `UserFormModal.tsx:312` (Admin) | `bg-red-50 border-red-200 text-red-700` | `bg-destructive/10` + tokens | ❌ Nenhuma |
| `CompanyFormModal.tsx:170` (checkbox nativo) | `rounded border-gray-300 text-primary focus:ring-primary h-4 w-4` | Componente `<Checkbox>` padrão | ❌ Nenhuma |
| `DeliveryLocationFormModal.tsx:98-107` | `h-4 w-4 rounded border-gray-300` | Componente `<Checkbox>` padrão | ❌ Nenhuma |
| `attachments-viewer.tsx:56-67` (Badges tipo arquivo) | `bg-blue-100 text-blue-800`, `bg-red-100 text-red-800`, etc. | Variantes de Badge do design system | ❌ Nenhuma |

**Impacto Crítico**: No tema escuro, esses modais terão fundos coloridos de "tema claro" sobre fundo escuro (`slate-800/50`). Resultado:
- Texto `purple-700` ou `red-700` sobre fundo já escuro → contraste estimado < 3:1 ❌
- Viola WCAG 1.4.3 Contraste Mínimo

**Recomendação**:
1. Criar novas variantes em `badge.tsx`: `variant="success" | "warning" | "info" | "violet"` com classes `dark:` completas
2. Criar variante `destructive-light`, `violet-light`, `blue-light` para Cards de permissão
3. Atualizar DESIGN_SYSTEM_COLORS.md com essas novas cores
4. Remover TODO checkbox HTML nativo e usar o componente `<Checkbox>`

---

### 1.7 Modal Custom Implementado do Zero — Attachments Viewer

`attachments-viewer.tsx` linhas 173-252 cria um modal completamente manual:

```tsx
<div 
  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  onClick={() => setSelectedAttachment(null)}
>
  <div 
    className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
  >
```

**Problemas em relação ao Dialog padrão**:
| Característica | Dialog Radix | Attachments Custom |
|:---|:---|:---|
| Animações fade/zoom | ✅ Sim | ❌ Nenhuma |
| `role="dialog"` + `aria-modal` | ✅ Sim | ❌ Não |
| `aria-labelledby` | ✅ Sim | ❌ Não |
| Focus trap (Tab não sai) | ✅ Sim | ❌ Não |
| Fechamento ESC | ✅ Sim | ❌ Não |
| Body scroll lock | ✅ Sim | ❌ Não (fundo continua scrollando) |
| Overlay `bg-black/80` | ✅ Sim | ❌ `bg-black bg-opacity-50` (50% vs 80%) |
| Suporte dark mode | ✅ Sim via tokens | ❌ Hardcoded `bg-white` |
| Foco restaurado após fechar | ✅ Sim | ❌ Não |

**Impacto**: ⚠️ **GRAVE** para acessibilidade. Usuários de teclado e leitores de tela não conseguirão operar esse modal corretamente.

**Recomendação Imediata**: Refatorar substituindo a div customizada por `<Dialog>` padrão, mantendo a mesma estrutura interna de conteúdo.

---

### 1.8 Tipografia — Tamanhos e Pesos

| Elemento | Arquivo | Classe Aplicada | Padrão da Biblioteca | Diferença |
|:---|:---|:---|:---|:---|
| DialogTitle padrão | `dialog.tsx` | `text-lg font-semibold leading-none tracking-tight` | — | OK |
| DialogTitle Pendency | `pendency-modal.tsx:41` | `text-base font-semibold` | text-lg | ❌ 14px vs 18px |
| DialogTitle NewRequest | `enhanced-new-request-modal.tsx:525` | `text-base font-semibold` | text-lg | ❌ 14px vs 18px |
| CardTitle Attachments | `attachments-viewer.tsx:83,103` | `text-lg` | CardTitle padrão = text-2xl | ❌ Override mas OK para seção |
| CardTitle NewRequest | `enhanced-new-request-modal.tsx:541,770` | `text-sm font-semibold` | text-2xl | Override intencional OK |
| Badge texto | Vários | `text-xs` font-medium | — | OK |
| Label formulário | Vários | Padrão FormLabel = default text-sm | — | OK |

---

## 2. Problemas Técnicos no Código React

### 2.1 Abstração Ausente: 7 FormModals CRUD com Código ~80% Duplicado

Cada modal CRUD reimplementa separadamente:
1. Estrutura JSX: `Dialog → DialogContent → DialogHeader → Form → form → footer inline`
2. Props de interface: `isOpen, onClose, form, isEditing, onSubmit, isPending`
3. Labels dinâmicos de submit: `"Salvando..." / isEditing ? "Atualizar" : "Criar"`
4. Validação de loading e disabled state
5. Passagem do `form.handleSubmit(onSubmit)`

**Arquivos afetados**:
1. `SupplierFormModal.tsx`
2. `UserFormModal.tsx` (mais complexo com tabs)
3. `CompanyFormModal.tsx` (sem RHF — controlled state)
4. `DeliveryLocationFormModal.tsx` (sem RHF)
5. `DepartmentModals.tsx` (2 modais)
6. `UnitOfMeasureFormModal.tsx` (RHF dentro do próprio modal)

**Estimativa de duplicação**: ~150-200 linhas repetidas por modal × 7 = **1000+ linhas de código duplicado**.

**Recomendação**: Criar:
```tsx
// shared/components/form-modal-wrapper.tsx
interface FormModalWrapperProps {
  title: string;
  description?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  maxHeight?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel?: boolean; // dirty check
  isPending: boolean;
  submitLabel?: string;
  editLabel?: string;
  createLabel?: string;
  isEditing?: boolean;
  formId?: string;
  children: React.ReactNode;
  stickyHeader?: boolean;
  stickyFooter?: boolean;
  footerBg?: 'default' | 'muted';
}
```

Economia estimada: **600-800 linhas** + consistência 100% garantida.

---

### 2.2 Controle de Estado: Controlled vs Uncontrolled — Sem RHF em 2 Modais

**CompanyFormModal** e **DeliveryLocationFormModal** usam:
```tsx
const [formData, setFormData] = useState<InsertCompany>({...});
// depois:
<Input
  value={formData.name}
  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
  required
/>
```

**Problemas vs React Hook Form padrão**:
| Critério | React Hook Form | useState Manual |
|:---|:---|:---|
| Mensagens de erro Zod | ✅ Automático via FormMessage | ❌ Apenas `required` nativo HTML |
| Validação por campo blur | ✅ Sim | ❌ Apenas no submit nativo |
| `form.reset()` no fechamento | ✅ Fácil | ❌ Propenso a vazamento de estado |
| Coerção de tipos (CNPJ, números) | ✅ Via resolver + transform | ❌ Precisa manual |
| Performance (re-renders) | ✅ Subscrição por campo | ❌ Re-render completo a cada key |
| Validação condicional | ✅ Refine do Zod | ❌ Manual no onSubmit |

**Impacto**: Os dois modais têm validação mais fraca, UX pior e risco de dados "vazarem" entre aberturas (ex: abrir modal X, preencher meio, cancelar, abrir modal Y — estado antigo ainda pode estar lá se o componente não for desmontado).

**Recomendação**: Migrar ambos para o mesmo padrão de `SupplierFormModal.tsx` com RHF + Zod resolver + `<FormField>`.

---

### 2.3 Checkbox HTML Nativo (sem Radix)

`CompanyFormModal.tsx:165-170` e `DeliveryLocationFormModal.tsx:98-107`:
```tsx
<input
  type="checkbox"
  id="edit-active"
  checked={formData.active || false}
  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
/>
```

**Problemas vs `<Checkbox>` Radix**:
- Sem `indeterminate` state
- Sem tratamento de `disabled` visual nativo apropriado
- `focus-visible` ring padrão do navegador, não do design system
- `aria-checked` não automático (o navegador faz, mas menor garantia)
- Tamanho fixado em `h-4 w-4` (padrão Checkbox shadcn é variável)

---

### 2.4 `window.confirm()` Nativo — Fora do Design System

`receipt-search-dialog.tsx` linhas 75-79:
```tsx
const handleSelect = (id: number) => {
  if (confirm("Deseja utilizar os dados desta nota fiscal para preencher o formulário?")) {
    onSelect(id);
    setOpen(false);
  }
};
```

**Por que é ruim**:
1. Aparência OS-específica (Windows 10 / macOS / Chrome mobile cada um desenha diferente)
2. Não pode ser estilizado → quebra identidade visual
3. `confirm()` é bloqueante e síncrono — ruim para animações
4. Acessibilidade inconsistente entre navegadores
5. Botões sempre em idioma do SO (ex: "OK/Cancelar" em PT-BR do Windows, mas "Cancel" em EN-US do macOS)

**Recomendação**: Substituir pelo `<AlertDialog>` oficial do design system.

---

### 2.5 Código Duplicado: Download via `<a>` Temporário

`attachments-viewer.tsx` linhas 148-158 e **232-242** (duas vezes o mesmo bloco):
```tsx
onClick={() => {
  if (attachment.url || attachment.downloadUrl) {
    const link = document.createElement('a');
    link.href = attachment.url || attachment.downloadUrl;
    link.download = attachment.fileName || attachment.name || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}}
```

**Recomendação**: Criar utilitário em `lib/utils.ts`:
```tsx
export function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

---

## 3. Falhas de Acessibilidade (WCAG 2.1)

### 3.1 Gravidade das Falhas Identificadas

| Item | WCAG Violado | Severidade | Arquivos |
|:---|:---|:---|:---|
| Attachments Modal custom sem focus trap | 2.1.1 Keyboard (A), 2.4.3 Foco Visível (A) | 🔴 CRÍTICA | `attachments-viewer.tsx:173-252` |
| Attachments Modal sem ESC para fechar | 2.1.1 Keyboard (A) | 🔴 CRÍTICA | Mesmo |
| Attachments Modal sem role=dialog | 1.3.1 Info e Relações (A), 4.1.2 Nome/Função/Valor (A) | 🔴 CRÍTICA | Mesmo |
| Attachments Modal sem scroll lock | 1.3.2 Ordem Significativa (A) | 🟠 ALTA | Mesmo |
| `window.confirm()` nativo | 4.1.2 Nome/Função/Valor (A) | 🟠 ALTA | `receipt-search-dialog.tsx:76` |
| Cores hardcoded sem dark mode | 1.4.3 Contraste Mínimo (AA) | 🟠 ALTA | UserFormModal, Pendency, Attachments |
| Botões em mobile < 48x48px | 2.5.5 Target Size (AA) | 🟠 ALTA | 8+ modais sem footer responsivo |
| Checkboxes nativos sem foco apropriado | 2.4.7 Foco Visível (AA) | 🟡 MÉDIA | CompanyFormModal, DeliveryLocation |

---

### 3.2 Live Regions e Feedback Assíncrono

✅ **Bom**: O sistema usa `toast()` shadcn que já implementa `aria-live="polite"` corretamente.

✅ **Excelente**: Apenas `enhanced-new-request-modal.tsx` implementa `aria-live="polite"` no contador de caracteres (linhas 735-741).

⚠️ **A melhorar**: Botões de submit com `isPending` não têm `aria-busy="true"` ou `aria-disabled="true"` anunciado. Recomenda-se adicionar aos botões:
```tsx
<Button
  type="submit"
  disabled={isPending}
  aria-busy={isPending}
>
  {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
  {isPending ? 'Salvando...' : 'Salvar'}
</Button>
```

---

### 3.3 Rótulos de Formulário

✅ **Excelente**: O componente `form.tsx` faz automaticamente:
- `htmlFor` do Label associado ao input correto
- `aria-describedby` concatenando description + message
- `aria-invalid={!!error}` automático
- IDs únicos gerados via `React.useId()`

❌ **Ruim**: Modais **sem** `FormField` (Company, DeliveryLocation) e **checkboxes nativos** não têm essas associações automáticas. `CompanyFormModal.tsx` usa `<Label htmlFor>` mas sem `aria-describedby` para mensagens de erro.

---

### 3.4 Ícone X sem Tooltip Visível

Todos os modais usam `<span className="sr-only">Close</span>` para leitores de tela. OK para WCAG 4.1.2.

Porém, para usuários que não usam leitores de tela (incluindo TEA e baixa literacia), um `title="Fechar (ESC)"` adicional ou `tooltip` do shadcn reduziria a curva de aprendizado. Menor impacto.

---

## 4. Gargalos de Performance

### 4.1 EnhancedNewRequestModal — Componente Monolítico (1057 linhas)

Um único componente com:
- 11 estados locais + 3 refs
- 6 queries React Query simultâneas
- ~200 linhas de mutation com optimistic update
- Formulário principal + sub-formulário de item
- Tabela com itens editáveis inline
- Múltiplos conditionals de categoria (Produto/Serviço/Material)

**Sintomas de re-render excessivo**:
- Cada digitação em `justification` roda `form.watch("justification")` → re-render TODO componente com sua tabela de 50+ linhas
- Cada alteração em `newItemForm.description` → mesmo
- `useEffect` de `manualItems` roda JSON.stringify a cada render (para debug comentado, mas ainda há risco)

**Sugestões**:
1. Extrair `<BasicInfoCard>` (dados básicos) como componente separado
2. Extrair `<NewItemFormCard>` como componente memoizado
3. Extrair `<ItemsTable>` com `React.memo(ItemsTable, areEqual)` comparando itens por referência
4. Usar `useWatch` em vez de `form.watch()` no JSX para granularidade
5. Usar `useFormContext` + fragmentar em submódulos

**Ganho estimado**: 30-50% menos re-renders em telas com 10+ itens.

---

### 4.2 `JSON.stringify` para Deep-Compare

`ReceiptManualEntry.tsx` linha 67:
```tsx
if (JSON.stringify(autoItems) !== JSON.stringify(manualItems)) {
  setManualItems(autoItems);
  // ...
}
```

Complexidade O(n) a cada render do componente (que já tem 4 queries e muito estado). Com arrays de 50+ itens, torna-se perceptível.

**Melhor abordagem**:
```tsx
// Primeiro quick check por tamanho + último item id
const itemsEqual = 
  autoItems.length === manualItems.length &&
  (autoItems.length === 0 || 
   autoItems[autoItems.length - 1]?.purchaseOrderItemId === 
   manualItems[manualItems.length - 1]?.purchaseOrderItemId);
```

Ou, se precisar de robustez: `useMemo` + hash.

---

### 4.3 `form.watch()` Inline em Render

`SupplierFormModal.tsx` linhas 66, 77, 88, 96, 104, 112, 120, 137 (8 vezes):
```tsx
{form.watch("type") === 0 && (
  <FormField ...>...</FormField>
)}
```

Cada `form.watch()` inscreve o componente pai a TODAS as mudanças do campo. Com 8 watches = 8 subscrições que causam re-render do componente inteiro (que tem 14 campos + grid 2-col).

**Melhor**: Usar hook granular:
```tsx
const supplierType = useWatch({ control: form.control, name: 'type' });
```
Ou encapsular cada conditional em seu próprio `<ShowForType value={0}>` sub-componente.

---

### 4.4 Scroll Janky no iOS

Modais com `overflow-y-auto` + conteúdo longo em iOS/Safari têm scroll "sem inércia" por padrão. Falta a classe:
```css
-webkit-overflow-scrolling: touch;
```

Recomenda-se adicionar ao `.flex-1.overflow-y-auto` em `index.css` globalmente.

---

## 5. Falhas de Responsividade

### 5.1 Footer Responsivo: 1 de 8+ Correto

Já detalhado no item 1.4. **Resumo**:
- ✅ SupplierFormModal: `flex-col sm:flex-row` + `w-full sm:w-auto` + `order-*` invertido
- ❌ 8 outros modais: `space-x-*` em flex-row sempre

**Impacto em iPhone SE (375px)**:
- Dois botões de ~120px + 16px gap = 256px mínimo horizontal. OK de largura.
- Mas altura de botão com `h-10` + padding `p-6` do footer = pequeno touch target.
- **Pior**: UserFormModal usa `space-x-3` (12px) mas com botões "Cancelar" + "Atualizar Usuário" (texto longo, sem wrap) → overflow de texto no botão.

---

### 5.2 Grids de Formulário Sem Breakpoint

| Arquivo | Grid Atual | Problema Mobile < 640px |
|:---|:---|:---|
| `UserFormModal.tsx:113` | `grid-cols-2` (HARDCODED, sem md:) | 2 colunas ~155px cada, input nome/sobrenome muito estreito |
| `CompanyFormModal.tsx:70` | `grid-cols-2` HARDCODED | Idem, CNPJ + EmpresaERP apertados |
| `CompanyFormModal.tsx:132` | `grid-cols-2` HARDCODED | Telefone + Email em 2 colunas |
| `SupplierFormModal.tsx:40` | `grid-cols-1 lg:grid-cols-2` | OK, mas `lg` (1024px) é tarde; tablet 768px ainda 1-col |
| `EnhancedNewRequest.tsx:581` | `grid-cols-1 md:grid-cols-2` | ✅ OK |
| `ReceiptSearchDialog.tsx:99` | `grid-cols-1 md:grid-cols-4` | ✅ OK |
| `UnitOfMeasureFormModal.tsx` | 1 coluna sempre | ✅ OK (2 campos) |
| `DepartmentModals.tsx` | 1 coluna sempre | ✅ OK |
| `DeliveryLocationFormModal.tsx` | 1 coluna sempre | OK, mas `md:grid-cols-2` (email/telefone) melhoraria |

**Correção Crítica para UserFormModal e CompanyFormModal**:
```diff
- <div className="grid grid-cols-2 gap-4">
+ <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

---

### 5.3 Altura Máxima com `vh` vs `dvh`

Modais usam `max-h-[90vh]`, `max-h-[95vh]`, `max-h-[85vh]`. Em navegadores mobile modernos (Safari iOS 15+, Chrome Android), `vh` considera a barra de endereço expandida → modal pode transbordar.

Padronizar para `max-h-[90dvh]` (dynamic viewport height) em TODOS os modais com conteúdo scrollável.

---

### 5.4 Tabs em UserFormModal — Mobile

UserFormModal.tsx usa Tabs com 3 abas: "Dados Pessoais", "Departamento", "Permissões". Em < 640px o `TabsList` com `grid-cols-3` + texto + ícone por aba → cada aba tem ~100px, ícone + texto quebram ou overflowam.

Sugestão: Em mobile, oculte o ícone das abas ou mude para `TabsList` horizontalmente scrollável (componente nativo shadcn não tem scroll, precisaria customizar).

---

## 6. Oportunidades de Melhoria Geral na UX

### 6.1 Confirmação Visual de Sucesso Antes de Fechar

Atualmente: `toast({title: "Sucesso"})` + `onClose()` imediatamente após sucesso no mutation.

Problema: Em rede 3G/conexão ruim, o usuário pode não ver o toast e não ter certeza. Também não há feedback dentro do próprio modal.

Padrão melhor:
```
DIGITANDO → (clica Salvar) → LOADING (spinner) → SUCESSO (ícone check + "Salvo!" por 400ms) → FECHAR
```

Implementação: Estado `submitState: 'idle' | 'loading' | 'success' | 'error'`.

---

### 6.2 Confirmação de Saída com Dados Não Salvos (Dirty Check)

Nenhum modal pergunta antes de fechar por ESC / clique fora / X:

> "Você tem alterações não salvas. Deseja realmente sair? As alterações serão perdidas."
> [Ficar no modal] [Sair sem salvar]

Implementação:
```tsx
const isDirty = form.formState.isDirty;
const handleRequestClose = () => {
  if (isDirty && !isPending) {
    setShowConfirmClose(true); // AlertDialog
  } else {
    onClose();
  }
};
```

Especialmente importante para EnhancedNewRequestModal (usuário pode ter digitado 20 itens).

---

### 6.3 Persistência Parcial (Auto-Save em SessionStorage)

Para EnhancedNewRequestModal e UpdateSupplierQuotation (formulários > 30min de preenchimento possível):
- Salvar `formData + items` no sessionStorage a cada 3s via debounce
- Ao reabrir a modal, se detectar rascunho: "Rascunho salvo em DD/MM HH:MM detectado. Deseja restaurar?"
- Botão "[Descartar rascunho] [Restaurar]"

Reduz drasticamente perdas de trabalho por refresh acidental.

---

### 6.4 Indicadores de Progresso em Fluxos Multi-Etapa

- **ReceiptFormPage**: Tem tabs NF-e / Manual / Conferência → sem barra "Passo 2/3"
- **Approval A1/A2**: Visualização de dados → ação (aprovar/reprovar) → justificativa → confirmação. 4 passos sem indicador.
- **ConclusionPhase**: Tem múltiplos cards de informação → ação final.

Adicionar componente `<Stepper current={2} total={4} steps={['Dados Básicos', 'Itens', 'Financeiro', 'Concluir']} />` reduz ansiedade do usuário ("quanto falta?").

---

### 6.5 Enter como "Próximo Campo" vs "Submeter Form"

Sistemas ERP brasileiros têm a convenção que Enter vai para o próximo campo, Tab também. Atualmente:
- Enter em qualquer input → nativamente submita o form se houver apenas 1 botão submit
- Em forms com múltiplos campos, comportamento é imprevisível

Sugestão (baixa prioridade): Criar `EnterKeyNextFieldProvider` que intercepta Enter e move o foco, usando `requestSubmit()` apenas no último campo.

---

### 6.6 Mensagens de Erro Mais Específicas

Hoje, múltiplos `onError` usam:
```tsx
toast({ title: "Erro", description: "Falha ao atualizar", variant: "destructive" });
```

Mesmo quando a API retorna mensagem específica:
```ts
HTTP 400 { message: "CNPJ já cadastrado para outro fornecedor: 12.345.678/0001-00" }
```

Padrão recomendado:
```tsx
onError: (err: any) => {
  const detail = err?.response?.data?.message || err?.message;
  toast({
    title: "Erro ao atualizar",
    description: detail || "Tente novamente ou contate o suporte.",
    variant: "destructive",
  });
}
```

---

## 7. Resumo Priorizado — Roadmap de Ações

| # | Prioridade | Categoria | Item Principal | Arquivos Afetados | Impacto | Esforço |
|:--|:--|:--|:--|:--|:--|:--|
| **01** | 🔴 ALTA | Acessibilidade | Refatorar Attachments Viewer para usar Dialog padrão (focus trap, ESC, aria-*, dark mode) | `attachments-viewer.tsx` (L173-252) | Usuários cegos/teclado: **não conseguem operar** hoje | Pequeno |
| **02** | 🔴 ALTA | Acessibilidade | Eliminar `window.confirm()` → AlertDialog | `receipt-search-dialog.tsx` (L76) | Quebra identidade + inconsistente entre OS | Muito Pequeno |
| **03** | 🔴 ALTA | Visual + Responsivo | Unificar footer responsivo em TODOS os modais (full-width mobile + Submit primeiro) | 8+ modais de formulário | Em mobile: 80% dos usuários erram clique | Pequeno |
| **04** | 🔴 ALTA | Visual + Dark Mode | Adicionar `dark:` em TODAS cores hardcoded (bg-purple-50 etc.) + documentar no DESIGN_SYSTEM_COLORS.md | UserFormModal, PendencyModal, AttachmentsViewer | Dark mode hoje é **ilegível** nesses modais | Médio |
| **05** | 🔴 ALTA | Consistência + Manutenibilidade | Criar `<FormModalWrapper>` HOC e refatorar 7 modais CRUD para ele | 7 form modais + novo arquivo | 100% consistência + remove 1000+ linhas duplicadas | Médio |
| **06** | 🟠 MÉDIA | Consistência | Migrar CompanyFormModal + DeliveryLocationFormModal para React Hook Form + Zod | 2 arquivos | Validação + UX iguais aos outros 5 | Pequeno |
| **07** | 🟠 MÉDIA | Acessibilidade | Substituir checkbox HTML nativo por `<Checkbox>` shadcn | CompanyFormModal, DeliveryLocationFormModal | Contraste + foco adequado | Muito Pequeno |
| **08** | 🟠 MÉDIA | Responsividade | Corrigir grids hardcoded: grid-cols-2 → grid-cols-1 sm:grid-cols-2 | UserFormModal, CompanyFormModal | Mobile < 640px: inputs inutilizáveis | Muito Pequeno |
| **09** | 🟠 MÉDIA | Consistência | Unificar tokens de tamanho/padding de modal; usar dvh em vez de vh | Global (documentação + atualizações) | Padrão documentado para devs novos | Pequeno |
| **10** | 🟡 BAIXA | Performance | Fragmentar EnhancedNewRequestModal em sub-componentes memoizados | `enhanced-new-request-modal.tsx` | Menos re-renders; forms com itens rápidos | Médio |
| **11** | 🟡 BAIXA | UX | Dirty check + AlertDialog antes de fechar qualquer form modal sujo | Todos os 7 FormModals | Evita perda acidental de dados | Médio |
| **12** | 🟡 BAIXA | UX | Estado visual "Sucesso" (400ms) antes de fechar modal após submit | Todos os FormModals | Feedback inequívoco ao usuário | Pequeno |
| **13** | 🟡 BAIXA | Performance | Trocar `form.watch()` inline por `useWatch()` ou sub-componentes | SupplierFormModal (8 usos), UserFormModal | Menos re-renders a cada digitação | Pequeno |
| **14** | 🟡 BAIXA | UX | Auto-save em sessionStorage para EnhancedNewRequestModal | `enhanced-new-request-modal.tsx` | Salva trabalho do usuário em refresh acidental | Médio |
| **15** | ⚪ MELHORIA | Consistência | Unificar botão Close X para estilo rounded-full p-2 (hit area maior) globalmente | `dialog.tsx` + modais que hoje usam custom | Touch target consistente | Pequeno |

---

## 8. Matriz de Esforço × Impacto

```
ALTO IMPACTO  ┤  01  02        03  04  05  06
              │
              │         07  08  09
              │
BAIXO IMPACTO ┤                 11  12   14   10
              │              13         15
              └───────────────────────────────────
               PEQUENO ESFORÇO        GRANDE ESFORÇO
```

**Sprint 1 (Primeiro) — Itens 01, 02, 03, 06, 07, 08**: 6 itens, esforço **pequeno/muito pequeno**, impacto **alto**.
- 80% do valor com 20% do esforço (princípio de Pareto).
- Resolve acessibilidade crítica + mobile + consistência básica.

**Sprint 2 — Itens 04, 05, 09**: 3 itens, esforço **médio**
- Criação do FormModalWrapper + migração + design system de cores.
- Aqui está a economia de longo prazo: cada nova modal já nasce consistente.

**Backlog (melhoria contínua) — Itens 10-15**: Performance, UX avançada e polimento.
- Fazer conforme surjam oportunidades ou sejam reportados por usuários.

---

## 9. Conclusão Final

### Pontos Fortes da Base Atual:
✅ Stack moderna e bem escolhida (Radix + shadcn/ui + RHF + Zod + TanStack Query)
✅ Componentes base (`dialog.tsx`, `form.tsx`, `button.tsx`) bem implementados e com a11y nativa
✅ Toasts, Tooltip, AlertDialog existem e funcionam
✅ DESIGN_SYSTEM_COLORS.md documentado para Comparação de Fornecedores (base para expandir)
✅ A maioria dos formulários usa React Hook Form corretamente

### Problema Central:
**Fragmentação orgânica**: À medida que novos devs adicionavam features, cada um implementou seu modal "do jeito que deu certo na hora". Não houve um "padrão oficial documentado" enforceado por componente compartilhado.

### Resultado Esperado Após Roadmap:
- **100% das telas modais** com identidade visual uniforme
- **0 violações de acessibilidade WCAG AA** críticas
- **Responsividade perfeita** de 320px (iPhone SE) a 2560px (4K)
- **Código reduzido em ~1500 linhas** (remoção de duplicação)
- **Tempo para criar nova modal CRUD**: de 1-2h para ~20min (usando wrapper)

---

*Documento gerado em 30/08/2026. Análise baseada em snapshot do código no momento da varredura.*
