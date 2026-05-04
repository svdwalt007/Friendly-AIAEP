/**
 * Cache Decorator for Method-Level Caching
 *
 * Features:
 * - @Cacheable decorator for automatic method caching
 * - @CacheEvict decorator for cache invalidation
 * - @CachePut decorator for cache updates
 * - Automatic cache key generation from method arguments
 * - Custom cache key generation support
 * - TTL configuration per method
 * - Conditional caching
 */

import { CacheService, getCacheService } from './cache.service';

/**
 * Cache decorator options
 */
export interface CacheableOptions {
  /**
   * Cache key prefix or generator function
   * If string: used as prefix with auto-generated suffix from args
   * If function: called with method args to generate full key
   */
  key?: string | ((...args: any[]) => string);

  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Condition function to determine if caching should be applied
   * Return true to cache, false to skip
   */
  condition?: (...args: any[]) => boolean;

  /**
   * Custom cache service instance
   * If not provided, uses the default singleton
   */
  cacheService?: CacheService;

  /**
   * Whether to cache null/undefined results
   */
  cacheNullValues?: boolean;
}

/**
 * Cache eviction options
 */
export interface CacheEvictOptions {
  /**
   * Cache key or pattern to evict
   */
  key?: string | ((...args: any[]) => string);

  /**
   * Whether to evict all keys matching a pattern
   */
  allEntries?: boolean;

  /**
   * Custom cache service instance
   */
  cacheService?: CacheService;

  /**
   * Whether to evict before or after method execution
   */
  beforeInvocation?: boolean;
}

/**
 * Cache put options
 */
export interface CachePutOptions {
  /**
   * Cache key or generator function
   */
  key?: string | ((...args: any[]) => string);

  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Custom cache service instance
   */
  cacheService?: CacheService;

  /**
   * Condition function to determine if caching should be applied
   */
  condition?: (...args: any[]) => boolean;
}

/**
 * Generate a cache key from method arguments
 */
function generateCacheKey(prefix: string, args: any[]): string {
  if (args.length === 0) {
    return prefix;
  }

  // Create a stable string representation of arguments
  const argsKey = args
    .map((arg) => {
      if (arg === null || arg === undefined) {
        return 'null';
      }
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    })
    .join(':');

  return `${prefix}:${argsKey}`;
}

/**
 * Get the cache key from options and arguments
 */
function getCacheKey(
  options: CacheableOptions | CacheEvictOptions | CachePutOptions,
  args: any[],
  defaultPrefix: string
): string {
  if (!options.key) {
    return generateCacheKey(defaultPrefix, args);
  }

  if (typeof options.key === 'function') {
    return options.key(...args);
  }

  return generateCacheKey(options.key, args);
}

/**
 * @Cacheable Decorator
 *
 * Caches the result of a method. If the method is called again with the same
 * arguments, the cached result is returned instead of executing the method.
 *
 * Usage:
 * ```typescript
 * class UserService {
 *   @Cacheable({ key: 'user', ttl: 600 })
 *   async getUser(id: string) {
 *     // This will be cached for 10 minutes
 *     return await db.user.findUnique({ where: { id } });
 *   }
 *
 *   @Cacheable({
 *     key: (id: string) => `user:${id}`,
 *     condition: (id: string) => id !== 'admin'
 *   })
 *   async getUserConditional(id: string) {
 *     // Only cache non-admin users
 *     return await db.user.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */
export function Cacheable(options: CacheableOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const defaultKey = `${className}:${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      // Get cache service
      const cacheService = options.cacheService || getCacheService();

      // Check condition
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = getCacheKey(options, args, defaultKey);

      try {
        // Try to get from cache
        const cached = await cacheService.get(cacheKey);

        if (cached !== null) {
          return cached;
        }

        // Execute method
        const result = await originalMethod.apply(this, args);

        // Cache result if not null (unless cacheNullValues is true)
        if (result !== null && result !== undefined) {
          await cacheService.set(cacheKey, result, options.ttl);
        } else if (options.cacheNullValues) {
          await cacheService.set(cacheKey, result, options.ttl);
        }

        return result;
      } catch (error) {
        console.error(`Cache error in ${className}.${propertyKey}:`, error);
        // If cache fails, execute method normally
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * @CacheEvict Decorator
 *
 * Evicts one or more entries from the cache. Can be used to invalidate cache
 * when data is updated.
 *
 * Usage:
 * ```typescript
 * class UserService {
 *   @CacheEvict({ key: 'user' })
 *   async updateUser(id: string, data: UserUpdate) {
 *     // This will evict the cache after updating
 *     return await db.user.update({ where: { id }, data });
 *   }
 *
 *   @CacheEvict({ allEntries: true })
 *   async clearUserCache() {
 *     // This will evict all cache entries
 *   }
 *
 *   @CacheEvict({
 *     key: (id: string) => `user:${id}`,
 *     beforeInvocation: true
 *   })
 *   async deleteUser(id: string) {
 *     // This will evict the cache before deleting
 *     return await db.user.delete({ where: { id } });
 *   }
 * }
 * ```
 */
export function CacheEvict(options: CacheEvictOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const defaultKey = `${className}:${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const cacheService = options.cacheService || getCacheService();

      const evictCache = async () => {
        try {
          if (options.allEntries) {
            await cacheService.clear();
          } else {
            const cacheKey = getCacheKey(options, args, defaultKey);
            if (cacheKey.includes('*')) {
              await cacheService.deletePattern(cacheKey);
            } else {
              await cacheService.delete(cacheKey);
            }
          }
        } catch (error) {
          console.error(`Cache eviction error in ${className}.${propertyKey}:`, error);
        }
      };

      // Evict before if specified
      if (options.beforeInvocation) {
        await evictCache();
      }

      // Execute method
      const result = await originalMethod.apply(this, args);

      // Evict after (default)
      if (!options.beforeInvocation) {
        await evictCache();
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * @CachePut Decorator
 *
 * Always executes the method and updates the cache with the result.
 * Useful for methods that update data and want to refresh the cache.
 *
 * Usage:
 * ```typescript
 * class UserService {
 *   @CachePut({ key: 'user', ttl: 600 })
 *   async refreshUser(id: string) {
 *     // This will always execute and update the cache
 *     return await db.user.findUnique({ where: { id } });
 *   }
 *
 *   @CachePut({
 *     key: (id: string) => `user:${id}`,
 *     condition: (id: string, data: any) => data.important === true
 *   })
 *   async updateUserConditional(id: string, data: UserUpdate) {
 *     // Only update cache if data.important is true
 *     return await db.user.update({ where: { id }, data });
 *   }
 * }
 * ```
 */
export function CachePut(options: CachePutOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const defaultKey = `${className}:${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const cacheService = options.cacheService || getCacheService();

      // Execute method
      const result = await originalMethod.apply(this, args);

      // Check condition
      if (options.condition && !options.condition(...args)) {
        return result;
      }

      try {
        // Update cache with result
        const cacheKey = getCacheKey(options, args, defaultKey);
        await cacheService.set(cacheKey, result, options.ttl);
      } catch (error) {
        console.error(`Cache put error in ${className}.${propertyKey}:`, error);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Helper function to create a cache key manually
 * Useful for consistent key generation across decorators
 */
export function createCacheKey(prefix: string, ...parts: any[]): string {
  return generateCacheKey(prefix, parts);
}
