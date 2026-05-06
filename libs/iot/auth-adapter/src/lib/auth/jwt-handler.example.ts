/**
 * JWT Authentication Handler - Usage Examples
 *
 * This file demonstrates various usage patterns for the JWTAuthHandler.
 * These examples are for reference only and are not compiled as part of the library.
 */

import { JWTAuthHandler, AuthError, AuthErrorType } from './jwt-handler';

/**
 * Example 1: Basic Usage
 */
async function basicExample() {
  const handler = new JWTAuthHandler({
    eventsUrl: 'https://api.example.com',
    username: 'user@example.com',
    password: 'your-password',
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  try {
    // Initialize the handler
    await handler.initialize();

    // Get authorization header
    const authHeader = await handler.getAuthorizationHeader();
    console.log('Authorization header:', authHeader);

    // Use in HTTP request
    const response = await fetch('https://api.example.com/data', {
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('API response:', data);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    await handler.close();
  }
}

/**
 * Example 2: Error Handling
 */
async function errorHandlingExample() {
  const handler = new JWTAuthHandler({
    eventsUrl: 'https://api.example.com',
    username: 'user@example.com',
    password: 'wrong-password',
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  try {
    await handler.initialize();
    await handler.getAuthorizationHeader();
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case AuthErrorType.INVALID_CREDENTIALS:
          console.error('Invalid credentials provided');
          break;
        case AuthErrorType.NETWORK_ERROR:
          console.error('Network request failed:', error.message);
          break;
        case AuthErrorType.REDIS_ERROR:
          console.error('Redis connection issue:', error.message);
          break;
        case AuthErrorType.TOKEN_EXPIRED:
          console.error('Token expired and refresh failed');
          break;
        case AuthErrorType.PARSE_ERROR:
          console.error('Failed to parse JWT token');
          break;
        default:
          console.error('Unknown error:', error.message);
      }

      // Access original error if available
      if (error.originalError) {
        console.error('Original error:', error.originalError);
      }
    }
  } finally {
    await handler.close();
  }
}

/**
 * Example 3: Custom Configuration
 */
async function customConfigExample() {
  const handler = new JWTAuthHandler({
    eventsUrl: 'https://api.example.com',
    username: 'user@example.com',
    password: 'your-password',
    redis: {
      host: 'redis.example.com',
      port: 6379,
      password: 'redis-secret',
      db: 2,
      keyPrefix: 'myapp:',
    },
    refreshBufferSeconds: 120, // Refresh 2 minutes before expiry
    maxRetries: 5, // Retry up to 5 times
    requestTimeout: 60000, // 60 second timeout
  });

  await handler.initialize();
  const authHeader = await handler.getAuthorizationHeader();
  console.log('Got auth header:', authHeader);
  await handler.close();
}

/**
 * Example 4: Token Monitoring
 */
async function tokenMonitoringExample() {
  const handler = new JWTAuthHandler({
    eventsUrl: 'https://api.example.com',
    username: 'user@example.com',
    password: 'your-password',
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  await handler.initialize();

  // Get initial token
  await handler.getAuthorizationHeader();

  // Monitor token status
  const monitor = setInterval(async () => {
    const info = await handler.getTokenInfo();

    if (info.hasCachedToken) {
      console.log(`Token expires in ${info.expiresIn} seconds`);

      if (info.isExpiringSoon) {
        console.log('Token will be refreshed soon');
      }
    } else {
      console.log('No cached token');
    }
  }, 10000); // Check every 10 seconds

  // Stop monitoring after 5 minutes
  setTimeout(() => {
    clearInterval(monitor);
    handler.close();
  }, 300000);
}

/**
 * Example 5: Manual Cache Management
 */
async function cacheManagementExample() {
  const handler = new JWTAuthHandler({
    eventsUrl: 'https://api.example.com',
    username: 'user@example.com',
    password: 'your-password',
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  await handler.initialize();

  // Get token
  const header1 = await handler.getAuthorizationHeader();
  console.log('First token:', header1);

  // Check token info
  const info1 = await handler.getTokenInfo();
  console.log('Token info:', info1);

  // Clear cache to force re-authentication
  await handler.clearCache();

  // This will authenticate again
  const header2 = await handler.getAuthorizationHeader();
  console.log('New token:', header2);

  await handler.close();
}

/**
 * Example 6: Fastify Integration
 */
async function fastifyIntegrationExample() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Fastify = require('fastify');
  const fastify = Fastify();

  const authHandler = new JWTAuthHandler({
    eventsUrl: process.env['EVENTS_URL'] || 'https://api.example.com',
    username: process.env['AUTH_USERNAME'] || 'user',
    password: process.env['AUTH_PASSWORD'] || 'pass',
    redis: {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
    },
  });

  // Initialize on server start
  fastify.addHook('onReady', async () => {
    await authHandler.initialize();
  });

  // Close on server stop
  fastify.addHook('onClose', async () => {
    await authHandler.close();
  });

  // Example route
  fastify.get('/api/data', async () => {
    const authHeader = await authHandler.getAuthorizationHeader();

    const response = await fetch('https://api.example.com/data', {
      headers: authHeader,
    });

    return response.json();
  });

  await fastify.listen({ port: 3000 });
}

/**
 * Example 7: Express Integration
 */
async function expressIntegrationExample() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const app = express();

  const authHandler = new JWTAuthHandler({
    eventsUrl: process.env['EVENTS_URL'] || 'https://api.example.com',
    username: process.env['AUTH_USERNAME'] || 'user',
    password: process.env['AUTH_PASSWORD'] || 'pass',
    redis: {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
    },
  });

  // Initialize
  await authHandler.initialize();

  // Middleware to add auth header
  app.use(async (req: any, res: any, next: any) => {
    try {
      req.authHeader = await authHandler.getAuthorizationHeader();
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Example route
  app.get('/api/data', async (req: any, res: any) => {
    try {
      const response = await fetch('https://api.example.com/data', {
        headers: req.authHeader,
      });

      res.json(await response.json());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(3000);

  // Cleanup on shutdown
  process.on('SIGTERM', async () => {
    await authHandler.close();
    process.exit(0);
  });
}

/**
 * Example 8: Retry Logic Demonstration
 */
async function retryLogicExample() {
  const handler = new JWTAuthHandler({
    eventsUrl: 'https://api.example.com',
    username: 'user@example.com',
    password: 'your-password',
    redis: {
      host: 'localhost',
      port: 6379,
    },
    maxRetries: 3,
  });

  await handler.initialize();

  try {
    // If the first request fails with a transient error,
    // the handler will retry up to 3 times with exponential backoff
    const authHeader = await handler.getAuthorizationHeader();
    console.log('Successfully authenticated:', authHeader);
  } catch (error) {
    console.error('Failed after retries:', error);
  } finally {
    await handler.close();
  }
}

// Export examples for documentation purposes
export {
  basicExample,
  errorHandlingExample,
  customConfigExample,
  tokenMonitoringExample,
  cacheManagementExample,
  fastifyIntegrationExample,
  expressIntegrationExample,
  retryLogicExample,
};
