import { PURCHASE_PHASES, RECEIPT_PHASES, type PurchasePhase } from "@/lib/types";

export function isFinalRequestPhase(phase: PurchasePhase) {
  return phase === PURCHASE_PHASES.PEDIDO_CONCLUIDO || phase === PURCHASE_PHASES.ARQUIVADO;
}

export function isFinalReceiptPhase(receiptPhase: string) {
  return receiptPhase === RECEIPT_PHASES.CONCLUIDO;
}

