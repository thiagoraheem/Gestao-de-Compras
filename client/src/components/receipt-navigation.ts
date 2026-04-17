import { RECEIPT_PHASES } from "@/lib/types";

export function shouldOpenRequestDetailsForReceipt(receiptPhase: string) {
  return receiptPhase === RECEIPT_PHASES.CONCLUIDO;
}

