import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";

export type NFSeParseResult = {
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
      vDesc?: string;
      vPIS?: string;
      vCOFINS?: string;
      vISS?: string;
    };
  };
  items: Array<{
    lineNumber?: number;
    description?: string;
    unit?: string;
    quantity?: string;
    unitPrice?: string;
    totalPrice?: string;
    taxes?: {
      issAmount?: string;
      pisAmount?: string;
      cofinsAmount?: string;
    };
  }>;
  installments: Array<{ number?: string; dueDate?: string; amount?: string }>;
  xmlHash: string;
};

function findNode(obj: any, keyName: string): any | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, keyName)) return obj[keyName];
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    const found = findNode(v, keyName);
    if (found) return found;
  }
  return undefined;
}

export function parseNFSeXml(xmlContent: string): NFSeParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    trimValues: true,
  });

  const json = parser.parse(xmlContent);

  const inf = findNode(json, "InfNfse");
  if (!inf) {
    throw new Error("XML não é um layout reconhecido de NFS-e");
  }

  const servico = inf.Servico || {};
  const valores = servico.Valores || {};

  const prestador = inf.PrestadorServico || {};
  const prestId = prestador.IdentificacaoPrestador || {};
  const tomador = inf.TomadorServico || {};
  const tomId = tomador.IdentificacaoTomador || {};
  const tomCpfCnpj = tomId.CpfCnpj || {};

  const totalServicos = valores.ValorServicos;
  const desconto = valores.ValorDeducoes;

  const header = {
    documentNumber: inf.Numero,
    documentSeries: inf.IdentificacaoRps?.Serie,
    documentKey: inf.CodigoVerificacao,
    issueDate: inf.DataEmissao,
    entryDate: inf.Competencia,
    supplier: {
      cnpjCpf: prestId.Cnpj || prestId.Cpf,
      name: prestador.RazaoSocial,
    },
    recipient: {
      cnpjCpf: tomCpfCnpj.Cnpj || tomCpfCnpj.Cpf,
      name: tomador.RazaoSocial,
    },
    totals: {
      vNF: totalServicos,
      vDesc: desconto,
      vPIS: valores.ValorPis,
      vCOFINS: valores.ValorCofins,
      vISS: valores.ValorIss,
    },
  };

  const description =
    servico.Discriminacao ||
    inf.OutrasInformacoes ||
    "Serviço prestado";

  const items = [
    {
      lineNumber: 1,
      description,
      unit: "SV",
      quantity: "1",
      unitPrice: totalServicos,
      totalPrice: totalServicos,
      taxes: {
        issAmount: valores.ValorIss,
        pisAmount: valores.ValorPis,
        cofinsAmount: valores.ValorCofins,
      },
    },
  ];

  const installments: Array<{ number?: string; dueDate?: string; amount?: string }> = [];

  const xmlHash = crypto.createHash("sha256").update(xmlContent).digest("hex");

  return { header, items, installments, xmlHash };
}

