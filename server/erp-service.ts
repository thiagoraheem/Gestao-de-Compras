import { z } from 'zod';
import { config } from './config';

interface ERPProduct {
  codigo: string;
  descricao: string;
  unidade: string;
  preco?: number;
  categoria?: string;
  ativo?: boolean;
}

interface ProductSearchParams {
  q: string;
  limit?: number;
}

interface SupplierFetchParams {
  search?: string;
  limit?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

interface SupplierFetchResult {
  suppliers: ERPSupplier[];
  total: number;
}

interface ERPSupplier {
  id: number;
  name: string;
  tradeName?: string;
  cnpj?: string;
  cpf?: string;
  document?: string;
  email?: string;
  phone?: string;
  contact?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  paymentTerms?: string;
  raw: Record<string, unknown>;
}

const erpSupplierSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    ids: z.union([z.string(), z.number()]).optional(),
    idsuppliererp: z.union([z.string(), z.number()]).optional(),
    supplierId: z.union([z.string(), z.number()]).optional(),
    codigo: z.union([z.string(), z.number()]).optional(),
    razaoSocial: z.string().optional(),
    nome: z.string().optional(),
    name: z.string().optional(),
    companyName: z.string().optional(),
    fantasia: z.string().optional(),
    nomeFantasia: z.string().optional(),
    tradeName: z.string().optional(),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    documento: z.string().optional(),
    cpfCnpj: z.string().optional(),
    cnpjCpf: z.string().optional(),
    document: z.string().optional(),
    email: z.string().optional(),
    eMail: z.string().optional(),
    emailContato: z.string().optional(),
    telefone: z.string().optional(),
    celular: z.string().optional(),
    phone: z.string().optional(),
    telefoneContato: z.string().optional(),
    contato: z.string().optional(),
    responsavel: z.string().optional(),
    contact: z.string().optional(),
    endereco: z.string().optional(),
    logradouro: z.string().optional(),
    address: z.string().optional(),
    numero: z.union([z.string(), z.number()]).optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    city: z.string().optional(),
    estado: z.string().optional(),
    uf: z.string().optional(),
    state: z.string().optional(),
    cep: z.string().optional(),
    zipcode: z.string().optional(),
    paymentTerms: z.string().optional(),
    prazoPagamento: z.string().optional(),
    condicaoPagamento: z.string().optional(),
  })
  .passthrough();

const sanitizeDocument = (value?: string | number | null): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const digits = String(value).replace(/\D+/g, '');
  if (!digits.length) return undefined;
  return digits;
};

const normalizeWhitespace = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.replace(/\s+/g, ' ') : undefined;
};

class ERPService {
  private baseUrl: string;
  private timeout: number;
  private enabled: boolean;
  private productsEndpoint: string;
  private suppliersEndpoint: string;
  private suppliersCountEndpoint: string;
  private supplierPageSize: number;
  private mockFallbackEnabled: boolean;

  constructor() {
    this.baseUrl = config.erp.baseUrl;
    this.timeout = config.erp.timeout;
    this.enabled = config.erp.enabled;
    this.productsEndpoint = config.erp.productsEndpoint;
    this.suppliersEndpoint = config.erp.suppliersEndpoint ?? '/Fornecedor';
    this.suppliersCountEndpoint =
      config.erp.suppliersCountEndpoint ?? '/Fornecedor/GetCount';
    this.supplierPageSize = Math.max(config.erp.supplierPageSize ?? 200, 50);
    this.mockFallbackEnabled = config.erp.useMockFallback ?? true;
  }

  /**
   * Busca produtos no ERP externo
   */
  async searchProducts(params: ProductSearchParams): Promise<ERPProduct[]> {
    if (!this.enabled) {
      if (this.mockFallbackEnabled) {
        return this.getMockProducts(params.q, params.limit);
      }
      throw new Error('ERP integration is disabled');
    }

    try {
      const searchUrl = `${this.baseUrl}${this.productsEndpoint}`;
      const queryParams = new URLSearchParams({
        search: params.q,
        ...(params.limit && { limit: params.limit.toString() }),
      });

      const response = await this.fetchWithTimeout(
        `${searchUrl}?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`ERP API responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Mapear os dados do ERP para o formato esperado
      return this.mapERPResponse(data);

    } catch (error) {
      console.error('Error fetching products from ERP:', error);

      // Em caso de erro, retornar dados mock como fallback quando habilitado
      if (this.mockFallbackEnabled) {
        return this.getMockProducts(params.q, params.limit);
      }

      throw error instanceof Error
        ? error
        : new Error('Failed to fetch products from ERP');
    }
  }

  /**
   * Mapeia a resposta do ERP para o formato esperado
   */
  private mapERPResponse(data: any): ERPProduct[] {
    if (!Array.isArray(data)) {
      // Se a resposta não for um array, tentar extrair de uma propriedade comum
      if (data.products) data = data.products;
      else if (data.items) data = data.items;
      else if (data.data) data = data.data;
      else return [];
    }

    return data.map((item: any) => ({
      codigo: item.codigo || item.code || item.id || '',
      descricao: item.descricao || item.description || item.name || '',
      unidade: item.unidade || item.unit || item.unitOfMeasure || 'Unidade',
      preco: item.preco || item.price || undefined,
      categoria: item.categoria || item.category || undefined,
      ativo: item.ativo !== undefined ? item.ativo : (item.active !== undefined ? item.active : true),
    })).filter((product: ERPProduct) => product.codigo && product.descricao);
  }

  async fetchSuppliers(params: SupplierFetchParams = {}): Promise<SupplierFetchResult> {
    if (!this.enabled) {
      if (this.mockFallbackEnabled) {
        return this.getMockSuppliers(params.search, params.limit);
      }
      throw new Error('ERP integration is disabled');
    }

    const limit = params.limit && params.limit > 0 ? params.limit : Number.MAX_SAFE_INTEGER;
    const pageSize = Math.min(
      Math.max(params.pageSize ?? this.supplierPageSize, 50),
      1000,
    );

    let total = limit;

    try {
      const count = await this.fetchSupplierCount(params.search, params.signal);
      if (typeof count === 'number' && count >= 0) {
        total = params.limit ? Math.min(params.limit, count) : count;
      }
    } catch (error) {
      console.warn('Failed to retrieve ERP supplier count:', error);
    }

    const aggregated: ERPSupplier[] = [];
    let page = 0;

    try {
      while (aggregated.length < limit) {
        const remaining = limit - aggregated.length;
        const currentPageSize = Math.min(pageSize, remaining);
        const batch = await this.fetchSupplierPage({
          page,
          pageSize: currentPageSize,
          search: params.search,
          signal: params.signal,
        });

        if (!batch.length) {
          break;
        }

        aggregated.push(...batch);

        if (batch.length < currentPageSize) {
          break;
        }

        page += 1;
      }

      const uniqueSuppliers = this.deduplicateSuppliers(aggregated);
      return {
        suppliers:
          limit === Number.MAX_SAFE_INTEGER
            ? uniqueSuppliers
            : uniqueSuppliers.slice(0, limit),
        total:
          total === Number.MAX_SAFE_INTEGER
            ? uniqueSuppliers.length
            : total,
      };
    } catch (error) {
      console.error('Error fetching suppliers from ERP:', error);
      if (this.mockFallbackEnabled) {
        return this.getMockSuppliers(params.search, params.limit);
      }

      throw error instanceof Error
        ? error
        : new Error('Failed to fetch suppliers from ERP');
    }
  }

  private async fetchSupplierCount(
    search?: string,
    signal?: AbortSignal,
  ): Promise<number | null> {
    const url = new URL(`${this.baseUrl}${this.suppliersCountEndpoint}`);
    if (search) {
      url.searchParams.set('search', search);
    }

    const response = await this.fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
      this.timeout,
      signal,
    );

    if (!response.ok) {
      throw new Error(
        `ERP supplier count endpoint responded with status: ${response.status}`,
      );
    }

    const payload = await response.json();

    if (typeof payload === 'number') {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      if ('count' in payload && typeof payload.count === 'number') {
        return payload.count;
      }
      if ('total' in payload && typeof payload.total === 'number') {
        return payload.total;
      }
      if ('totalCount' in payload && typeof payload.totalCount === 'number') {
        return payload.totalCount;
      }
    }

    return null;
  }

  private async fetchSupplierPage({
    page,
    pageSize,
    search,
    signal,
  }: {
    page: number;
    pageSize: number;
    search?: string;
    signal?: AbortSignal;
  }): Promise<ERPSupplier[]> {
    const queryParams = new URLSearchParams({
      limit: pageSize.toString(),
    });

    if (search) {
      queryParams.set('search', search);
    }

    if (page > 0) {
      queryParams.set('page', (page + 1).toString());
      queryParams.set('offset', String(page * pageSize));
      queryParams.set('skip', String(page * pageSize));
    }

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}${this.suppliersEndpoint}?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
      this.timeout,
      signal,
    );

    if (!response.ok) {
      throw new Error(
        `ERP supplier endpoint responded with status: ${response.status}`,
      );
    }

    const payload = await response.json();
    const records: unknown[] = Array.isArray(payload)
      ? payload
      : (payload?.items as unknown[]) ||
        (payload?.data as unknown[]) ||
        (payload?.results as unknown[]) ||
        (payload?.content as unknown[]) ||
        [];

    if (!Array.isArray(records)) {
      return [];
    }

    return this.normalizeSuppliers(records);
  }

  private normalizeSuppliers(records: unknown[]): ERPSupplier[] {
    const normalized: ERPSupplier[] = [];
    for (const record of records) {
      const supplier = this.mapToSupplier(record);
      if (supplier) {
        normalized.push(supplier);
      }
    }
    return normalized;
  }

  private mapToSupplier(record: unknown): ERPSupplier | null {
    const parsed = erpSupplierSchema.safeParse(record);
    if (!parsed.success) {
      return null;
    }

    const data = parsed.data;

    const idCandidate =
      data.id ??
      data.ids ??
      data.idsuppliererp ??
      data.supplierId ??
      data.codigo ??
      (typeof (record as Record<string, unknown>).Id === 'number'
        ? (record as Record<string, unknown>).Id
        : undefined) ??
      (typeof (record as Record<string, unknown>).ID === 'number'
        ? (record as Record<string, unknown>).ID
        : undefined);

    const numericId = Number.parseInt(String(idCandidate ?? ''), 10);
    if (!Number.isFinite(numericId)) {
      return null;
    }

    const nameCandidate =
      normalizeWhitespace(
        data.razaoSocial ??
          data.nome ??
          data.name ??
          data.companyName ??
          data.tradeName ??
          data.fantasia ??
          data.nomeFantasia,
      ) ?? `Fornecedor ${numericId}`;

    const tradeName = normalizeWhitespace(
      data.nomeFantasia ?? data.fantasia ?? data.tradeName,
    );

    const contact = normalizeWhitespace(
      data.contato ?? data.responsavel ?? data.contact,
    );

    const email = normalizeWhitespace(
      data.email ?? data.eMail ?? data.emailContato,
    );

    const phone = normalizeWhitespace(
      data.telefone ?? data.telefoneContato ?? data.celular ?? data.phone,
    );

    const docCandidates = [
      data.cnpj,
      data.cpf,
      data.documento,
      data.cpfCnpj,
      data.cnpjCpf,
      data.document,
    ];

    const cleanedDocs = docCandidates
      .map((value) => sanitizeDocument(value ?? null))
      .filter((value): value is string => Boolean(value));

    const primaryDocument = cleanedDocs[0];
    const cnpj = primaryDocument && primaryDocument.length === 14 ? primaryDocument : undefined;
    const cpf = primaryDocument && primaryDocument.length === 11 ? primaryDocument : undefined;

    const addressLine = normalizeWhitespace(
      data.endereco ?? data.logradouro ?? data.address,
    );
    const numberLine = normalizeWhitespace(
      typeof data.numero === 'number' ? data.numero.toString() : data.numero,
    );
    const district = normalizeWhitespace(data.bairro);
    const city = normalizeWhitespace(data.cidade ?? data.city);
    const addressParts = [addressLine, numberLine, district, city].filter(
      (part): part is string => Boolean(part),
    );
    const address = addressParts.length ? addressParts.join(', ') : undefined;

    const state = normalizeWhitespace(data.estado ?? data.state ?? data.uf);
    const zipCode = sanitizeDocument(data.cep ?? data.zipcode);

    const paymentTerms = normalizeWhitespace(
      data.paymentTerms ?? data.prazoPagamento ?? data.condicaoPagamento,
    );

    return {
      id: numericId,
      name: nameCandidate,
      tradeName,
      cnpj,
      cpf,
      document: primaryDocument,
      email,
      phone,
      contact,
      address,
      city,
      state,
      zipCode,
      paymentTerms,
      raw: parsed.data,
    };
  }

  private deduplicateSuppliers(suppliers: ERPSupplier[]): ERPSupplier[] {
    const unique = new Map<number, ERPSupplier>();
    for (const supplier of suppliers) {
      if (!unique.has(supplier.id)) {
        unique.set(supplier.id, supplier);
      }
    }
    return Array.from(unique.values());
  }

  /**
   * Dados mock de fornecedores para desenvolvimento e fallback
   */
  private getMockSuppliers(
    searchTerm?: string,
    limit?: number,
  ): SupplierFetchResult {
    const mockSuppliers: ERPSupplier[] = [
      {
        id: 1001,
        name: 'Papelaria Central LTDA',
        tradeName: 'Papelaria Central',
        cnpj: '12345678000190',
        document: '12345678000190',
        email: 'contato@papelaria.com',
        phone: '1130004000',
        contact: 'Maria Silva',
        address: 'Rua das Flores, 123, Centro, São Paulo',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        paymentTerms: '30 dias',
        raw: {},
      },
      {
        id: 1002,
        name: 'Construtora Horizonte',
        tradeName: 'Horizonte Engenharia',
        cnpj: '20987654000155',
        document: '20987654000155',
        email: 'financeiro@horizonte.com.br',
        phone: '1122223333',
        contact: 'João Pereira',
        address: 'Av. Paulista, 1500, Bela Vista, São Paulo',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310000',
        paymentTerms: '45 dias',
        raw: {},
      },
      {
        id: 1003,
        name: 'Serviços de Limpeza Brilho',
        tradeName: 'Brilho Serviços',
        cpf: '98765432100',
        document: '98765432100',
        email: 'contato@brilhoservicos.com',
        phone: '11988887777',
        contact: 'Ana Costa',
        address: 'Rua Verde, 45, Centro, Campinas',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13010010',
        paymentTerms: '15 dias',
        raw: {},
      },
      {
        id: 1004,
        name: 'TecnoDigital Equipamentos',
        tradeName: 'TecnoDigital',
        cnpj: '30456789000122',
        document: '30456789000122',
        email: 'vendas@tecnodigital.com',
        phone: '1144445555',
        contact: 'Marcos Vieira',
        address: 'Rua da Tecnologia, 200, Parque Tecnológico, Sorocaba',
        city: 'Sorocaba',
        state: 'SP',
        zipCode: '18050000',
        paymentTerms: '60 dias',
        raw: {},
      },
    ];

    let filtered = mockSuppliers;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = mockSuppliers.filter((supplier) => {
        const candidates = [
          supplier.name,
          supplier.tradeName,
          supplier.contact,
          supplier.document,
        ];
        return candidates.some((value) =>
          value ? value.toLowerCase().includes(lower) : false,
        );
      });
    }

    const total = filtered.length;
    const suppliers = limit ? filtered.slice(0, limit) : filtered;
    return { suppliers, total };
  }

  /**
   * Dados mock para desenvolvimento e fallback
   */
  private getMockProducts(searchTerm: string, limit?: number): ERPProduct[] {
    const mockProducts: ERPProduct[] = [
      { codigo: "PROD001", descricao: "Papel A4 75g/m² Branco", unidade: "Resma", preco: 25.90 },
      { codigo: "PROD002", descricao: "Caneta Esferográfica Azul", unidade: "Unidade", preco: 2.50 },
      { codigo: "PROD003", descricao: "Grampeador Médio", unidade: "Unidade", preco: 35.00 },
      { codigo: "PROD004", descricao: "Clips Nº 2/0", unidade: "Caixa", preco: 8.90 },
      { codigo: "PROD005", descricao: "Pasta Suspensa A4", unidade: "Unidade", preco: 12.50 },
      { codigo: "PROD006", descricao: "Toner HP LaserJet P1102", unidade: "Unidade", preco: 180.00 },
      { codigo: "PROD007", descricao: "Mouse Óptico USB", unidade: "Unidade", preco: 45.00 },
      { codigo: "PROD008", descricao: "Teclado ABNT2 USB", unidade: "Unidade", preco: 85.00 },
      { codigo: "PROD009", descricao: "Monitor LED 21.5\"", unidade: "Unidade", preco: 650.00 },
      { codigo: "PROD010", descricao: "Cabo HDMI 1.5m", unidade: "Unidade", preco: 25.00 },
      { codigo: "SERV001", descricao: "Manutenção Preventiva Ar Condicionado", unidade: "Serviço", preco: 150.00 },
      { codigo: "SERV002", descricao: "Limpeza de Escritório", unidade: "Hora", preco: 35.00 },
      { codigo: "MAT001", descricao: "Cimento Portland CP-II", unidade: "Saco", preco: 28.50 },
      { codigo: "MAT002", descricao: "Tijolo Cerâmico 6 Furos", unidade: "Milheiro", preco: 450.00 },
      { codigo: "EPI001", descricao: "Capacete de Segurança Branco", unidade: "Unidade", preco: 25.00 },
      { codigo: "EPI002", descricao: "Luva de Segurança Látex", unidade: "Par", preco: 8.50 },
    ];

    // Filtrar produtos baseado no termo de busca
    const searchTermLower = searchTerm.toLowerCase();
    const filteredProducts = mockProducts.filter(product => 
      product.codigo.toLowerCase().includes(searchTermLower) ||
      product.descricao.toLowerCase().includes(searchTermLower)
    );

    // Aplicar limite se especificado
    return limit ? filteredProducts.slice(0, limit) : filteredProducts;
  }

  /**
   * Testa a conectividade com o ERP
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.enabled) {
      return { success: false, message: 'ERP integration is disabled' };
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}${this.productsEndpoint}?limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
        5000,
      );

      if (response.ok) {
        return { success: true, message: 'ERP connection successful' };
      } else {
        return { success: false, message: `ERP responded with status: ${response.status}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `ERP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout = this.timeout,
    externalSignal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const abortListener = () => controller.abort();

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', abortListener, { once: true });
      }
    }

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortListener);
      }
    }
  }
}

export const erpService = new ERPService();
export type {
  ERPProduct,
  ProductSearchParams,
  ERPSupplier,
  SupplierFetchParams,
  SupplierFetchResult,
};