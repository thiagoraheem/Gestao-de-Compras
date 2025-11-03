import { EventEmitter } from 'events';

export interface CacheConfig {
  dbName: string;
  dbVersion: number;
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
  debug: boolean;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  etag?: string;
  lastModified?: string;
  size: number;
  accessCount: number;
  lastAccess: number;
}

export interface CacheOptions {
  ttl?: number;
  etag?: string;
  lastModified?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  oldestEntry: number;
  newestEntry: number;
}

export class LocalCacheManager extends EventEmitter {
  private config: CacheConfig;
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      dbName: config.dbName || 'app_cache',
      dbVersion: config.dbVersion || 1,
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      maxSize: config.maxSize || 50 * 1024 * 1024, // 50MB
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      debug: config.debug || false
    };

    this.log('Local Cache Manager initialized', this.config);
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[Cache Manager] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    console.error(`[Cache Manager] ${message}`, error || '');
    this.emit('error', { message, error });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => {
        this.error('Failed to open IndexedDB', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        this.startCleanupTimer();
        this.log('IndexedDB initialized successfully');
        this.emit('initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create cache store
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccess', 'lastAccess', { unique: false });
          store.createIndex('ttl', 'ttl', { unique: false });
        }

        this.log('IndexedDB schema upgraded');
      };
    });
  }

  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.error('Cleanup failed', error);
      });
    }, this.config.cleanupInterval);
  }

  public async set(key: string, data: any, options: CacheOptions = {}): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const now = Date.now();
    const serializedData = JSON.stringify(data);
    const size = new Blob([serializedData]).size;

    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      ttl: options.ttl || this.config.defaultTTL,
      etag: options.etag,
      lastModified: options.lastModified,
      size,
      accessCount: 0,
      lastAccess: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(entry);

      request.onsuccess = () => {
        this.stats.sets++;
        this.log('Cache entry set', { key, size, ttl: entry.ttl });
        this.emit('set', { key, size });
        resolve();
      };

      request.onerror = () => {
        this.error('Failed to set cache entry', request.error);
        reject(request.error);
      };
    });
  }

  public async get(key: string): Promise<any | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const entry: CacheEntry | undefined = request.result;

        if (!entry) {
          this.stats.misses++;
          this.log('Cache miss', { key });
          resolve(null);
          return;
        }

        const now = Date.now();
        const isExpired = (now - entry.timestamp) > entry.ttl;

        if (isExpired) {
          this.stats.misses++;
          this.log('Cache entry expired', { key, age: now - entry.timestamp });
          
          // Remove expired entry
          store.delete(key);
          resolve(null);
          return;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccess = now;
        store.put(entry);

        this.stats.hits++;
        this.log('Cache hit', { key, age: now - entry.timestamp });
        this.emit('hit', { key, age: now - entry.timestamp });
        resolve(entry.data);
      };

      request.onerror = () => {
        this.error('Failed to get cache entry', request.error);
        reject(request.error);
      };
    });
  }

  public async getWithMetadata(key: string): Promise<{ data: any; metadata: Omit<CacheEntry, 'data'> } | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const entry: CacheEntry | undefined = request.result;

        if (!entry) {
          this.stats.misses++;
          resolve(null);
          return;
        }

        const now = Date.now();
        const isExpired = (now - entry.timestamp) > entry.ttl;

        if (isExpired) {
          this.stats.misses++;
          store.delete(key);
          resolve(null);
          return;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccess = now;
        store.put(entry);

        this.stats.hits++;
        
        const { data, ...metadata } = entry;
        resolve({ data, metadata });
      };

      request.onerror = () => {
        this.error('Failed to get cache entry with metadata', request.error);
        reject(request.error);
      };
    });
  }

  public async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  public async delete(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => {
        this.stats.deletes++;
        this.log('Cache entry deleted', { key });
        this.emit('delete', { key });
        resolve(true);
      };

      request.onerror = () => {
        this.error('Failed to delete cache entry', request.error);
        reject(request.error);
      };
    });
  }

  public async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onsuccess = () => {
        this.log('Cache cleared');
        this.emit('clear');
        resolve();
      };

      request.onerror = () => {
        this.error('Failed to clear cache', request.error);
        reject(request.error);
      };
    });
  }

  public async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const now = Date.now();
    let deletedCount = 0;
    let totalSize = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();

      const entriesToDelete: string[] = [];
      const entries: CacheEntry[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const entry: CacheEntry = cursor.value;
          const isExpired = (now - entry.timestamp) > entry.ttl;

          if (isExpired) {
            entriesToDelete.push(entry.key);
            deletedCount++;
          } else {
            entries.push(entry);
            totalSize += entry.size;
          }

          cursor.continue();
        } else {
          // Delete expired entries
          const deletePromises = entriesToDelete.map(key => {
            return new Promise<void>((resolveDelete) => {
              const deleteRequest = store.delete(key);
              deleteRequest.onsuccess = () => resolveDelete();
              deleteRequest.onerror = () => resolveDelete(); // Continue even if delete fails
            });
          });

          Promise.all(deletePromises).then(() => {
            // Check if we need to evict entries due to size limit
            if (totalSize > this.config.maxSize) {
              this.evictLRU(entries, totalSize).then(() => {
                this.log('Cleanup completed', { 
                  expired: deletedCount, 
                  totalSize: Math.round(totalSize / 1024) + 'KB' 
                });
                resolve();
              }).catch(reject);
            } else {
              this.log('Cleanup completed', { 
                expired: deletedCount, 
                totalSize: Math.round(totalSize / 1024) + 'KB' 
              });
              resolve();
            }
          }).catch(reject);
        }
      };

      request.onerror = () => {
        this.error('Failed to cleanup cache', request.error);
        reject(request.error);
      };
    });
  }

  private async evictLRU(entries: CacheEntry[], currentSize: number): Promise<void> {
    // Sort by last access time (oldest first)
    entries.sort((a, b) => a.lastAccess - b.lastAccess);

    let sizeToRemove = currentSize - this.config.maxSize;
    const toEvict: string[] = [];

    for (const entry of entries) {
      if (sizeToRemove <= 0) break;
      
      toEvict.push(entry.key);
      sizeToRemove -= entry.size;
      this.stats.evictions++;
    }

    if (toEvict.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');

      const deletePromises = toEvict.map(key => {
        return new Promise<void>((resolveDelete) => {
          const deleteRequest = store.delete(key);
          deleteRequest.onsuccess = () => resolveDelete();
          deleteRequest.onerror = () => resolveDelete();
        });
      });

      Promise.all(deletePromises).then(() => {
        this.log('LRU eviction completed', { evicted: toEvict.length });
        this.emit('eviction', { keys: toEvict });
        resolve();
      }).catch(reject);
    });
  }

  public async getStats(): Promise<CacheStats> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();

      let totalEntries = 0;
      let totalSize = 0;
      let oldestEntry = Date.now();
      let newestEntry = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor) {
          const entry: CacheEntry = cursor.value;
          totalEntries++;
          totalSize += entry.size;
          
          if (entry.timestamp < oldestEntry) {
            oldestEntry = entry.timestamp;
          }
          
          if (entry.timestamp > newestEntry) {
            newestEntry = entry.timestamp;
          }

          cursor.continue();
        } else {
          const totalRequests = this.stats.hits + this.stats.misses;
          const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
          const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

          resolve({
            totalEntries,
            totalSize,
            hitRate,
            missRate,
            totalHits: this.stats.hits,
            totalMisses: this.stats.misses,
            oldestEntry: totalEntries > 0 ? oldestEntry : 0,
            newestEntry: totalEntries > 0 ? newestEntry : 0
          });
        }
      };

      request.onerror = () => {
        this.error('Failed to get cache stats', request.error);
        reject(request.error);
      };
    });
  }

  public async validateETag(key: string, etag: string): Promise<boolean> {
    const result = await this.getWithMetadata(key);
    return result?.metadata.etag === etag;
  }

  public async validateLastModified(key: string, lastModified: string): Promise<boolean> {
    const result = await this.getWithMetadata(key);
    return result?.metadata.lastModified === lastModified;
  }

  public async getKeys(pattern?: RegExp): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        let keys = request.result as string[];
        
        if (pattern) {
          keys = keys.filter(key => pattern.test(key));
        }
        
        resolve(keys);
      };

      request.onerror = () => {
        this.error('Failed to get cache keys', request.error);
        reject(request.error);
      };
    });
  }

  public async deleteByPattern(pattern: RegExp): Promise<number> {
    const keys = await this.getKeys(pattern);
    
    const deletePromises = keys.map(key => this.delete(key));
    await Promise.all(deletePromises);
    
    this.log('Deleted entries by pattern', { pattern: pattern.toString(), count: keys.length });
    return keys.length;
  }

  public destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.isInitialized = false;
    this.removeAllListeners();
    
    this.log('Cache Manager destroyed');
  }
}

// Singleton instance for global use
let globalCacheManager: LocalCacheManager | null = null;

export function getCacheManager(config?: Partial<CacheConfig>): LocalCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new LocalCacheManager(config);
  }
  return globalCacheManager;
}

export function destroyCacheManager() {
  if (globalCacheManager) {
    globalCacheManager.destroy();
    globalCacheManager = null;
  }
}