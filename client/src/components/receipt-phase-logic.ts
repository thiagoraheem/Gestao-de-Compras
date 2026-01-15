import { validateManualHeader, validateManualItems } from "../utils/manual-nf-validation";

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
  activeTab: 'financeiro' | 'xml' | 'manual_nf' | 'items';
  mode?: 'view' | 'physical';
  forcedShow?: boolean;
}): boolean {
  if (options.activeTab === 'items') return false;
  if (options.forcedShow) return true;
  if (options.fromKanban) {
    return options.activeTab === 'xml' || options.activeTab === 'manual_nf' || options.activeTab === 'financeiro';
  }
  return options.mode !== 'physical';
}

export type ReceiptMode = 'view' | 'physical';

export function isPhysicalModeActive(mode: ReceiptMode | undefined): boolean {
  return mode === 'physical';
}

export function getInitialTabForMode(mode: ReceiptMode | undefined): 'financeiro' | 'xml' | 'manual_nf' | 'items' {
  if (mode === 'physical') return 'items';
  return 'items'; // Default to items for view mode as well
}

export function canConfirmReceipt(params: {
  mode?: ReceiptMode;
  receivedQuantities: Record<number, number>;
  typeCategoryError: string;
  isReceiverOnly: boolean;
  nfConfirmed: boolean;
  isFiscalValid: boolean;
  allocations: any[];
  allocationsSumOk: boolean;
  receiptType: ReceiptType;
  activeTab: string;
  manualNFNumber: string;
  manualNFSeries: string;
  manualNFAccessKey: string;
  manualNFIssueDate: string;
  manualNFEmitterCNPJ: string;
  manualTotal: string;
  manualItems: any[];
  manualItemsMissingLinks: number[];
  itemsWithPrices: any[];
  xmlPreview: any;
}): boolean {
  const {
    mode,
    receivedQuantities,
    typeCategoryError,
    isReceiverOnly,
    nfConfirmed,
    isFiscalValid,
    allocations,
    allocationsSumOk,
    receiptType,
    activeTab,
    manualNFNumber,
    manualNFSeries,
    manualNFAccessKey,
    manualNFIssueDate,
    manualNFEmitterCNPJ,
    manualTotal,
    manualItems,
    manualItemsMissingLinks,
    itemsWithPrices,
    xmlPreview
  } = params;

  if (mode === 'physical') {
    const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
    return hasAnyQty;
  }
  if (typeCategoryError) return false;
  if (!isFiscalValid) return false;
  if (allocations.length > 0 && !allocationsSumOk) return false;
  if (receiptType === "avulso" || activeTab === "manual_nf") {
    const header = validateManualHeader({
      number: manualNFNumber,
      series: manualNFSeries,
      accessKey: manualNFAccessKey,
      issueDate: manualNFIssueDate,
      emitterCnpj: manualNFEmitterCNPJ,
      total: manualTotal,
      kind: receiptType === "servico" ? "servico" : (receiptType === "avulso" ? "avulso" : "produto"),
    });
    if (!header.isValid) return false;
    const itemsOk = validateManualItems(receiptType === "servico" ? "servico" : "produto", manualItems as any).isValid;
    if (receiptType !== "avulso" && manualItemsMissingLinks.length > 0) return false;
    return itemsOk;
  }
  const invalids = Array.isArray(itemsWithPrices) ? itemsWithPrices.filter((it: any) => {
    const current = Number(receivedQuantities[it.id] || 0);
    const max = Number(it.quantity || 0);
    return current > max;
  }) : [];
  if (invalids.length > 0) return false;
  const hasAnyQty = Object.values(receivedQuantities).some(v => Number(v) > 0);
  if (!hasAnyQty && !xmlPreview) return false;
  return true;
}

