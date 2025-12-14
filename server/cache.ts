import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "../shared/realtime-events";
import { realtime } from "./realtime";

// Simple in-memory cache with TTL (Time To Live)
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // TTL in milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60000) { // Cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  set(key: string, data: any, ttlMs = 30000): void { // Default 30 seconds TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Remove expired entries
  private cleanup(): void {
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    });
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // Invalidate cache entries by pattern
  invalidatePattern(pattern: string): number {
    let count = 0;
    this.cache.forEach((_entry, key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    });
    return count;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Cache configuration for different endpoints
export const CACHE_CONFIG = {
  // Cache settings for different route patterns
  '/api/purchase-requests': {
    ttl: 15000, // 15 seconds for purchase requests list
    enabled: true
  },
  '/api/quotations/purchase-request': {
    ttl: 20000, // 20 seconds for quotation data
    enabled: true
  },
  '/api/auth/check': {
    ttl: 60000, // 1 minute for auth check
    enabled: true
  },
  '/api/suppliers': {
    ttl: 300000, // 5 minutes for suppliers (less frequent changes)
    enabled: true
  },
  '/api/companies': {
    ttl: 300000, // 5 minutes for companies
    enabled: true
  }
  ,
  '/api/centros-custo': {
    ttl: 300000,
    enabled: true
  },
  '/api/plano-contas': {
    ttl: 300000,
    enabled: true
  }
  ,
  '/api/integracao-locador/centros-custo': {
    ttl: 300000,
    enabled: true
  }
};

// Create global cache instance
export const apiCache = new SimpleCache();

// Cache middleware factory
export function createCacheMiddleware(defaultTtl = 30000) {
  return (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching is enabled for this route
    const routeConfig = Object.entries(CACHE_CONFIG).find(([pattern]) => 
      req.path.startsWith(pattern)
    );

    if (!routeConfig || !routeConfig[1].enabled) {
      return next();
    }

    const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    const cachedData = apiCache.get(cacheKey);

    if (cachedData) {
      // Set cache headers
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache the response
    res.json = function(data: any) {
      // Cache successful responses only
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ttl = routeConfig[1].ttl || defaultTtl;
        apiCache.set(cacheKey, data, ttl);
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

// Helper function to invalidate cache when data changes
export function invalidateCache(patterns: string[]): void {
  patterns.forEach(pattern => {
    const count = apiCache.invalidatePattern(pattern);
    // Cache invalidation completed
    if (pattern.includes("/api/purchase-requests") && count > 0) {
      realtime.publish(REALTIME_CHANNELS.PURCHASE_REQUESTS, {
        event: PURCHASE_REQUEST_EVENTS.UPDATED,
        payload: { reason: "cache-invalidation" },
      });
    }
  });
}
