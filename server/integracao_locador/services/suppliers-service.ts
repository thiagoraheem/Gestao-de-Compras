import { erpService } from '../../erp-service';
import type { SupplierSummary } from '../models/types';

export class SuppliersService {
  async list(params: { search?: string; limit?: number }): Promise<SupplierSummary[]> {
    const result = await erpService.fetchSuppliers({ search: params.search, limit: params.limit });
    return result.suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      cnpj: s.cnpj,
      cpf: s.cpf,
      email: s.email,
      phone: s.phone,
    }));
  }
}

export const suppliersService = new SuppliersService();

