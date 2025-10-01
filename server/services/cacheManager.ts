import { EventEmitter } from 'events';

interface CacheItem {
  data: any;
  timestamp: number;
  version: number;
  lastAccessed: number;
  ttl?: number; // Custom TTL for specific items
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
  cleanupInterval: number;
  enableStats: boolean;
}

interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  expirations: number;
  totalRequests: number;
}

class IntelligentCacheManager extends EventEmitter {
  private cache = new Map<string, CacheItem>();
  private config: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 minutes default
    maxSize: 1000, // maximum 1000 items
    cleanupInterval: 60 * 1000, // cleanup every minute
    enableStats: true,
  };
  private cleanupTimer?: NodeJS.Timeout;
  private stats: CacheStats = {
    size: 0,
    maxSize: 1000,
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    expirations: 0,
    totalRequests: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.stats.maxSize = this.config.maxSize;
    this.startCleanup();
    
    console.log('🗄️ Cache Manager initialized with config:', {
      ttl: `${this.config.ttl / 1000}s`,
      maxSize: this.config.maxSize,
      cleanupInterval: `${this.config.cleanupInterval / 1000}s`,
    });
  }

  set(key: string, data: any, version: number = 1, customTtl?: number): void {
    // Check size limit and evict if necessary
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const now = Date.now();
    const item: CacheItem = {
      data,
      timestamp: now,
      version,
      lastAccessed: now,
      ttl: customTtl,
    };

    this.cache.set(key, item);
    this.stats.size = this.cache.size;
    
    // Emit event for WebSocket broadcasting
    this.emit('cache:update', { 
      key, 
      data, 
      version, 
      timestamp: now,
      action: 'set'
    });
    
    console.log(`📝 Cache SET: ${key} (v${version})`);
  }

  get(key: string): any {
    this.stats.totalRequests++;
    
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    }
    
    const now = Date.now();
    const ttl = item.ttl || this.config.ttl;
    
    // Check TTL
    if (now - item.timestamp > ttl) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.expirations++;
      this.stats.misses++;
      this.updateHitRate();
      
      this.emit('cache:expire', { key, reason: 'ttl_expired' });
      console.log(`⏰ Cache EXPIRED: ${key}`);
      return null;
    }
    
    // Update last accessed time
    item.lastAccessed = now;
    this.stats.hits++;
    this.updateHitRate();
    
    console.log(`✅ Cache HIT: ${key} (v${item.version})`);
    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    const now = Date.now();
    const ttl = item.ttl || this.config.ttl;
    
    if (now - item.timestamp > ttl) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.expirations++;
      this.emit('cache:expire', { key, reason: 'ttl_expired' });
      return false;
    }
    
    return true;
  }

  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
      this.emit('cache:invalidate', { key, action: 'single' });
      console.log(`🗑️ Cache INVALIDATED: ${key}`);
    }
    return deleted;
  }

  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
    this.stats.size = this.cache.size;
    
    if (keysToDelete.length > 0) {
      this.emit('cache:invalidate', { 
        pattern, 
        keys: keysToDelete, 
        count: keysToDelete.length,
        action: 'pattern'
      });
      console.log(`🗑️ Cache PATTERN INVALIDATED: ${pattern} (${keysToDelete.length} items)`);
    }
    
    return keysToDelete.length;
  }

  invalidateByPrefix(prefix: string): number {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
    this.stats.size = this.cache.size;
    
    if (keysToDelete.length > 0) {
      this.emit('cache:invalidate', { 
        prefix, 
        keys: keysToDelete, 
        count: keysToDelete.length,
        action: 'prefix'
      });
      console.log(`🗑️ Cache PREFIX INVALIDATED: ${prefix}* (${keysToDelete.length} items)`);
    }
    
    return keysToDelete.length;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.emit('cache:clear', { previousSize: size });
    console.log(`🧹 Cache CLEARED: ${size} items removed`);
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.size = this.cache.size;
      this.stats.evictions++;
      this.emit('cache:evict', { key: oldestKey, reason: 'lru' });
      console.log(`🚮 Cache LRU EVICTED: ${oldestKey}`);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      for (const [key, item] of this.cache.entries()) {
        const ttl = item.ttl || this.config.ttl;
        if (now - item.timestamp > ttl) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        this.cache.delete(key);
        this.stats.expirations++;
      });
      
      this.stats.size = this.cache.size;
      
      if (keysToDelete.length > 0) {
        this.emit('cache:cleanup', { 
          expiredKeys: keysToDelete, 
          count: keysToDelete.length 
        });
        console.log(`🧹 Cache cleanup: ${keysToDelete.length} expired items removed`);
      }
    }, this.config.cleanupInterval);
  }

  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getDetailedStats(): any {
    const now = Date.now();
    const itemsByAge: { [key: string]: number } = {};
    const itemsByAccess: { [key: string]: number } = {};
    
    for (const [key, item] of this.cache.entries()) {
      const age = Math.floor((now - item.timestamp) / 1000);
      const lastAccess = Math.floor((now - item.lastAccessed) / 1000);
      
      itemsByAge[key] = age;
      itemsByAccess[key] = lastAccess;
    }
    
    return {
      ...this.stats,
      config: this.config,
      itemsByAge,
      itemsByAccess,
      memoryUsage: process.memoryUsage(),
    };
  }

  // Kanban-specific cache methods
  setCacheForPurchaseRequest(id: number, data: any, version: number = 1): void {
    this.set(`purchase_request_${id}`, data, version);
  }

  getCacheForPurchaseRequest(id: number): any {
    return this.get(`purchase_request_${id}`);
  }

  invalidatePurchaseRequestCache(id: number): boolean {
    return this.invalidate(`purchase_request_${id}`);
  }

  setCacheForPurchaseRequestsList(data: any, version: number = 1): void {
    this.set('purchase_requests_list', data, version, 2 * 60 * 1000); // 2 minutes TTL for lists
  }

  getCacheForPurchaseRequestsList(): any {
    return this.get('purchase_requests_list');
  }

  invalidateAllPurchaseRequestsCache(): number {
    const count1 = this.invalidateByPrefix('purchase_request_');
    const count2 = this.invalidate('purchase_requests_list') ? 1 : 0;
    return count1 + count2;
  }

  // Quotation cache methods
  setCacheForQuotation(id: number, data: any, version: number = 1): void {
    this.set(`quotation_${id}`, data, version);
  }

  invalidateQuotationCache(purchaseRequestId: number): number {
    return this.invalidatePattern(`quotation_.*_request_${purchaseRequestId}`);
  }

  // Supplier quotation cache methods
  setCacheForSupplierQuotation(id: number, data: any, version: number = 1): void {
    this.set(`supplier_quotation_${id}`, data, version);
  }

  invalidateSupplierQuotationCache(quotationId: number): number {
    return this.invalidatePattern(`supplier_quotation_.*_quotation_${quotationId}`);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.removeAllListeners();
    console.log('🗄️ Cache Manager destroyed');
  }
}

export { IntelligentCacheManager };
export const cacheManager = new IntelligentCacheManager();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down Cache Manager...');
  cacheManager.destroy();
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down Cache Manager...');
  cacheManager.destroy();
});