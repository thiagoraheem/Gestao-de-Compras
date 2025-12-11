import type { NFEData, ItemNFE, ImpostosItem } from '@/types/nfe';

export function parseNFEXml(xmlString: string): NFEData | null {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlString, 'text/xml');
    
    const getText = (parent: Element | Document, tag: string): string => {
      const element = parent.getElementsByTagName(tag)[0];
      return element?.textContent?.trim() || '';
    };

    const getNumber = (parent: Element | Document, tag: string): number => {
      return parseFloat(getText(parent, tag)) || 0;
    };

    const infNFe = xml.getElementsByTagName('infNFe')[0];
    if (!infNFe) return null;

    const ide = xml.getElementsByTagName('ide')[0];
    const emit = xml.getElementsByTagName('emit')[0];
    const dest = xml.getElementsByTagName('dest')[0];
    const total = xml.getElementsByTagName('total')[0];
    const transp = xml.getElementsByTagName('transp')[0];
    const pag = xml.getElementsByTagName('pag')[0];
    const infProt = xml.getElementsByTagName('infProt')[0];
    const infAdic = xml.getElementsByTagName('infAdic')[0];

    const detElements = xml.getElementsByTagName('det');
    const itens: ItemNFE[] = [];
    
    for (let i = 0; i < detElements.length; i++) {
      const det = detElements[i];
      const prod = det.getElementsByTagName('prod')[0];
      const imposto = det.getElementsByTagName('imposto')[0];
      
      const icms = imposto?.getElementsByTagName('ICMS')[0];
      const icmsInner = icms?.firstElementChild;
      const ipi = imposto?.getElementsByTagName('IPI')[0];
      const ipiInner = ipi?.getElementsByTagName('IPITrib')[0] || ipi?.getElementsByTagName('IPINT')[0];
      const pis = imposto?.getElementsByTagName('PIS')[0];
      const pisInner = pis?.firstElementChild;
      const cofins = imposto?.getElementsByTagName('COFINS')[0];
      const cofinsInner = cofins?.firstElementChild;

      const impostos: ImpostosItem = {
        icmsBase: icmsInner ? getNumber(icmsInner, 'vBC') : 0,
        icmsAliquota: icmsInner ? getNumber(icmsInner, 'pICMS') : 0,
        icmsValor: icmsInner ? getNumber(icmsInner, 'vICMS') : 0,
        ipiBase: ipiInner ? getNumber(ipiInner, 'vBC') : 0,
        ipiAliquota: ipiInner ? getNumber(ipiInner, 'pIPI') : 0,
        ipiValor: ipiInner ? getNumber(ipiInner, 'vIPI') : 0,
        pisCST: pisInner ? getText(pisInner, 'CST') : '',
        cofinsCST: cofinsInner ? getText(cofinsInner, 'CST') : '',
        valorTotalTributos: getNumber(imposto, 'vTotTrib'),
      };

      itens.push({
        numero: parseInt(det.getAttribute('nItem') || '0'),
        codigo: getText(prod, 'cProd'),
        descricao: getText(prod, 'xProd'),
        ncm: getText(prod, 'NCM'),
        cfop: getText(prod, 'CFOP'),
        unidade: getText(prod, 'uCom'),
        quantidade: getNumber(prod, 'qCom'),
        valorUnitario: getNumber(prod, 'vUnCom'),
        valorTotal: getNumber(prod, 'vProd'),
        impostos,
        centroCusto: '',
        planoContas: '',
      });
    }

    const transportadora = transp?.getElementsByTagName('transporta')[0];
    const volumes = transp?.getElementsByTagName('vol')[0];

    const detPag = pag?.getElementsByTagName('detPag')[0];
    const formaPagamentoMap: Record<string, string> = {
      '01': 'Dinheiro',
      '02': 'Cheque',
      '03': 'Cartão de Crédito',
      '04': 'Cartão de Débito',
      '05': 'Crédito Loja',
      '10': 'Vale Alimentação',
      '11': 'Vale Refeição',
      '12': 'Vale Presente',
      '13': 'Vale Combustível',
      '14': 'Duplicata Mercantil',
      '15': 'Boleto Bancário',
      '16': 'Depósito Bancário',
      '17': 'PIX',
      '18': 'Transferência Bancária',
      '19': 'Programa de Fidelidade',
      '90': 'Sem Pagamento',
      '99': 'Outros',
    };

    const indicadorMap: Record<string, string> = {
      '0': 'À Vista',
      '1': 'A Prazo',
    };

    const modalidadeFreteMap: Record<string, string> = {
      '0': 'Por conta do Emitente',
      '1': 'Por conta do Destinatário',
      '2': 'Por conta de Terceiros',
      '3': 'Transporte Próprio Remetente',
      '4': 'Transporte Próprio Destinatário',
      '9': 'Sem Frete',
    };

    const nfeData: NFEData = {
      chaveAcesso: getText(infProt, 'chNFe') || infNFe.getAttribute('Id')?.replace('NFe', '') || '',
      numero: getText(ide, 'nNF'),
      serie: getText(ide, 'serie'),
      dataEmissao: getText(ide, 'dhEmi'),
      dataEntrada: getText(ide, 'dhSaiEnt'),
      naturezaOperacao: getText(ide, 'natOp'),
      protocolo: getText(infProt, 'nProt'),
      status: getText(infProt, 'xMotivo'),
      emitente: {
        cnpj: getText(emit, 'CNPJ'),
        razaoSocial: getText(emit, 'xNome'),
        nomeFantasia: getText(emit, 'xFant'),
        inscricaoEstadual: getText(emit, 'IE'),
        inscricaoMunicipal: getText(emit, 'IM'),
        endereco: {
          logradouro: getText(emit.getElementsByTagName('enderEmit')[0], 'xLgr'),
          numero: getText(emit.getElementsByTagName('enderEmit')[0], 'nro'),
          bairro: getText(emit.getElementsByTagName('enderEmit')[0], 'xBairro'),
          cidade: getText(emit.getElementsByTagName('enderEmit')[0], 'xMun'),
          uf: getText(emit.getElementsByTagName('enderEmit')[0], 'UF'),
          cep: getText(emit.getElementsByTagName('enderEmit')[0], 'CEP'),
          pais: getText(emit.getElementsByTagName('enderEmit')[0], 'xPais'),
        },
        telefone: getText(emit.getElementsByTagName('enderEmit')[0], 'fone'),
      },
      destinatario: {
        cnpj: getText(dest, 'CNPJ'),
        razaoSocial: getText(dest, 'xNome'),
        inscricaoEstadual: getText(dest, 'IE'),
        endereco: {
          logradouro: getText(dest.getElementsByTagName('enderDest')[0], 'xLgr'),
          numero: getText(dest.getElementsByTagName('enderDest')[0], 'nro'),
          bairro: getText(dest.getElementsByTagName('enderDest')[0], 'xBairro'),
          cidade: getText(dest.getElementsByTagName('enderDest')[0], 'xMun'),
          uf: getText(dest.getElementsByTagName('enderDest')[0], 'UF'),
          cep: getText(dest.getElementsByTagName('enderDest')[0], 'CEP'),
          pais: getText(dest.getElementsByTagName('enderDest')[0], 'xPais'),
        },
        telefone: getText(dest.getElementsByTagName('enderDest')[0], 'fone'),
        email: getText(dest, 'email'),
      },
      itens,
      totais: {
        baseCalculoICMS: getNumber(total, 'vBC'),
        valorICMS: getNumber(total, 'vICMS'),
        valorICMSDesonerado: getNumber(total, 'vICMSDeson'),
        baseCalculoST: getNumber(total, 'vBCST'),
        valorST: getNumber(total, 'vST'),
        valorProdutos: getNumber(total, 'vProd'),
        valorFrete: getNumber(total, 'vFrete'),
        valorSeguro: getNumber(total, 'vSeg'),
        valorDesconto: getNumber(total, 'vDesc'),
        valorII: getNumber(total, 'vII'),
        valorIPI: getNumber(total, 'vIPI'),
        valorPIS: getNumber(total, 'vPIS'),
        valorCOFINS: getNumber(total, 'vCOFINS'),
        valorOutros: getNumber(total, 'vOutro'),
        valorNota: getNumber(total, 'vNF'),
        valorTotalTributos: getNumber(total, 'vTotTrib'),
      },
      transporte: {
        modalidadeFrete: modalidadeFreteMap[getText(transp, 'modFrete')] || getText(transp, 'modFrete'),
        transportadora: transportadora ? {
          cnpj: getText(transportadora, 'CNPJ'),
          razaoSocial: getText(transportadora, 'xNome'),
          inscricaoEstadual: getText(transportadora, 'IE'),
          endereco: getText(transportadora, 'xEnder'),
          cidade: getText(transportadora, 'xMun'),
          uf: getText(transportadora, 'UF'),
        } : undefined,
        volumes: volumes ? {
          quantidade: getNumber(volumes, 'qVol'),
          especie: getText(volumes, 'esp'),
        } : undefined,
      },
      pagamento: {
        indicador: indicadorMap[getText(detPag, 'indPag')] || getText(detPag, 'indPag'),
        formaPagamento: formaPagamentoMap[getText(detPag, 'tPag')] || getText(detPag, 'tPag'),
        valor: getNumber(detPag, 'vPag'),
      },
      informacoesAdicionais: getText(infAdic, 'infCpl'),
    };

    return nfeData;
  } catch (error) {
    console.error('Error parsing NF-e XML:', error);
    return null;
  }
}
