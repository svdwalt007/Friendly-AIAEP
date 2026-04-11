/**
 * JWT Authentication Handler
 * Manages JWT token lifecycle including authentication, caching, and auto-refresh
 */

import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import {
  JWTAuthConfig,
  JWTLoginResponse,
  JWTTokenData,
  CachedToken,
  AuthError,
  AuthErrorType,
  AuthorizationHeader,
} from './types';

// Re-export types for external use
export { AuthError, AuthErrorType } from './types';
export type { AuthorizationHeader } from './types';

/**
 * JWT Authentication Handler
 *
 * Features:
 * - Authenticates with username/password via REST API
 * - Caches JWT tokens in Redis with TTL
 * - Auto-refreshes tokens 60 seconds before expiry
 * - Handles token parsing and expiry detection
 * - Implements retry logic on 401 errors
 * - Returns Bearer token in Authorization header
 *
 * @example
 * ```typescript
 * const handler = new JWTAuthHandler({
 *   eventsUrl: 'https://api.example.com',
 *   username: 'user@example.com',
 *   password: 'secret',
 *   redis: {
 *     host: 'localhost',
 *     port: 6379,
 *   },
 * });
 *
 * await handler.initialize();
 * const authHeader = await handler.getAuthorizationHeader();
 * // Use authHeader in HTTP requests
 * await handler.close();
 * ```
 */
export class JWTAuthHandler {
  private readonly config: Required<
    Omit<JWTAuthConfig, 'redis'> & { redis: JWTAuthConfig['redis'] }
  >;
  private redis: Redis | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private readonly cacheKey: string;

  /**
   * Creates a new JWT authentication handler
   * @param config - Configuration options
   */
  constructor(config: JWTAuthConfig) {
    this.config = {
      ...config,
      refreshBufferSeconds: config.refreshBufferSeconds ?? 60,
      maxRetries: config.maxRetries ?? 3,
      requestTimeout: config.requestTimeout ?? 30000,
    };

    // Create a unique cache key based on username and events URL
    const hash = createHash('sha256')
      .update(`${this.config.username}:${this.config.eventsUrl}`)
      .digest('hex')
      .substring(0, 16);
    this.cacheKey = `jwt:token:${hash}`;
  }

  /**
   * Initializes the Redis connection
   * Must be called before using the handler
   */
  async initialize(): Promise<void> {
    if (this.redis) {
      return;
    }

    try {
      this.redis = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db ?? 0,
        keyPrefix: this.config.redis.keyPrefix,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      throw new AuthError(
        'Failed to initialize Redis connection',
        AuthErrorType.REDIS_ERROR,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the Authorization header with a valid JWT token
   * Automatically refreshes the token if needed
   *
   * @returns Authorization header object
   * @throws {AuthError} If authentication fails
   */
  async getAuthorizationHeader(): Promise<AuthorizationHeader> {
    await this.ensureInitialized();

    let token = await this.getCachedToken();

    if (!token || this.isTokenExpiringSoon(token)) {
      token = await this.refreshToken();
    }

    return {
      Authorization: `Bearer ${token.token}`,
    };
  }

  /**
   * Closes the Redis connection and clears any timers
   */
  async close(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  /**
   * Ensures the handler is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.redis) {
      throw new AuthError(
        'JWTAuthHandler not initialized. Call initialize() first.',
        AuthErrorType.UNKNOWN_ERROR
      );
    }
  }

  /**
   * Gets the cached token from Redis
   */
  private async getCachedToken(): Promise<CachedToken | null> {
    await this.ensureInitialized();

    try {
      const cached = await this.redis!.get(this.cacheKey);
      if (!cached) {
        return null;
      }

      const token: CachedToken = JSON.parse(cached);

      // Check if token is still valid
      const now = Math.floor(Date.now() / 1000);
      if (token.expiresAt <= now) {
        await this.redis!.del(this.cacheKey);
        return null;
      }

      return token;
    } catch (error) {
      // If parsing fails or Redis error, return null to trigger refresh
      console.warn('Failed to retrieve cached token:', error);
      return null;
    }
  }

  /**
   * Checks if the token is expiring soon (within refresh buffer)
   */
  private isTokenExpiringSoon(token: CachedToken): boolean {
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = token.expiresAt - now;
    return timeUntilExpiry <= this.config.refreshBufferSeconds;
  }

  /**
   * Refreshes the token by authenticating with the API
   * Implements retry logic for 401 errors
   */
  private async refreshToken(): Promise<CachedToken> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      // Wait for the current refresh to complete
      await this.waitForRefresh();
      const token = await this.getCachedToken();
      if (token) {
        return token;
      }
    }

    this.isRefreshing = true;

    try {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
          const token = await this.authenticate();
          await this.cacheToken(token);
          this.scheduleRefresh(token);
          return token;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (error instanceof AuthError && error.statusCode === 401) {
            // Don't retry on invalid credentials
            if (attempt === 1) {
              throw error;
            }
          }

          if (attempt < this.config.maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            await this.sleep(delay);
          }
        }
      }

      throw new AuthError(
        `Failed to refresh token after ${this.config.maxRetries} attempts`,
        AuthErrorType.REFRESH_FAILED,
        undefined,
        lastError ?? undefined
      );
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Authenticates with the API and returns a new token
   */
  private async authenticate(): Promise<CachedToken> {
    const url = `${this.config.eventsUrl}/rest/v2/auth/login`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === 401) {
          throw new AuthError(
            'Invalid credentials',
            AuthErrorType.INVALID_CREDENTIALS,
            401
          );
        }

        throw new AuthError(
          `Authentication failed: ${response.status} ${response.statusText} - ${errorText}`,
          AuthErrorType.NETWORK_ERROR,
          response.status
        );
      }

      const data = await response.json() as JWTLoginResponse;

      if (!data.token) {
        throw new AuthError(
          'Invalid response: missing token',
          AuthErrorType.PARSE_ERROR
        );
      }

      // Parse the token to get expiration
      const tokenData = this.parseJWTToken(data.token);
      const expiresAt = this.calculateExpiresAt(data, tokenData);

      return {
        token: data.token,
        expiresAt,
        cachedAt: Math.floor(Date.now() / 1000),
        refreshToken: data.refreshToken,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AuthError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AuthError(
          'Authentication request timed out',
          AuthErrorType.NETWORK_ERROR,
          undefined,
          error
        );
      }

      throw new AuthError(
        'Authentication request failed',
        AuthErrorType.NETWORK_ERROR,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parses a JWT token and extracts the payload
   */
  private parseJWTToken(token: string): JWTTokenData {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode the payload (second part)
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      return JSON.parse(decoded) as JWTTokenData;
    } catch (error) {
      throw new AuthError(
        'Failed to parse JWT token',
        AuthErrorType.PARSE_ERROR,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Calculates the token expiration timestamp
   */
  private calculateExpiresAt(
    response: JWTLoginResponse,
    tokenData: JWTTokenData
  ): number {
    // Priority: expiresAt > exp from token > expiresIn
    if (response.expiresAt) {
      return response.expiresAt;
    }

    if (tokenData.exp) {
      return tokenData.exp;
    }

    if (response.expiresIn) {
      return Math.floor(Date.now() / 1000) + response.expiresIn;
    }

    // Default to 1 hour if no expiration info available
    return Math.floor(Date.now() / 1000) + 3600;
  }

  /**
   * Caches the token in Redis with appropriate TTL
   */
  private async cacheToken(token: CachedToken): Promise<void> {
    await this.ensureInitialized();

    try {
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(token.expiresAt - now, 0);

      if (ttl > 0) {
        await this.redis!.setex(
          this.cacheKey,
          ttl,
          JSON.stringify(token)
        );
      }
    } catch (error) {
      // Log but don't throw - caching failure shouldn't prevent authentication
      console.warn('Failed to cache token:', error);
    }
  }

  /**
   * Schedules automatic token refresh before expiration
   */
  private scheduleRefresh(token: CachedToken): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilRefresh = Math.max(
      (token.expiresAt - now - this.config.refreshBufferSeconds) * 1000,
      0
    );

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch((error) => {
          console.error('Auto-refresh failed:', error);
        });
      }, timeUntilRefresh);
    }
  }

  /**
   * Waits for an ongoing refresh to complete
   */
  private async waitForRefresh(): Promise<void> {
    const maxWait = 10000; // 10 seconds
    const checkInterval = 100; // 100ms
    let waited = 0;

    while (this.isRefreshing && waited < maxWait) {
      await this.sleep(checkInterval);
      waited += checkInterval;
    }
  }

  /**
   * Helper method to sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually clears the cached token
   * Useful for forcing re-authentication
   */
  async clearCache(): Promise<void> {
    await this.ensureInitialized();
    try {
      await this.redis!.del(this.cacheKey);
    } catch (error) {
      throw new AuthError(
        'Failed to clear token cache',
        AuthErrorType.REDIS_ERROR,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the current token information without refreshing
   * Useful for debugging and monitoring
   */
  async getTokenInfo(): Promise<{
    hasCachedToken: boolean;
    expiresAt?: number;
    expiresIn?: number;
    isExpiringSoon?: boolean;
  }> {
    await this.ensureInitialized();

    const token = await this.getCachedToken();

    if (!token) {
      return { hasCachedToken: false };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = Math.max(token.expiresAt - now, 0);

    return {
      hasCachedToken: true,
      expiresAt: token.expiresAt,
      expiresIn,
      isExpiringSoon: this.isTokenExpiringSoon(token),
    };
  }
}
