const { buildNFeXml, buildNFSeXml } = require("../../utils/xml-generation");

describe("xml-generation", () => {
  test("generates NF-e XML with emitter, recipient, items and totals", () => {
    const xml = buildNFeXml({
      accessKey: "31251219537752003482550010000750031327461407",
      number: "75003",
      series: "1",
      issueDate: "2025-12-04T11:53:00-03:00",
      entryDate: "2025-12-04T11:53:00-03:00",
      emitter: {
        cnpj: "19537752003482",
        name: "ORGUEL INDUSTRIA E LOCACAO DE EQUIPAMENTOS S/A",
        fantasyName: "BELO HORIZONTE",
        ie: "0622061071588",
        im: "0090144897",
        cnae: "7732201",
        crt: "3",
        address: { street: "RODOVIA MG-010", number: "SN", neighborhood: "ANGICOS", city: "VESPASIANO", uf: "MG", cep: "33206240", country: "BRASIL", phone: "3136294000" },
      },
      recipient: {
        cnpjCpf: "13844973000159",
        name: "BBM SERVICOS, ALUGUEL DE MAQUINAS E TECNOLOGIA LTDA",
        ie: "042351979",
        email: "nfe@blomaq.com.br",
        address: { street: "RUA FRANCISCO ARRUDA", number: "265", neighborhood: "ALEIXO", city: "MANAUS", uf: "AM", cep: "69083060", country: "BRASIL", phone: "9232330634" },
      },
      items: [
        {
          lineNumber: 1,
          code: "0901030046",
          description: "S/ ACAB - CONJUNTO PARAFUSO CURVO PARA ABRACADEIRA 48MM",
          ncm: "73084000",
          cfop: "6910",
          unit: "PC",
          quantity: 2.0,
          unitPrice: 13.85,
          totalPrice: 27.70,
          taxes: {
            icms: { vBC: 27.70, pICMS: 7.0, vICMS: 1.94, cst: "00", modBC: "3" },
            ipi: { cst: "99", vBC: 0, pIPI: 0, vIPI: 0 },
            pis: { cst: "08" },
            cofins: { cst: "08" },
          },
        },
      ],
      totals: { vNF: 27.70, vProd: 27.70, vTotTrib: 1.94 },
      transp: { modFrete: "0", transporter: { cnpj: "16561409000206", name: "CORREIO / MALOTE", ie: "0620949730180", address: "RUA CURITIBA, 715", city: "BELO HORIZONTE", uf: "MG" }, volume: { quantity: 2, specie: "VOLUME" } },
      pagamento: { indPag: "0", tPag: "18", vPag: 27.70 },
      infCpl: "NF de teste gerada pelo sistema",
    });
    expect(xml).toContain("<nfeProc");
    expect(xml).toContain("<emit>");
    expect(xml).toContain("<dest>");
    expect(xml).toContain("<det nItem=\"1\">");
    expect(xml).toContain("<ICMSTot>");
    expect(xml).toContain("<transp>");
    expect(xml).toContain("<pag>");
  });

  test("generates NFS-e XML with service data", () => {
    const xml = buildNFSeXml({
      numero: "12738",
      codigoVerificacao: "2B9B.5DE5.C27E",
      dataEmissao: "2025-12-01T12:58:26",
      rps: { numero: "6585", serie: "2", tipo: "1" },
      competencia: "2025-12-01",
      outrasInformacoes: "REFERENTE AO SERVIÇO DE MONITORAMENTO",
      valores: { valorServicos: 346.0, baseCalculo: 346.0, aliquota: 0.0, valorLiquidoNfse: 346.0 },
      itemListaServico: "1102",
      codigoTributacaoMunicipio: "1102",
      discriminacao: "SERVIÇO DE MONITORAMENTO DE ALARME",
      codigoMunicipio: "1302603",
      prestador: { cnpj: "13684457000104", inscricaoMunicipal: "13822201", razaoSocial: "3D SERVICOS EMPRESARIAIS LTDA", nomeFantasia: "3D SERVICOS" },
      tomador: { cnpjCpf: "13844973000159", inscricaoMunicipal: "20035101", razaoSocial: "BBM SERVICOS, ALUGUEL DE MAQUINAS E TECNOLOGIA LTDA" },
      orgaoGerador: { codigoMunicipio: "1302603", uf: "AM" },
    });
    expect(xml).toContain("<CompNfse>");
    expect(xml).toContain("<InfNfse>");
    expect(xml).toContain("<Servico>");
    expect(xml).toContain("<Valores>");
    expect(xml).toContain("<PrestadorServico>");
    expect(xml).toContain("<TomadorServico>");
  });
});
