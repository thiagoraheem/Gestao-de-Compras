const { validateManualHeader, validateManualItems, isValidCnpj, isValidAccessKey, validateTotalConsistency, computeItemsTotal, parseMoney } = require("../../utils/manual-nf-validation");

describe("manual NF header validation", () => {
  it("validates CNPJ and access key for produto", () => {
    const cnpj = "11.222.333/0001-81";
    const accessKey = "12345678901234567890123456789012345678901234";
    expect(isValidCnpj(cnpj)).toBe(true);
    expect(isValidAccessKey(accessKey)).toBe(true);
    const res = validateManualHeader({
      number: "123",
      series: "1",
      accessKey,
      issueDate: "2025-12-15",
      emitterCnpj: cnpj,
      total: "100,00",
      kind: "produto",
    });
    expect(res.isValid).toBe(true);
  });

  it("fails when required fields missing", () => {
    const res = validateManualHeader({
      number: "",
      series: "",
      accessKey: "",
      issueDate: "",
      emitterCnpj: "00.000.000/0000-00",
      total: "",
      kind: "produto",
    });
    expect(res.isValid).toBe(false);
    expect(res.errors.number).toBeTruthy();
    expect(res.errors.series).toBeTruthy();
    expect(res.errors.issueDate).toBeTruthy();
    expect(res.errors.emitterCnpj).toBeTruthy();
    expect(res.errors.total).toBeTruthy();
    expect(res.errors.accessKey).toBeTruthy();
  });

  it("does not require 44-digit access key for servico", () => {
    const res = validateManualHeader({
      number: "1",
      series: "A",
      accessKey: "",
      issueDate: "2025-12-15",
      emitterCnpj: "11.222.333/0001-81",
      total: "50,00",
      kind: "servico",
    });
    expect(res.isValid).toBe(true);
  });
});

describe("manual NF items validation", () => {
  it("requires at least one item", () => {
    const res = validateManualItems("produto", []);
    expect(res.isValid).toBe(false);
  });

  it("validates product items", () => {
    const res = validateManualItems("produto", [{ description: "Parafuso", quantity: 10, unitPrice: 1.5 }]);
    expect(res.isValid).toBe(true);
  });

  it("validates service items", () => {
    const res = validateManualItems("servico", [{ description: "Manutenção", netValue: 200, issValue: 20 }]);
    expect(res.isValid).toBe(true);
  });
});

describe("manual NF totals consistency", () => {
  it("computes items total for produto and validates consistency", () => {
    const items = [{ description: "Parafuso", quantity: 2, unitPrice: 10 }];
    const total = computeItemsTotal("produto", items);
    const check = validateTotalConsistency(String(total), "produto", items);
    expect(check.isValid).toBe(true);
    const bad = validateTotalConsistency("15,00", "produto", items);
    expect(bad.isValid).toBe(false);
  });
  it("computes items total for servico and validates consistency", () => {
    const items = [{ description: "Serviço", netValue: 200 }];
    const total = computeItemsTotal("servico", items);
    const check = validateTotalConsistency(String(total), "servico", items);
    expect(check.isValid).toBe(true);
  });
  it("parses currency strings", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("100,00")).toBe(100);
    expect(parseMoney(99.999)).toBe(100.00);
  });
});
