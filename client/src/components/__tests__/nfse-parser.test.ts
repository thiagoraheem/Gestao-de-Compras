declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
import { parseNFSeXml } from "../../../../server/services/nfse-parser";

jest.mock("fast-xml-parser", () => {
  return {
    XMLParser: class {
      parse(xml: string) {
        if (!xml.includes("<InfNfse")) {
          return {};
        }
        return {
          ConsultarLoteRpsResposta: {
            ListaNfse: {
              CompNfse: {
                Nfse: {
                  InfNfse: {
                    Numero: "12738",
                    CodigoVerificacao: "ABCD-1234",
                    DataEmissao: "2025-12-01T12:58:26",
                    IdentificacaoRps: { Numero: "6585", Serie: "2", Tipo: "1" },
                    Competencia: "2025-12-01",
                    Servico: {
                      Valores: {
                        ValorServicos: "346.00",
                        ValorDeducoes: "0.00",
                        ValorPis: "0.00",
                        ValorCofins: "0.00",
                        ValorIss: "0.00",
                      },
                      Discriminacao: "Monitoramento de alarme",
                    },
                    PrestadorServico: {
                      IdentificacaoPrestador: { Cnpj: "12345678000199" },
                      RazaoSocial: "BBM SERVICOS LTDA",
                    },
                    TomadorServico: {
                      IdentificacaoTomador: { CpfCnpj: { Cnpj: "19537752003482" } },
                      RazaoSocial: "ORGUEL INDUSTRIA S/A",
                    },
                  },
                },
              },
            },
          },
        };
      }
    },
  };
}, { virtual: true });

describe("NFS-e XML parser", () => {
  it("extrai campos principais de NFS-e", () => {
    const xml = "<InfNfse>mock</InfNfse>";
    const result = parseNFSeXml(xml);

    expect(result.header.documentNumber).toBe("12738");
    expect(result.header.documentSeries).toBe("2");
    expect(result.header.documentKey).toBe("ABCD-1234");
    expect(result.header.totals?.vNF).toBe("346.00");
    expect(result.header.supplier?.cnpjCpf).toBe("12345678000199");
    expect(result.header.recipient?.cnpjCpf).toBe("19537752003482");

    expect(result.items.length).toBe(1);
    expect(result.items[0].description).toBe("Monitoramento de alarme");
    expect(result.items[0].totalPrice).toBe("346.00");
  });

  it("lança erro para XML inválido", () => {
    expect(() => parseNFSeXml("<xml>invalido</xml>")).toThrow();
  });
});
