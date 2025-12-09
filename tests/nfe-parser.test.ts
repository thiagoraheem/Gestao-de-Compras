import { parseNFeXml } from "../server/services/nfe-parser";

jest.mock("fast-xml-parser", () => {
  return {
    XMLParser: class {
      parse(xml: string) {
        if (!xml.includes("<nfeProc") && !xml.includes("<NFe")) {
          return {};
        }
        return {
          nfeProc: {
            NFe: {
              infNFe: {
                "@Id": "NFe35251112345678900011550010001234567890123456",
                ide: { nNF: "12345", serie: "1", dhEmi: "2025-11-10T10:30:00-03:00" },
                emit: { CNPJ: "12345678000199", xNome: "Fornecedor Exemplo SA" },
                dest: { CNPJ: "99887766000155", xNome: "Empresa Destinatária" },
                det: [
                  {
                    "@nItem": "1",
                    prod: {
                      xProd: "Cimento CP-II 50kg",
                      NCM: "25232910",
                      CFOP: "1556",
                      uCom: "SC",
                      qCom: "50.0000",
                      vUnCom: "39.600000",
                      vProd: "1980.00",
                    },
                    imposto: {
                      ICMS: { ICMS00: { pICMS: "18.00", vICMS: "356.40" } },
                      IPI: { IPITrib: { pIPI: "5.00", vIPI: "99.00" } },
                      PIS: { PISAliq: { pPIS: "1.65", vPIS: "32.67" } },
                      COFINS: { COFINSAliq: { pCOFINS: "7.60", vCOFINS: "150.48" } },
                    },
                  },
                ],
                total: { ICMSTot: { vNF: "2079.00", vProd: "1980.00", vIPI: "99.00" } },
                cobr: {
                  dup: [
                    { nDup: "1", dVenc: "2025-12-10", vDup: "1039.50" },
                    { nDup: "2", dVenc: "2026-01-10", vDup: "1039.50" },
                  ],
                },
              },
            },
          },
          protNFe: { infProt: { chNFe: "35251112345678900011550010001234567890123456" } },
        };
      }
    },
  };
}, { virtual: true });

describe("NF-e XML parser", () => {
  it("extrai cabeçalho, itens e parcelas do XML", () => {
    const xml = "<nfeProc>mock</nfeProc>";
    const result = parseNFeXml(xml);

    expect(result.header.documentNumber).toBe("12345");
    expect(result.header.documentSeries).toBe("1");
    expect(result.header.documentKey).toBe("35251112345678900011550010001234567890123456");
    expect(result.header.totals?.vNF).toBe("2079.00");

    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.description).toBe("Cimento CP-II 50kg");
    expect(item.ncm).toBe("25232910");
    expect(item.cfop).toBe("1556");
    expect(item.taxes?.icmsRate).toBe("18.00");
    expect(item.taxes?.ipiRate).toBe("5.00");

    expect(result.installments.length).toBe(2);
    expect(result.installments[0].amount).toBe("1039.50");
  });

  it("lança erro para XML inválido", () => {
    expect(() => parseNFeXml("<xml>invalido</xml>")).toThrow();
  });
});

