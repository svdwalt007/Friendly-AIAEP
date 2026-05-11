/**
 * Base Tool Class for IoT StructuredTools
 *
 * Provides common functionality for all IoT tools including:
 * - SDK integration
 * - Redis caching with fallback
 * - Error handling
 * - Standardized response formatting
 *
 * @module base-tool
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { CacheHelper } from './cache';
import type { IoTSdk, ToolConfig, ToolResult } from './types';

/**
 * Base class for all IoT StructuredTools
 *
 * Provides common patterns for:
 * - API calls with automatic retries
 * - Redis caching with stale data fallback
 * - Error handling and user-friendly messages
 * - Result formatting
 *
 * @example
 * ```typescript
 * export class MyTool extends IoTTool {
 *   name = 'myTool';
 *   description = 'Does something useful';
 *   schema = z.object({
 *     param1: z.string(),
 *   });
 *
 *   protected async _call(input: z.infer<typeof this.schema>): Promise<string> {
 *     const result = await this.callWithCache(
 *       'myTool',
 *       input,
 *       async () => {
 *         const data = await this.sdk.someMethod(input.param1);
 *         return { success: true, data };
 *       }
 *     );
 *     return JSON.stringify(result);
 *   }
 * }
 * ```
 */
export abstract class IoTTool<
  TSchema extends z.ZodObject<any> = z.ZodObject<any>
> extends StructuredTool {
  /** IoTSdk instance for API calls */
  protected sdk: IoTSdk;

  /** Optional cache helper for Redis caching */
  protected cache?: CacheHelper;

  /** Zod schema for input validation */
  abstract override schema: TSchema;

  /** Tool name (used for caching and identification) */
  abstract override name: string;

  /** Human-readable description for LLM context */
  abstract override description: string;

  /**
   * Creates a new IoT Tool instance
   *
   * @param config - Tool configuration with SDK and optional Redis
   */
  constructor(config: ToolConfig) {
    super();
    this.sdk = config.sdk;

    if (config.redis) {
      const ttl = config.cacheTtl ?? 300; // Default 5 minutes
      this.cache = new CacheHelper(config.redis, ttl);
    }
  }

  /**
   * Calls a function with Redis cache fallback
   *
   * This method:
   * 1. Generates a cache key from tool name and parameters
   * 2. Attempts to call the provided function
   * 3. If successful, caches the result
   * 4. If failed, tries to return stale cached data as fallback
   * 5. Formats the response with caching metadata
   *
   * @param toolName - Name of the tool (for cache key generation)
   * @param params - Input parameters (for cache key generation)
   * @param fn - Async function to call
   * @returns Tool result with data or error
   *
   * @example
   * ```typescript
   * const result = await this.callWithCache(
   *   'getDeviceList',
   *   { tenantId: 'abc', page: 1 },
   *   async () => {
   *     const devices = await this.sdk.getDeviceList({ limit: 20 });
   *     return { success: true, data: devices };
   *   }
   * );
   * ```
   */
  protected async callWithCache<T>(
    toolName: string,
    params: any,
    fn: () => Promise<ToolResult<T>>
  ): Promise<ToolResult<T>> {
    const cacheKey = this.cache?.generateKey(toolName, params);

    try {
      // Attempt to call the function
      const result = await fn();

      // Cache successful results
      if (result.success && cacheKey && this.cache) {
        await this.cache.set(cacheKey, result.data);
      }

      return result;
    } catch (error) {
      // On error, try to return stale cached data
      if (cacheKey && this.cache) {
        const cached = await this.cache.get<T>(cacheKey);
        if (cached) {
          console.warn(
            `[${toolName}] API call failed, returning stale cached data (${cached.staleSeconds}s old)`
          );

          return {
            success: true,
            data: cached.data,
            cached: true,
            staleSeconds: cached.staleSeconds,
          };
        }
      }

      // No cache available, return error
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  /**
   * Formats an error into a user-friendly message
   *
   * @param error - Error object or unknown error
   * @returns Formatted error message
   */
  protected formatError(error: unknown): string {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }

    if (typeof error === 'string') {
      return `Error: ${error}`;
    }

    if (error && typeof error === 'object') {
      // Check for FriendlyApiError structure
      if ('message' in error && typeof error.message === 'string') {
        const details = 'details' in error ? JSON.stringify(error.details) : '';
        return `API Error: ${error.message}${details ? ` - ${details}` : ''}`;
      }
    }

    return 'An unknown error occurred';
  }

  /**
   * Formats a tool result as a JSON string for LLM consumption
   *
   * @param result - Tool result to format
   * @returns JSON string representation
   */
  protected formatResult<T>(result: ToolResult<T>): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Validates input against the schema
   *
   * This is called automatically by StructuredTool but can be
   * overridden for custom validation logic.
   *
   * @param input - Input to validate
   * @returns Validated input
   * @throws ZodError if validation fails
   */
  protected validateInput(input: any): z.infer<TSchema> {
    return this.schema.parse(input);
  }

  /**
   * Gets the cache helper instance (if configured)
   */
  protected getCacheHelper(): CacheHelper | undefined {
    return this.cache;
  }

  /**
   * Gets the SDK instance
   */
  protected getSdk(): IoTSdk {
    return this.sdk;
  }

  /**
   * Checks if caching is enabled
   */
  protected isCachingEnabled(): boolean {
    return this.cache !== undefined;
  }
}
