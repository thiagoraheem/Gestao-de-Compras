import { z } from "zod";
import { configService } from "./configService";

const LoginResponseSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

type TokenCache = {
  token: string;
  expiresAt: number;
};

export class LocadorAuthService {
  private tokenCache: TokenCache | null = null;
  private inFlightLogin: Promise<string> | null = null;
  private readonly preemptRefreshMs: number;

  constructor() {
    const ms = Number(process.env.LOCADOR_TOKEN_PREEMPT_MS ?? "");
    this.preemptRefreshMs = Number.isFinite(ms) && ms > 0 ? ms : 120_000;
  }

  invalidateToken() {
    this.tokenCache = null;
  }

  async getValidToken(): Promise<string> {
    const cfg = await configService.getLocadorConfig();
    if (!cfg.enabled) {
      throw new Error("Integração com Locador desabilitada");
    }

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - now > this.preemptRefreshMs) {
      return this.tokenCache.token;
    }

    if (!this.inFlightLogin) {
      this.inFlightLogin = this.login().finally(() => {
        this.inFlightLogin = null;
      });
    }
    return this.inFlightLogin;
  }

  async forceRefreshToken(): Promise<string> {
    this.invalidateToken();
    return this.getValidToken();
  }

  private async login(): Promise<string> {
    const cfg = await configService.getLocadorConfig();
    const url = new URL(joinUrl(cfg.baseUrl, "/Auth/login"));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login: cfg.credentials.login,
        senha: cfg.credentials.senha,
      }),
    });

    if (!response.ok) {
      const text = await safeText(response);
      throw new Error(`Falha no login do Locador (HTTP ${response.status}): ${text}`);
    }

    const json = await response.json();
    const parsed = LoginResponseSchema.parse(json);

    this.tokenCache = {
      token: parsed.token,
      expiresAt: Date.now() + parsed.expiresIn * 1000,
    };

    return parsed.token;
  }
}

export const locadorAuthService = new LocadorAuthService();

function joinUrl(baseUrl: string, path: string) {
  const b = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

