import { configService } from "./configService";
import { locadorAuthService } from "./locadorAuthService";

export type LocadorHttpError = {
  status: number;
  message: string;
  url: string;
  method: string;
  details?: unknown;
};

type RequestOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export class LocadorHttpClient {
  private readonly defaultTimeoutMs: number;

  constructor() {
    const ms = Number(process.env.LOCADOR_HTTP_TIMEOUT_MS ?? "");
    this.defaultTimeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 25_000;
  }

  async get<T>(path: string, opts: RequestOptions = {}) {
    return this.request<T>("GET", path, undefined, opts);
  }

  async post<T>(path: string, body: unknown, opts: RequestOptions = {}) {
    return this.request<T>("POST", path, body, opts);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: RequestOptions = {},
  ): Promise<T> {
    return this.requestWithAuth<T>(method, path, body, opts, false);
  }

  private async requestWithAuth<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    opts: RequestOptions,
    retried: boolean,
  ): Promise<T> {
    const cfg = await configService.getLocadorConfig();
    if (!cfg.enabled) {
      throw new Error("Integração com Locador desabilitada");
    }

    const token = await locadorAuthService.getValidToken();
    const url = new URL(joinUrl(cfg.baseUrl, path));

    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(opts.headers ?? {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401 && !retried) {
        await locadorAuthService.forceRefreshToken();
        return this.requestWithAuth<T>(method, path, body, opts, true);
      }

      if (!response.ok) {
        const details = await safeJson(response);
        const err: LocadorHttpError = {
          status: response.status,
          message: response.statusText || "Request failed",
          url: url.toString(),
          method,
          details,
        };
        throw err;
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const locadorHttpClient = new LocadorHttpClient();

function joinUrl(baseUrl: string, path: string) {
  const b = baseUrl.replace(/\/$/, "");
  if (!path) return b;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

