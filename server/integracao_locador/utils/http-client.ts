import { getApiConfig } from '../config/api-config';

export type HttpError = {
  status: number;
  message: string;
  details?: unknown;
  url: string;
  method: string;
};

type RequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  retry?: number;
  timeoutMs?: number;
};

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;

  constructor() {
    const cfg = getApiConfig();
    this.baseUrl = cfg.baseUrl.replace(/\/$/, '');
    this.defaultTimeout = cfg.timeoutMs;
  }

  async get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('GET', url, undefined, opts);
  }

  async post<T>(path: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('POST', url, body, opts);
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    opts: RequestOptions = {},
  ): Promise<T> {
    const cfg = getApiConfig();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-API-Version': cfg.version,
      ...(cfg.token ? { 'Authorization': `Bearer ${cfg.token}` } : {}),
      ...(opts.headers ?? {}),
    };

    const retry = Math.max(0, opts.retry ?? 1);
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeout;

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const started = Date.now();
        if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
          console.log(`[locador] ${method} ${url} attempt=${attempt + 1} timeout=${timeoutMs}`);
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: opts.signal ?? controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const details = await safeJson(response);
          const error: HttpError = {
            status: response.status,
            message: response.statusText || 'Request failed',
            details,
            url,
            method,
          };
          if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
            const dur = Date.now() - started;
            console.warn(`[locador] ${method} ${url} status=${response.status} duration=${dur}ms`);
          }
          throw error;
        }

        const data = (await response.json()) as T;
        if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
          const dur = Date.now() - started;
          const ct = response.headers.get('content-type') || '';
          const size = typeof data === 'object' && data && 'length' in (data as any) ? (data as any).length : undefined;
          console.log(`[locador] ${method} ${url} status=${response.status} duration=${dur}ms contentType=${ct} items=${size ?? 'n/a'}`);
        }
        return data;
      } catch (err) {
        if (attempt < retry && isRetryable(err)) {
          await delay(200 * (attempt + 1));
          continue;
        }
        if (process.env.LOG_VERBOSE === 'true' || process.env.NODE_ENV === 'development') {
          const type = err instanceof Error ? err.name : typeof err;
          console.error(`[locador] error ${method} ${url} type=${type} message=${(err as any)?.message ?? String(err)}`);
        }
        throw err;
      }
    }

    throw new Error('Unreachable');
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && 'status' in err) {
    const status = (err as any).status as number;
    return status >= 500 || status === 429;
  }
  return err instanceof DOMException && err.name === 'AbortError';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const httpClient = new HttpClient();
