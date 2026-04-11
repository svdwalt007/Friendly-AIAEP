/**
 * Cache Helper for Redis-based Caching
 *
 * Provides utilities for caching API responses with TTL management
 * and stale data tracking for fallback scenarios.
 *
 * @module cache
 */

import type Redis from 'ioredis';
import { createHash } from 'crypto';

/**
 * Cached data with staleness metadata
 */
export interface CachedData<T> {
  /** The cached data */
  data: T;

  /** How many seconds the cached data has been stale */
  staleSeconds: number;
}

/**
 * CacheHelper provides Redis caching with staleness tracking
 *
 * @example
 * ```typescript
 * const cache = new CacheHelper(redisClient);
 *
 * // Cache some data
 * await cache.set('my-key', { foo: 'bar' }, 300);
 *
 * // Retrieve cached data
 * const cached = await cache.get<MyType>('my-key');
 * if (cached) {
 *   console.log(`Data is ${cached.staleSeconds}s stale`);
 *   return cached.data;
 * }
 * ```
 */
export class CacheHelper {
  private redis: Redis;
  private defaultTtl: number;

  /**
   * Creates a new CacheHelper instance
   *
   * @param redis - Redis client instance
   * @param defaultTtl - Default TTL in seconds (default: 300 = 5 minutes)
   */
  constructor(redis: Redis, defaultTtl = 300) {
    this.redis = redis;
    this.defaultTtl = defaultTtl;
  }

  /**
   * Retrieves cached data with staleness information
   *
   * @param key - Cache key
   * @returns Cached data with staleness info, or null if not found
   */
  async get<T>(key: string): Promise<CachedData<T> | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }

      // Get remaining TTL to calculate staleness
      const ttl = await this.redis.ttl(key);
      const maxAge = this.defaultTtl;
      const staleSeconds = ttl > 0 ? maxAge - ttl : maxAge;

      return {
        data: JSON.parse(cached) as T,
        staleSeconds: staleSeconds > 0 ? staleSeconds : 0,
      };
    } catch (error) {
      // Log error but don't throw - caching is non-critical
      console.error('[CacheHelper] Error retrieving from cache:', error);
      return null;
    }
  }

  /**
   * Stores data in cache with TTL
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlSeconds - TTL in seconds (defaults to defaultTtl)
   */
  async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.defaultTtl;
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      // Log error but don't throw - caching is non-critical
      console.error('[CacheHelper] Error setting cache:', error);
    }
  }

  /**
   * Deletes a key from cache
   *
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('[CacheHelper] Error deleting from cache:', error);
    }
  }

  /**
   * Checks if a key exists in cache
   *
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[CacheHelper] Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Generates a deterministic hash from parameters
   *
   * Used to create cache keys from tool input parameters.
   *
   * @param params - Parameters to hash
   * @returns 16-character hex hash
   *
   * @example
   * ```typescript
   * const hash = cache.hashParams({ deviceId: '123', metric: 'cpu' });
   * const cacheKey = `iot:tool:telemetry:${hash}`;
   * ```
   */
  hashParams(params: any): string {
    try {
      // Sort keys for deterministic hashing
      const normalized = JSON.stringify(params, Object.keys(params).sort());
      return createHash('sha256')
        .update(normalized)
        .digest('hex')
        .substring(0, 16);
    } catch (error) {
      console.error('[CacheHelper] Error hashing params:', error);
      // Return a fallback hash if something goes wrong
      return createHash('sha256')
        .update(String(params))
        .digest('hex')
        .substring(0, 16);
    }
  }

  /**
   * Generates a cache key for IoT tools
   *
   * @param toolName - Name of the tool
   * @param params - Tool parameters
   * @returns Cache key in format: iot:tool:{toolName}:{hash}
   *
   * @example
   * ```typescript
   * const key = cache.generateKey('getDeviceList', { tenantId: 'abc', page: 1 });
   * // Returns: "iot:tool:getDeviceList:a1b2c3d4e5f6g7h8"
   * ```
   */
  generateKey(toolName: string, params: any): string {
    const hash = this.hashParams(params);
    return `iot:tool:${toolName}:${hash}`;
  }

  /**
   * Clears all cached data for a specific tool
   *
   * @param toolName - Name of the tool
   * @returns Number of keys deleted
   */
  async clearToolCache(toolName: string): Promise<number> {
    try {
      const pattern = `iot:tool:${toolName}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error('[CacheHelper] Error clearing tool cache:', error);
      return 0;
    }
  }

  /**
   * Gets the default TTL in seconds
   */
  getDefaultTtl(): number {
    return this.defaultTtl;
  }

  /**
   * Sets the default TTL in seconds
   */
  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }
}
