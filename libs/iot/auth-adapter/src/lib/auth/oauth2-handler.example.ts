/**
 * OAuth2 Authentication Handler - Usage Examples
 *
 * @module OAuth2AuthHandler.examples
 * @phase Phase 2 - Not Yet Implemented
 * @description Practical examples of OAuth2 handler usage
 *
 * These examples demonstrate how to use the OAuth2AuthHandler in various
 * scenarios. Note that this is a stub implementation - actual OAuth2 calls
 * will be implemented in Phase 2.
 */

import {
  OAuth2AuthHandler,
  createOAuth2Handler,
  type OAuth2Config,
} from './oauth2-handler';

// ============================================================================
// Example 1: Basic Configuration
// ============================================================================

/**
 * Basic OAuth2 handler setup with minimal configuration
 */
export function basicExample() {
  const handler = new OAuth2AuthHandler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
  });

  return handler;
}

// ============================================================================
// Example 2: Configuration with Scopes
// ============================================================================

/**
 * OAuth2 handler with specific scopes
 */
export function scopedExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
    scopes: ['device:read', 'device:write', 'device:control'],
  });

  return handler;
}

// ============================================================================
// Example 3: Configuration with Redis Caching
// ============================================================================

/**
 * OAuth2 handler with Redis token caching
 */
export function redisExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'redis-password',
      db: 0,
      keyPrefix: 'oauth2:tokens:',
    },
  });

  return handler;
}

// ============================================================================
// Example 4: Environment-based Configuration
// ============================================================================

/**
 * OAuth2 handler configured from environment variables
 */
export function envBasedExample() {
  if (
    !process.env.OAUTH2_TOKEN_ENDPOINT ||
    !process.env.OAUTH2_CLIENT_ID ||
    !process.env.OAUTH2_CLIENT_SECRET
  ) {
    throw new Error('Missing required OAuth2 environment variables');
  }

  const config: OAuth2Config = {
    tokenEndpoint: process.env.OAUTH2_TOKEN_ENDPOINT,
    clientId: process.env.OAUTH2_CLIENT_ID,
    clientSecret: process.env.OAUTH2_CLIENT_SECRET,
    scopes: process.env.OAUTH2_SCOPES?.split(',') || [],
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    },
  };

  return createOAuth2Handler(config);
}

// ============================================================================
// Example 5: Making Authenticated API Calls
// ============================================================================

/**
 * Example of using OAuth2 handler to make authenticated API calls
 *
 * @phase Phase 2 - Will work when token acquisition is implemented
 */
export async function authenticatedApiCallExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
  });

  try {
    // Get authorization headers
    const authHeaders = await handler.getToken();

    // Make API call with authorization
    const response = await fetch('https://api.example.com/devices', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 6: Express.js Middleware
// ============================================================================

/**
 * Express middleware for OAuth2 authentication
 *
 * @phase Phase 2 - Will work when token acquisition is implemented
 */
export function expressMiddlewareExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: process.env.OAUTH2_TOKEN_ENDPOINT!,
    clientId: process.env.OAUTH2_CLIENT_ID!,
    clientSecret: process.env.OAUTH2_CLIENT_SECRET!,
  });

  return async (req: any, res: any, next: any) => {
    try {
      const authHeaders = await handler.getToken();
      req.oauth2Headers = authHeaders;
      next();
    } catch (error) {
      console.error('OAuth2 authentication failed:', error);
      res.status(500).json({
        error: 'Authentication failed',
        message: 'Unable to obtain OAuth2 token',
      });
    }
  };
}

// ============================================================================
// Example 7: Fastify Decorator Plugin
// ============================================================================

/**
 * Fastify plugin for OAuth2 authentication
 *
 * @phase Phase 2 - Will work when token acquisition is implemented
 */
export async function fastifyPluginExample(fastify: any, opts: any) {
  const handler = createOAuth2Handler({
    tokenEndpoint: opts.tokenEndpoint,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    scopes: opts.scopes,
    redis: opts.redis,
  });

  // Decorate fastify instance
  fastify.decorate('oauth2', handler);

  // Add hook to inject auth headers
  fastify.addHook('onRequest', async (request: any, reply: any) => {
    try {
      request.oauth2Headers = await handler.getToken();
    } catch (error) {
      reply.code(500).send({
        error: 'OAuth2 authentication failed',
      });
    }
  });

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    await handler.destroy();
  });
}

// ============================================================================
// Example 8: Token Lifecycle Management
// ============================================================================

/**
 * Example of complete token lifecycle management
 *
 * @phase Phase 2 - Will work when token acquisition is implemented
 */
export async function tokenLifecycleExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
  });

  try {
    // Get initial token
    console.log('Getting initial token...');
    const token1 = await handler.getToken();
    console.log('Token acquired:', token1.Authorization.substring(0, 20) + '...');

    // Token is cached - second call returns cached token
    console.log('Getting cached token...');
    const token2 = await handler.getToken();
    console.log('Cached token:', token2.Authorization.substring(0, 20) + '...');

    // Manually refresh token
    console.log('Refreshing token...');
    const token3 = await handler.refreshToken();
    console.log('New token:', token3.Authorization.substring(0, 20) + '...');

    // Revoke token
    console.log('Revoking token...');
    const revocationResult = await handler.revokeToken();
    console.log('Revocation result:', revocationResult);

    // Get new token after revocation
    console.log('Getting token after revocation...');
    const token4 = await handler.getToken();
    console.log('New token:', token4.Authorization.substring(0, 20) + '...');
  } finally {
    // Always cleanup
    await handler.destroy();
  }
}

// ============================================================================
// Example 9: Error Handling
// ============================================================================

/**
 * Example of proper error handling with OAuth2 handler
 *
 * @phase Phase 2 - Will work when token acquisition is implemented
 */
export async function errorHandlingExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
  });

  try {
    const authHeaders = await handler.getToken();

    // Use the token
    const response = await fetch('https://api.example.com/devices', {
      headers: authHeaders,
    });

    if (response.status === 401) {
      // Token might be expired, try refreshing
      console.log('Token expired, refreshing...');
      const newHeaders = await handler.refreshToken();

      // Retry with new token
      const retryResponse = await fetch('https://api.example.com/devices', {
        headers: newHeaders,
      });

      return await retryResponse.json();
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error('OAuth2 error:', error.message);

      // Handle specific error types
      if (error.message.includes('token')) {
        // Clear cache and retry
        await handler.clearCache();
        const freshHeaders = await handler.getToken();
        // Retry API call...
      }
    }
    throw error;
  } finally {
    await handler.destroy();
  }
}

// ============================================================================
// Example 10: Health Check Integration
// ============================================================================

/**
 * Example of integrating OAuth2 handler health check
 *
 * @phase Phase 2 - Will work when health check is implemented
 */
export async function healthCheckExample() {
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
  });

  // Health check endpoint
  const checkHealth = async () => {
    const isReady = await handler.isReady();

    return {
      oauth2: {
        ready: isReady,
        timestamp: new Date().toISOString(),
      },
    };
  };

  // Example health check result
  const health = await checkHealth();
  console.log('OAuth2 health status:', health);

  return health;
}

// ============================================================================
// Example 11: Multiple Handlers for Different Services
// ============================================================================

/**
 * Example of managing multiple OAuth2 handlers for different services
 */
export function multipleHandlersExample() {
  // Handler for Device API
  const deviceHandler = createOAuth2Handler({
    tokenEndpoint: 'https://device-auth.example.com/oauth2/token',
    clientId: 'device-client-id',
    clientSecret: 'device-client-secret',
    scopes: ['device:read', 'device:write'],
    redis: {
      keyPrefix: 'oauth2:device:',
    },
  });

  // Handler for Analytics API
  const analyticsHandler = createOAuth2Handler({
    tokenEndpoint: 'https://analytics-auth.example.com/oauth2/token',
    clientId: 'analytics-client-id',
    clientSecret: 'analytics-client-secret',
    scopes: ['analytics:read'],
    redis: {
      keyPrefix: 'oauth2:analytics:',
    },
  });

  // Handler for Notification API
  const notificationHandler = createOAuth2Handler({
    tokenEndpoint: 'https://notification-auth.example.com/oauth2/token',
    clientId: 'notification-client-id',
    clientSecret: 'notification-client-secret',
    scopes: ['notification:send'],
    redis: {
      keyPrefix: 'oauth2:notification:',
    },
  });

  return {
    device: deviceHandler,
    analytics: analyticsHandler,
    notification: notificationHandler,
  };
}

// ============================================================================
// Example 12: Custom Cache TTL
// ============================================================================

/**
 * Example of configuring custom cache TTL
 */
export function customCacheTtlExample() {
  // Cache tokens for only 50% of their lifetime (more aggressive refresh)
  const handler = createOAuth2Handler({
    tokenEndpoint: 'https://auth.example.com/oauth2/token',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
    cacheTtl: 1800, // 30 minutes in seconds
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  return handler;
}
