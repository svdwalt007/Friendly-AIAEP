# JWT Authentication Handler - Quick Start Guide

## Installation

The handler is part of the `@friendly-aiaep/auth-adapter` library.

Dependencies are already configured:
```json
{
  "dependencies": {
    "ioredis": "^5.3.2"
  }
}
```

Run `pnpm install` to install dependencies.

## Basic Setup (3 Steps)

### 1. Import the Handler

```typescript
import { JWTAuthHandler } from '@friendly-aiaep/auth-adapter';
```

### 2. Create and Initialize

```typescript
const handler = new JWTAuthHandler({
  eventsUrl: 'https://api.example.com',
  username: 'your-username',
  password: 'your-password',
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

await handler.initialize();
```

### 3. Get Authorization Header

```typescript
const authHeader = await handler.getAuthorizationHeader();
// Returns: { Authorization: 'Bearer eyJhbGc...' }

// Use in HTTP requests
const response = await fetch('https://api.example.com/data', {
  headers: {
    ...authHeader,
    'Content-Type': 'application/json',
  },
});
```

## Complete Example

```typescript
import { JWTAuthHandler, AuthError, AuthErrorType } from '@friendly-aiaep/auth-adapter';

async function main() {
  const handler = new JWTAuthHandler({
    eventsUrl: process.env.EVENTS_URL || 'https://api.example.com',
    username: process.env.AUTH_USERNAME || 'user',
    password: process.env.AUTH_PASSWORD || 'pass',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  try {
    // Initialize
    await handler.initialize();

    // Get auth header
    const authHeader = await handler.getAuthorizationHeader();

    // Make authenticated request
    const response = await fetch('https://api.example.com/data', {
      headers: authHeader,
    });

    const data = await response.json();
    console.log('Data:', data);
  } catch (error) {
    if (error instanceof AuthError) {
      console.error(`Auth error (${error.type}):`, error.message);
    } else {
      console.error('Error:', error);
    }
  } finally {
    // Clean up
    await handler.close();
  }
}

main();
```

## Environment Variables

Create a `.env` file:

```bash
EVENTS_URL=https://api.example.com
AUTH_USERNAME=your-username
AUTH_PASSWORD=your-password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-password
```

## Key Features

### Automatic Token Refresh
Tokens are automatically refreshed 60 seconds before expiry.

```typescript
// No manual refresh needed - handler does it automatically
const header1 = await handler.getAuthorizationHeader(); // Gets new token
// ... 59 minutes later ...
const header2 = await handler.getAuthorizationHeader(); // Returns cached token
// ... 59 minutes later (near expiry) ...
const header3 = await handler.getAuthorizationHeader(); // Auto-refreshes and returns new token
```

### Error Handling
Built-in retry logic with exponential backoff.

```typescript
try {
  const authHeader = await handler.getAuthorizationHeader();
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.type) {
      case AuthErrorType.INVALID_CREDENTIALS:
        // Handle bad username/password
        break;
      case AuthErrorType.NETWORK_ERROR:
        // Handle network issues
        break;
      case AuthErrorType.REDIS_ERROR:
        // Handle Redis connection issues
        break;
    }
  }
}
```

### Token Monitoring
Check token status without refreshing.

```typescript
const info = await handler.getTokenInfo();
console.log('Has cached token:', info.hasCachedToken);
console.log('Expires in:', info.expiresIn, 'seconds');
console.log('Expiring soon:', info.isExpiringSoon);
```

### Manual Cache Control
Force re-authentication when needed.

```typescript
// Clear cache to force new authentication
await handler.clearCache();

// Next call will authenticate again
const newHeader = await handler.getAuthorizationHeader();
```

## Configuration Options

### Minimal Configuration
```typescript
new JWTAuthHandler({
  eventsUrl: 'https://api.example.com',
  username: 'user',
  password: 'pass',
  redis: {
    host: 'localhost',
    port: 6379,
  },
});
```

### Full Configuration
```typescript
new JWTAuthHandler({
  eventsUrl: 'https://api.example.com',
  username: 'user',
  password: 'pass',
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: 'redis-secret',
    db: 2,
    keyPrefix: 'myapp:',
  },
  refreshBufferSeconds: 120,  // Refresh 2 min before expiry
  maxRetries: 5,               // Retry up to 5 times
  requestTimeout: 60000,       // 60 second timeout
});
```

## Framework Integration

### Fastify
```typescript
const authHandler = new JWTAuthHandler({ /* config */ });

fastify.addHook('onReady', async () => {
  await authHandler.initialize();
});

fastify.addHook('onClose', async () => {
  await authHandler.close();
});

fastify.get('/api/data', async () => {
  const headers = await authHandler.getAuthorizationHeader();
  return fetch(apiUrl, { headers });
});
```

### Express
```typescript
const authHandler = new JWTAuthHandler({ /* config */ });
await authHandler.initialize();

app.use(async (req, res, next) => {
  req.authHeader = await authHandler.getAuthorizationHeader();
  next();
});

app.get('/api/data', async (req, res) => {
  const response = await fetch(apiUrl, { headers: req.authHeader });
  res.json(await response.json());
});
```

## Testing

### Unit Tests
```bash
pnpm nx test auth-adapter
```

### Manual Testing
```typescript
// Test authentication
const handler = new JWTAuthHandler({ /* config */ });
await handler.initialize();

// Should authenticate successfully
const header = await handler.getAuthorizationHeader();
console.log('Auth header:', header);

// Should return cached token (fast)
const header2 = await handler.getAuthorizationHeader();
console.log('Cached header:', header2);

// Check token info
const info = await handler.getTokenInfo();
console.log('Token info:', info);

await handler.close();
```

## Troubleshooting

### "Not initialized" Error
```typescript
// ❌ Wrong
const handler = new JWTAuthHandler({ /* config */ });
await handler.getAuthorizationHeader(); // Error!

// ✅ Correct
const handler = new JWTAuthHandler({ /* config */ });
await handler.initialize(); // Initialize first!
await handler.getAuthorizationHeader(); // Works
```

### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check connection
redis-cli -h localhost -p 6379 ping
```

### Invalid Credentials
```typescript
// Verify credentials work
const response = await fetch('https://api.example.com/rest/v2/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'your-username',
    password: 'your-password',
  }),
});

console.log('Status:', response.status);
console.log('Response:', await response.json());
```

## API Reference

### Main Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize Redis connection (required) |
| `getAuthorizationHeader()` | Get auth header with valid token |
| `getTokenInfo()` | Get token status without refreshing |
| `clearCache()` | Clear cached token |
| `close()` | Close connections and cleanup |

### Configuration Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `eventsUrl` | `string` | Yes | - | API base URL |
| `username` | `string` | Yes | - | Username |
| `password` | `string` | Yes | - | Password |
| `redis.host` | `string` | Yes | - | Redis host |
| `redis.port` | `number` | Yes | - | Redis port |
| `redis.password` | `string` | No | - | Redis password |
| `redis.db` | `number` | No | 0 | Redis database |
| `redis.keyPrefix` | `string` | No | - | Key prefix |
| `refreshBufferSeconds` | `number` | No | 60 | Refresh buffer |
| `maxRetries` | `number` | No | 3 | Max retries |
| `requestTimeout` | `number` | No | 30000 | Timeout (ms) |

## Next Steps

1. ✅ Review this quick start
2. ✅ Set up Redis
3. ✅ Configure environment variables
4. ✅ Initialize the handler
5. ✅ Test authentication
6. ✅ Integrate into your app
7. ✅ Deploy to production

## Additional Resources

- **Full Documentation**: `JWT_README.md`
- **Usage Examples**: `jwt-handler.example.ts`
- **Implementation Details**: `JWT_IMPLEMENTATION_SUMMARY.md`
- **Unit Tests**: `jwt-handler.spec.ts`
- **Type Definitions**: `types.ts`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the full documentation in `JWT_README.md`
3. Look at examples in `jwt-handler.example.ts`
4. Examine unit tests in `jwt-handler.spec.ts`

---

**Happy Coding! 🚀**
