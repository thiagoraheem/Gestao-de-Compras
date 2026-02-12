const { validateAllocationsAgainstLocador, formatReceiptApiError } = require("../../utils/locador-validation");

describe("validateAllocationsAgainstLocador", () => {
  const costCenters = [{ idCostCenter: 10 }, { idCostCenter: 20 }];
  const chartAccounts = [{ idChartOfAccounts: 100 }, { idChartOfAccounts: 200 }];

  it("returns valid when all ids exist in Locador sources", () => {
    const allocations = [
      { costCenterId: 10, chartOfAccountsId: 100 },
      { costCenterId: 20, chartOfAccountsId: 200 },
    ];
    const res = validateAllocationsAgainstLocador(allocations, costCenters, chartAccounts);
    expect(res.isValid).toBe(true);
    expect(res.invalidRows).toHaveLength(0);
    expect(res.sources.costCentersSource).toBe("locador");
    expect(res.sources.chartAccountsSource).toBe("locador");
  });

  it("detects invalid cost centers and chart accounts", () => {
    const allocations = [
      { costCenterId: 99, chartOfAccountsId: 100 },
      { costCenterId: 10, chartOfAccountsId: 999 },
    ];
    const res = validateAllocationsAgainstLocador(allocations, costCenters, chartAccounts);
    expect(res.isValid).toBe(false);
    expect(res.invalidRows).toHaveLength(2);
    expect(res.invalidRows[0].invalidCostCenter).toBe(99);
    expect(res.invalidRows[1].invalidChartAccount).toBe(999);
  });
});

describe("formatReceiptApiError", () => {
  it("keeps base message when there are no invalid rows", () => {
    const msg = formatReceiptApiError("Centro de Custo inválido ou não sincronizado", []);
    expect(msg).toBe("Centro de Custo inválido ou não sincronizado");
  });

  it("appends line indices for invalid cost centers and chart accounts", () => {
    const msg = formatReceiptApiError("Centro de Custo inválido ou não sincronizado", [
      { index: 0, invalidCostCenter: 99 },
      { index: 2, invalidChartAccount: 999 },
    ]);
    expect(msg).toContain("Centros de Custo inválidos nas linhas: 1");
    expect(msg).toContain("Planos de Contas inválidos nas linhas: 3");
  });
});
