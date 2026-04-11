/**
 * Authentication Plugin for AEP API Gateway
 *
 * Registers @fastify/jwt with RS256 algorithm and provides authentication routes:
 * - POST /api/v1/auth/login - Authenticate with Friendly API and issue JWT
 * - POST /api/v1/auth/token/refresh - Refresh JWT with refresh token
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import { getJwtKeyPair, validateKeyPair } from './jwt-keys';
import {
  JwtPayload,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
} from './types';

/**
 * Configuration for the auth plugin
 */
export interface AuthPluginConfig {
  /** Redis configuration for FriendlyAuthAdapter */
  redis: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };

  /** Encryption key for credential decryption */
  encryptionKey?: string;

  /** JWT signing configuration */
  jwt?: {
    /** Path to private key file (optional, will use env vars if not provided) */
    privateKeyPath?: string;

    /** Path to public key file (optional, will use env vars if not provided) */
    publicKeyPath?: string;

    /** Generate keys if missing (default: false for production safety) */
    generateIfMissing?: boolean;

    /** Access token expiration time (default: '15m') */
    accessTokenExpiration?: string | number;

    /** Refresh token expiration time (default: '7d') */
    refreshTokenExpiration?: string | number;

    /** Token issuer (default: 'aep-api-gateway') */
    issuer?: string;
  };

  /** Friendly Northbound API base URL */
  friendlyNorthboundUrl: string;

  /** Whether to enable detailed error messages (default: false for production) */
  verboseErrors?: boolean;
}

/**
 * Redis configuration for FriendlyAuthAdapter instances
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

/**
 * Cache for FriendlyAuthAdapter instances by tenant ID
 */
const authAdapterCache = new Map<string, FriendlyAuthAdapter>();

/**
 * Declare authConfig on FastifyInstance
 */
declare module 'fastify' {
  interface FastifyInstance {
    authConfig: {
      redis: RedisConfig;
      encryptionKey?: string;
      friendlyNorthboundUrl: string;
      accessTokenExpiration: string | number;
      refreshTokenExpiration: string | number;
      verboseErrors: boolean;
    };
  }
}

/**
 * Authentication plugin for Fastify
 *
 * This plugin:
 * 1. Registers @fastify/jwt with RS256 algorithm
 * 2. Provides login route that authenticates via FriendlyAuthAdapter
 * 3. Provides token refresh route
 * 4. Stores JWT configuration and helpers on Fastify instance
 */
const authPlugin: FastifyPluginAsync<AuthPluginConfig> = async (
  fastify: FastifyInstance,
  options: AuthPluginConfig
) => {
  // Load or generate JWT keys
  const keyPair = getJwtKeyPair({
    privateKeyPath: options.jwt?.privateKeyPath,
    publicKeyPath: options.jwt?.publicKeyPath,
    generateIfMissing: options.jwt?.generateIfMissing ?? false,
  });

  // Validate key pair
  validateKeyPair(keyPair);

  // Register @fastify/jwt with RS256
  await fastify.register(fastifyJwt as any, {
    secret: {
      private: keyPair.privateKey,
      public: keyPair.publicKey,
    },
    sign: {
      algorithm: 'RS256',
      expiresIn: options.jwt?.accessTokenExpiration ?? '15m',
      issuer: options.jwt?.issuer ?? 'aep-api-gateway',
    },
    verify: {
      algorithms: ['RS256'],
      issuer: options.jwt?.issuer ?? 'aep-api-gateway',
    },
  });

  // Store config on Fastify instance for use in routes
  const authConfig = {
    redis: {
      host: options.redis.host ?? 'localhost',
      port: options.redis.port ?? 6379,
      password: options.redis.password,
      db: options.redis.db ?? 0,
      keyPrefix: options.redis.keyPrefix ?? 'aep:auth:',
    } as RedisConfig,
    encryptionKey: options.encryptionKey ?? process.env.ENCRYPTION_KEY,
    friendlyNorthboundUrl: options.friendlyNorthboundUrl,
    accessTokenExpiration: options.jwt?.accessTokenExpiration ?? '15m',
    refreshTokenExpiration: options.jwt?.refreshTokenExpiration ?? '7d',
    verboseErrors: options.verboseErrors ?? false,
  };

  fastify.decorate('authConfig', authConfig);

  /**
   * Helper to get or create FriendlyAuthAdapter for a tenant
   */
  async function getAuthAdapter(
    tenantId: string,
    credentials: { username: string; password: string }
  ): Promise<FriendlyAuthAdapter> {
    const cacheKey = `${tenantId}:${credentials.username}`;

    // Check cache first
    if (authAdapterCache.has(cacheKey)) {
      const adapter = authAdapterCache.get(cacheKey)!;
      if (adapter.isInitialized()) {
        return adapter;
      }
      // Remove stale adapter
      authAdapterCache.delete(cacheKey);
    }

    // Create new adapter
    const config = fastify.authConfig;
    const adapter = new FriendlyAuthAdapter({
      tenantId,
      apis: {
        northbound: {
          id: 'northbound',
          baseUrl: config.friendlyNorthboundUrl,
          authMethods: ['jwt', 'basic'],
          primaryAuth: 'jwt',
          credentials: {
            username: credentials.username,
            password: credentials.password,
          },
        },
      },
      redis: config.redis,
      encryptionKey: config.encryptionKey,
    });

    await adapter.initialize();
    authAdapterCache.set(cacheKey, adapter);

    return adapter;
  }

  /**
   * POST /api/v1/auth/login
   *
   * Authenticates user credentials against Friendly Northbound API
   * and issues local JWT tokens.
   */
  fastify.post<{
    Body: LoginRequest;
  }>(
    '/api/v1/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['uid', 'pw'],
          properties: {
            uid: { type: 'string', minLength: 1 },
            pw: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              tokenType: { type: 'string', enum: ['Bearer'] },
              expiresIn: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  tenantId: { type: 'string' },
                  role: { type: 'string' },
                  tier: { type: 'string', enum: ['free', 'professional', 'enterprise'] },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
      const { uid, pw } = request.body;

      try {
        // Extract tenant ID from username (assuming format: username@tenantId)
        // In production, this might come from a different source
        const tenantId = uid.includes('@') ? uid.split('@')[1] : 'default';
        const username = uid;

        // Get auth adapter and authenticate with Friendly Northbound API
        const authAdapter = await getAuthAdapter(tenantId, {
          username,
          password: pw,
        });

        // If we got here, authentication was successful (getAuthHeaders would throw on failure)
        await authAdapter.getAuthHeaders('northbound');
        // In a real implementation, you would fetch user details from Friendly API
        // For now, we'll use mock data based on authentication success

        // Mock user data - in production, fetch from Friendly API
        const userId = username; // Or parse from Friendly API response
        const role = 'user'; // Fetch from Friendly API
        const tier: 'free' | 'professional' | 'enterprise' = 'professional'; // Fetch from Friendly API or database

        // Create JWT payload
        const payload: JwtPayload = {
          tenantId,
          userId,
          role,
          tier,
        };

        // Sign access token
        const accessToken = fastify.jwt.sign(payload, {
          expiresIn: fastify.authConfig.accessTokenExpiration,
        });

        // Sign refresh token (longer expiration)
        const refreshToken = fastify.jwt.sign(
          { ...payload, tokenType: 'refresh' } as any,
          {
            expiresIn: fastify.authConfig.refreshTokenExpiration,
          }
        );

        // Calculate expiration time in seconds
        const expiresIn = parseExpiration(fastify.authConfig.accessTokenExpiration);

        const response: LoginResponse = {
          accessToken,
          refreshToken,
          tokenType: 'Bearer',
          expiresIn,
          user: {
            userId,
            tenantId,
            role,
            tier,
          },
        };

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error({ err: error }, 'Login failed');

        const config = fastify.authConfig;
        const errorMessage = config.verboseErrors && error instanceof Error
          ? error.message
          : 'Authentication failed';

        return reply.code(401).send({
          error: 'Unauthorized',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/v1/auth/token/refresh
   *
   * Refreshes an access token using a valid refresh token.
   */
  fastify.post<{
    Body: RefreshRequest;
  }>(
    '/api/v1/auth/token/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              tokenType: { type: 'string', enum: ['Bearer'] },
              expiresIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RefreshRequest }>, reply: FastifyReply) => {
      const { refreshToken } = request.body;

      try {
        // Verify the refresh token
        const decoded = fastify.jwt.verify<JwtPayload & { tokenType?: string }>(refreshToken);

        // Ensure it's actually a refresh token
        if (decoded.tokenType !== 'refresh') {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid token type',
          });
        }

        // Create new payload (remove tokenType and refresh timestamps)
        const { tokenType, iat, exp, ...basePayload } = decoded;
        const payload: JwtPayload = basePayload;

        // Sign new access token
        const accessToken = fastify.jwt.sign(payload, {
          expiresIn: fastify.authConfig.accessTokenExpiration,
        });

        // Sign new refresh token
        const newRefreshToken = fastify.jwt.sign(
          { ...payload, tokenType: 'refresh' } as any,
          {
            expiresIn: fastify.authConfig.refreshTokenExpiration,
          }
        );

        // Calculate expiration time in seconds
        const expiresIn = parseExpiration(fastify.authConfig.accessTokenExpiration);

        const response: RefreshResponse = {
          accessToken,
          refreshToken: newRefreshToken,
          tokenType: 'Bearer',
          expiresIn,
        };

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error({ err: error }, 'Token refresh failed');

        const config = fastify.authConfig;
        const errorMessage = config.verboseErrors && error instanceof Error
          ? error.message
          : 'Invalid or expired refresh token';

        return reply.code(401).send({
          error: 'Unauthorized',
          message: errorMessage,
        });
      }
    }
  );

  // Clean up adapters on server close
  fastify.addHook('onClose', async () => {
    for (const adapter of authAdapterCache.values()) {
      await adapter.close();
    }
    authAdapterCache.clear();
  });
};

/**
 * Parse expiration time string to seconds
 */
function parseExpiration(expiration: string | number): number {
  if (typeof expiration === 'number') {
    return expiration;
  }

  // Parse strings like "15m", "7d", "1h", etc.
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 900; // Default to 15 minutes
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return 900; // Default to 15 minutes
  }
}

// Export as Fastify plugin
export default fastifyPlugin(authPlugin, {
  name: 'aep-auth-plugin',
  fastify: '5.x',
});
