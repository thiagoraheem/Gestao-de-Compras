export const PURCHASE_PHASES = {
  SOLICITACAO: 'solicitacao',
  APROVACAO_A1: 'aprovacao_a1',
  COTACAO: 'cotacao',
  APROVACAO_A2: 'aprovacao_a2',
  PEDIDO_COMPRA: 'pedido_compra',
  CONCLUSAO_COMPRA: 'conclusao_compra',
  RECEBIMENTO: 'recebimento',
  ARQUIVADO: 'arquivado',
} as const;

export const PHASE_LABELS = {
  [PURCHASE_PHASES.SOLICITACAO]: 'Solicitação',
  [PURCHASE_PHASES.APROVACAO_A1]: 'Aprovação A1',
  [PURCHASE_PHASES.COTACAO]: 'Cotação (RFQ)',
  [PURCHASE_PHASES.APROVACAO_A2]: 'Aprovação A2',
  [PURCHASE_PHASES.PEDIDO_COMPRA]: 'Pedido de Compra',
  [PURCHASE_PHASES.CONCLUSAO_COMPRA]: 'Conclusão',
  [PURCHASE_PHASES.RECEBIMENTO]: 'Recebimento',
  [PURCHASE_PHASES.ARQUIVADO]: 'Arquivado',
} as const;

export const PHASE_COLORS = {
  [PURCHASE_PHASES.SOLICITACAO]: 'hsl(207, 90%, 54%)',
  [PURCHASE_PHASES.APROVACAO_A1]: 'hsl(38, 92%, 50%)',
  [PURCHASE_PHASES.COTACAO]: 'hsl(263, 70%, 50%)',
  [PURCHASE_PHASES.APROVACAO_A2]: 'hsl(231, 48%, 48%)',
  [PURCHASE_PHASES.PEDIDO_COMPRA]: 'hsl(180, 25%, 25%)',
  [PURCHASE_PHASES.CONCLUSAO_COMPRA]: 'hsl(142, 71%, 45%)',
  [PURCHASE_PHASES.RECEBIMENTO]: 'hsl(152, 81%, 43%)',
  [PURCHASE_PHASES.ARQUIVADO]: 'hsl(210, 12%, 47%)',
} as const;

export const URGENCY_LEVELS = {
  BAIXO: 'baixo',
  MEDIO: 'medio',
  ALTO: 'alto',
} as const;

export const URGENCY_LABELS = {
  [URGENCY_LEVELS.BAIXO]: 'Baixo',
  [URGENCY_LEVELS.MEDIO]: 'Médio',
  [URGENCY_LEVELS.ALTO]: 'Alto',
} as const;

export const CATEGORY_OPTIONS = {
  PRODUTO: 'produto',
  SERVICO: 'servico',
  OUTROS: 'outros',
} as const;

export const CATEGORY_LABELS = {
  [CATEGORY_OPTIONS.PRODUTO]: 'Produto',
  [CATEGORY_OPTIONS.SERVICO]: 'Serviço',
  [CATEGORY_OPTIONS.OUTROS]: 'Outros',
} as const;

export type PurchasePhase = typeof PURCHASE_PHASES[keyof typeof PURCHASE_PHASES];
export type UrgencyLevel = typeof URGENCY_LEVELS[keyof typeof URGENCY_LEVELS];
export type CategoryOption = typeof CATEGORY_OPTIONS[keyof typeof CATEGORY_OPTIONS];
