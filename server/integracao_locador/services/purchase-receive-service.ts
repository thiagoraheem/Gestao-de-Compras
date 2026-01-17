import { httpClient } from "../utils/http-client";
import { getEndpoints } from "../config/endpoints-registry";

export interface SupplierInfo {
  fornecedor_id?: number | null;
  cnpj?: string;
  nome?: string;
}

export interface InvoiceInfo {
  numero?: string;
  serie?: string;
  chave_nfe?: string;
  data_emissao?: string;
  valor_total: number;
}

export interface AllocationDetail {
  centro_custo_id?: number;
  plano_conta_id?: number;
  valor: number;
  percentual?: number;
}

export interface InstallmentDetail {
  data_vencimento?: string;
  valor: number;
  forma_pagamento?: number;
  numero_parcela?: number;
}

export interface PaymentConditions {
  empresa_id?: number;
  forma_pagamento?: number;
  data_vencimento?: string;
  parcelas: number;
  rateio?: AllocationDetail[];
  parcelas_detalhes?: InstallmentDetail[];
}

export interface PurchaseItem {
  codigo_produto?: string;
  descricao?: string;
  unidade?: string;
  quantidade: number;
  preco_unitario: number;
  ncm?: string;
  cest?: string;
}

export interface PurchaseReceiveRequest {
  pedido_id: number;
  numero_pedido?: string;
  numero_solicitacao?: string;
  solicitacao_id: number;
  data_pedido?: string;
  justificativa?: string;
  fornecedor: SupplierInfo;
  nota_fiscal: InvoiceInfo;
  condicoes_pagamento?: PaymentConditions;
  itens?: PurchaseItem[];
}

class PurchaseReceiveService {
  async submit(data: PurchaseReceiveRequest): Promise<void> {
    const endpoints = getEndpoints();
    try {
      await httpClient.post(endpoints.purchaseReceive, data);
    } catch (error) {
      console.error("Error submitting purchase receive:", error);
      throw error;
    }
  }
}

export const purchaseReceiveService = new PurchaseReceiveService();
