import { shouldOpenRequestDetailsForReceipt } from "../receipt-navigation";
import { RECEIPT_PHASES } from "@/lib/types";

describe("receipt navigation", () => {
  test("returns true only for receipt phase 'concluido'", () => {
    expect(shouldOpenRequestDetailsForReceipt(RECEIPT_PHASES.CONCLUIDO)).toBe(true);
    expect(shouldOpenRequestDetailsForReceipt(RECEIPT_PHASES.RECEBIMENTO_FISICO)).toBe(false);
    expect(shouldOpenRequestDetailsForReceipt(RECEIPT_PHASES.CONF_FISCAL)).toBe(false);
    expect(shouldOpenRequestDetailsForReceipt("")).toBe(false);
    expect(shouldOpenRequestDetailsForReceipt("conf_fisica")).toBe(false);
  });
});

