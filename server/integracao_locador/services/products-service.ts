import { HttpClient } from '../utils/http-client';
import { getEndpoints } from '../config/endpoints-registry';
import type { Product } from '../models/types';

export class ProductsService {
  private client = new HttpClient();

  async search(params: { search?: string; limit?: number; codCategoria?: number; type?: string }): Promise<Product[]> {
    const { products } = getEndpoints();
    const url = new URL(products, 'http://dummy');
    if (params.search) url.searchParams.set('search', params.search);
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    if (params.codCategoria) url.searchParams.set('codCategoria', String(params.codCategoria));
    if (params.type) url.searchParams.set('type', params.type);

    const path = url.pathname + (url.search || '');
    const data = await this.client.get<any>(path);
    const records: any[] = Array.isArray(data)
      ? data
      : (data?.items ?? data?.data ?? data?.results ?? []);

    return records.map(mapProduct);
  }
}

function mapProduct(raw: any): Product {
  return {
    id: Number(raw.id ?? 0),
    codigo: raw.codigo ?? null,
    descricao: raw.descricao ?? null,
    descricaocompleta: raw.descricaocompleta ?? null,
    categoria: raw.categoria ?? null,
    quantidade: Number(raw.quantidade ?? 0),
    preco: raw.preco ?? null,
    unidade: raw.unidade ?? null,
    ativo: Boolean(raw.ativo ?? true),
    tipo: raw.tipo ?? null,
    partNumber: raw.partNumber ?? null,
  };
}

export const productsService = new ProductsService();
