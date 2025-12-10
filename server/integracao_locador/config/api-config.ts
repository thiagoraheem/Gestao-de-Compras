import { z } from 'zod';

const ApiConfigSchema = z.object({
  baseUrl: z.string().url(),
  version: z.string().default('v1'),
  timeoutMs: z.number().int().positive().default(10000),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

let cachedConfig: ApiConfig | null = null;

export function getApiConfig(): ApiConfig {
  if (cachedConfig) return cachedConfig;

  const baseUrl = process.env.BASE_API_URL || 'http://localhost:5001/api';
  const version = process.env.API_VERSION || 'v1';
  const timeoutMs = Number(process.env.API_TIMEOUT_MS || 10000);

  const parsed = ApiConfigSchema.parse({ baseUrl, version, timeoutMs });
  cachedConfig = parsed;
  return parsed;
}

export function setApiConfig(config: Partial<ApiConfig>) {
  const current = getApiConfig();
  const merged = { ...current, ...config };
  cachedConfig = ApiConfigSchema.parse(merged);
}

