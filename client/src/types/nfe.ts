export interface NFEData {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  dataEntrada: string;
  naturezaOperacao: string;
  protocolo: string;
  status: string;
  emitente: Empresa;
  destinatario: Empresa;
  itens: ItemNFE[];
  totais: TotaisNFE;
  transporte: TransporteNFE;
  pagamento: PagamentoNFE;
  informacoesAdicionais: string;
}

export interface Empresa {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual: string;
  inscricaoMunicipal?: string;
  endereco: Endereco;
  telefone?: string;
  email?: string;
}

export interface Endereco {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  pais: string;
}

export interface ItemNFE {
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  impostos: ImpostosItem;
  centroCusto?: string;
  planoContas?: string;
}

export interface ImpostosItem {
  icmsBase: number;
  icmsAliquota: number;
  icmsValor: number;
  ipiBase: number;
  ipiAliquota: number;
  ipiValor: number;
  pisCST: string;
  cofinsCST: string;
  valorTotalTributos: number;
}

export interface TotaisNFE {
  baseCalculoICMS: number;
  valorICMS: number;
  valorICMSDesonerado: number;
  baseCalculoST: number;
  valorST: number;
  valorProdutos: number;
  valorFrete: number;
  valorSeguro: number;
  valorDesconto: number;
  valorII: number;
  valorIPI: number;
  valorPIS: number;
  valorCOFINS: number;
  valorOutros: number;
  valorNota: number;
  valorTotalTributos: number;
}

export interface TransporteNFE {
  modalidadeFrete: string;
  transportadora?: {
    cnpj: string;
    razaoSocial: string;
    inscricaoEstadual: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  volumes?: {
    quantidade: number;
    especie: string;
  };
}

export interface PagamentoNFE {
  indicador: string;
  formaPagamento: string;
  valor: number;
}

export interface ParcelaNFE {
  numero: number;
  vencimento: string;
  valor: number;
}
