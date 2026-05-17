# OAuth2 Authentication Handler

**Status**: Phase 2 - Not Yet Implemented (Stub)

## Overview

This module provides OAuth2 authentication handling for IoT device integrations. It implements the `client_credentials` grant flow with token caching via Redis to minimize authorization server requests.

## Current Implementation

This is a **stub implementation** that defines the complete structure, interfaces, and method signatures for OAuth2 authentication. The actual token acquisition and management logic will be implemented in Phase 2.

## Features (Planned for Phase 2)

- ✅ OAuth2 client_credentials grant flow
- ✅ Token caching with Redis
- ✅ Automatic token refresh before expiration
- ✅ Bearer token authorization headers
- ✅ Token revocation support
- ✅ Comprehensive TypeScript types
- ✅ JSDoc documentation

## Usage

### Basic Setup

```typescript
import { OAuth2AuthHandler } from '@friendly-aiaep/auth-adapter';

const handler = new OAuth2AuthHandler({
  tokenEndpoint: 'https://auth.example.com/oauth2/token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scopes: ['read', 'write'],
  redis: {
    host: 'localhost',
    port: 6379,
    keyPrefix: 'oauth2:token:'
  }
});
```

### Getting Authorization Headers

```typescript
// Get authorization header for API requests
const headers = await handler.getToken();
// { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }

// Use in HTTP requests
fetch('https://api.example.com/devices', {
  headers: {
    ...headers,
    'Content-Type': 'application/json'
  }
});
```

### Using the Factory Function

```typescript
import { createOAuth2Handler } from '@friendly-aiaep/auth-adapter';

const handler = createOAuth2Handler({
  tokenEndpoint: process.env.OAUTH2_TOKEN_ENDPOINT,
  clientId: process.env.OAUTH2_CLIENT_ID,
  clientSecret: process.env.OAUTH2_CLIENT_SECRET
});
```

### Token Refresh

```typescript
// Manually refresh token (clears cache and gets new token)
const newHeaders = await handler.refreshToken();
```

### Token Revocation

```typescript
// Revoke current token
const result = await handler.revokeToken();
if (result.success) {
  console.log('Token revoked successfully');
}

// Revoke specific token
await handler.revokeToken('specific-token-to-revoke');
```

### Cleanup

```typescript
// Close connections and cleanup resources
await handler.destroy();
```

## Configuration

### OAuth2Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tokenEndpoint` | `string` | Yes | OAuth2 token endpoint URL |
| `clientId` | `string` | Yes | Client ID for OAuth2 application |
| `clientSecret` | `string` | Yes | Client secret for OAuth2 application |
| `grantType` | `'client_credentials'` | No | Grant type (default: `client_credentials`) |
| `scopes` | `string[]` | No | Optional scopes to request |
| `cacheTtl` | `number` | No | Token cache TTL in seconds (default: 90% of token expiry) |
| `redis` | `RedisConfig` | No | Redis configuration for token caching |

### RedisConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `host` | `string` | No | Redis host (default: `localhost`) |
| `port` | `number` | No | Redis port (default: `6379`) |
| `password` | `string` | No | Redis password if authentication is enabled |
| `db` | `number` | No | Redis database number (default: `0`) |
| `keyPrefix` | `string` | No | Key prefix for OAuth2 tokens (default: `oauth2:token:`) |

## Type Definitions

### OAuth2TokenResponse

```typescript
interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}
```

### AuthorizationHeader

```typescript
interface AuthorizationHeader {
  Authorization: string; // Format: 'Bearer <token>'
}
```

### CachedToken

```typescript
interface CachedToken {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // Unix timestamp
  scopes?: string[];
}
```

## Token Caching Strategy

The handler implements an intelligent caching strategy:

1. **Cache Key**: `{keyPrefix}{clientId}` (e.g., `oauth2:token:my-client-id`)
2. **Cache TTL**: 90% of actual token lifetime (configurable)
3. **Expiry Buffer**: 30-second buffer before actual expiry
4. **Automatic Refresh**: Tokens are refreshed before they expire

## Phase 2 Implementation Checklist

### Core Functionality

- [ ] Implement HTTP client for token endpoint requests
- [ ] Add proper error handling for network failures
- [ ] Implement retry logic with exponential backoff
- [ ] Add request/response logging

### Redis Integration

- [ ] Initialize Redis client on handler creation
- [ ] Implement token caching with proper TTL
- [ ] Add Redis connection health checks
- [ ] Handle Redis connection failures gracefully
- [ ] Add connection pooling

### Token Management

- [ ] Implement `requestNewToken()` method
- [ ] Implement `getCachedToken()` method
- [ ] Implement `cacheToken()` method
- [ ] Add token expiration checks
- [ ] Implement token revocation endpoint calls

### Security

- [ ] Add secure credential storage
- [ ] Implement token encryption in cache
- [ ] Add audit logging for token operations
- [ ] Implement rate limiting
- [ ] Add HTTPS enforcement

### Testing

- [ ] Add integration tests with real OAuth2 server
- [ ] Add Redis integration tests
- [ ] Test concurrent token requests
- [ ] Test token expiration scenarios
- [ ] Add performance benchmarks

### Documentation

- [ ] Add API documentation
- [ ] Create integration guides
- [ ] Add troubleshooting section
- [ ] Document error codes and handling

## Dependencies (Phase 2)

The following dependencies will be needed:

```json
{
  "dependencies": {
    "ioredis": "^5.x",
    "axios": "^1.x"
  },
  "devDependencies": {
    "@types/node": "^20.x"
  }
}
```

## Error Handling (Phase 2)

The handler will implement comprehensive error handling:

- **Network Errors**: Retry with exponential backoff
- **Invalid Credentials**: Fail fast with clear error message
- **Token Expired**: Automatic refresh
- **Redis Failures**: Fallback to requesting new token
- **Revocation Failures**: Log and clear cache anyway

## Performance Considerations

- Token caching reduces authorization server load
- Redis provides sub-millisecond token retrieval
- Automatic refresh prevents request delays
- Connection pooling for optimal throughput

## Security Best Practices

1. **Never log client secrets or tokens**
2. **Use HTTPS for all token endpoint communication**
3. **Rotate client credentials regularly**
4. **Encrypt tokens in Redis if storing sensitive data**
5. **Implement proper access controls on Redis**
6. **Use secure environment variable storage**

## Examples

### Express.js Middleware

```typescript
import { createOAuth2Handler } from '@friendly-aiaep/auth-adapter';

const oauth2 = createOAuth2Handler({
  tokenEndpoint: process.env.OAUTH2_TOKEN_ENDPOINT!,
  clientId: process.env.OAUTH2_CLIENT_ID!,
  clientSecret: process.env.OAUTH2_CLIENT_SECRET!
});

// Middleware to add OAuth2 headers
const oauth2Middleware = async (req, res, next) => {
  try {
    const headers = await oauth2.getToken();
    req.oauth2Headers = headers;
    next();
  } catch (error) {
    res.status(500).json({ error: 'OAuth2 authentication failed' });
  }
};

app.use('/api', oauth2Middleware);
```

### Fastify Plugin

```typescript
import { createOAuth2Handler } from '@friendly-aiaep/auth-adapter';
import fp from 'fastify-plugin';

export default fp(async (fastify, opts) => {
  const oauth2 = createOAuth2Handler(opts.oauth2Config);

  fastify.decorate('oauth2', oauth2);

  fastify.addHook('onRequest', async (request, reply) => {
    request.oauth2Headers = await oauth2.getToken();
  });

  fastify.addHook('onClose', async () => {
    await oauth2.destroy();
  });
});
```

## Related Documentation

- [OAuth 2.0 Client Credentials Grant](https://oauth.net/2/grant-types/client-credentials/)
- [Redis Documentation](https://redis.io/docs/)
- [IoT Auth Adapter Overview](../../README.md)

## Support

For questions or issues during Phase 2 implementation, please refer to:
- System Specification Document
- Module Reference Document
- Phase 1 Prompt Playbook
