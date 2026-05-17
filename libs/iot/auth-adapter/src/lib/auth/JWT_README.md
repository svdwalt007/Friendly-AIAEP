# JWT Authentication Handler

A robust JWT authentication handler for IoT applications with automatic token refresh, Redis caching, and comprehensive error handling.

## Features

- **Username/Password Authentication**: POST to REST API endpoint with credentials
- **Redis Token Caching**: Efficient token storage with automatic TTL management
- **Auto-Refresh**: Automatically refreshes tokens 60 seconds before expiry (configurable)
- **Token Parsing**: Extracts expiration and metadata from JWT tokens
- **Retry Logic**: Automatic retry on transient failures (excludes 401 errors)
- **Error Handling**: Comprehensive error types and detailed error messages
- **TypeScript**: Full type safety with detailed interfaces

## Installation

The `ioredis` dependency is already included in the package.json:

```json
{
  "dependencies": {
    "ioredis": "^5.3.2"
  }
}
```

## Quick Start

```typescript
import { JWTAuthHandler } from '@friendly-aiaep/auth-adapter';

// Create handler instance
const handler = new JWTAuthHandler({
  eventsUrl: 'https://api.example.com',
  username: 'user@example.com',
  password: 'your-password',
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'redis-password', // optional
  },
});

// Initialize (connects to Redis)
await handler.initialize();

// Get authorization header for requests
const authHeader = await handler.getAuthorizationHeader();
// Returns: { Authorization: 'Bearer eyJhbGc...' }

// Use in HTTP requests
const response = await fetch('https://api.example.com/data', {
  headers: {
    ...authHeader,
    'Content-Type': 'application/json',
  },
});

// Clean up when done
await handler.close();
```

## Configuration Options

```typescript
interface JWTAuthConfig {
  // Required
  eventsUrl: string;              // Base URL for auth API
  username: string;               // Authentication username
  password: string;               // Authentication password

  redis: {
    host: string;                 // Redis host
    port: number;                 // Redis port
    password?: string;            // Redis password (optional)
    db?: number;                  // Redis database number (default: 0)
    keyPrefix?: string;           // Key prefix for Redis keys (optional)
  };

  // Optional
  refreshBufferSeconds?: number;  // Refresh before expiry (default: 60)
  maxRetries?: number;            // Max retry attempts (default: 3)
  requestTimeout?: number;        // Request timeout in ms (default: 30000)
}
```

## API Methods

### `initialize(): Promise<void>`

Initializes the Redis connection. Must be called before using other methods.

```typescript
await handler.initialize();
```

### `getAuthorizationHeader(): Promise<AuthorizationHeader>`

Returns an Authorization header with a valid Bearer token. Automatically refreshes if needed.

```typescript
const header = await handler.getAuthorizationHeader();
// { Authorization: 'Bearer eyJhbGc...' }
```

### `clearCache(): Promise<void>`

Manually clears the cached token, forcing re-authentication on next request.

```typescript
await handler.clearCache();
```

### `getTokenInfo(): Promise<TokenInfo>`

Gets information about the current cached token without refreshing.

```typescript
const info = await handler.getTokenInfo();
// {
//   hasCachedToken: true,
//   expiresAt: 1234567890,
//   expiresIn: 3540,
//   isExpiringSoon: false
// }
```

### `close(): Promise<void>`

Closes the Redis connection and clears refresh timers.

```typescript
await handler.close();
```

## Error Handling

The handler throws `AuthError` instances with specific error types:

```typescript
import { AuthError, AuthErrorType } from '@friendly-aiaep/auth-adapter';

try {
  await handler.getAuthorizationHeader();
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.type) {
      case AuthErrorType.INVALID_CREDENTIALS:
        console.error('Invalid username/password');
        break;
      case AuthErrorType.TOKEN_EXPIRED:
        console.error('Token expired and refresh failed');
        break;
      case AuthErrorType.NETWORK_ERROR:
        console.error('Network request failed');
        break;
      case AuthErrorType.REDIS_ERROR:
        console.error('Redis connection issue');
        break;
      case AuthErrorType.PARSE_ERROR:
        console.error('Failed to parse JWT token');
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

## Advanced Usage

### Custom Refresh Buffer

Set a custom time before expiry to trigger refresh:

```typescript
const handler = new JWTAuthHandler({
  // ... other config
  refreshBufferSeconds: 120, // Refresh 2 minutes before expiry
});
```

### Custom Retry Configuration

```typescript
const handler = new JWTAuthHandler({
  // ... other config
  maxRetries: 5,              // Retry up to 5 times
  requestTimeout: 60000,      // 60 second timeout
});
```

### Redis with Password and Database

```typescript
const handler = new JWTAuthHandler({
  // ... other config
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: 'secret',
    db: 2,                    // Use database 2
    keyPrefix: 'myapp:',      // Prefix all keys with 'myapp:'
  },
});
```

### Monitoring Token Status

```typescript
// Check token status periodically
setInterval(async () => {
  const info = await handler.getTokenInfo();
  if (info.hasCachedToken) {
    console.log(`Token expires in ${info.expiresIn} seconds`);
    if (info.isExpiringSoon) {
      console.log('Token will refresh soon');
    }
  }
}, 10000); // Check every 10 seconds
```

### Integration with Fastify

```typescript
import Fastify from 'fastify';
import { JWTAuthHandler } from '@friendly-aiaep/auth-adapter';

const fastify = Fastify();
const authHandler = new JWTAuthHandler({ /* config */ });

// Initialize on server start
fastify.addHook('onReady', async () => {
  await authHandler.initialize();
});

// Close on server stop
fastify.addHook('onClose', async () => {
  await authHandler.close();
});

// Use in routes
fastify.get('/data', async (request, reply) => {
  const authHeader = await authHandler.getAuthorizationHeader();

  const response = await fetch('https://api.example.com/data', {
    headers: authHeader,
  });

  return response.json();
});
```

### Integration with Express

```typescript
import express from 'express';
import { JWTAuthHandler } from '@friendly-aiaep/auth-adapter';

const app = express();
const authHandler = new JWTAuthHandler({ /* config */ });

// Initialize
(async () => {
  await authHandler.initialize();

  app.get('/data', async (req, res) => {
    try {
      const authHeader = await authHandler.getAuthorizationHeader();

      const response = await fetch('https://api.example.com/data', {
        headers: authHeader,
      });

      res.json(await response.json());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(3000);
})();
```

## Token Lifecycle

1. **First Request**: No cached token exists
   - Authenticates with username/password
   - Parses JWT to extract expiration
   - Caches token in Redis with TTL
   - Schedules auto-refresh

2. **Subsequent Requests**: Valid cached token exists
   - Returns cached token immediately
   - No API call needed

3. **Token Expiring Soon**: Token within refresh buffer
   - Automatically refreshes token
   - Updates cache with new token
   - Reschedules next refresh

4. **Token Expired**: Token past expiration
   - Removes from cache
   - Authenticates to get new token
   - Updates cache

5. **Authentication Failure**: 401 or network error
   - Retries with exponential backoff
   - Throws AuthError if all retries fail

## Security Considerations

- **Credentials**: Store username/password in environment variables or secure configuration
- **Redis**: Use password-protected Redis instances in production
- **Network**: Use HTTPS for API endpoints
- **Token Storage**: Tokens are stored in Redis with automatic expiration
- **Key Isolation**: Each username/URL combination gets a unique cache key

## Testing

The handler includes comprehensive unit tests covering:

- Initialization and connection handling
- Token caching and retrieval
- Auto-refresh logic
- Error handling and retry logic
- Token parsing and expiration detection
- Redis operations

Run tests:

```bash
pnpm test auth-adapter
```

## Troubleshooting

### "Not initialized" Error

Make sure to call `initialize()` before using the handler:

```typescript
await handler.initialize();
```

### Redis Connection Issues

Check Redis configuration and network connectivity:

```typescript
// Test Redis connection separately
import Redis from 'ioredis';
const redis = new Redis({ host: 'localhost', port: 6379 });
await redis.ping(); // Should return 'PONG'
```

### Authentication Failures

Verify credentials and API endpoint:

```bash
curl -X POST https://api.example.com/rest/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'
```

### Token Not Refreshing

Check `refreshBufferSeconds` configuration and token expiration times:

```typescript
const info = await handler.getTokenInfo();
console.log('Token expires in:', info.expiresIn, 'seconds');
```

## License

UNLICENSED - Friendly Technology
