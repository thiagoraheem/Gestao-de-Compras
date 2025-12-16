export type AllocationRow = { costCenterId?: number; chartOfAccountsId?: number; amount?: string; percentage?: string };

export function validateAllocationsAgainstLocador(
  allocations: AllocationRow[],
  costCenters: Array<{ id?: number; idCostCenter?: number }>,
  chartAccounts: Array<{ id?: number; idChartOfAccounts?: number }>
) {
  const ccIds = new Set<number>();
  const coaIds = new Set<number>();
  for (const cc of costCenters || []) {
    const id = Number(cc.idCostCenter ?? cc.id);
    if (Number.isFinite(id)) ccIds.add(id);
  }
  for (const ca of chartAccounts || []) {
    const id = Number(ca.idChartOfAccounts ?? ca.id);
    if (Number.isFinite(id)) coaIds.add(id);
  }
  const invalidRows: { index: number; invalidCostCenter?: number; invalidChartAccount?: number }[] = [];
  allocations.forEach((row, index) => {
    const ccId = Number(row.costCenterId ?? NaN);
    const caId = Number(row.chartOfAccountsId ?? NaN);
    const invalidCc = Number.isFinite(ccId) ? !ccIds.has(ccId) : true;
    const invalidCa = Number.isFinite(caId) ? !coaIds.has(caId) : true;
    if (invalidCc || invalidCa) {
      invalidRows.push({
        index,
        invalidCostCenter: invalidCc ? (Number.isFinite(ccId) ? ccId : undefined) : undefined,
        invalidChartAccount: invalidCa ? (Number.isFinite(caId) ? caId : undefined) : undefined,
      });
    }
  });
  return {
    isValid: invalidRows.length === 0,
    invalidRows,
    sources: {
      costCentersSource: "locador",
      chartAccountsSource: "locador",
      costCentersCount: ccIds.size,
      chartAccountsCount: coaIds.size,
    },
  };
}

export function formatReceiptApiError(
  apiMessage: string,
  invalidRows: { index: number; invalidCostCenter?: number; invalidChartAccount?: number }[]
) {
  const base = apiMessage || "Falha ao confirmar o recebimento";
  if (invalidRows.length === 0) return base;
  const parts: string[] = [base];
  const ccIssues = invalidRows.filter(r => r.invalidCostCenter !== undefined);
  const caIssues = invalidRows.filter(r => r.invalidChartAccount !== undefined);
  if (ccIssues.length > 0) {
    parts.push(`Centros de Custo inválidos nas linhas: ${ccIssues.map(r => r.index + 1).join(", ")}`);
  }
  if (caIssues.length > 0) {
    parts.push(`Planos de Contas inválidos nas linhas: ${caIssues.map(r => r.index + 1).join(", ")}`);
  }
  return parts.join(" — ");
}
