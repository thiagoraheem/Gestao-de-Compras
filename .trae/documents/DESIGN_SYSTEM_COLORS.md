# Design System - Cores e Acessibilidade

Este documento detalha as cores utilizadas na aplicação, especificamente no módulo de Comparação de Fornecedores, garantindo conformidade com os requisitos de acessibilidade e suporte a temas (Claro/Escuro).

## Paleta de Cores e Variáveis CSS

A aplicação utiliza variáveis CSS para facilitar a adaptação aos temas.

### Variáveis Globais (Base)

| Variável | Tema Claro (Hex) | Tema Escuro (Hex/HSL) | Uso Recomendado |
| :--- | :--- | :--- | :--- |
| `--background` | `#FFFFFF` | `hsl(217, 28%, 8%)` | Fundo principal da página |
| `--foreground` | `#222222` | `hsl(220, 9%, 92%)` | Texto principal |
| `--muted` | `#FAFAFA` | `hsl(217, 24%, 21%)` | Fundo de elementos secundários |
| `--muted-foreground` | `#666666` | `hsl(220, 9%, 65%)` | Texto secundário/de apoio |
| `--card` | `#FFFFFF` | `hsl(217, 32%, 13%)` | Fundo de cartões/cards |
| `--border` | `#EEEEEE` | `hsl(217, 24%, 21%)` | Bordas sutis |
| `--primary` | `#E95B2D` | `hsl(16, 100%, 66%)` | Ações principais, destaques |
| `--destructive` | `#E53935` | `hsl(0, 84%, 60%)` | Erros, ações destrutivas |

### Cores Específicas para Status (Comparação de Fornecedores)

Para garantir contraste adequado (mínimo 4.5:1) em ambos os temas, utilizamos classes utilitárias do Tailwind com modificadores `dark:`.

#### Sucesso / Melhor Valor / Vencedor
- **Claro**: `text-green-700` / `text-green-800`
- **Escuro**: `dark:text-green-400` / `dark:text-green-300`
- **Fundo**: `bg-green-50` / `dark:bg-green-900/20`
- **Borda**: `border-green-300` / `dark:border-green-800`

#### Alerta / Atenção / Desconto
- **Claro**: `text-orange-600` / `text-orange-800`
- **Escuro**: `dark:text-orange-400` / `dark:text-orange-200`
- **Fundo**: `bg-orange-50` / `dark:bg-orange-950/20`
- **Borda**: `border-orange-200` / `dark:border-orange-900`

#### Erro / Indisponível
- **Claro**: `text-red-600`
- **Escuro**: `dark:text-red-400`
- **Fundo**: `bg-red-50` / `dark:bg-red-900/20`

#### Informação / Prazo
- **Claro**: `text-blue-600`
- **Escuro**: `dark:text-blue-400`

#### Neutro / Não Cotado
- **Geral**: `text-muted-foreground` (Adaptação automática)

## Diretrizes de Acessibilidade

1.  **Contraste de Texto**: Todo texto normal deve ter uma taxa de contraste de pelo menos 4.5:1 em relação ao fundo. Texto grande (bold 14pt+ ou regular 18pt+) deve ter 3:1.
    *   *Solução*: No tema escuro, evite usar cores `500` ou `600` para texto fino; prefira `400` ou `300` para garantir legibilidade sobre fundos escuros.

2.  **Transições de Tema**:
    *   Utilizar `transition-colors duration-200` em elementos interativos e containers principais para evitar flashes bruscos durante a troca de tema.

3.  **Indicadores Visuais**:
    *   Não dependa apenas da cor para transmitir informação. Use ícones (ex: `XCircle` para indisponível, `Badge` para melhor valor) e texto descritivo.

## Combinações Aprovadas

| Contexto | Tema Claro | Tema Escuro |
| :--- | :--- | :--- |
| **Card de Indisponível** | Bg: `orange-50`<br>Border: `orange-200`<br>Text: `orange-800` | Bg: `orange-950/20`<br>Border: `orange-900`<br>Text: `orange-200` |
| **Item Selecionado** | Bg: `white`<br>Border: `border` | Bg: `card`<br>Border: `border` |
| **Badge de Melhor Preço** | Bg: `green-100`<br>Text: `green-800` | Bg: `green-900/40`<br>Text: `green-300` |
