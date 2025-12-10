import { HttpClient } from '../utils/http-client';
import { getEndpoints } from '../config/endpoints-registry';
import type { ChartOfAccounts } from '../models/types';

const cache: { data: ChartOfAccounts[] | null; ts: number } = { data: null, ts: 0 };
const TTL_MS = 5 * 60 * 1000;

export class ChartOfAccountsService {
  private client = new HttpClient();

  async list(): Promise<ChartOfAccounts[]> {
    if (cache.data && Date.now() - cache.ts < TTL_MS) return cache.data;
    const { chartOfAccounts } = getEndpoints();
    const data = await this.client.get<any>(chartOfAccounts);
    const items: ChartOfAccounts[] = Array.isArray(data)
      ? data.map(mapAccount)
      : (Array.isArray(data?.items) ? data.items.map(mapAccount) : []);
    cache.data = items;
    cache.ts = Date.now();
    return items;
  }
}

function mapAccount(raw: any): ChartOfAccounts {
  return {
    idChartOfAccounts: Number(raw.idChartOfAccounts ?? raw.id ?? 0),
    parentId: raw.parentId ?? null,
    accountName: raw.accountName ?? raw.name ?? null,
    isPayable: raw.isPayable ?? raw.IsPayable ?? false,
  };
}

export const chartOfAccountsService = new ChartOfAccountsService();
