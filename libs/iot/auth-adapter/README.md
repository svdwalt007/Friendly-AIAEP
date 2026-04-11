# auth-adapter

Comprehensive authentication adapter for connecting to Friendly IoT APIs with multi-method authentication, automatic token refresh, credential encryption, and audit logging.

## Overview

The `auth-adapter` library provides a unified interface for authenticating to three Friendly API endpoints (Northbound, Events, QoE) with support for:

- **4 Authentication Methods**: Basic Auth, API Key, JWT Bearer, OAuth2 Client Credentials
- **Automatic Token Management**: JWT auto-refresh with Redis caching
- **Credential Security**: AES-256-GCM encryption for credential storage
- **Fallback Mechanisms**: Primary auth → secondary auth on failure
- **401 Retry Logic**: Automatic token refresh on 401 responses
- **Audit Trail**: Event emission for all authentication operations
- **Multi-Tenant**: Per-tenant credential storage via Prisma integration
- **Type-Safe**: Full TypeScript support with comprehensive interfaces

## Installation

```bash
pnpm add @friendly-tech/iot/auth-adapter
pnpm add ioredis  # Required for JWT token caching
```

## Quick Start

### Basic Usage

```typescript
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import Redis from 'ioredis';

// Create Redis client for token caching
const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

// Configure adapter
const adapter = new FriendlyAuthAdapter({
  apis: [
    {
      id: 'northbound',
      baseUrl: 'https://dm.friendly.example.com',
      authMethods: ['basic', 'apikey'],
      primaryAuth: 'basic',
      credentials: {
        username: 'admin',
        password: 'secret123',
        apiKey: 'api-key-backup'
      }
    },
    {
      id: 'events',
      baseUrl: 'https://events.friendly.example.com',
      authMethods: ['jwt', 'apikey'],
      primaryAuth: 'jwt',
      credentials: {
        username: 'events-user',
        password: 'events-pass',
        apiKey: 'events-api-key-backup'
      }
    }
  ],
  redis,
  tenantId: 'tenant-123'
});

// Get auth headers for API calls
const headers = await adapter.getAuthHeaders('events');
console.log(headers); // { Authorization: 'Bearer eyJhbGc...' }

// Use headers in HTTP requests
const response = await fetch('https://events.friendly.example.com/api/devices', {
  headers
});

// Handle 401 responses with automatic token refresh
if (response.status === 401) {
  const freshHeaders = await adapter.handle401('events');
  const retryResponse = await fetch('https://events.friendly.example.com/api/devices', {
    headers: freshHeaders
  });
}

// Cleanup when done
await adapter.close();
```

### From Prisma Tenant

```typescript
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import { prisma } from '@friendly-tech/data/prisma-schema';
import Redis from 'ioredis';

// Fetch tenant from database
const tenant = await prisma.tenant.findUnique({
  where: { id: 'tenant-123' }
});

// Create adapter from Prisma tenant
const adapter = await FriendlyAuthAdapter.fromPrismaTenant(
  tenant,
  new Redis(),
  process.env.ENCRYPTION_KEY
);

// Use adapter
const headers = await adapter.getAuthHeaders('northbound');
```

## Authentication Methods

### 1. Basic Authentication

Uses HTTP Basic Auth with username and password.

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [{
    id: 'northbound',
    baseUrl: 'https://dm.friendly.example.com',
    authMethods: ['basic'],
    primaryAuth: 'basic',
    credentials: {
      username: 'admin',
      password: 'secret123'
    }
  }],
  redis,
  tenantId: 'tenant-123'
});

const headers = await adapter.getAuthHeaders('northbound');
// { Authorization: 'Basic YWRtaW46c2VjcmV0MTIz' }
```

### 2. API Key Authentication

Uses custom header `X-API-Key`.

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [{
    id: 'qoe',
    baseUrl: 'https://qoe.friendly.example.com',
    authMethods: ['apikey'],
    primaryAuth: 'apikey',
    credentials: {
      apiKey: 'qoe-api-key-12345'
    }
  }],
  redis,
  tenantId: 'tenant-123'
});

const headers = await adapter.getAuthHeaders('qoe');
// { 'X-API-Key': 'qoe-api-key-12345' }
```

### 3. JWT Authentication

Authenticates with username/password to get JWT token, caches in Redis with auto-refresh.

**Features**:
- POST to `/rest/v2/auth/login` with credentials
- Parses JWT exp claim or uses expiresAt/expiresIn from response
- Caches token in Redis with SHA-256 key hashing
- Auto-refreshes 60 seconds before expiry
- Exponential backoff retry (1s, 2s, 4s) on failure

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [{
    id: 'events',
    baseUrl: 'https://events.friendly.example.com',
    authMethods: ['jwt'],
    primaryAuth: 'jwt',
    credentials: {
      username: 'events-user',
      password: 'events-pass'
    }
  }],
  redis,
  tenantId: 'tenant-123'
});

const headers = await adapter.getAuthHeaders('events');
// { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }

// Token is cached in Redis and auto-refreshed
// Subsequent calls return cached token if not expired
const cachedHeaders = await adapter.getAuthHeaders('events');
```

### 4. OAuth2 Client Credentials (Phase 2)

OAuth2 client credentials flow support.

**Status**: Stub implementation - throws error "Phase 2 - Not Yet Implemented"

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [{
    id: 'northbound',
    baseUrl: 'https://dm.friendly.example.com',
    authMethods: ['oauth2'],
    primaryAuth: 'oauth2',
    credentials: {
      oauth2Config: {
        tokenUrl: 'https://auth.friendly.example.com/oauth/token',
        clientId: 'client-123',
        clientSecret: 'client-secret',
        scope: 'api:read api:write'
      }
    }
  }],
  redis,
  tenantId: 'tenant-123'
});

// Will throw: "Phase 2 - Not Yet Implemented"
```

## Credential Encryption

All credentials can be encrypted using AES-256-GCM before storage.

### Encrypting Credentials

```typescript
import { encryptCredential } from '@friendly-tech/iot/auth-adapter';

const credentials = {
  username: 'admin',
  password: 'secret123',
  apiKey: 'api-key-12345'
};

const encrypted = encryptCredential(
  credentials,
  process.env.ENCRYPTION_KEY
);

console.log(encrypted);
// {
//   username: 'encrypted:iv:authTag:ciphertext',
//   password: 'encrypted:iv:authTag:ciphertext',
//   apiKey: 'encrypted:iv:authTag:ciphertext'
// }
```

### Decrypting Credentials

```typescript
import { decryptCredential } from '@friendly-tech/iot/auth-adapter';

const decrypted = decryptCredential(
  encrypted,
  process.env.ENCRYPTION_KEY
);

console.log(decrypted);
// {
//   username: 'admin',
//   password: 'secret123',
//   apiKey: 'api-key-12345'
// }
```

### Using with Adapter

The adapter automatically detects and decrypts encrypted credentials:

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [{
    id: 'northbound',
    baseUrl: 'https://dm.friendly.example.com',
    authMethods: ['basic'],
    primaryAuth: 'basic',
    credentials: {
      username: 'encrypted:iv1:tag1:cipher1',
      password: 'encrypted:iv2:tag2:cipher2'
    }
  }],
  redis,
  tenantId: 'tenant-123',
  encryptionKey: process.env.ENCRYPTION_KEY
});

// Credentials are automatically decrypted before use
const headers = await adapter.getAuthHeaders('northbound');
```

## Fallback Authentication

Configure multiple auth methods with automatic fallback on failure.

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [{
    id: 'northbound',
    baseUrl: 'https://dm.friendly.example.com',
    authMethods: ['jwt', 'apikey', 'basic'],
    primaryAuth: 'jwt',
    credentials: {
      username: 'admin',
      password: 'secret123',
      apiKey: 'api-key-backup'
    }
  }],
  redis,
  tenantId: 'tenant-123'
});

// 1. Tries JWT first (primary)
// 2. Falls back to API Key if JWT fails
// 3. Falls back to Basic Auth if API Key fails
const headers = await adapter.getAuthHeaders('northbound');
```

## 401 Retry Handling

Automatically refresh tokens on 401 responses:

```typescript
// Make API call
let response = await fetch('https://events.friendly.example.com/api/devices', {
  headers: await adapter.getAuthHeaders('events')
});

// Handle 401 by refreshing token
if (response.status === 401) {
  const freshHeaders = await adapter.handle401('events');
  response = await fetch('https://events.friendly.example.com/api/devices', {
    headers: freshHeaders
  });
}
```

## Audit Events

The adapter emits audit events for all authentication operations.

### Event Types

- `auth_success` - Successful authentication
- `auth_failure` - Authentication failure
- `token_refresh` - Token refreshed successfully
- `token_expired` - Token expired
- `credential_decryption_error` - Failed to decrypt credentials

### Listening to Events

```typescript
const adapter = new FriendlyAuthAdapter({
  apis: [/* ... */],
  redis,
  tenantId: 'tenant-123'
});

// Listen to all events
adapter.on('auth_success', (event) => {
  console.log(`✅ Auth success for ${event.apiId} using ${event.authMethod}`);
  console.log(`Tenant: ${event.tenantId}, Timestamp: ${event.timestamp}`);
});

adapter.on('auth_failure', (event) => {
  console.error(`❌ Auth failed for ${event.apiId}: ${event.error}`);
});

adapter.on('token_refresh', (event) => {
  console.log(`🔄 Token refreshed for ${event.apiId}`);
});

adapter.on('token_expired', (event) => {
  console.warn(`⏰ Token expired for ${event.apiId}`);
});

adapter.on('credential_decryption_error', (event) => {
  console.error(`🔐 Decryption failed: ${event.error}`);
});

// Filter events by tenant
import { createFilteredListener } from '@friendly-tech/iot/auth-adapter';

const listener = createFilteredListener(
  (event) => console.log('Filtered event:', event),
  { tenantId: 'tenant-123' }
);

adapter.on('auth_success', listener);
```

### Integration with Audit Service

```typescript
import { AuditEventEmitter } from '@friendly-tech/iot/auth-adapter';

const auditEmitter = new AuditEventEmitter();

// Register hook for external audit service
auditEmitter.registerAuditServiceHook(async (event) => {
  // Send to audit service
  await auditService.logEvent({
    type: event.eventType,
    tenantId: event.tenantId,
    timestamp: event.timestamp,
    metadata: event
  });
});
```

## Prisma Integration

Store encrypted credentials in Prisma and create adapters from tenant records.

### Tenant Model

```prisma
model Tenant {
  id                  String  @id @default(cuid())
  name                String
  friendlyDmUrl       String
  friendlyEventsUrl   String
  friendlyQoEUrl      String
  encryptedCredentials Json?   // Store encrypted credentials here
  // ... other fields
}
```

### Storing Credentials

```typescript
import { encryptCredential } from '@friendly-tech/iot/auth-adapter';
import { prisma } from '@friendly-tech/data/prisma-schema';

const encryptedCreds = {
  northbound: encryptCredential({
    username: 'admin',
    password: 'secret123'
  }, process.env.ENCRYPTION_KEY),

  events: encryptCredential({
    username: 'events-user',
    password: 'events-pass'
  }, process.env.ENCRYPTION_KEY),

  qoe: encryptCredential({
    apiKey: 'qoe-api-key-12345'
  }, process.env.ENCRYPTION_KEY)
};

await prisma.tenant.update({
  where: { id: 'tenant-123' },
  data: {
    encryptedCredentials: encryptedCreds
  }
});
```

### Creating Adapter from Tenant

```typescript
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import { prisma } from '@friendly-tech/data/prisma-schema';
import Redis from 'ioredis';

const tenant = await prisma.tenant.findUnique({
  where: { id: 'tenant-123' }
});

const adapter = await FriendlyAuthAdapter.fromPrismaTenant(
  tenant,
  new Redis(),
  process.env.ENCRYPTION_KEY
);

// Adapter is ready with decrypted credentials
const headers = await adapter.getAuthHeaders('northbound');
```

## Configuration Reference

### FriendlyAuthAdapterConfig

```typescript
interface FriendlyAuthAdapterConfig {
  apis: FriendlyApiConfig[];           // API configurations
  redis: Redis;                        // Redis client for token caching
  tenantId: string;                    // Tenant identifier
  encryptionKey?: string;              // Key for credential decryption
  auditEmitter?: AuditEventEmitter;    // Custom audit emitter
}
```

### FriendlyApiConfig

```typescript
interface FriendlyApiConfig {
  id: 'northbound' | 'events' | 'qoe';  // API identifier
  baseUrl: string;                       // Base URL for API
  authMethods: AuthMethod[];             // Supported auth methods
  primaryAuth: AuthMethod;               // Primary auth method
  credentials: TenantCredentials;        // Auth credentials
}

type AuthMethod = 'basic' | 'apikey' | 'jwt' | 'oauth2';
```

### TenantCredentials

```typescript
interface TenantCredentials {
  username?: string;           // For basic/jwt auth
  password?: string;           // For basic/jwt auth
  apiKey?: string;            // For apikey auth
  oauth2Config?: OAuth2Config; // For oauth2 auth
}
```

### OAuth2Config

```typescript
interface OAuth2Config {
  tokenUrl: string;     // OAuth2 token endpoint
  clientId: string;     // OAuth2 client ID
  clientSecret: string; // OAuth2 client secret
  scope?: string;       // OAuth2 scopes
}
```

## API Reference

### FriendlyAuthAdapter

#### Constructor

```typescript
constructor(config: FriendlyAuthAdapterConfig)
```

Creates a new adapter instance.

#### Static Methods

```typescript
static async fromPrismaTenant(
  tenant: any,
  redis: Redis,
  encryptionKey?: string
): Promise<FriendlyAuthAdapter>
```

Factory method to create adapter from Prisma tenant record.

#### Instance Methods

```typescript
async getAuthHeaders(apiId: string): Promise<AuthorizationHeader>
```

Get authentication headers for an API. Returns headers using primary auth method with automatic fallback.

```typescript
async handle401(apiId: string): Promise<AuthorizationHeader>
```

Handle 401 response by clearing cached tokens and getting fresh credentials.

```typescript
async close(): Promise<void>
```

Cleanup resources (close Redis connection, clear timers).

```typescript
on(event: string, listener: Function): this
```

Register event listener (extends EventEmitter).

### JWTAuthHandler

```typescript
class JWTAuthHandler {
  constructor(config: JWTAuthConfig);
  async getAuthorizationHeader(): Promise<AuthorizationHeader>;
  async authenticate(): Promise<JWTTokenData>;
  async clearCache(): Promise<void>;
  close(): void;
}
```

### Encryption Utilities

```typescript
function encrypt(plaintext: string, key?: string): string
function decrypt(ciphertext: string, key?: string): string

function encryptCredential(
  credential: Credential,
  key?: string
): EncryptedCredential

function decryptCredential(
  encrypted: EncryptedCredential,
  key?: string
): Credential

function generateEncryptionKey(): string
```

### AuditEventEmitter

```typescript
class AuditEventEmitter extends EventEmitter {
  emitAuthSuccess(tenantId: string, apiId: string, authMethod: AuthMethod, metadata?: any): void;
  emitAuthFailure(tenantId: string, apiId: string, authMethod: AuthMethod, error: string, metadata?: any): void;
  emitTokenRefresh(tenantId: string, apiId: string, authMethod: AuthMethod, metadata?: any): void;
  emitTokenExpired(tenantId: string, apiId: string, authMethod: AuthMethod, metadata?: any): void;
  emitCredentialDecryptionError(tenantId: string, error: string, metadata?: any): void;
  registerAuditServiceHook(hook: AuditServiceHook): void;
}
```

## Advanced Usage

### Custom Redis Configuration

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'redis.example.com',
  port: 6380,
  password: 'redis-password',
  db: 2,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: true,
  maxRetriesPerRequest: 3
});

const adapter = new FriendlyAuthAdapter({
  apis: [/* ... */],
  redis,
  tenantId: 'tenant-123'
});
```

### Custom JWT Handler Configuration

```typescript
import { JWTAuthHandler } from '@friendly-tech/iot/auth-adapter';

const handler = new JWTAuthHandler({
  baseUrl: 'https://events.friendly.example.com',
  credentials: {
    username: 'events-user',
    password: 'events-pass'
  },
  redis,
  tenantId: 'tenant-123',
  refreshThresholdSeconds: 120,  // Refresh 2 minutes before expiry
  maxRetries: 5,                 // Retry up to 5 times
  initialRetryDelayMs: 2000      // Start with 2s retry delay
});

const headers = await handler.getAuthorizationHeader();
```

### Transaction Support

```typescript
// Ensure consistent credentials across transaction
const adapter = new FriendlyAuthAdapter({
  apis: [/* ... */],
  redis,
  tenantId: 'tenant-123'
});

try {
  const headers = await adapter.getAuthHeaders('northbound');

  // Use same headers for multiple requests in transaction
  const response1 = await fetch('https://dm.friendly.example.com/api/devices', { headers });
  const response2 = await fetch('https://dm.friendly.example.com/api/users', { headers });

  // Both requests use same token
} catch (error) {
  console.error('Transaction failed:', error);
}
```

## Troubleshooting

### Redis Connection Errors

**Error**: `Error: Redis connection failed`

**Solutions**:
1. Verify Redis is running: `redis-cli ping`
2. Check Redis host/port in configuration
3. Ensure Redis allows connections from your IP
4. Check Redis password if authentication is enabled

### JWT Token Not Refreshing

**Error**: Token expires despite auto-refresh configured

**Solutions**:
1. Verify `refreshThresholdSeconds` is set (default: 60)
2. Check Redis is caching tokens: `redis-cli keys "auth:jwt:*"`
3. Ensure JWT response includes `exp` claim or `expiresIn`/`expiresAt`
4. Check adapter event logs for token_refresh events

### Credential Decryption Errors

**Error**: `DecryptionError: Failed to decrypt credential`

**Solutions**:
1. Verify `ENCRYPTION_KEY` environment variable is set
2. Ensure encryption key matches the one used for encryption
3. Check encrypted format is `encrypted:iv:authTag:ciphertext`
4. Verify credentials were encrypted with same algorithm (AES-256-GCM)

### 401 Errors Despite Valid Credentials

**Error**: Persistent 401 responses

**Solutions**:
1. Verify credentials are correct
2. Check API baseUrl is correct
3. Try manual authentication with curl:
   ```bash
   curl -u username:password https://api.example.com/rest/v2/auth/login
   ```
4. Check if API requires additional headers
5. Verify fallback methods are configured correctly

### Memory Leaks with JWT Handler

**Error**: Memory usage increases over time

**Solutions**:
1. Always call `await adapter.close()` when done
2. Ensure scheduled refresh timers are cleared
3. Don't create multiple handlers for same API
4. Use handler pooling (built into FriendlyAuthAdapter)

## Testing

Run the test suite:

```bash
# Run all tests
pnpm nx test auth-adapter

# Run tests in watch mode
pnpm nx test auth-adapter --watch

# Run specific test file
pnpm nx test auth-adapter --testFile=friendly-auth-adapter.spec.ts
```

### Test Coverage

- **148+ total test cases** across all modules
- **FriendlyAuthAdapter**: 48 tests (initialization, auth methods, fallback, 401 handling)
- **JWTAuthHandler**: 18 tests (authentication, caching, refresh)
- **Encryption**: 64 tests (encrypt/decrypt, credential handling, error cases)
- **AuditEventEmitter**: 40+ tests (event emission, filtering, hooks)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   FriendlyAuthAdapter                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Config: northbound, events, qoe                 │   │
│  │  - Primary auth method                               │   │
│  │  - Fallback methods                                  │   │
│  │  - Encrypted credentials                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │
│  │   Basic    │  │  API Key   │  │  JWT Handler Pool    │   │
│  │   Auth     │  │   Auth     │  │  (per API)           │   │
│  └────────────┘  └────────────┘  └──────────────────────┘   │
│                                   │                          │
│                                   ▼                          │
│                          ┌─────────────────┐                 │
│                          │  Redis Cache    │                 │
│                          │  - Token store  │                 │
│                          │  - TTL mgmt     │                 │
│                          │  - Auto-refresh │                 │
│                          └─────────────────┘                 │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              AuditEventEmitter                       │   │
│  │  - auth_success, auth_failure                        │   │
│  │  - token_refresh, token_expired                      │   │
│  │  - credential_decryption_error                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Audit Service │
                  │  (External)    │
                  └────────────────┘
```

## Environment Variables

```bash
# Required
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Redis (if not using default localhost:6379)
REDIS_HOST=redis.example.com
REDIS_PORT=6380
REDIS_PASSWORD=redis-password
REDIS_DB=0

# Friendly API URLs
FRIENDLY_DM_URL=https://dm.friendly.example.com
FRIENDLY_EVENTS_URL=https://events.friendly.example.com
FRIENDLY_QOE_URL=https://qoe.friendly.example.com
```

## License

UNLICENSED

## Building

Run `nx build auth-adapter` to build the library.

## Running unit tests

Run `nx test auth-adapter` to execute the unit tests via [Vitest](https://vitest.dev/).
