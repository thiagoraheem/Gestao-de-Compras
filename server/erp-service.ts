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

class ERPService {
  private baseUrl: string;
  private timeout: number;
  private enabled: boolean;

  constructor() {
    this.baseUrl = config.erp.baseUrl;
    this.timeout = config.erp.timeout;
    this.enabled = config.erp.enabled;
  }

  /**
   * Busca produtos no ERP externo
   */
  async searchProducts(params: ProductSearchParams): Promise<ERPProduct[]> {
    if (!this.enabled) {
      return this.getMockProducts(params.q, params.limit);
    }

    try {
      const searchUrl = `${this.baseUrl}${config.erp.productsEndpoint}`;
      const queryParams = new URLSearchParams({
        search: params.q,
        ...(params.limit && { limit: params.limit.toString() })
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${searchUrl}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ERP API responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Mapear os dados do ERP para o formato esperado
      return this.mapERPResponse(data);

    } catch (error) {
      console.error('Error fetching products from ERP:', error);
      
      // Em caso de erro, retornar dados mock como fallback
      return this.getMockProducts(params.q, params.limit);
    }
  }

  /**
   * Mapeia a resposta do ERP para o formato esperado
   */
  private mapERPResponse(data: any): ERPProduct[] {
    if (!Array.isArray(data)) {
      console.warn('ERP response is not an array, trying to extract products');
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds for test

      const response = await fetch(`${this.baseUrl}${config.erp.productsEndpoint}?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
}

export const erpService = new ERPService();
export type { ERPProduct, ProductSearchParams };