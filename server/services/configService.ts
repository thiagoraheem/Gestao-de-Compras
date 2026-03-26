import { eq, sql } from "drizzle-orm";
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
  sendEnabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  endpoints: LocadorEndpointsSchema,
});

const LocadorCredentialsSchema = z.object({
  login: z.string().min(1),
  senha: z.string().min(1),
});

const FileStorageConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    bucket: z.string().default(""),
    region: z.string().default("us-east-1"),
    endpoint: z.string().url().optional().or(z.literal("")).transform((value) => value || undefined),
    forcePathStyle: z.boolean().default(false),
    signedUrlExpiresInSeconds: z.number().int().min(60).max(7 * 24 * 60 * 60).default(3600),
    localFallbackEnabled: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && !value.bucket.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bucket"], message: "Bucket é obrigatório quando o S3 está habilitado" });
    }
  });

const FileStorageCredentialsSchema = z.object({
  accessKeyId: z.string().default(""),
  secretAccessKey: z.string().default(""),
});

const FileStorageCredentialsPatchSchema = z.object({
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
});

export type LocadorConfig = z.infer<typeof LocadorConfigSchema>;
export type LocadorCredentials = z.infer<typeof LocadorCredentialsSchema>;
export type FileStorageConfig = z.infer<typeof FileStorageConfigSchema>;
export type FileStorageCredentials = z.infer<typeof FileStorageCredentialsSchema>;

export type LocadorIntegrationConfig = LocadorConfig & {
  credentials: LocadorCredentials;
};

export type LocadorIntegrationConfigPublic = LocadorConfig & {
  credentials: {
    login: string;
    senha: string;
  };
};

export type FileStorageIntegrationConfig = FileStorageConfig & {
  credentials: FileStorageCredentials;
};

export type FileStorageIntegrationConfigPublic = FileStorageConfig & {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
};

const DEFAULT_LOCADOR_CONFIG: LocadorConfig = {
  enabled: true,
  sendEnabled: true,
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

const DEFAULT_FILE_STORAGE_CONFIG: FileStorageConfig = {
  enabled: (process.env.AWS_S3_ENABLED || "false").toLowerCase() === "true",
  bucket: process.env.AWS_S3_BUCKET || "",
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: (process.env.AWS_S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true",
  signedUrlExpiresInSeconds: Number(process.env.AWS_S3_SIGNED_URL_EXPIRES_IN || 3600),
  localFallbackEnabled:
    process.env.AWS_S3_LOCAL_FALLBACK === undefined
      ? true
      : process.env.AWS_S3_LOCAL_FALLBACK.toLowerCase() !== "false",
};

const DEFAULT_FILE_STORAGE_CREDENTIALS: FileStorageCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class ConfigService {
  private locadorCache: CacheEntry<LocadorIntegrationConfig> | null = null;
  private fileStorageCache: CacheEntry<FileStorageIntegrationConfig> | null = null;
  private readonly cacheTtlMs: number;

  constructor() {
    const ttl = Number(process.env.CONFIG_CACHE_TTL_MS ?? "");
    this.cacheTtlMs = Number.isFinite(ttl) && ttl > 0 ? ttl : 60_000;
  }

  invalidateLocadorCache() {
    this.locadorCache = null;
  }

  invalidateFileStorageCache() {
    this.fileStorageCache = null;
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
      sendEnabled: cfg.sendEnabled,
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
      sendEnabled: z.boolean().optional(),
      baseUrl: z.string().url().optional(),
      endpoints: LocadorEndpointsPatchSchema.optional(),
      credentials: LocadorCredentialsSchema.partial().optional(),
    });

    const incoming = UpdateSchema.parse(payload);
    const current = await this.getLocadorConfig();

    const nextConfig: LocadorConfig = LocadorConfigSchema.parse({
      enabled: incoming.enabled ?? current.enabled,
      sendEnabled: incoming.sendEnabled ?? current.sendEnabled,
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

    await this.writeAuditLog(
      "Atualização de configuração do Locador",
      updatedBy,
      { enabled: current.enabled, sendEnabled: current.sendEnabled },
      { enabled: nextConfig.enabled, sendEnabled: nextConfig.sendEnabled },
    );

    this.invalidateLocadorCache();
    return this.getLocadorConfigPublic();
  }

  async reloadLocadorConfig(): Promise<LocadorIntegrationConfigPublic> {
    this.invalidateLocadorCache();
    return this.getLocadorConfigPublic();
  }

  async getFileStorageConfig(): Promise<FileStorageIntegrationConfig> {
    if (this.fileStorageCache && Date.now() < this.fileStorageCache.expiresAt) {
      return this.fileStorageCache.value;
    }

    const [configRow, credRow] = await Promise.all([
      this.getSetting("file_storage.config"),
      this.getSetting("file_storage.credentials"),
    ]);

    const cfg = FileStorageConfigSchema.parse({
      ...DEFAULT_FILE_STORAGE_CONFIG,
      ...(configRow ?? {}),
    });

    const creds = FileStorageCredentialsSchema.parse({
      ...DEFAULT_FILE_STORAGE_CREDENTIALS,
      ...(credRow ?? {}),
    });

    const merged: FileStorageIntegrationConfig = { ...cfg, credentials: creds };
    this.fileStorageCache = { value: merged, expiresAt: Date.now() + this.cacheTtlMs };
    return merged;
  }

  async getFileStorageConfigPublic(): Promise<FileStorageIntegrationConfigPublic> {
    const cfg = await this.getFileStorageConfig();
    return {
      enabled: cfg.enabled,
      bucket: cfg.bucket,
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      signedUrlExpiresInSeconds: cfg.signedUrlExpiresInSeconds,
      localFallbackEnabled: cfg.localFallbackEnabled,
      credentials: {
        accessKeyId: cfg.credentials.accessKeyId,
        secretAccessKey: maskSecret(cfg.credentials.secretAccessKey),
      },
    };
  }

  async updateFileStorageConfig(
    payload: unknown,
    updatedBy: number | null,
  ): Promise<FileStorageIntegrationConfigPublic> {
    const UpdateSchema = z.object({
      enabled: z.boolean().optional(),
      bucket: z.string().optional(),
      region: z.string().min(1).optional(),
      endpoint: z.string().url().optional().or(z.literal("")).optional(),
      forcePathStyle: z.boolean().optional(),
      signedUrlExpiresInSeconds: z.number().int().min(60).max(7 * 24 * 60 * 60).optional(),
      localFallbackEnabled: z.boolean().optional(),
      credentials: FileStorageCredentialsPatchSchema.optional(),
    });

    const incoming = UpdateSchema.parse(payload);
    const current = await this.getFileStorageConfig();

    const nextConfig: FileStorageConfig = FileStorageConfigSchema.parse({
      enabled: incoming.enabled ?? current.enabled,
      bucket: incoming.bucket ?? current.bucket,
      region: incoming.region ?? current.region,
      endpoint: incoming.endpoint === undefined ? current.endpoint : incoming.endpoint || undefined,
      forcePathStyle: incoming.forcePathStyle ?? current.forcePathStyle,
      signedUrlExpiresInSeconds:
        incoming.signedUrlExpiresInSeconds ?? current.signedUrlExpiresInSeconds,
      localFallbackEnabled: incoming.localFallbackEnabled ?? current.localFallbackEnabled,
    });

    const nextCreds: FileStorageCredentials = FileStorageCredentialsSchema.parse({
      accessKeyId: incoming.credentials?.accessKeyId ?? current.credentials.accessKeyId,
      secretAccessKey:
        incoming.credentials?.secretAccessKey ?? current.credentials.secretAccessKey,
    });

    await Promise.all([
      this.setSetting("file_storage.config", nextConfig, false, updatedBy),
      this.setSetting("file_storage.credentials", nextCreds, true, updatedBy),
    ]);

    await this.writeAuditLog(
      "Atualização de configuração de storage de arquivos",
      updatedBy,
      {
        enabled: current.enabled,
        bucket: current.bucket,
        region: current.region,
        localFallbackEnabled: current.localFallbackEnabled,
      },
      {
        enabled: nextConfig.enabled,
        bucket: nextConfig.bucket,
        region: nextConfig.region,
        localFallbackEnabled: nextConfig.localFallbackEnabled,
      },
    );

    this.invalidateFileStorageCache();
    return this.getFileStorageConfigPublic();
  }

  async reloadFileStorageConfig(): Promise<FileStorageIntegrationConfigPublic> {
    this.invalidateFileStorageCache();
    return this.getFileStorageConfigPublic();
  }

  private async writeAuditLog(
    actionDescription: string,
    updatedBy: number | null,
    beforeData: unknown,
    afterData: unknown,
  ) {
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (purchase_request_id, action_type, action_description, performed_by, before_data, after_data, affected_tables)
        VALUES (
          0,
          'config_update',
          ${actionDescription},
          ${updatedBy},
          ${JSON.stringify(beforeData)}::jsonb,
          ${JSON.stringify(afterData)}::jsonb,
          ARRAY['app_settings']
        )
      `);
    } catch (error) {
      console.error("Failed to insert audit log for config update:", error);
    }
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
