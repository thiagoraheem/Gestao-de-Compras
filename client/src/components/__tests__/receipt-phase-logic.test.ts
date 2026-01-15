declare const describe: any;
declare const test: any;
declare const expect: any;
import {
  shouldShowAvulsaFields,
  areManualAvulsaFieldsFilled,
  getXmlNextTab,
  getXmlNextValidationError,
  canConfirmReceipt,
  getInitialTabForMode
} from "../../components/receipt-phase-logic";

describe("receipt-phase-logic", () => {
  test("getInitialTabForMode behavior", () => {
    expect(getInitialTabForMode('physical')).toBe('items');
    expect(getInitialTabForMode('view')).toBe('items');
    expect(getInitialTabForMode(undefined)).toBe('items');
  });

  test("should show avulsa fields only when type is avulso", () => {
    expect(shouldShowAvulsaFields("avulso")).toBe(true);
    expect(shouldShowAvulsaFields("produto")).toBe(false);
    expect(shouldShowAvulsaFields("servico")).toBe(false);
  });

  test("manual avulsa fields filled validation", () => {
    expect(
      areManualAvulsaFieldsFilled({
        manualNFNumber: "1",
        manualNFSeries: "A",
        manualNFIssueDate: "2025-12-01",
        manualNFEntryDate: "2025-12-02",
        manualTotal: "100,00",
      }),
    ).toBe(true);
    expect(
      areManualAvulsaFieldsFilled({
        manualNFNumber: "",
        manualNFSeries: "A",
        manualNFIssueDate: "2025-12-01",
        manualNFEntryDate: "2025-12-02",
        manualTotal: "100,00",
      }),
    ).toBe(false);
  });

  test("next tab from XML for avulsa requires fields", () => {
    expect(getXmlNextTab("avulso", true)).toBe("financeiro");
    expect(getXmlNextTab("avulso", false)).toBeNull();
  });

  test("next validation error messages", () => {
    expect(
      getXmlNextValidationError("avulso", false, false, false),
    ).toBe("Preencha Número, Série, Emissão, Entrada e Valor Total da NF Avulsa");
    expect(getXmlNextValidationError("avulso", true, false, false)).toBeNull();
    expect(
      getXmlNextValidationError("produto", true, false, false),
    ).toBe("Informe quantidades recebidas ou importe o XML da NF");
    expect(getXmlNextValidationError("produto", true, true, false)).toBeNull();
  });

  test("canConfirmReceipt physical mode", () => {
    const baseParams = {
      receivedQuantities: {},
      typeCategoryError: "",
      isReceiverOnly: false,
      nfConfirmed: false,
      isFiscalValid: true,
      allocations: [],
      allocationsSumOk: true,
      receiptType: "produto" as const,
      activeTab: "items",
      manualNFNumber: "",
      manualNFSeries: "",
      manualNFAccessKey: "",
      manualNFIssueDate: "",
      manualNFEmitterCNPJ: "",
      manualTotal: "",
      manualItems: [],
      manualItemsMissingLinks: [],
      itemsWithPrices: [],
      xmlPreview: null
    };

    // Physical mode: No quantities -> false
    expect(canConfirmReceipt({
      ...baseParams,
      mode: 'physical',
      receivedQuantities: {}
    })).toBe(false);

    // Physical mode: With quantities -> true
    expect(canConfirmReceipt({
      ...baseParams,
      mode: 'physical',
      receivedQuantities: { 1: 5 }
    })).toBe(true);
  });
});
