import { httpClient } from "../utils/http-client";
import { getEndpoints } from "../config/endpoints-registry";

export interface PaymentMethod {
  codigo: number | null;
  descricao: string | null;
}

class PaymentMethodService {
  async list(): Promise<PaymentMethod[]> {
    const endpoints = getEndpoints();
    try {
      const response = await httpClient.get<any>(endpoints.paymentMethods);
      const items = Array.isArray(response) 
        ? response 
        : (Array.isArray(response?.data) ? response.data : (Array.isArray(response?.items) ? response.items : []));
      
      return items.map((item: any) => ({
        codigo: item.codigo ?? item.code ?? item.id ?? null,
        descricao: item.descricao ?? item.description ?? item.name ?? null
      }));
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      throw error;
    }
  }
}

export const paymentMethodService = new PaymentMethodService();
