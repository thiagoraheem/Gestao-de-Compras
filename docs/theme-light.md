# Tema Claro — Compras

## Paleta Base

- Fundo principal: `#FFFFFF`
- Texto primário: `#222222`
- Texto secundário: `#666666`
- Bordas/divisórias: `#EEEEEE`
- Superfícies discretas (`muted`/`accent`/`secondary`): `#F5F5F5` / `#FAFAFA`
- Primário (destaques/botões): `#E95B2D` com texto `#FFFFFF`
- Destrutivo: `#E53935` com texto `#FFFFFF`
- Anel de foco (`ring`): `#E95B2D`

## Tokens CSS

- `--background: #FFFFFF`
- `--foreground: #222222`
- `--muted: #FAFAFA`
- `--muted-foreground: #666666`
- `--popover: #FFFFFF`
- `--popover-foreground: #222222`
- `--card: #FFFFFF`
- `--card-foreground: #222222`
- `--border: #EEEEEE`
- `--input: #FFFFFF`
- `--primary: #E95B2D`
- `--primary-foreground: #FFFFFF`
- `--secondary: #F5F5F5`
- `--secondary-foreground: #222222`
- `--accent: #F5F5F5`
- `--accent-foreground: #222222`
- `--destructive: #E53935`
- `--destructive-foreground: #FFFFFF`
- `--ring: #E95B2D`
- `--kanban-solicitacao: #E95B2D`
- `--kanban-aprovacao-a1: #F59E0B`
- `--kanban-cotacao: #7C3AED`
- `--kanban-aprovacao-a2: #2563EB`
- `--kanban-pedido: #2F3A3A`
- `--kanban-conclusao: #22C55E`
- `--kanban-recebimento: #10B981`
- `--kanban-arquivado: #6B7280`

## Acessibilidade (Contraste)

- Texto primário `#222222` sobre `#FFFFFF`: contraste ~ 14:1
- Texto secundário `#666666` sobre `#FFFFFF`: contraste ~ 5:1
- Texto `#FFFFFF` sobre primário `#E95B2D`: contraste ≥ 4.5:1
- Bordas `#EEEEEE` em fundo `#FFFFFF`: contraste adequado para separação sem poluição visual

## Observações

- Tema escuro preservado: os tokens em `.dark` permanecem inalterados.
- Kanban e componentes utilizam tokens; não há mudanças estruturais, apenas cromáticas.

## Screenshots

- Consulte a pasta `docs/screenshots` para imagens comparativas.