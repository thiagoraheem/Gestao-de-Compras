import { eq } from "drizzle-orm";
import { z } from "zod";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db } from "../db";
import { appSettings } from "../../shared/schema";

const EndpointPathSchema = z
  .string()
  .min(1)
  .transform((p) => normalizeEndpointPath(p));

const LocadorEndpointsSchema = z.object({
  combo: z.object({
    fornecedor: EndpointPathSchema,
    centroCusto: EndpointPathSchema,
    planoContas: EndpointPathSchema,
    empresa: EndpointPathSchema,
    formaPagamento: EndpointPathSchema,
  }),
  post: z.object({
    enviarSolicitacao: EndpointPathSchema.optional(),
    recebimento: EndpointPathSchema.optional(),
  }),
});

const LocadorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  endpoints: LocadorEndpointsSchema,
});

const LocadorCredentialsSchema = z.object({
  login: z.string().min(1),
  senha: z.string().min(1),
});

export type LocadorConfig = z.infer<typeof LocadorConfigSchema>;
export type LocadorCredentials = z.infer<typeof LocadorCredentialsSchema>;

export type LocadorIntegrationConfig = LocadorConfig & {
  credentials: LocadorCredentials;
};

export type LocadorIntegrationConfigPublic = LocadorConfig & {
  credentials: {
    login: string;
    senha: string;
  };
};

const DEFAULT_LOCADOR_CONFIG: LocadorConfig = {
  enabled: true,
  baseUrl: process.env.BASE_API_URL || "http://localhost:5001/api",
  endpoints: {
    combo: {
      fornecedor: "/Fornecedor",
      centroCusto: "/CostCenter",
      planoContas: "/ChartOfAccounts",
      empresa: "/Empresa",
      formaPagamento: "/FormaPagamento",
    },
    post: {
      enviarSolicitacao: "/Purchase/PurchaseRequest",
      recebimento: "/Purchase/PurchaseReceive",
    },
  },
};

const DEFAULT_LOCADOR_CREDENTIALS: LocadorCredentials = {
  login: process.env.LOCADOR_TECH_LOGIN || "admin",
  senha: process.env.LOCADOR_TECH_PASSWORD || "admin",
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class ConfigService {
  private locadorCache: CacheEntry<LocadorIntegrationConfig> | null = null;
  private readonly cacheTtlMs: number;

  constructor() {
    const ttl = Number(process.env.CONFIG_CACHE_TTL_MS ?? "");
    this.cacheTtlMs = Number.isFinite(ttl) && ttl > 0 ? ttl : 60_000;
  }

  invalidateLocadorCache() {
    this.locadorCache = null;
  }

  async getLocadorConfig(): Promise<LocadorIntegrationConfig> {
    if (this.locadorCache && Date.now() < this.locadorCache.expiresAt) {
      return this.locadorCache.value;
    }

    const [configRow, credRow] = await Promise.all([
      this.getSetting("locador.config"),
      this.getSetting("locador.credentials"),
    ]);

    const cfg = LocadorConfigSchema.parse({
      ...DEFAULT_LOCADOR_CONFIG,
      ...(configRow ?? {}),
    });

    const creds = LocadorCredentialsSchema.parse({
      ...DEFAULT_LOCADOR_CREDENTIALS,
      ...(credRow ?? {}),
    });

    const merged: LocadorIntegrationConfig = { ...cfg, credentials: creds };
    this.locadorCache = { value: merged, expiresAt: Date.now() + this.cacheTtlMs };
    return merged;
  }

  async getLocadorConfigPublic(): Promise<LocadorIntegrationConfigPublic> {
    const cfg = await this.getLocadorConfig();
    return {
      enabled: cfg.enabled,
      baseUrl: cfg.baseUrl,
      endpoints: cfg.endpoints,
      credentials: {
        login: cfg.credentials.login,
        senha: maskSecret(cfg.credentials.senha),
      },
    };
  }

  async updateLocadorConfig(
    payload: unknown,
    updatedBy: number | null,
  ): Promise<LocadorIntegrationConfigPublic> {
    const LocadorEndpointsPatchSchema = z.object({
      combo: z
        .object({
          fornecedor: EndpointPathSchema.optional(),
          centroCusto: EndpointPathSchema.optional(),
          planoContas: EndpointPathSchema.optional(),
          empresa: EndpointPathSchema.optional(),
          formaPagamento: EndpointPathSchema.optional(),
        })
        .optional(),
      post: z
        .object({
          enviarSolicitacao: EndpointPathSchema.optional(),
          recebimento: EndpointPathSchema.optional(),
        })
        .optional(),
    });

    const UpdateSchema = z.object({
      enabled: z.boolean().optional(),
      baseUrl: z.string().url().optional(),
      endpoints: LocadorEndpointsPatchSchema.optional(),
      credentials: LocadorCredentialsSchema.partial().optional(),
    });

    const incoming = UpdateSchema.parse(payload);
    const current = await this.getLocadorConfig();

    const nextConfig: LocadorConfig = LocadorConfigSchema.parse({
      enabled: incoming.enabled ?? current.enabled,
      baseUrl: incoming.baseUrl ?? current.baseUrl,
      endpoints: deepMerge(current.endpoints, incoming.endpoints ?? {}),
    });

    const nextCreds: LocadorCredentials = LocadorCredentialsSchema.parse({
      login: incoming.credentials?.login ?? current.credentials.login,
      senha: incoming.credentials?.senha ?? current.credentials.senha,
    });

    await Promise.all([
      this.setSetting("locador.config", nextConfig, false, updatedBy),
      this.setSetting("locador.credentials", nextCreds, true, updatedBy),
    ]);

    this.invalidateLocadorCache();
    return this.getLocadorConfigPublic();
  }

  async reloadLocadorConfig(): Promise<LocadorIntegrationConfigPublic> {
    this.invalidateLocadorCache();
    return this.getLocadorConfigPublic();
  }

  private async getSetting(key: string): Promise<any | null> {
    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (!row[0]) return null;

    const value = row[0].value as any;
    if (row[0].isSecret) {
      if (typeof value !== "string") return null;
      const decrypted = decryptString(value);
      return JSON.parse(decrypted);
    }
    return value;
  }

  private async setSetting(
    key: string,
    value: unknown,
    isSecret: boolean,
    updatedBy: number | null,
  ) {
    const now = new Date();
    const persistedValue = isSecret ? encryptString(JSON.stringify(value)) : value;

    await db
      .insert(appSettings)
      .values({
        key,
        value: persistedValue as any,
        isSecret,
        updatedAt: now,
        updatedBy,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: persistedValue as any,
          isSecret,
          updatedAt: now,
          updatedBy,
        },
      });
  }
}

export const configService = new ConfigService();

function normalizeEndpointPath(p: string) {
  const trimmed = p.trim();
  if (!trimmed) return "/";
  if (/^https?:\/\//i.test(trimmed)) {
    const u = new URL(trimmed);
    return normalizeEndpointPath(u.pathname + u.search);
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/^\/api\//i, "/");
}

function maskSecret(secret: string) {
  if (!secret) return "***";
  return "***";
}

function deepMerge<T extends Record<string, any>>(base: T, patch: any): T {
  const out: any = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] ?? {}, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function getKeyBytes(): Buffer {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("CONFIG_ENCRYPTION_KEY is required to read/write secret settings");
  }

  const tryBase64 = Buffer.from(raw, "base64");
  if (tryBase64.length === 32) return tryBase64;

  const tryHex = Buffer.from(raw, "hex");
  if (tryHex.length === 32) return tryHex;

  throw new Error("CONFIG_ENCRYPTION_KEY must decode to 32 bytes (base64 or hex)");
}

function encryptString(plainText: string): string {
  const key = getKeyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptString(cipherTextBase64: string): string {
  const key = getKeyBytes();
  const data = Buffer.from(cipherTextBase64, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const enc = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return plain.toString("utf8");
}
