import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";

export type NFeParseResult = {
  header: {
    documentNumber?: string;
    documentSeries?: string;
    documentKey?: string;
    issueDate?: string;
    entryDate?: string;
    supplier?: { cnpjCpf?: string; name?: string };
    recipient?: { cnpjCpf?: string; name?: string };
    totals?: {
      vNF?: string;
      vProd?: string;
      vDesc?: string;
      vFrete?: string;
      vIPI?: string;
    };
  };
  items: Array<{
    lineNumber?: number;
    description?: string;
    unit?: string;
    quantity?: string;
    unitPrice?: string;
    totalPrice?: string;
    ncm?: string;
    cfop?: string;
    taxes?: {
      icmsRate?: string;
      icmsAmount?: string;
      ipiRate?: string;
      ipiAmount?: string;
      pisRate?: string;
      pisAmount?: string;
      cofinsRate?: string;
      cofinsAmount?: string;
    };
  }>;
  installments: Array<{ number?: string; dueDate?: string; amount?: string }>;
  xmlHash: string;
};

export function parseNFeXml(xmlContent: string): NFeParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    trimValues: true,
  });

  const json = parser.parse(xmlContent);

  // Handle different root possibilities: NFe, nfeProc
  const nfe = json?.NFe?.infNFe || json?.nfeProc?.NFe?.infNFe;
  if (!nfe) {
    throw new Error("XML não é um layout reconhecido de NF-e");
  }

  const ide = nfe.ide || {};
  const emit = nfe.emit || {};
  const dest = nfe.dest || {};
  const total = nfe.total?.ICMSTot || {};

  const header = {
    documentNumber: ide.nNF,
    documentSeries: ide.serie,
    documentKey: nfe["@Id"] ? String(nfe["@Id"]).replace("NFe", "") : json?.protNFe?.infProt?.chNFe,
    issueDate: ide.dhEmi || ide.dEmi,
    entryDate: ide.dhSaiEnt || ide.dSaiEnt,
    supplier: { cnpjCpf: emit.CNPJ || emit.CPF, name: emit.xNome },
    recipient: { cnpjCpf: dest.CNPJ || dest.CPF, name: dest.xNome },
    totals: {
      vNF: total.vNF,
      vProd: total.vProd,
      vDesc: total.vDesc,
      vFrete: total.vFrete,
      vIPI: total.vIPI,
    },
  };

  const detArray = Array.isArray(nfe.det) ? nfe.det : nfe.det ? [nfe.det] : [];
  const items = detArray.map((det: any) => {
    const prod = det.prod || {};
    const imposto = det.imposto || {};

    const ipi = imposto.IPI?.IPITrib || {};
    const pis = imposto.PIS?.PISAliq || {};
    const cofins = imposto.COFINS?.COFINSAliq || {};
    const icms: any = imposto.ICMS && typeof imposto.ICMS === "object" ? (Object.values(imposto.ICMS)[0] as any) || {} : {};

    return {
      lineNumber: Number(det["@nItem"]) || undefined,
      description: prod.xProd,
      unit: prod.uCom,
      quantity: prod.qCom,
      unitPrice: prod.vUnCom,
      totalPrice: prod.vProd,
      ncm: prod.NCM,
      cfop: prod.CFOP,
      taxes: {
        icmsRate: icms.pICMS,
        icmsAmount: icms.vICMS,
        ipiRate: ipi.pIPI,
        ipiAmount: ipi.vIPI,
        pisRate: pis.PISAliq ? pis.pPIS : pis.pPIS,
        pisAmount: pis.vPIS,
        cofinsRate: cofins.pCOFINS,
        cofinsAmount: cofins.vCOFINS,
      },
    };
  });

  const installments: Array<{ number?: string; dueDate?: string; amount?: string }> = [];
  const cobr = nfe.cobr || {};
  const dupArray = Array.isArray(cobr.dup) ? cobr.dup : cobr.dup ? [cobr.dup] : [];
  for (const dup of dupArray) {
    installments.push({ number: dup.nDup, dueDate: dup.dVenc, amount: dup.vDup });
  }
  const pag = nfe.pag || {};
  const detPagArray = Array.isArray(pag.detPag) ? pag.detPag : pag.detPag ? [pag.detPag] : [];
  for (const det of detPagArray) {
    installments.push({ number: det.nDup || det.tPag, dueDate: det.dVenc, amount: det.vPag });
  }

  const xmlHash = crypto.createHash("sha256").update(xmlContent).digest("hex");

  return { header, items, installments, xmlHash };
}
