export function isValidCnpj(value: string) {
  const cnpj = String(value || "").replace(/\D+/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (cnpj: string, pos: number) => {
    const factors = pos === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = factors.reduce((acc, f, i) => acc + Number(cnpj[i]) * f, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calc(cnpj, 12);
  const d2 = calc(cnpj, 13);
  return Number(cnpj[12]) === d1 && Number(cnpj[13]) === d2;
}

export function isValidAccessKey(value: string) {
  const key = String(value || "").replace(/\D+/g, "");
  return key.length === 44;
}

export function validateManualHeader(params: {
  number: string;
  series: string;
  accessKey?: string | null;
  issueDate: string;
  emitterCnpj: string;
  total: string;
  kind: "produto" | "servico" | "avulso";
}) {
  const errors: Record<string, string> = {};
  if (!String(params.number || "").trim()) errors.number = "Número do documento é obrigatório";
  if (!String(params.issueDate || "").trim()) errors.issueDate = "Data de emissão é obrigatória";
  if (!String(params.total || "").trim()) errors.total = "Valor total é obrigatório";
  
  // Validations specific to NF types (not Avulsa)
  if (params.kind !== "avulso") {
    if (!String(params.series || "").trim()) errors.series = "Série da NF é obrigatória";
    if (!String(params.emitterCnpj || "").trim() || !isValidCnpj(String(params.emitterCnpj || ""))) errors.emitterCnpj = "CNPJ do emitente inválido";
    
    if (params.kind === "produto") {
      if (!String(params.accessKey || "").trim() || !isValidAccessKey(String(params.accessKey || ""))) errors.accessKey = "Chave de acesso (44 dígitos) é obrigatória";
    }
  }

  // Common validations
  const totalVal = parseFloat(String(params.total || "0").replace(',', '.'));
  if (isNaN(totalVal) || totalVal <= 0) {
      errors.total = "Valor total deve ser maior que zero";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

export type ManualProductItem = { code?: string; description: string; ncm?: string; quantity: number; unit?: string; unitPrice: number };
export type ManualServiceItem = { serviceCode?: string; description: string; netValue: number; issValue?: number };

export function validateManualItems(kind: "produto" | "servico", items: Array<ManualProductItem | ManualServiceItem>) {
  const errors: Array<{ index: number; message: string }> = [];
  if (!Array.isArray(items) || items.length === 0) {
    return { isValid: false, errors: [{ index: -1, message: "Inclua pelo menos um item" }] };
  }
  items.forEach((it: any, idx: number) => {
    if (kind === "produto") {
      if (!String(it.description || "").trim()) errors.push({ index: idx, message: "Descrição é obrigatória" });
      if (it.quantity == null || Number(it.quantity) <= 0) errors.push({ index: idx, message: "Quantidade deve ser maior que zero" });
      if (it.unitPrice == null || Number(it.unitPrice) < 0) errors.push({ index: idx, message: "Valor unitário inválido" });
    } else {
      if (!String(it.description || "").trim()) errors.push({ index: idx, message: "Descrição é obrigatória" });
      if (it.netValue == null || Number(it.netValue) <= 0) errors.push({ index: idx, message: "Valor líquido deve ser maior que zero" });
      if (it.issValue != null && Number(it.issValue) < 0) errors.push({ index: idx, message: "ISS inválido" });
    }
  });
  return { isValid: errors.length === 0, errors };
}

export function parseMoney(value: string | number): number {
  if (typeof value === "number") return Number(value.toFixed(2));
  const s = String(value || "").trim();
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(norm);
  return Number((isNaN(n) ? 0 : n).toFixed(2));
}

export function computeItemsTotal(kind: "produto" | "servico", items: Array<ManualProductItem | ManualServiceItem>): number {
  if (!Array.isArray(items)) return 0;
  if (kind === "produto") {
    const sum = (items as ManualProductItem[]).reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
    return Number(sum.toFixed(2));
  }
  const sum = (items as ManualServiceItem[]).reduce((acc, it) => acc + Number(it.netValue || 0), 0);
  return Number(sum.toFixed(2));
}

export function validateTotalConsistency(total: string, kind: "produto" | "servico", items: Array<ManualProductItem | ManualServiceItem>) {
  const t = parseMoney(total);
  const si = computeItemsTotal(kind, items);
  const ok = Math.abs(t - si) < 0.01;
  return { isValid: ok, expected: si, provided: t };
}

export type PartyAddress = {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  cep?: string;
  country?: string;
};

export type EmitterData = {
  cnpj?: string;
  name?: string;
  fantasyName?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  address?: PartyAddress;
  phone?: string;
};

export type RecipientData = {
  cnpjCpf?: string;
  name?: string;
  ie?: string;
  email?: string;
  address?: PartyAddress;
  phone?: string;
};

export type TransportData = {
  modFrete?: string;
  transporter?: {
    cnpj?: string;
    name?: string;
    ie?: string;
    address?: string;
    city?: string;
    uf?: string;
  };
  volume?: {
    quantity?: number;
    specie?: string;
  };
};

export type ProductTaxes = {
  vBC?: number;
  pICMS?: number;
  vICMS?: number;
  ipi?: { vBC?: number; pIPI?: number; vIPI?: number };
  vTotTrib?: number;
  pis?: { cst?: string };
  cofins?: { cst?: string };
};

export type ServiceData = {
  itemListaServico?: string;
  codigoTributacaoMunicipio?: string;
  discriminacao?: string;
  codigoMunicipio?: string;
  valores?: {
    valorServicos?: number;
    valorDeducoes?: number;
    valorPis?: number;
    valorCofins?: number;
    valorInss?: number;
    valorIr?: number;
    valorCsll?: number;
    issRetido?: number;
    valorIss?: number;
    valorIssRetido?: number;
    baseCalculo?: number;
    aliquota?: number;
    valorLiquidoNfse?: number;
    descontoIncondicionado?: number;
    descontoCondicionado?: number;
  };
};

export function normalizeCnpjCpf(value: string): string {
  return String(value || "").replace(/\D+/g, "");
}

export function isValidCpf(value: string) {
  const cpf = normalizeCnpjCpf(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let total = 0;
    for (let i = 0; i < factor - 1; i++) total += Number(base[i]) * (factor - i);
    const dv = (total * 10) % 11;
    return dv === 10 ? 0 : dv;
  };
  const d1 = calc(cpf, 10);
  const d2 = calc(cpf, 11);
  return Number(cpf[9]) === d1 && Number(cpf[10]) === d2;
}

export function validateEmitter(emitter: EmitterData) {
  const errors: Record<string, string> = {};
  if (!emitter.cnpj || !isValidCnpj(emitter.cnpj)) errors.cnpj = "CNPJ do emitente inválido";
  if (!emitter.name?.trim()) errors.name = "Nome/Razão Social do emitente é obrigatório";
  if (!emitter.address?.city?.trim()) errors.city = "Cidade do emitente é obrigatória";
  if (!emitter.address?.uf?.trim()) errors.uf = "UF do emitente é obrigatória";
  if (!emitter.address?.cep?.trim()) errors.cep = "CEP do emitente é obrigatório";
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateRecipient(recipient: RecipientData) {
  const errors: Record<string, string> = {};
  const doc = recipient.cnpjCpf || "";
  const num = normalizeCnpjCpf(doc);
  const ok = num.length === 14 ? isValidCnpj(num) : isValidCpf(num);
  if (!ok) errors.cnpjCpf = "CPF/CNPJ do destinatário inválido";
  if (!recipient.name?.trim()) errors.name = "Nome/Razão Social do destinatário é obrigatório";
  if (!recipient.address?.city?.trim()) errors.city = "Cidade do destinatário é obrigatória";
  if (!recipient.address?.uf?.trim()) errors.uf = "UF do destinatário é obrigatória";
  if (!recipient.address?.cep?.trim()) errors.cep = "CEP do destinatário é obrigatório";
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateTransport(transport: TransportData) {
  const errors: Record<string, string> = {};
  if (transport.modFrete == null || String(transport.modFrete).trim() === "") errors.modFrete = "Modalidade de frete é obrigatória";
  if (transport.transporter?.cnpj && !isValidCnpj(transport.transporter.cnpj)) errors.transporterCnpj = "CNPJ do transportador inválido";
  if (transport.volume?.quantity != null && Number(transport.volume.quantity) < 0) errors.volumeQuantity = "Quantidade de volumes inválida";
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateProductTaxes(taxes: ProductTaxes) {
  const errors: Record<string, string> = {};
  if (taxes.vBC != null && taxes.vBC < 0) errors.vBC = "Base de cálculo ICMS inválida";
  if (taxes.pICMS != null && (taxes.pICMS < 0 || taxes.pICMS > 100)) errors.pICMS = "Alíquota ICMS inválida";
  if (taxes.vICMS != null && taxes.vICMS < 0) errors.vICMS = "Valor ICMS inválido";
  if (taxes.ipi?.vBC != null && taxes.ipi.vBC < 0) errors.ipiVBC = "Base de cálculo IPI inválida";
  if (taxes.ipi?.pIPI != null && (taxes.ipi.pIPI < 0 || taxes.ipi.pIPI > 100)) errors.ipiPI = "Alíquota IPI inválida";
  if (taxes.ipi?.vIPI != null && taxes.ipi.vIPI < 0) errors.ipiVI = "Valor IPI inválido";
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateServiceData(service: ServiceData) {
  const errors: Record<string, string> = {};
  if (!service.itemListaServico?.trim()) errors.itemListaServico = "Item da Lista de Serviço é obrigatório";
  if (!service.codigoTributacaoMunicipio?.trim()) errors.codigoTributacaoMunicipio = "Código de Tributação do Município é obrigatório";
  if (!service.discriminacao?.trim()) errors.discriminacao = "Discriminação do serviço é obrigatória";
  if (!service.codigoMunicipio?.trim()) errors.codigoMunicipio = "Código do Município é obrigatório";
  const v = service.valores || {};
  if (v.valorServicos == null || Number(v.valorServicos) <= 0) errors.valorServicos = "Valor dos serviços é obrigatório";
  if (v.aliquota != null && (Number(v.aliquota) < 0 || Number(v.aliquota) > 100)) errors.aliquota = "Alíquota inválida";
  if (v.valorIss != null && Number(v.valorIss) < 0) errors.valorIss = "Valor de ISS inválido";
  if (v.valorLiquidoNfse != null && Number(v.valorLiquidoNfse) < 0) errors.valorLiquidoNfse = "Valor líquido inválido";
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function computeIcms(vBC: number, pICMS: number) {
  return Number(((vBC || 0) * (pICMS || 0) / 100).toFixed(2));
}

export function computeIpi(vBC: number, pIPI: number) {
  return Number(((vBC || 0) * (pIPI || 0) / 100).toFixed(2));
}

export function computeIss(base: number, aliquota: number) {
  return Number(((base || 0) * (aliquota || 0) / 100).toFixed(2));
}
