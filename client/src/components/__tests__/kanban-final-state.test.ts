import { isFinalReceiptPhase, isFinalRequestPhase } from "../kanban-final-state";
import { PURCHASE_PHASES, RECEIPT_PHASES } from "@/lib/types";

describe("kanban final states", () => {
  test("isFinalRequestPhase is true only for Pedido concluído and Arquivado", () => {
    expect(isFinalRequestPhase(PURCHASE_PHASES.PEDIDO_CONCLUIDO)).toBe(true);
    expect(isFinalRequestPhase(PURCHASE_PHASES.ARQUIVADO)).toBe(true);
    expect(isFinalRequestPhase(PURCHASE_PHASES.PEDIDO_COMPRA)).toBe(false);
    expect(isFinalRequestPhase(PURCHASE_PHASES.COTACAO)).toBe(false);
  });

  test("isFinalReceiptPhase is true only for Conclusão", () => {
    expect(isFinalReceiptPhase(RECEIPT_PHASES.CONCLUIDO)).toBe(true);
    expect(isFinalReceiptPhase(RECEIPT_PHASES.CONF_FISCAL)).toBe(false);
    expect(isFinalReceiptPhase(RECEIPT_PHASES.RECEBIMENTO_FISICO)).toBe(false);
    expect(isFinalReceiptPhase("")).toBe(false);
  });
});

