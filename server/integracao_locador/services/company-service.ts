import { HttpClient } from '../utils/http-client';
import { getEndpoints } from '../config/endpoints-registry';

export interface EmpresaERP {
  idCompany: number;
  companyName: string | null;
  companyTrading: string | null;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export class CompanyService {
  private client = new HttpClient();

  async list(): Promise<EmpresaERP[]> {
    const { companies } = getEndpoints();
    return this.client.get<EmpresaERP[]>(companies);
  }
}

export const companyService = new CompanyService();
