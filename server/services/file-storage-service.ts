import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac, randomUUID } from "node:crypto";
import mime from "mime-types";
import { configService } from "./configService";

export type UploadCategory =
  | "supplier-quotations"
  | "nfe-xml"
  | "company-logos";

export type UploadFileInput = {
  category: UploadCategory;
  originalName: string;
  contentType?: string;
  buffer: Buffer;
  entityId?: string | number | null;
  preferredLocalName?: string;
};

export type StoredFileResult = {
  storage: "s3" | "local";
  filePath: string;
  fileName: string;
  contentType: string;
  size: number;
  bucket?: string;
  key?: string;
  localPath?: string;
  signedUrl?: string;
};

const LOCAL_UPLOAD_DIRS: Record<UploadCategory, string> = {
  "supplier-quotations": path.join("uploads", "supplier_quotations"),
  "nfe-xml": path.join("uploads", "nfe_xml"),
  "company-logos": path.join("uploads", "company_logos"),
};

const S3_PREFIXES: Record<UploadCategory, string> = {
  "supplier-quotations": "supplier-quotations",
  "nfe-xml": "nfe-xml",
  "company-logos": "company-logos",
};

export class FileStorageService {
  async uploadFile(input: UploadFileInput): Promise<StoredFileResult> {
    const config = await configService.getFileStorageConfig();
    const normalizedName = sanitizeFilename(input.originalName);
    const contentType = input.contentType || inferMimeType(normalizedName);

    if (config.enabled) {
      try {
        return await this.uploadToS3({
          ...input,
          originalName: normalizedName,
          contentType,
        });
      } catch (error) {
        console.error("[file-storage] Falha no upload para S3, usando fallback local:", error);
        if (!config.localFallbackEnabled) {
          throw error;
        }
      }
    }

    return this.uploadToLocal({
      ...input,
      originalName: normalizedName,
      contentType,
    });
  }

  async resolveFile(filePath: string): Promise<StoredFileResult> {
    if (isS3Path(filePath)) {
      const { bucket, key } = parseS3Path(filePath);
      return {
        storage: "s3",
        filePath,
        fileName: path.basename(key),
        contentType: inferMimeType(key),
        size: 0,
        bucket,
        key,
      };
    }

    const resolvedLocalPath = resolveLocalPath(filePath);
    const stats = await fs.promises.stat(resolvedLocalPath);
    return {
      storage: "local",
      filePath,
      fileName: path.basename(resolvedLocalPath),
      contentType: inferMimeType(resolvedLocalPath),
      size: stats.size,
      localPath: resolvedLocalPath,
    };
  }

  async openFileStream(filePath: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    contentLength?: number;
    fileName: string;
  }> {
    if (isS3Path(filePath)) {
      const response = await this.executeS3Request({ method: "GET", filePath });
      const body = response.body;
      if (!body) {
        throw new Error("Arquivo não encontrado no S3");
      }

      return {
        stream: body as unknown as NodeJS.ReadableStream,
        contentType: response.headers.get("content-type") || inferMimeType(filePath),
        contentLength: Number(response.headers.get("content-length") || "") || undefined,
        fileName: path.basename(parseS3Path(filePath).key),
      };
    }

    const localPath = resolveLocalPath(filePath);
    const stats = await fs.promises.stat(localPath);
    return {
      stream: fs.createReadStream(localPath),
      contentType: inferMimeType(localPath),
      contentLength: stats.size,
      fileName: path.basename(localPath),
    };
  }

  async readFileBuffer(filePath: string): Promise<Buffer> {
    if (isS3Path(filePath)) {
      const response = await this.executeS3Request({ method: "GET", filePath });
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return fs.promises.readFile(resolveLocalPath(filePath));
  }

  async deleteFile(filePath?: string | null): Promise<void> {
    if (!filePath) return;

    if (isS3Path(filePath)) {
      try {
        await this.executeS3Request({ method: "DELETE", filePath });
      } catch (error) {
        console.error("[file-storage] Falha ao excluir arquivo no S3:", error);
      }
      return;
    }

    try {
      await fs.promises.unlink(resolveLocalPath(filePath));
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.error("[file-storage] Falha ao excluir arquivo local:", error);
      }
    }
  }

  buildCompanyLogoProxyUrl(companyId: number) {
    return `/api/companies/${companyId}/logo`;
  }

  private async uploadToS3(input: UploadFileInput & { contentType: string }): Promise<StoredFileResult> {
    const config = await configService.getFileStorageConfig();
    this.ensureS3EnabledAndConfigured(config);

    const key = this.buildS3Key(input.category, input.entityId, input.originalName);
    const filePath = `s3://${config.bucket}/${key}`;

    await this.executeS3Request({
      method: "PUT",
      filePath,
      body: input.buffer,
      headers: {
        "content-type": input.contentType,
        "content-length": String(input.buffer.length),
      },
    });

    return {
      storage: "s3",
      filePath,
      fileName: input.originalName,
      contentType: input.contentType,
      size: input.buffer.length,
      bucket: config.bucket,
      key,
    };
  }

  private async uploadToLocal(input: UploadFileInput & { contentType: string }): Promise<StoredFileResult> {
    const relativeDir = LOCAL_UPLOAD_DIRS[input.category];
    const absoluteDir = path.join(process.cwd(), relativeDir);
    await fs.promises.mkdir(absoluteDir, { recursive: true });

    const extension = path.extname(input.originalName);
    const basename = input.preferredLocalName
      ? sanitizeFilename(input.preferredLocalName)
      : `${Date.now()}-${randomUUID()}${extension}`;
    const fileName = basename.endsWith(extension) ? basename : `${basename}${extension}`;
    const absolutePath = path.join(absoluteDir, fileName);
    await fs.promises.writeFile(absolutePath, input.buffer);

    return {
      storage: "local",
      filePath: `/${path.posix.join(relativeDir.replace(/\\/g, "/"), fileName)}`,
      fileName: input.originalName,
      contentType: input.contentType,
      size: input.buffer.length,
      localPath: absolutePath,
    };
  }

  private buildS3Key(category: UploadCategory, entityId: string | number | null | undefined, originalName: string) {
    const sanitizedName = sanitizeFilename(originalName);
    const entitySegment = entityId === null || entityId === undefined ? "general" : String(entityId);
    return `${S3_PREFIXES[category]}/${entitySegment}/${Date.now()}-${randomUUID()}-${sanitizedName}`;
  }

  private ensureS3EnabledAndConfigured(config: Awaited<ReturnType<typeof configService.getFileStorageConfig>>) {
    if (!config.enabled) {
      throw new Error("S3 não está habilitado nas configurações do sistema");
    }
    if (!config.bucket.trim()) {
      throw new Error("Bucket S3 não configurado");
    }
    if (!config.credentials.accessKeyId.trim() || !config.credentials.secretAccessKey.trim()) {
      throw new Error("Credenciais S3 não configuradas");
    }
  }

  private async executeS3Request(args: {
    method: "GET" | "PUT" | "DELETE";
    filePath: string;
    body?: Buffer;
    headers?: Record<string, string>;
  }) {
    const config = await configService.getFileStorageConfig();
    this.ensureS3EnabledAndConfigured(config);

    const { bucket, key } = parseS3Path(args.filePath);
    const endpointInfo = buildS3Endpoint({
      bucket,
      key,
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });

    const signed = signAwsV4Request({
      method: args.method,
      url: endpointInfo.url,
      region: config.region,
      service: "s3",
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
      headers: args.headers,
      body: args.body,
    });

    const response = await fetch(signed.url, {
      method: args.method,
      headers: signed.headers,
      body: args.body,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Falha no S3 (${response.status}): ${message}`);
    }

    return response;
  }
}

export const fileStorageService = new FileStorageService();

export function sanitizeFilename(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function inferMimeType(fileName: string) {
  return (mime.lookup(fileName) || "application/octet-stream") as string;
}

export function isS3Path(filePath: string) {
  return filePath.startsWith("s3://");
}

export function parseS3Path(filePath: string) {
  const withoutScheme = filePath.replace(/^s3:\/\//, "");
  const [bucket, ...keyParts] = withoutScheme.split("/");
  return { bucket, key: keyParts.join("/") };
}

export function resolveLocalPath(filePath: string) {
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }

  if (filePath.startsWith("/")) {
    return path.join(process.cwd(), filePath.slice(1));
  }

  return path.join(process.cwd(), filePath);
}

type EndpointArgs = {
  bucket: string;
  key: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

function buildS3Endpoint({ bucket, key, region, endpoint, forcePathStyle }: EndpointArgs) {
  const normalizedKey = key.split("/").map(encodeURIComponent).join("/");
  const baseEndpoint = endpoint?.replace(/\/$/, "") || `https://s3.${region}.amazonaws.com`;
  const baseUrl = new URL(baseEndpoint);

  if (forcePathStyle) {
    baseUrl.pathname = `/${bucket}/${normalizedKey}`;
    return { url: baseUrl.toString() };
  }

  if (endpoint) {
    baseUrl.pathname = `/${normalizedKey}`;
    baseUrl.hostname = `${bucket}.${baseUrl.hostname}`;
    return { url: baseUrl.toString() };
  }

  return {
    url: `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`,
  };
}

type SignArgs = {
  method: string;
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  headers?: Record<string, string>;
  body?: Buffer;
};

function signAwsV4Request({
  method,
  url,
  region,
  service,
  accessKeyId,
  secretAccessKey,
  headers = {},
  body,
}: SignArgs) {
  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body || Buffer.alloc(0));

  const requestHeaders = new Headers(headers);
  requestHeaders.set("host", parsedUrl.host);
  requestHeaders.set("x-amz-content-sha256", payloadHash);
  requestHeaders.set("x-amz-date", amzDate);

  const canonicalHeaders = Array.from(requestHeaders.entries())
    .map(([key, value]) => [key.toLowerCase().trim(), value.trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");

  const signedHeaders = Array.from(requestHeaders.keys())
    .map((key) => key.toLowerCase().trim())
    .sort()
    .join(";");

  const canonicalRequest = [
    method.toUpperCase(),
    parsedUrl.pathname || "/",
    parsedUrl.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest, "utf8")),
  ].join("\n");

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  requestHeaders.set(
    "Authorization",
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );

  return {
    url: parsedUrl.toString(),
    headers: requestHeaders,
  };
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string) {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}
