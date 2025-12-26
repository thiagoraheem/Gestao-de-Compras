import { httpClient } from "../utils/http-client";
import { getEndpoints } from "../config/endpoints-registry";

export interface SupplierInfo {
  fornecedor_id: number;
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
  conta_contabil_id?: number;
  valor: number;
  percentual?: number;
}

export interface PaymentConditions {
  forma_pagamento?: number;
  data_vencimento?: string;
  parcelas: number;
  rateio?: AllocationDetail[];
}

export interface PurchaseItem {
  produto_id?: string;
  codigo?: string;
  descricao?: string;
  unidade?: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  ncm?: string;
  cfop?: string;
}

export interface PurchaseReceiveRequest {
  pedido_id: number;
  numero_pedido?: string;
  data_pedido?: string;
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
