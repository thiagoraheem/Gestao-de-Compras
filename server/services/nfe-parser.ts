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
    transp?: {
      modFrete?: string;
      carrierCnpj?: string;
      carrierName?: string;
      volumeQuantity?: string;
      species?: string;
    };
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
  const transp = nfe.transp || {};
  const transporta = transp.transporta || {};
  const vol = Array.isArray(transp.vol) ? transp.vol[0] : (transp.vol || {});
  const total = nfe.total?.ICMSTot || {};

  const header = {
    documentNumber: ide.nNF,
    documentSeries: ide.serie,
    documentKey: nfe["@Id"] ? String(nfe["@Id"]).replace("NFe", "") : json?.protNFe?.infProt?.chNFe,
    issueDate: ide.dhEmi || ide.dEmi,
    entryDate: ide.dhSaiEnt || ide.dSaiEnt,
    supplier: {
      cnpjCpf: emit.CNPJ || emit.CPF,
      name: emit.xNome,
      fantasyName: emit.xFant,
      ie: emit.IE,
      im: emit.IM,
      address: {
        street: emit.enderEmit?.xLgr,
        number: emit.enderEmit?.nro,
        neighborhood: emit.enderEmit?.xBairro,
        city: emit.enderEmit?.xMun,
        uf: emit.enderEmit?.UF,
        cep: emit.enderEmit?.CEP,
        country: emit.enderEmit?.xPais,
        phone: emit.enderEmit?.fone,
      },
    },
    recipient: {
      cnpjCpf: dest.CNPJ || dest.CPF,
      name: dest.xNome,
      ie: dest.IE,
      email: dest.email,
      address: {
        street: dest.enderDest?.xLgr,
        number: dest.enderDest?.nro,
        neighborhood: dest.enderDest?.xBairro,
        city: dest.enderDest?.xMun,
        uf: dest.enderDest?.UF,
        cep: dest.enderDest?.CEP,
        country: dest.enderDest?.xPais,
        phone: dest.enderDest?.fone,
      },
    },
    transp: {
      modFrete: transp.modFrete,
      carrierCnpj: transporta.CNPJ || transporta.CPF,
      carrierName: transporta.xNome,
      volumeQuantity: vol.qVol,
      species: vol.esp,
    },
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
