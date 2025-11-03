import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CacheConfig {
  defaultTTL: number;
  maxAge: number;
  enableCompression: boolean;
  compressionThreshold: number;
  enableETag: boolean;
  enableLastModified: boolean;
  varyHeaders: string[];
  skipPaths: string[];
  skipMethods: string[];
  debug: boolean;
}

export interface CacheEntry {
  data: any;
  etag: string;
  lastModified: string;
  timestamp: number;
  ttl: number;
  compressed: boolean;
  size: number;
  headers: Record<string, string>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  compressionSavings: number;
  totalSize: number;
  averageResponseTime: number;
}

class IntelligentCacheManager {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    compressionSavings: 0,
    totalSize: 0,
    averageResponseTime: 0
  };
  private responseTimes: number[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      maxAge: config.maxAge || 3600, // 1 hour in seconds
      enableCompression: config.enableCompression !== false,
      compressionThreshold: config.compressionThreshold || 1024, // 1KB
      enableETag: config.enableETag !== false,
      enableLastModified: config.enableLastModified !== false,
      varyHeaders: config.varyHeaders || ['Accept-Encoding', 'Authorization'],
      skipPaths: config.skipPaths || ['/api/ws', '/api/health', '/api/metrics'],
      skipMethods: config.skipMethods || ['POST', 'PUT', 'DELETE', 'PATCH'],
      debug: config.debug || false
    };

    this.startCleanupTimer();
    this.log('Intelligent Cache Manager initialized', this.config);
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[Cache Middleware] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    console.error(`[Cache Middleware] ${message}`, error || '');
  }

  private generateCacheKey(req: Request): string {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const userId = (req as any).user?.id || 'anonymous';
    
    // Include relevant headers in cache key
    const varyData = this.config.varyHeaders.reduce((acc, header) => {
      const value = req.headers[header.toLowerCase()];
      if (value) {
        acc[header] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    const keyData = {
      method,
      url,
      userId,
      vary: varyData
    };

    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  private generateETag(data: any): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return `"${createHash('md5').update(content).digest('hex')}"`;
  }

  private shouldCache(req: Request, res: Response): boolean {
    // Skip if method is not cacheable
    if (this.config.skipMethods.includes(req.method)) {
      return false;
    }

    // Skip if path is in skip list
    const path = req.originalUrl || req.url;
    if (this.config.skipPaths.some(skipPath => path.startsWith(skipPath))) {
      return false;
    }

    // Skip if response has error status
    if (res.statusCode >= 400) {
      return false;
    }

    // Skip if response has cache-control no-cache
    const cacheControl = res.getHeader('cache-control') as string;
    if (cacheControl && cacheControl.includes('no-cache')) {
      return false;
    }

    return true;
  }

  private async compressData(data: any): Promise<{ compressed: Buffer; originalSize: number; compressedSize: number }> {
    const originalData = typeof data === 'string' ? Buffer.from(data) : Buffer.from(JSON.stringify(data));
    const originalSize = originalData.length;

    if (originalSize < this.config.compressionThreshold) {
      return {
        compressed: originalData,
        originalSize,
        compressedSize: originalSize
      };
    }

    const compressed = await gzipAsync(originalData);
    const compressedSize = compressed.length;

    this.stats.compressionSavings += (originalSize - compressedSize);

    return {
      compressed,
      originalSize,
      compressedSize
    };
  }

  private async decompressData(compressed: Buffer, wasCompressed: boolean): Promise<string> {
    if (!wasCompressed) {
      return compressed.toString();
    }

    const decompressed = await gunzipAsync(compressed);
    return decompressed.toString();
  }

  public async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.deletes++;
      return null;
    }

    this.stats.hits++;
    this.log('Cache hit', { key, age: now - entry.timestamp });
    return entry;
  }

  public async set(key: string, data: any, options: {
    ttl?: number;
    headers?: Record<string, string>;
  } = {}): Promise<void> {
    try {
      const etag = this.generateETag(data);
      const lastModified = new Date().toISOString();
      const ttl = options.ttl || this.config.defaultTTL;

      let compressed = false;
      let finalData = data;
      let size = 0;

      if (this.config.enableCompression) {
        const compressionResult = await this.compressData(data);
        finalData = compressionResult.compressed;
        size = compressionResult.compressedSize;
        compressed = compressionResult.compressedSize < compressionResult.originalSize;
      } else {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        size = Buffer.byteLength(dataStr);
      }

      const entry: CacheEntry = {
        data: finalData,
        etag,
        lastModified,
        timestamp: Date.now(),
        ttl,
        compressed,
        size,
        headers: options.headers || {}
      };

      this.cache.set(key, entry);
      this.stats.sets++;
      this.stats.totalSize += size;

      this.log('Cache set', { key, size, compressed, ttl });

    } catch (error) {
      this.error('Failed to set cache entry', error);
    }
  }

  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.deletes++;
      this.stats.totalSize -= entry.size;
      this.log('Cache deleted', { key });
      return true;
    }
    return false;
  }

  public clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.log('Cache cleared');
  }

  public getStats(): CacheStats & { hitRate: number; totalEntries: number } {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      hitRate,
      totalEntries: this.cache.size,
      averageResponseTime: this.responseTimes.length > 0 
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
        : 0
    };
  }

  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  private cleanup() {
    const now = Date.now();
    let deletedCount = 0;
    let freedSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        deletedCount++;
        freedSize += entry.size;
        this.stats.totalSize -= entry.size;
      }
    }

    if (deletedCount > 0) {
      this.log('Cleanup completed', { deleted: deletedCount, freedSize });
    }
  }

  public destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
    this.log('Cache Manager destroyed');
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const cacheKey = this.generateCacheKey(req);

      // Try to get from cache
      const cachedEntry = await this.get(cacheKey);

      if (cachedEntry) {
        // Handle conditional requests
        const ifNoneMatch = req.headers['if-none-match'];
        const ifModifiedSince = req.headers['if-modified-since'];

        if (ifNoneMatch === cachedEntry.etag) {
          res.status(304).end();
          return;
        }

        if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(cachedEntry.lastModified)) {
          res.status(304).end();
          return;
        }

        try {
          // Decompress data if needed
          const responseData = await this.decompressData(
            Buffer.isBuffer(cachedEntry.data) ? cachedEntry.data : Buffer.from(cachedEntry.data),
            cachedEntry.compressed
          );

          // Set cache headers only if response hasn't been sent
          if (!res.headersSent) {
            if (this.config.enableETag) {
              res.setHeader('ETag', cachedEntry.etag);
            }

            if (this.config.enableLastModified) {
              res.setHeader('Last-Modified', cachedEntry.lastModified);
            }

            res.setHeader('Cache-Control', `public, max-age=${this.config.maxAge}`);
            res.setHeader('X-Cache', 'HIT');

            // Set custom headers from cache
            Object.entries(cachedEntry.headers).forEach(([key, value]) => {
              res.setHeader(key, value);
            });
          }

          // Set compression header if data was compressed
          if (cachedEntry.compressed && req.headers['accept-encoding']?.includes('gzip')) {
            if (!res.headersSent) {
              res.setHeader('Content-Encoding', 'gzip');
            }
            res.send(cachedEntry.data);
          } else {
            res.json(JSON.parse(responseData));
          }

          const responseTime = Date.now() - startTime;
          this.responseTimes.push(responseTime);
          if (this.responseTimes.length > 1000) {
            this.responseTimes = this.responseTimes.slice(-1000);
          }

          return;

        } catch (error) {
          this.error('Failed to serve cached response', error);
          // Continue to next middleware if cache serving fails
        }
      }

      // Intercept response
      const originalSend = res.send;
      const originalJson = res.json;

      let responseData: any = null;
      let responseSent = false;

      res.send = function(data: any) {
        if (!responseSent) {
          responseData = data;
          responseSent = true;
        }
        return originalSend.call(this, data);
      };

      res.json = function(data: any) {
        if (!responseSent) {
          responseData = data;
          responseSent = true;
        }
        return originalJson.call(this, data);
      };

      // Continue to next middleware
      res.on('finish', async () => {
        const responseTime = Date.now() - startTime;
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > 1000) {
          this.responseTimes = this.responseTimes.slice(-1000);
        }

        // Cache response if appropriate
        if (responseData && this.shouldCache(req, res)) {
          const customHeaders: Record<string, string> = {};
          
          // Preserve important headers
          const headersToPreserve = ['content-type', 'content-language'];
          headersToPreserve.forEach(header => {
            const value = res.getHeader(header);
            if (value) {
              customHeaders[header] = value.toString();
            }
          });

          await this.set(cacheKey, responseData, {
            headers: customHeaders
          });

          // Only set header if response hasn't been sent yet
          if (!res.headersSent) {
            res.setHeader('X-Cache', 'MISS');
          }
        }
      });

      next();
    };
  }
}

// Singleton instance
let globalCacheManager: IntelligentCacheManager | null = null;

export function createCacheMiddleware(config?: Partial<CacheConfig>) {
  if (!globalCacheManager) {
    globalCacheManager = new IntelligentCacheManager(config);
  }
  return globalCacheManager.middleware();
}

export function getCacheManager(): IntelligentCacheManager | null {
  return globalCacheManager;
}

export function destroyCacheManager() {
  if (globalCacheManager) {
    globalCacheManager.destroy();
    globalCacheManager = null;
  }
}

// Delta update middleware
export function createDeltaUpdateMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(data: any) {
      // Check if client supports delta updates
      const supportsDelta = req.headers['x-supports-delta'] === 'true';
      const lastVersion = req.headers['x-last-version'] as string;

      if (supportsDelta && lastVersion && data && typeof data === 'object') {
        // This is a simplified delta implementation
        // In a real implementation, you would compare with the last known version
        // and send only the differences
        
        const deltaData = {
          version: Date.now().toString(),
          delta: true,
          changes: data, // Simplified - should be actual diff
          timestamp: new Date().toISOString()
        };

        res.setHeader('X-Delta-Response', 'true');
        res.setHeader('X-Version', deltaData.version);
        
        return originalJson.call(this, deltaData);
      }

      return originalJson.call(this, data);
    };

    next();
  };
}