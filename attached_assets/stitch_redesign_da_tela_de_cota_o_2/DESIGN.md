---
name: ProcureFlow Slate Dark
colors:
  surface: '#0d131f'
  surface-dim: '#0d131f'
  surface-bright: '#333947'
  surface-container-lowest: '#080e1a'
  surface-container-low: '#161c28'
  surface-container: '#1a202c'
  surface-container-high: '#242a37'
  surface-container-highest: '#2f3542'
  on-surface: '#dde2f4'
  on-surface-variant: '#e1bfb5'
  inverse-surface: '#dde2f4'
  inverse-on-surface: '#2b303e'
  outline: '#a98a80'
  outline-variant: '#594139'
  surface-tint: '#ffb59d'
  primary: '#ffb59d'
  on-primary: '#5d1900'
  primary-container: '#ff6b35'
  on-primary-container: '#5f1900'
  inverse-primary: '#ab3500'
  secondary: '#b4c5ff'
  on-secondary: '#002a78'
  secondary-container: '#0053db'
  on-secondary-container: '#cdd7ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00af79'
  on-tertiary-container: '#003a25'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59d'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#832600'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0d131f'
  on-background: '#dde2f4'
  surface-variant: '#2f3542'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.4rem
  body-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '600'
    lineHeight: 1.125rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.03em
  numeric-currency:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: 1.25rem
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets enterprise procurement teams, supply chain officers, and corporate B2B buyers who manage high-stakes financial operations across hundreds of line items simultaneously.

The visual direction combines **Corporate Modern** with a refined **Data-Dense Technical Dark** architecture:
- **Atmosphere:** Deep slate navy backdrops that eradicate eye fatigue during marathon quotation reviews, balanced with high-precision micro-contrasts.
- **Intentional Accents:** Safety-engineered vibrant orange accents draw immediate gaze towards primary calls-to-action and critical stages; vivid emerald greens lock focus on monetary totals, confirmed budgets, and positive availability statuses; technical cobalts guide operational routing.
- **Ergonomics:** Designed for high data density without feeling cluttered. Visual rhythm is maintained via razor-sharp hairline borders, segmented sub-panels, and monospace tabular figures that keep numerical data rigorously aligned.

## Colors

The palette establishes hierarchical depth through structured slate layers and semantic color accents:

### Surfaces & Foundations
- **Base Canvas:** `#0d131f` (Primary system background, deep slate obsidian)
- **Layer 1 Surface (Cards, Modals, Kanban Columns):** `#131b2e`
- **Layer 2 Surface (Input Fields, Nested Item Rows, Headers):** `#1a233a`
- **Surface Hover / Highlight:** `#212c48`
- **Structural Outlines & Dividers:** `#263352` (Hairline containment, soft slate stroke)
- **Muted Outlines:** `#1e293b`

### Accents & Semantics
- **Primary Brand (Action & Focus):** `#ff6b35` (Vibrant orange for RFQ actions, primary CTAs, and pending warnings). Secondary hover variant: `#ea580c`.
- **Secondary Corporate (Workflow & Secondary Tasks):** `#2563eb` with `#3b82f6` for secondary links, badge backdrops, and active step pills.
- **Financial & Success Positive:** `#10b981` (Emerald green dedicated to currency values, positive unit totals, active availability toggles, and approval confirmations).
- **Destructive & Urgent:** `#ef4444` (Critical alerts, rejection actions, missing delivery items).
- **Informative Status Neutral:** `#64748b` (Default icons, disabled tags).

### Typography Tones
- **High-Emphasis Text:** `#f8fafc` (Titles, monetary amounts, table headers)
- **Medium-Emphasis Text:** `#cbd5e1` (Input text, labels, secondary metadata)
- **Subdued / Hint Text:** `#64748b` (Placeholders, unit symbols, part numbers)

## Typography

Typography prioritizes tabular clarity and rapid scanning across dense rows of financial and technical items:
- **Font Family:** `Inter` is universally deployed for display, functional body copy, and micro-labels.
- **Tabular Figures:** All numeric displays (pricing, quantities, tax calculations, part numbers) must enable tabular lining (`font-feature-settings: "tnum" 1, "cv05" 1`) to guarantee perfect column alignment without spatial drifting.
- **Hierarchy Scale:** Font sizes remain deliberately compact (`0.6875rem` to `1rem`) for operational UI, keeping viewport height optimized for visible rows without scrolling. Headlines max out at `1.5rem` (`24px`) to preserve dense workspace layouts.

## Layout & Spacing

The layout is built for complex, multi-pane B2B workflows operating on a 12-column fluid grid:
- **Density Scaling:** A dense 8px/4px base grid ensures tight, spreadsheet-level packing of inputs without compromising hit targets.
- **Table Grids:** Quotation matrices utilize `gutter-dense` (8px) between micro-inputs (`Preço Unitário`, `Desconto %`, `Prazo`), allowing full-line calculations within standard laptop viewports.
- **Layout Model:** Fixed top enterprise command navigation (56px height) sits above flexible split workspaces. Modals utilize fixed 90–94vw width containers on desktop with internal scrolling and sticky summary footers.
- **Sticky Summary Regions:** Large financial modals or comparison views feature fixed persistent bottom toolbars or right-hand floating summary panels (`space-lg` internal padding) displaying net subtotals, tax withholdings, and primary confirmation buttons.

## Elevation & Depth

Visual hierarchy does not rely on ambient diffusion or high-blur drop shadows; instead, it is enforced through **tonal stratification and low-contrast borders**:

1. **Level 0 (Workspace Canvas):** `#0d131f` flat background.
2. **Level 1 (Card & Column Surfaces):** `#131b2e` with a crisp `1px solid #263352` outline. No drop shadows.
3. **Level 2 (Active Rows & Embedded Inputs):** `#1a233a` with inset micro-borders (`#263352`).
4. **Level 3 (Modals, Overlays, Dropdowns):** `#131b2e` surface accompanied by a subtle tinted edge (`1px solid #334366`) and deep ambient occlusion: `0 20px 40px -10px rgba(0, 0, 0, 0.75)`. Modals dim the background with a 65% opacity overlay of `#070a10` with a 4px backdrop blur.
5. **Level 4 (Floating Totals & Actions):** Sticky summary footers pin to viewport edges with a subtle top border `#263352` and an elevation shadow `0 -10px 24px rgba(0, 0, 0, 0.5)`.

## Shapes

The design system maintains a **Soft / Technical (Level 1)** geometric standard:
- **Base Components:** Inputs, buttons, and badges use `0.25rem` (4px) or `0.375rem` (6px) border-radii. This maximizes pixel efficiency inside dense grids and conveys industrial precision.
- **Containers & Modals:** Modals and large module wrappers use `rounded-lg` (`0.5rem` / 8px).
- **Badges & Micro Pills:** Status tags (`Pendente`, `Crítico`, `Aprovação`) maintain controlled `4px` corner radii or compact full pill styles (`rounded-full`) only when indicating circular state indicators.

## Components

### Buttons
- **Primary:** Vibrant orange background (`#ff6b35`), white bold text (`#ffffff`), `0.375rem` radius, subtle transition to `#ea580c`. Used strictly for irrevocable or primary submit actions (`Salvar Cotação`, `Nova Solicitação`).
- **Secondary Corporate:** Deep cobalt (`#2563eb`) hoverable to `#1d4ed8`, text `#ffffff`. For secondary actions (`Confirmar`, `Criar RFQ`).
- **Secondary Outlined:** Background transparent, border `1px solid #263352`, text `#cbd5e1`, hover background `#1a233a`.
- **Destructive Ghost:** Subtle text `#ef4444`, hover background `rgba(239, 68, 68, 0.1)`.

### Input Fields & Compact Table Inputs
- **Base Style:** Background `#1a233a`, hairline border `1px solid #263352`, text `#f8fafc`, typography `body-md` with tabular numerals.
- **Focus State:** Border transitions to `#ff6b35` or `#3b82f6` with an outer ring `0 0 0 2px rgba(255, 107, 53, 0.2)`.
- **Composite Inputs:** Paired currency/percentage boxes (e.g. Unit Price with embedded original price hint below, Discount inputs with adjacent `%` and `R$` segmented buttons) packaged into unified single-line widgets.

### Data Tables (Quotation Matrix)
- **Header:** Sticky row with `#131b2e` surface, uppercase `label-sm` text `#64748b`, subtle bottom divider `#263352`.
- **Item Row:** Interleaved or bordered rows (`#263352`). Item titles displayed in high-contrast `label-lg`, with SKU and demand specifications in `body-sm` `#64748b`.
- **Financial Outputs:** Auto-calculated subtotal and unit totals highlighted in `#10b981` (`numeric-currency`) for instantaneous fiscal verification.

### Checkboxes & Availability Toggles
- **Checkbox:** `16px x 16px`, rounded `3px`, border `#263352`, checked fill `#ff6b35` with bold white checkmark.
- **Availability Widget (`Disp.`):** Integrated checkbox labeled with high-visibility emerald or orange accents to signal immediate stock status.

### Status Chips & Priority Badges
- **Urgent / Critical:** Background `rgba(239, 68, 68, 0.15)`, text `#ef4444`, border `1px solid rgba(239, 68, 68, 0.3)`.
- **RFQ Active / Sent:** Background `rgba(37, 99, 235, 0.15)`, text `#60a5fa`, border `1px solid rgba(59, 130, 246, 0.3)`.
- **Pending:** Background `#1a233a`, text `#94a3b8`, border `1px solid #263352`.

### File Upload & Attachment Zone
- **Dropzone:** Dashed container (`2px dashed #263352`), background `rgba(26, 35, 58, 0.4)`, hover state brightening the stroke to `#ff6b35`. Micro-labels detailing allowed extensions (`PDF, DOC, XLS`) in `#64748b`.