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

export function computeTabsVisibility(options: {
  fromKanban: boolean;
  activeTab: 'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items';
  mode?: 'view' | 'physical' | 'fiscal';
  forcedShow?: boolean;
}): boolean {
  if (options.activeTab === 'items') return false;
  if (options.forcedShow) return true;
  if (options.fromKanban) {
    return options.activeTab === 'xml' || options.activeTab === 'manual_nf' || options.activeTab === 'financeiro';
  }
  return options.mode !== 'physical';
}

export type ReceiptMode = 'view' | 'physical' | 'fiscal';

export function isFiscalModeActive(mode: ReceiptMode | undefined): boolean {
  return mode === 'fiscal';
}

export function isPhysicalModeActive(mode: ReceiptMode | undefined): boolean {
  return mode === 'physical';
}

export function getInitialTabForMode(mode: ReceiptMode | undefined): 'fiscal' | 'financeiro' | 'xml' | 'manual_nf' | 'items' {
  if (mode === 'physical') return 'items';
  if (mode === 'fiscal') return 'xml';
  return 'fiscal';
}

