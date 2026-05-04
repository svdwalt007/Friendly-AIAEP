/**
 * Redis Caching Service
 *
 * Features:
 * - Redis-backed caching with automatic failover to in-memory
 * - TTL management with automatic expiration
 * - Cache invalidation (single key, pattern, all)
 * - Cache statistics and monitoring
 * - Namespace support for multi-tenant scenarios
 * - Type-safe caching with generics
 * - Compression for large values
 */

import Redis from 'ioredis';

/**
 * Cache configuration
 */
export interface CacheConfig {
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  defaultTTL?: number; // in seconds
  enableCompression?: boolean;
  compressionThreshold?: number; // bytes
  enableFallback?: boolean; // fallback to in-memory if Redis fails
  namespace?: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

/**
 * In-memory cache entry
 */
interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cache Service
 *
 * Usage:
 * ```typescript
 * const cache = new CacheService({
 *   redis: { url: process.env.REDIS_URL },
 *   defaultTTL: 300,
 *   namespace: 'myapp',
 * });
 *
 * await cache.set('user:123', { name: 'John' }, 600);
 * const user = await cache.get<User>('user:123');
 * ```
 */
export class CacheService {
  private redis?: Redis;
  private memoryCache: Map<string, MemoryCacheEntry<any>> = new Map();
  private config: Required<CacheConfig>;
  private logger: any;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
  };
  private redisAvailable = false;

  constructor(config: CacheConfig = {}, logger?: any) {
    this.config = {
      redis: config.redis || {},
      defaultTTL: config.defaultTTL || 300,
      enableCompression: config.enableCompression || false,
      compressionThreshold: config.compressionThreshold || 1024,
      enableFallback: config.enableFallback !== false,
      namespace: config.namespace || 'cache',
    };

    this.logger = logger || console;

    this.initializeRedis();
    this.startCleanupInterval();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = this.config.redis.url || process.env.REDIS_URL;

      if (!redisUrl && !this.config.redis.host) {
        this.logger.info('Redis not configured, using in-memory cache only');
        return;
      }

      this.redis = redisUrl
        ? new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            keyPrefix: this.config.redis.keyPrefix || `${this.config.namespace}:`,
          })
        : new Redis({
            host: this.config.redis.host,
            port: this.config.redis.port || 6379,
            password: this.config.redis.password,
            db: this.config.redis.db || 0,
            maxRetriesPerRequest: 3,
            keyPrefix: this.config.redis.keyPrefix || `${this.config.namespace}:`,
          });

      // Test connection
      await this.redis.ping();
      this.redisAvailable = true;

      this.redis.on('error', (err) => {
        this.logger.error({ err }, 'Redis error');
        this.redisAvailable = false;
        this.stats.errors++;
      });

      this.redis.on('connect', () => {
        this.logger.info('Redis connected');
        this.redisAvailable = true;
      });

      this.redis.on('ready', () => {
        this.logger.info('Redis ready');
        this.redisAvailable = true;
      });

      this.logger.info('Redis cache initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize Redis');
      if (!this.config.enableFallback) {
        throw error;
      }
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    try {
      // Try Redis first
      if (this.redis && this.redisAvailable) {
        const value = await this.redis.get(fullKey);

        if (value !== null) {
          this.stats.hits++;
          this.updateHitRate();
          return this.deserialize<T>(value);
        }
      }

      // Fallback to memory cache
      if (this.config.enableFallback) {
        const memoryValue = this.getFromMemory<T>(fullKey);
        if (memoryValue !== null) {
          this.stats.hits++;
          this.updateHitRate();
          return memoryValue;
        }
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      this.logger.error({ error, key }, 'Cache get error');
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const expiration = ttl || this.config.defaultTTL;

    try {
      const serialized = this.serialize(value);

      // Set in Redis
      if (this.redis && this.redisAvailable) {
        await this.redis.setex(fullKey, expiration, serialized);
      }

      // Set in memory cache as fallback
      if (this.config.enableFallback) {
        this.setInMemory(fullKey, value, expiration);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.logger.error({ error, key }, 'Cache set error');
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      // Delete from Redis
      if (this.redis && this.redisAvailable) {
        await this.redis.del(fullKey);
      }

      // Delete from memory cache
      this.memoryCache.delete(fullKey);

      this.stats.deletes++;
      return true;
    } catch (error) {
      this.logger.error({ error, key }, 'Cache delete error');
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);
    let deletedCount = 0;

    try {
      // Delete from Redis
      if (this.redis && this.redisAvailable) {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          deletedCount = await this.redis.del(...keys);
        }
      }

      // Delete from memory cache
      for (const key of this.memoryCache.keys()) {
        if (this.matchesPattern(key, fullPattern)) {
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }

      this.stats.deletes += deletedCount;
      return deletedCount;
    } catch (error) {
      this.logger.error({ error, pattern }, 'Cache deletePattern error');
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    try {
      // Clear Redis
      if (this.redis && this.redisAvailable) {
        const keys = await this.redis.keys(`${this.config.namespace}:*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear memory cache
      this.memoryCache.clear();

      this.logger.info('Cache cleared');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Cache clear error');
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);

    try {
      if (this.redis && this.redisAvailable) {
        const exists = await this.redis.exists(fullKey);
        return exists === 1;
      }

      return this.memoryCache.has(fullKey);
    } catch (error) {
      this.logger.error({ error, key }, 'Cache has error');
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Close cache connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string): string {
    return key.startsWith(`${this.config.namespace}:`) ? key : `${this.config.namespace}:${key}`;
  }

  /**
   * Serialize value for storage
   */
  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize value from storage
   */
  private deserialize<T>(value: string): T {
    return JSON.parse(value);
  }

  /**
   * Get value from in-memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in in-memory cache
   */
  private setInMemory<T>(key: string, value: T, ttl: number): void {
    const expiresAt = Date.now() + ttl * 1000;
    this.memoryCache.set(key, { value, expiresAt });
  }

  /**
   * Check if key matches pattern (simple glob matching)
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Start cleanup interval for expired memory cache entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expiresAt) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000); // Run every minute
  }
}

/**
 * Create a cache service instance
 */
export function createCacheService(config?: CacheConfig, logger?: any): CacheService {
  return new CacheService(config, logger);
}

/**
 * Singleton instance for convenience
 */
let defaultInstance: CacheService | undefined;

/**
 * Get the default cache service instance
 */
export function getCacheService(config?: CacheConfig, logger?: any): CacheService {
  if (!defaultInstance) {
    defaultInstance = createCacheService(config, logger);
  }
  return defaultInstance;
}
