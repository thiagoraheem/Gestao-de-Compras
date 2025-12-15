export type ReceiptType = "produto" | "servico" | "avulso";

export function shouldShowAvulsaFields(receiptType: ReceiptType): boolean {
  return receiptType === "avulso";
}

export function areManualAvulsaFieldsFilled(fields: {
  manualNFNumber?: string;
  manualNFSeries?: string;
  manualNFIssueDate?: string;
  manualNFEntryDate?: string;
  manualTotal?: string;
}): boolean {
  const required = [
    fields.manualNFNumber,
    fields.manualNFSeries,
    fields.manualNFIssueDate,
    fields.manualNFEntryDate,
    fields.manualTotal,
  ];
  return required.every((v) => !!v && String(v).trim() !== "");
}

export function getXmlNextTab(
  receiptType: ReceiptType,
  manualFilled: boolean,
): "financeiro" | null {
  if (receiptType === "avulso") {
    return manualFilled ? "financeiro" : null;
  }
  return "financeiro";
}

export function getXmlNextValidationError(
  receiptType: ReceiptType,
  manualFilled: boolean,
  hasAnyQty: boolean,
  hasXmlPreview: boolean,
): string | null {
  if (receiptType === "avulso") {
    return manualFilled
      ? null
      : "Preencha Número, Série, Emissão, Entrada e Valor Total da NF Avulsa";
  }
  if (!hasAnyQty && !hasXmlPreview) {
    return "Informe quantidades recebidas ou importe o XML da NF";
  }
  return null;
}

