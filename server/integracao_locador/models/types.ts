export interface ApiCostCenter {
  idCostCenter: number;
  parentId?: number | null;
  name?: string | null;
}

export interface ChartOfAccounts {
  idChartOfAccounts: number;
  parentId?: number | null;
  accountName?: string | null;
  isPayable?: boolean;
}

export interface Product {
  id: number;
  codigo?: string | null;
  descricao?: string | null;
  descricaocompleta?: string | null;
  categoria?: string | null;
  quantidade: number;
  preco?: number | null;
  unidade?: string | null;
  ativo: boolean;
  tipo?: string | null;
  partNumber?: string | null;
}

export interface Company {
  id: number;
  name?: string | null;
  equity: number;
}

export interface CompanyResponse {
  updated: string;
  taxId?: string | null;
  alias?: string | null;
  founded: string;
  head: boolean;
  company: Company;
  statusDate: string;
  address?: any;
  mainActivity?: any;
  phones?: any[] | null;
  emails?: any[] | null;
  sideActivities?: any[] | null;
  registrations?: any[] | null;
  suframa?: any[] | null;
}

export type Supplier = CompanyResponse;

export interface SupplierSummary {
  id: number;
  name: string;
  cnpj?: string;
  cpf?: string;
  email?: string;
  phone?: string;
}
