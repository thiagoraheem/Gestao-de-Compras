import { HttpClient } from '../utils/http-client';
import { getEndpoints } from '../config/endpoints-registry';
import type { ApiCostCenter } from '../models/types';

const cache: { data: ApiCostCenter[] | null; ts: number } = { data: null, ts: 0 };
const TTL_MS = 5 * 60 * 1000;

export class CostCenterService {
  private client = new HttpClient();

  async list(): Promise<ApiCostCenter[]> {
    if (cache.data && Date.now() - cache.ts < TTL_MS) return cache.data;
    const { costCenter } = getEndpoints();
    const data = await this.client.get<any>(costCenter);
    const items: ApiCostCenter[] = Array.isArray(data)
      ? data.map(mapCostCenter)
      : (Array.isArray(data?.items) ? data.items.map(mapCostCenter) : []);
    cache.data = items;
    cache.ts = Date.now();
    return items;
  }
}

function mapCostCenter(raw: any): ApiCostCenter {
  return {
    idCostCenter: Number(raw.idCostCenter ?? raw.id ?? 0),
    parentId: raw.parentId ?? null,
    name: raw.name ?? null,
  };
}

export const costCenterService = new CostCenterService();
