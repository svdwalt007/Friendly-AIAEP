/**
 * FriendlyAuthAdapter - Main authentication adapter for Friendly APIs
 *
 * Provides unified authentication across three Friendly API endpoints:
 * - Northbound API (Device Management)
 * - Events API (Event Streaming)
 * - QoE API (Quality of Experience)
 *
 * Supports multiple authentication methods per API with automatic fallback.
 *
 * @module friendly-auth-adapter
 */

import { Redis } from 'ioredis';
import { JWTAuthHandler } from './auth/jwt-handler';
import { OAuth2AuthHandler } from './auth/oauth2-handler';
import { getDefaultAuditEmitter, type AuditEventEmitter } from './audit-emitter';
import { decrypt } from './encryption';
import type {
  FriendlyApiConfig,
  AuthMethod,
  AuthorizationHeader,
  TenantCredentials,
} from './types';

/**
 * Configuration for FriendlyAuthAdapter
 */
export interface FriendlyAuthAdapterConfig {
  /** Tenant ID for multi-tenant support */
  tenantId: string;

  /** Configurations for each Friendly API */
  apis: {
    northbound?: FriendlyApiConfig;
    events?: FriendlyApiConfig;
    qoe?: FriendlyApiConfig;
  };

  /** Redis configuration for token caching */
  redis: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };

  /** Encryption key for decrypting stored credentials */
  encryptionKey?: string;

  /** Audit event emitter (defaults to singleton) */
  auditEmitter?: AuditEventEmitter;

  /** Optional timeout for auth requests in milliseconds */
  timeout?: number;
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly apiId: string,
    public readonly authMethod: AuthMethod,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Main authentication adapter for Friendly APIs
 *
 * @example
 * ```typescript
 * const adapter = new FriendlyAuthAdapter({
 *   tenantId: 'tenant-123',
 *   apis: {
 *     events: {
 *       id: 'events',
 *       baseUrl: 'https://events.friendly.example.com',
 *       authMethods: ['jwt', 'basic'],
 *       primaryAuth: 'jwt',
 *       credentials: {
 *         username: 'user@example.com',
 *         password: 'encrypted:...'
 *       }
 *     }
 *   },
 *   redis: { host: 'localhost', port: 6379 }
 * });
 *
 * await adapter.initialize();
 * const headers = await adapter.getAuthHeaders('events');
 * // { Authorization: 'Bearer ...' }
 * ```
 */
export class FriendlyAuthAdapter {
  private config: FriendlyAuthAdapterConfig;
  private redis: Redis;
  private jwtHandlers: Map<string, JWTAuthHandler> = new Map();
  private oauth2Handlers: Map<string, OAuth2AuthHandler> = new Map();
  private auditEmitter: AuditEventEmitter;
  private initialized = false;

  constructor(config: FriendlyAuthAdapterConfig) {
    this.validateConfig(config);
    this.config = config;
    this.auditEmitter = config.auditEmitter || getDefaultAuditEmitter();

    // Initialize Redis client
    this.redis = new Redis({
      host: config.redis.host || 'localhost',
      port: config.redis.port || 6379,
      password: config.redis.password,
      db: config.redis.db || 0,
      keyPrefix: config.redis.keyPrefix || 'friendly:auth:',
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  /**
   * Validates the adapter configuration
   */
  private validateConfig(config: FriendlyAuthAdapterConfig): void {
    if (!config.tenantId) {
      throw new ConfigurationError('tenantId is required');
    }

    if (!config.apis || Object.keys(config.apis).length === 0) {
      throw new ConfigurationError('At least one API configuration is required');
    }

    // Validate each API config
    for (const [key, apiConfig] of Object.entries(config.apis)) {
      if (!apiConfig) continue;

      if (!apiConfig.baseUrl) {
        throw new ConfigurationError(`${key}: baseUrl is required`);
      }

      if (!apiConfig.authMethods || apiConfig.authMethods.length === 0) {
        throw new ConfigurationError(`${key}: at least one authMethod is required`);
      }

      if (!apiConfig.primaryAuth) {
        throw new ConfigurationError(`${key}: primaryAuth is required`);
      }

      if (!apiConfig.authMethods.includes(apiConfig.primaryAuth)) {
        throw new ConfigurationError(
          `${key}: primaryAuth must be one of the configured authMethods`
        );
      }
    }
  }

  /**
   * Initializes the adapter and all auth handlers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize handlers for each API
    for (const [_apiId, apiConfig] of Object.entries(this.config.apis)) {
      if (!apiConfig) continue;

      // Decrypt credentials if needed
      const credentials = await this.decryptCredentials(apiConfig.credentials);

      // Initialize JWT handler if JWT auth is configured
      if (apiConfig.authMethods.includes('jwt') && credentials.username && credentials.password) {
        const jwtHandler = new JWTAuthHandler({
          eventsUrl: apiConfig.baseUrl,
          username: credentials.username,
          password: credentials.password,
          redis: {
            host: this.config.redis.host || 'localhost',
            port: this.config.redis.port || 6379,
            password: this.config.redis.password,
            db: this.config.redis.db,
            keyPrefix: this.config.redis.keyPrefix,
          },
          refreshBufferSeconds: 60,
          maxRetries: 3,
          requestTimeout: this.config.timeout || 30000,
        });

        await jwtHandler.initialize();
        this.jwtHandlers.set(apiConfig.id, jwtHandler);
      }

      // Initialize OAuth2 handler if OAuth2 auth is configured
      if (apiConfig.authMethods.includes('oauth2') && credentials.oauth2Config) {
        const oauth2Handler = new OAuth2AuthHandler({
          tokenEndpoint: credentials.oauth2Config.tokenEndpoint,
          clientId: credentials.oauth2Config.clientId,
          clientSecret: credentials.oauth2Config.clientSecret,
          scopes: credentials.oauth2Config.scope ? [credentials.oauth2Config.scope] : undefined,
          redis: this.config.redis,
        });

        this.oauth2Handlers.set(apiConfig.id, oauth2Handler);
      }
    }

    this.initialized = true;

    // Emit initialization audit event
    this.auditEmitter.emit('auth_success', {
      timestamp: new Date(),
      tenantId: this.config.tenantId,
      apiId: 'adapter',
      authMethod: 'none',
      metadata: { action: 'initialize', apisConfigured: Object.keys(this.config.apis) },
    });
  }

  /**
   * Decrypts credentials if they are encrypted
   */
  private async decryptCredentials(
    credentials: TenantCredentials
  ): Promise<TenantCredentials> {
    const encryptionKey = this.config.encryptionKey || process.env['ENCRYPTION_KEY'];

    if (!encryptionKey) {
      // No encryption key, assume credentials are in plaintext
      return credentials;
    }

    const decrypted: TenantCredentials = {};

    try {
      // Decrypt each credential field if it starts with 'encrypted:'
      if (credentials.password && credentials.password.startsWith('encrypted:')) {
        const encryptedData = credentials.password.substring('encrypted:'.length);
        decrypted.password = decrypt(encryptedData, encryptionKey);
      } else {
        decrypted.password = credentials.password;
      }

      if (credentials.apiKey && credentials.apiKey.startsWith('encrypted:')) {
        const encryptedData = credentials.apiKey.substring('encrypted:'.length);
        decrypted.apiKey = decrypt(encryptedData, encryptionKey);
      } else {
        decrypted.apiKey = credentials.apiKey;
      }

      // Copy other fields as-is
      decrypted.username = credentials.username;
      decrypted.oauth2Config = credentials.oauth2Config;

      return decrypted;
    } catch (error) {
      this.auditEmitter.emitCredentialDecryptionError({
        tenantId: this.config.tenantId,
        apiId: 'unknown',
        authMethod: 'none' as any,
        errorMessage: error instanceof Error ? error.message : String(error),
        credentialType: 'encrypted',
      });
      throw new ConfigurationError(
        `Failed to decrypt credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets authentication headers for the specified API
   *
   * @param apiId - The API identifier ('northbound', 'events', or 'qoe')
   * @returns Authorization headers ready to use in HTTP requests
   *
   * @throws {AuthenticationError} If authentication fails for all configured methods
   *
   * @example
   * ```typescript
   * const headers = await adapter.getAuthHeaders('events');
   * const response = await fetch('https://api.example.com/data', {
   *   headers: {
   *     ...headers,
   *     'Content-Type': 'application/json'
   *   }
   * });
   * ```
   */
  async getAuthHeaders(apiId: string): Promise<AuthorizationHeader> {
    if (!this.initialized) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }

    const apiConfig = this.config.apis[apiId as keyof typeof this.config.apis];
    if (!apiConfig) {
      throw new ConfigurationError(`No configuration found for API: ${apiId}`);
    }

    // Try primary auth method first
    try {
      const headers = await this.getHeadersForMethod(apiConfig, apiConfig.primaryAuth);

      this.auditEmitter.emitAuthSuccess({
        tenantId: this.config.tenantId,
        apiId: apiConfig.id,
        authMethod: apiConfig.primaryAuth as any,
        metadata: { method: 'primary' },
      });

      return headers;
    } catch (primaryError) {
      // Primary method failed, emit failure event
      this.auditEmitter.emitAuthFailure({
        tenantId: this.config.tenantId,
        apiId: apiConfig.id,
        authMethod: apiConfig.primaryAuth as any,
        reason: primaryError instanceof Error ? primaryError.message : String(primaryError),
      });

      // Try fallback methods
      for (const fallbackMethod of apiConfig.authMethods) {
        if (fallbackMethod === apiConfig.primaryAuth) {
          continue; // Already tried
        }

        try {
          const headers = await this.getHeadersForMethod(apiConfig, fallbackMethod);

          this.auditEmitter.emitAuthSuccess({
            tenantId: this.config.tenantId,
            apiId: apiConfig.id,
            authMethod: fallbackMethod as any,
            metadata: { method: 'fallback', primaryMethod: apiConfig.primaryAuth },
          });

          return headers;
        } catch (fallbackError) {
          this.auditEmitter.emitAuthFailure({
            tenantId: this.config.tenantId,
            apiId: apiConfig.id,
            authMethod: fallbackMethod as any,
            reason: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
          // Continue to next fallback
        }
      }

      // All methods failed
      throw new AuthenticationError(
        `All authentication methods failed for API: ${apiId}`,
        apiConfig.id,
        apiConfig.primaryAuth,
        primaryError instanceof Error ? primaryError : undefined
      );
    }
  }

  /**
   * Gets headers for a specific authentication method
   */
  private async getHeadersForMethod(
    apiConfig: FriendlyApiConfig,
    method: AuthMethod
  ): Promise<AuthorizationHeader> {
    const credentials = await this.decryptCredentials(apiConfig.credentials);

    switch (method) {
      case 'basic':
        return this.getBasicAuthHeaders(credentials);

      case 'apikey':
        return this.getApiKeyHeaders(credentials);

      case 'jwt':
        return this.getJwtHeaders(apiConfig.id);

      case 'oauth2':
        return this.getOAuth2Headers(apiConfig.id);

      default:
        throw new Error(`Unsupported auth method: ${method}`);
    }
  }

  /**
   * Generates Basic Authentication headers
   */
  private getBasicAuthHeaders(credentials: TenantCredentials): AuthorizationHeader {
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password required for Basic auth');
    }

    const base64Credentials = Buffer.from(
      `${credentials.username}:${credentials.password}`
    ).toString('base64');

    return {
      Authorization: `Basic ${base64Credentials}`,
    };
  }

  /**
   * Generates API Key headers
   */
  private getApiKeyHeaders(credentials: TenantCredentials): AuthorizationHeader {
    if (!credentials.apiKey) {
      throw new Error('API key required for API key auth');
    }

    return {
      'X-API-Key': credentials.apiKey,
    };
  }

  /**
   * Gets JWT Bearer token headers
   */
  private async getJwtHeaders(apiId: string): Promise<AuthorizationHeader> {
    const handler = this.jwtHandlers.get(apiId);
    if (!handler) {
      throw new Error(`JWT handler not initialized for API: ${apiId}`);
    }

    return await handler.getAuthorizationHeader();
  }

  /**
   * Gets OAuth2 Bearer token headers
   */
  private async getOAuth2Headers(apiId: string): Promise<AuthorizationHeader> {
    const handler = this.oauth2Handlers.get(apiId);
    if (!handler) {
      throw new Error(`OAuth2 handler not initialized for API: ${apiId}`);
    }

    return await handler.getToken();
  }

  /**
   * Handles 401 Unauthorized responses by refreshing tokens and retrying
   *
   * @param apiId - The API identifier
   * @returns New authorization headers after token refresh
   */
  async handle401(apiId: string): Promise<AuthorizationHeader> {
    const apiConfig = this.config.apis[apiId as keyof typeof this.config.apis];
    if (!apiConfig) {
      throw new ConfigurationError(`No configuration found for API: ${apiId}`);
    }

    // Emit token expired event
    this.auditEmitter.emitTokenExpired({
      tenantId: this.config.tenantId,
      apiId: apiConfig.id,
      authMethod: apiConfig.primaryAuth as any,
      expiredAt: new Date(),
    });

    // Clear cached tokens and get fresh ones
    if (apiConfig.primaryAuth === 'jwt') {
      const handler = this.jwtHandlers.get(apiId);
      if (handler) {
        await handler.clearCache();
      }
    } else if (apiConfig.primaryAuth === 'oauth2') {
      const handler = this.oauth2Handlers.get(apiId);
      if (handler) {
        await handler.clearCache();
      }
    }

    // Get new headers
    return this.getAuthHeaders(apiId);
  }

  /**
   * Checks if the adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gets the tenant ID
   */
  getTenantId(): string {
    return this.config.tenantId;
  }

  /**
   * Gets the list of configured API IDs
   */
  getConfiguredApis(): string[] {
    return Object.keys(this.config.apis);
  }

  /**
   * Closes the adapter and cleans up resources
   */
  async close(): Promise<void> {
    // Close JWT handlers
    for (const handler of this.jwtHandlers.values()) {
      await handler.close();
    }

    // Close OAuth2 handlers
    for (const handler of this.oauth2Handlers.values()) {
      await handler.destroy();
    }

    // Close Redis connection
    await this.redis.quit();

    this.initialized = false;
  }

  /**
   * Creates a FriendlyAuthAdapter from Prisma Tenant data
   *
   * @param tenant - Tenant data from Prisma
   * @param redis - Redis configuration
   * @param encryptionKey - Encryption key for credentials
   * @returns Configured FriendlyAuthAdapter instance
   *
   * @example
   * ```typescript
   * const tenant = await prisma.tenant.findUnique({
   *   where: { id: 'tenant-123' }
   * });
   *
   * const adapter = await FriendlyAuthAdapter.fromPrismaTenant(
   *   tenant,
   *   { host: 'localhost', port: 6379 },
   *   process.env.ENCRYPTION_KEY
   * );
   * ```
   */
  static async fromPrismaTenant(
    tenant: {
      id: string;
      friendlyDmUrl: string;
      friendlyEventsUrl: string;
      friendlyQoEUrl: string;
      encryptedCredentials: any;
    },
    redis: FriendlyAuthAdapterConfig['redis'],
    encryptionKey?: string
  ): Promise<FriendlyAuthAdapter> {
    const credentials = tenant.encryptedCredentials as TenantCredentials;

    const adapter = new FriendlyAuthAdapter({
      tenantId: tenant.id,
      apis: {
        northbound: {
          id: 'northbound',
          baseUrl: tenant.friendlyDmUrl,
          authMethods: ['jwt', 'basic'],
          primaryAuth: 'jwt',
          credentials,
        },
        events: {
          id: 'events',
          baseUrl: tenant.friendlyEventsUrl,
          authMethods: ['jwt', 'basic'],
          primaryAuth: 'jwt',
          credentials,
        },
        qoe: {
          id: 'qoe',
          baseUrl: tenant.friendlyQoEUrl,
          authMethods: ['apikey', 'basic'],
          primaryAuth: 'apikey',
          credentials,
        },
      },
      redis,
      encryptionKey,
    });

    await adapter.initialize();
    return adapter;
  }
}
