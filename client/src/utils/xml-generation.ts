export type NFeEmitter = {
  cnpj: string;
  name: string;
  fantasyName?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  address: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string };
};

export type NFeRecipient = {
  cnpjCpf: string;
  name: string;
  ie?: string;
  email?: string;
  address: { street?: string; number?: string; neighborhood?: string; city?: string; uf?: string; cep?: string; country?: string; phone?: string };
};

export type NFeItem = {
  lineNumber: number;
  code?: string;
  description: string;
  ncm?: string;
  cest?: string;
  cfop?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxes?: {
    icms?: { vBC?: number; pICMS?: number; vICMS?: number; cst?: string; modBC?: string; orig?: string };
    ipi?: { cEnq?: string; vBC?: number; pIPI?: number; vIPI?: number; cst?: string };
    pis?: { cst?: string };
    cofins?: { cst?: string };
  };
};

export type NFeTransp = {
  modFrete: string;
  transporter?: { cnpj?: string; name?: string; ie?: string; address?: string; city?: string; uf?: string };
  volume?: { quantity?: number; specie?: string };
};

export function buildNFeXml(params: {
  accessKey?: string;
  number: string;
  series: string;
  issueDate: string;
  entryDate?: string;
  emitter: NFeEmitter;
  recipient: NFeRecipient;
  items: NFeItem[];
  totals: { vNF: number; vProd?: number; vDesc?: number; vFrete?: number; vIPI?: number; vTotTrib?: number };
  transp?: NFeTransp;
  pagamento?: { indPag?: string; tPag?: string; vPag?: number };
  infCpl?: string;
}) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">',
    '<NFe>',
    `<infNFe Id="NFe${params.accessKey || ''}" versao="4.00">`,
    '<ide>',
    `<serie>${params.series}</serie>`,
    `<nNF>${params.number}</nNF>`,
    `<dhEmi>${params.issueDate}</dhEmi>`,
    params.entryDate ? `<dhSaiEnt>${params.entryDate}</dhSaiEnt>` : '',
    '</ide>',
    '<emit>',
    `<CNPJ>${params.emitter.cnpj}</CNPJ>`,
    `<xNome>${params.emitter.name}</xNome>`,
    params.emitter.fantasyName ? `<xFant>${params.emitter.fantasyName}</xFant>` : '',
    '<enderEmit>',
    params.emitter.address.street ? `<xLgr>${params.emitter.address.street}</xLgr>` : '',
    params.emitter.address.number ? `<nro>${params.emitter.address.number}</nro>` : '',
    params.emitter.address.neighborhood ? `<xBairro>${params.emitter.address.neighborhood}</xBairro>` : '',
    params.emitter.address.city ? `<xMun>${params.emitter.address.city}</xMun>` : '',
    params.emitter.address.uf ? `<UF>${params.emitter.address.uf}</UF>` : '',
    params.emitter.address.cep ? `<CEP>${params.emitter.address.cep}</CEP>` : '',
    params.emitter.address.country ? `<xPais>${params.emitter.address.country}</xPais>` : '',
    params.emitter.address.phone ? `<fone>${params.emitter.address.phone}</fone>` : '',
    '</enderEmit>',
    params.emitter.ie ? `<IE>${params.emitter.ie}</IE>` : '',
    params.emitter.im ? `<IM>${params.emitter.im}</IM>` : '',
    params.emitter.cnae ? `<CNAE>${params.emitter.cnae}</CNAE>` : '',
    params.emitter.crt ? `<CRT>${params.emitter.crt}</CRT>` : '',
    '</emit>',
    '<dest>',
    `<${params.recipient.cnpjCpf.length === 11 ? 'CPF' : 'CNPJ'}>${params.recipient.cnpjCpf}</${params.recipient.cnpjCpf.length === 11 ? 'CPF' : 'CNPJ'}>`,
    `<xNome>${params.recipient.name}</xNome>`,
    '<enderDest>',
    params.recipient.address.street ? `<xLgr>${params.recipient.address.street}</xLgr>` : '',
    params.recipient.address.number ? `<nro>${params.recipient.address.number}</nro>` : '',
    params.recipient.address.neighborhood ? `<xBairro>${params.recipient.address.neighborhood}</xBairro>` : '',
    params.recipient.address.city ? `<xMun>${params.recipient.address.city}</xMun>` : '',
    params.recipient.address.uf ? `<UF>${params.recipient.address.uf}</UF>` : '',
    params.recipient.address.cep ? `<CEP>${params.recipient.address.cep}</CEP>` : '',
    params.recipient.address.country ? `<xPais>${params.recipient.address.country}</xPais>` : '',
    params.recipient.address.phone ? `<fone>${params.recipient.address.phone}</fone>` : '',
    '</enderDest>',
    params.recipient.ie ? `<IE>${params.recipient.ie}</IE>` : '',
    params.recipient.email ? `<email>${params.recipient.email}</email>` : '',
  '</dest>',
    params.items.map((it) => [
      `<det nItem="${it.lineNumber}">`,
      '<prod>',
      it.code ? `<cProd>${it.code}</cProd>` : '',
      `<xProd>${it.description}</xProd>`,
      it.ncm ? `<NCM>${it.ncm}</NCM>` : '',
      it.cest ? `<CEST>${it.cest}</CEST>` : '',
      it.cfop ? `<CFOP>${it.cfop}</CFOP>` : '',
      `<uCom>${it.unit}</uCom>`,
      `<qCom>${Number(it.quantity).toFixed(4)}</qCom>`,
      `<vUnCom>${Number(it.unitPrice).toFixed(10)}</vUnCom>`,
      `<vProd>${Number(it.totalPrice).toFixed(2)}</vProd>`,
      `<uTrib>${it.unit}</uTrib>`,
      `<qTrib>${Number(it.quantity).toFixed(4)}</qTrib>`,
      `<vUnTrib>${Number(it.unitPrice).toFixed(10)}</vUnTrib>`,
      '<indTot>1</indTot>',
      '</prod>',
      '<imposto>',
      it.taxes?.icms ? [
        '<ICMS>',
        '<ICMS00>',
        it.taxes.icms.orig ? `<orig>${it.taxes.icms.orig}</orig>` : '',
        it.taxes.icms.cst ? `<CST>${it.taxes.icms.cst}</CST>` : '<CST>00</CST>',
        it.taxes.icms.modBC ? `<modBC>${it.taxes.icms.modBC}</modBC>` : '',
        it.taxes.icms.vBC != null ? `<vBC>${Number(it.taxes.icms.vBC).toFixed(2)}</vBC>` : '',
        it.taxes.icms.pICMS != null ? `<pICMS>${Number(it.taxes.icms.pICMS).toFixed(4)}</pICMS>` : '',
        it.taxes.icms.vICMS != null ? `<vICMS>${Number(it.taxes.icms.vICMS).toFixed(2)}</vICMS>` : '',
        '</ICMS00>',
        '</ICMS>',
      ].join('') : '',
      it.taxes?.ipi ? [
        '<IPI>',
        '<IPITrib>',
        it.taxes.ipi.cst ? `<CST>${it.taxes.ipi.cst}</CST>` : '<CST>99</CST>',
        it.taxes.ipi.vBC != null ? `<vBC>${Number(it.taxes.ipi.vBC).toFixed(2)}</vBC>` : '',
        it.taxes.ipi.pIPI != null ? `<pIPI>${Number(it.taxes.ipi.pIPI).toFixed(2)}</pIPI>` : '',
        it.taxes.ipi.vIPI != null ? `<vIPI>${Number(it.taxes.ipi.vIPI).toFixed(2)}</vIPI>` : '',
        '</IPITrib>',
        '</IPI>',
      ].join('') : '',
      it.taxes?.pis ? [
        '<PIS>',
        '<PISNT>',
        it.taxes.pis.cst ? `<CST>${it.taxes.pis.cst}</CST>` : '<CST>08</CST>',
        '</PISNT>',
        '</PIS>',
      ].join('') : '',
      it.taxes?.cofins ? [
        '<COFINS>',
        '<COFINSNT>',
        it.taxes.cofins.cst ? `<CST>${it.taxes.cofins.cst}</CST>` : '<CST>08</CST>',
        '</COFINSNT>',
        '</COFINS>',
      ].join('') : '',
      '</imposto>',
      '</det>',
    ].join('')).join(''),
    '<total>',
    '<ICMSTot>',
    params.totals.vProd != null ? `<vProd>${Number(params.totals.vProd).toFixed(2)}</vProd>` : '',
    params.totals.vFrete != null ? `<vFrete>${Number(params.totals.vFrete).toFixed(2)}</vFrete>` : '',
    params.totals.vDesc != null ? `<vDesc>${Number(params.totals.vDesc).toFixed(2)}</vDesc>` : '',
    params.totals.vIPI != null ? `<vIPI>${Number(params.totals.vIPI).toFixed(2)}</vIPI>` : '',
    `<vNF>${Number(params.totals.vNF).toFixed(2)}</vNF>`,
    params.totals.vTotTrib != null ? `<vTotTrib>${Number(params.totals.vTotTrib).toFixed(2)}</vTotTrib>` : '',
    '</ICMSTot>',
    '</total>',
    params.transp ? [
      '<transp>',
      `<modFrete>${params.transp.modFrete}</modFrete>`,
      params.transp.transporter ? [
        '<transporta>',
        params.transp.transporter.cnpj ? `<CNPJ>${params.transp.transporter.cnpj}</CNPJ>` : '',
        params.transp.transporter.name ? `<xNome>${params.transp.transporter.name}</xNome>` : '',
        params.transp.transporter.ie ? `<IE>${params.transp.transporter.ie}</IE>` : '',
        params.transp.transporter.address ? `<xEnder>${params.transp.transporter.address}</xEnder>` : '',
        params.transp.transporter.city ? `<xMun>${params.transp.transporter.city}</xMun>` : '',
        params.transp.transporter.uf ? `<UF>${params.transp.transporter.uf}</UF>` : '',
        '</transporta>',
      ].join('') : '',
      params.transp.volume ? [
        '<vol>',
        params.transp.volume.quantity != null ? `<qVol>${params.transp.volume.quantity}</qVol>` : '',
        params.transp.volume.specie ? `<esp>${params.transp.volume.specie}</esp>` : '',
        '</vol>',
      ].join('') : '',
      '</transp>',
    ].join('') : '',
    params.pagamento ? [
      '<pag>',
      '<detPag>',
      params.pagamento.indPag ? `<indPag>${params.pagamento.indPag}</indPag>` : '',
      params.pagamento.tPag ? `<tPag>${params.pagamento.tPag}</tPag>` : '',
      params.pagamento.vPag != null ? `<vPag>${Number(params.pagamento.vPag).toFixed(2)}</vPag>` : '',
      '</detPag>',
      '</pag>',
    ].join('') : '',
    params.infCpl ? [
      '<infAdic>',
      `<infCpl>${params.infCpl}</infCpl>`,
      '</infAdic>',
    ].join('') : '',
    '</infNFe>',
    '</NFe>',
    '</nfeProc>',
  ].join('');
  return xml;
}

export type NFSeParams = {
  numero: string;
  codigoVerificacao?: string;
  dataEmissao: string;
  rps: { numero: string; serie?: string; tipo?: string };
  competencia: string;
  outrasInformacoes?: string;
  valores: {
    valorServicos: number;
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
  itemListaServico: string;
  codigoTributacaoMunicipio: string;
  discriminacao: string;
  codigoMunicipio: string;
  prestador: { cnpj: string; inscricaoMunicipal?: string; razaoSocial: string; nomeFantasia?: string; endereco?: { endereco?: string; numero?: string; complemento?: string; bairro?: string; codigoMunicipio?: string; uf?: string; cep?: string }; contato?: { telefone?: string; email?: string } };
  tomador: { cnpjCpf: string; inscricaoMunicipal?: string; razaoSocial: string; endereco?: { endereco?: string; numero?: string; complemento?: string; bairro?: string; codigoMunicipio?: string; uf?: string; cep?: string }; contato?: { telefone?: string; email?: string } };
  orgaoGerador?: { codigoMunicipio?: string; uf?: string };
};

export function buildNFSeXml(params: NFSeParams) {
  const xml = [
    '<CompNfse>',
    '<Nfse>',
    '<InfNfse>',
    `<Numero>${params.numero}</Numero>`,
    params.codigoVerificacao ? `<CodigoVerificacao>${params.codigoVerificacao}</CodigoVerificacao>` : '',
    `<DataEmissao>${params.dataEmissao}</DataEmissao>`,
    '<IdentificacaoRps>',
    `<Numero>${params.rps.numero}</Numero>`,
    params.rps.serie ? `<Serie>${params.rps.serie}</Serie>` : '',
    params.rps.tipo ? `<Tipo>${params.rps.tipo}</Tipo>` : '',
    '</IdentificacaoRps>',
    `<DataEmissaoRps>${params.dataEmissao.split('T')[0]}</DataEmissaoRps>`,
    `<Competencia>${params.competencia}</Competencia>`,
    params.outrasInformacoes ? `<OutrasInformacoes>${params.outrasInformacoes}</OutrasInformacoes>` : '',
    '<Servico>',
    '<Valores>',
    `<ValorServicos>${Number(params.valores.valorServicos).toFixed(2)}</ValorServicos>`,
    params.valores.valorDeducoes != null ? `<ValorDeducoes>${Number(params.valores.valorDeducoes).toFixed(2)}</ValorDeducoes>` : '',
    params.valores.valorPis != null ? `<ValorPis>${Number(params.valores.valorPis).toFixed(2)}</ValorPis>` : '',
    params.valores.valorCofins != null ? `<ValorCofins>${Number(params.valores.valorCofins).toFixed(2)}</ValorCofins>` : '',
    params.valores.valorInss != null ? `<ValorInss>${Number(params.valores.valorInss).toFixed(2)}</ValorInss>` : '',
    params.valores.valorIr != null ? `<ValorIr>${Number(params.valores.valorIr).toFixed(2)}</ValorIr>` : '',
    params.valores.valorCsll != null ? `<ValorCsll>${Number(params.valores.valorCsll).toFixed(2)}</ValorCsll>` : '',
    params.valores.issRetido != null ? `<IssRetido>${Number(params.valores.issRetido).toFixed(0)}</IssRetido>` : '',
    params.valores.valorIss != null ? `<ValorIss>${Number(params.valores.valorIss).toFixed(2)}</ValorIss>` : '',
    params.valores.valorIssRetido != null ? `<ValorIssRetido>${Number(params.valores.valorIssRetido).toFixed(2)}</ValorIssRetido>` : '',
    params.valores.baseCalculo != null ? `<BaseCalculo>${Number(params.valores.baseCalculo).toFixed(2)}</BaseCalculo>` : '',
    params.valores.aliquota != null ? `<Aliquota>${Number(params.valores.aliquota).toFixed(4)}</Aliquota>` : '',
    params.valores.valorLiquidoNfse != null ? `<ValorLiquidoNfse>${Number(params.valores.valorLiquidoNfse).toFixed(2)}</ValorLiquidoNfse>` : '',
    params.valores.descontoIncondicionado != null ? `<DescontoIncondicionado>${Number(params.valores.descontoIncondicionado).toFixed(2)}</DescontoIncondicionado>` : '',
    params.valores.descontoCondicionado != null ? `<DescontoCondicionado>${Number(params.valores.descontoCondicionado).toFixed(2)}</DescontoCondicionado>` : '',
    '</Valores>',
    `<ItemListaServico>${params.itemListaServico}</ItemListaServico>`,
    `<CodigoTributacaoMunicipio>${params.codigoTributacaoMunicipio}</CodigoTributacaoMunicipio>`,
    `<Discriminacao>${params.discriminacao}</Discriminacao>`,
    `<CodigoMunicipio>${params.codigoMunicipio}</CodigoMunicipio>`,
    '</Servico>',
    '<PrestadorServico>',
    '<IdentificacaoPrestador>',
    `<Cnpj>${params.prestador.cnpj}</Cnpj>`,
    params.prestador.inscricaoMunicipal ? `<InscricaoMunicipal>${params.prestador.inscricaoMunicipal}</InscricaoMunicipal>` : '',
    '</IdentificacaoPrestador>',
    `<RazaoSocial>${params.prestador.razaoSocial}</RazaoSocial>`,
    params.prestador.nomeFantasia ? `<NomeFantasia>${params.prestador.nomeFantasia}</NomeFantasia>` : '',
    params.prestador.endereco ? [
      '<Endereco>',
      params.prestador.endereco.endereco ? `<Endereco>${params.prestador.endereco.endereco}</Endereco>` : '',
      params.prestador.endereco.numero ? `<Numero>${params.prestador.endereco.numero}</Numero>` : '',
      params.prestador.endereco.complemento ? `<Complemento>${params.prestador.endereco.complemento}</Complemento>` : '',
      params.prestador.endereco.bairro ? `<Bairro>${params.prestador.endereco.bairro}</Bairro>` : '',
      params.prestador.endereco.codigoMunicipio ? `<CodigoMunicipio>${params.prestador.endereco.codigoMunicipio}</CodigoMunicipio>` : '',
      params.prestador.endereco.uf ? `<Uf>${params.prestador.endereco.uf}</Uf>` : '',
      params.prestador.endereco.cep ? `<Cep>${params.prestador.endereco.cep}</Cep>` : '',
      '</Endereco>',
    ].join('') : '',
    params.prestador.contato ? [
      '<Contato>',
      params.prestador.contato.telefone ? `<Telefone>${params.prestador.contato.telefone}</Telefone>` : '',
      params.prestador.contato.email ? `<Email>${params.prestador.contato.email}</Email>` : '',
      '</Contato>',
    ].join('') : '',
    '</PrestadorServico>',
    '<TomadorServico>',
    '<IdentificacaoTomador>',
    '<CpfCnpj>',
    `<${params.tomador.cnpjCpf.length === 11 ? 'Cpf' : 'Cnpj'}>${params.tomador.cnpjCpf}</${params.tomador.cnpjCpf.length === 11 ? 'Cpf' : 'Cnpj'}>`,
    '</CpfCnpj>',
    params.tomador.inscricaoMunicipal ? `<InscricaoMunicipal>${params.tomador.inscricaoMunicipal}</InscricaoMunicipal>` : '',
    '</IdentificacaoTomador>',
    `<RazaoSocial>${params.tomador.razaoSocial}</RazaoSocial>`,
    params.tomador.endereco ? [
      '<Endereco>',
      params.tomador.endereco.endereco ? `<Endereco>${params.tomador.endereco.endereco}</Endereco>` : '',
      params.tomador.endereco.numero ? `<Numero>${params.tomador.endereco.numero}</Numero>` : '',
      params.tomador.endereco.complemento ? `<Complemento>${params.tomador.endereco.complemento}</Complemento>` : '',
      params.tomador.endereco.bairro ? `<Bairro>${params.tomador.endereco.bairro}</Bairro>` : '',
      params.tomador.endereco.codigoMunicipio ? `<CodigoMunicipio>${params.tomador.endereco.codigoMunicipio}</CodigoMunicipio>` : '',
      params.tomador.endereco.uf ? `<Uf>${params.tomador.endereco.uf}</Uf>` : '',
      params.tomador.endereco.cep ? `<Cep>${params.tomador.endereco.cep}</Cep>` : '',
      '</Endereco>',
    ].join('') : '',
    params.tomador.contato ? [
      '<Contato>',
      params.tomador.contato.telefone ? `<Telefone>${params.tomador.contato.telefone}</Telefone>` : '',
      params.tomador.contato.email ? `<Email>${params.tomador.contato.email}</Email>` : '',
      '</Contato>',
    ].join('') : '',
    '</TomadorServico>',
    params.orgaoGerador ? [
      '<OrgaoGerador>',
      params.orgaoGerador.codigoMunicipio ? `<CodigoMunicipio>${params.orgaoGerador.codigoMunicipio}</CodigoMunicipio>` : '',
      params.orgaoGerador.uf ? `<Uf>${params.orgaoGerador.uf}</Uf>` : '',
      '</OrgaoGerador>',
    ].join('') : '',
    '</InfNfse>',
    '</Nfse>',
    '</CompNfse>',
  ].join('');
  return xml;
}
