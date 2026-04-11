# AEP API Gateway Authentication Module

This module provides comprehensive JWT-based authentication for the AEP API Gateway using RS256 algorithm. It integrates with the Friendly Northbound API for credential validation and issues local JWT tokens for session management.

## Architecture

The authentication module consists of four main components:

1. **JWT Key Management** (`jwt-keys.ts`) - Generates and manages RSA key pairs for RS256 signing
2. **Auth Plugin** (`auth-plugin.ts`) - Fastify plugin that registers JWT and provides login/refresh routes
3. **Auth Middleware** (`auth-middleware.ts`) - Request validation middleware with role/tier-based access control
4. **Types** (`types.ts`) - TypeScript interfaces for authentication data structures

## Features

- RS256 JWT signing with RSA key pairs
- Integration with Friendly Northbound API via `@friendly-tech/iot/auth-adapter`
- Access token and refresh token flow
- Automatic token expiration handling
- Role-based access control (RBAC)
- Tier-based access control (free, professional, enterprise)
- Tenant context extraction from JWT
- Health check routes (exempt from authentication)
- Configurable exempt routes and patterns

## Installation

Ensure the following packages are installed:

```bash
npm install @fastify/jwt fastify-plugin
npm install @friendly-tech/iot/auth-adapter
```

## Quick Start

### 1. Generate JWT Keys

You can generate JWT keys in several ways:

```typescript
import { generateJwtKeyPair, getJwtKeyPair } from './auth/jwt-keys';

// Option 1: Generate programmatically
const keyPair = generateJwtKeyPair();
console.log(keyPair.privateKey);
console.log(keyPair.publicKey);

// Option 2: Load from environment variables
// Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in .env
const keyPair = getJwtKeyPair();

// Option 3: Load from filesystem or generate if missing
const keyPair = getJwtKeyPair({
  privateKeyPath: './keys/jwt-private.pem',
  publicKeyPath: './keys/jwt-public.pem',
  generateIfMissing: true
});
```

### 2. Register Auth Plugin

In your Fastify application, register the auth plugin:

```typescript
import { FastifyInstance } from 'fastify';
import authPlugin from './auth/auth-plugin';
import authMiddleware from './auth/auth-middleware';

async function setupAuth(fastify: FastifyInstance) {
  // Register auth plugin (provides JWT and auth routes)
  await fastify.register(authPlugin, {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'aep:auth:',
    },
    encryptionKey: process.env.ENCRYPTION_KEY,
    friendlyNorthboundUrl: process.env.FRIENDLY_NORTHBOUND_URL || 'https://dm.friendly.example.com',
    jwt: {
      privateKeyPath: './keys/jwt-private.pem',
      publicKeyPath: './keys/jwt-public.pem',
      generateIfMissing: false, // Set to true in development only
      accessTokenExpiration: '15m',
      refreshTokenExpiration: '7d',
      issuer: 'aep-api-gateway',
    },
    verboseErrors: process.env.NODE_ENV !== 'production',
  });

  // Register auth middleware (protects all /api/v1/* routes)
  await fastify.register(authMiddleware, {
    exemptRoutes: [
      '/api/v1/auth/login',
      '/api/v1/auth/token/refresh',
      '/health',
      '/health/ready',
      '/health/live',
      '/',
    ],
    verboseErrors: process.env.NODE_ENV !== 'production',
  });
}
```

### 3. Environment Variables

Create a `.env` file with the following variables:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Keys (base64 encoded PEM format, or raw PEM)
JWT_PRIVATE_KEY=LS0tLS1CRUdJTi...
JWT_PUBLIC_KEY=LS0tLS1CRUdJTi...

# Encryption Key for Credentials
ENCRYPTION_KEY=your-32-character-hex-key-here

# Friendly API Configuration
FRIENDLY_NORTHBOUND_URL=https://dm.friendly.example.com

# Application
NODE_ENV=development
APP_VERSION=1.0.0
```

## API Endpoints

### POST /api/v1/auth/login

Authenticates user credentials against Friendly Northbound API and issues JWT tokens.

**Request:**
```json
{
  "uid": "user@tenant123",
  "pw": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "userId": "user@tenant123",
    "tenantId": "tenant123",
    "role": "user",
    "tier": "professional"
  }
}
```

### POST /api/v1/auth/token/refresh

Refreshes an access token using a valid refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

## Using Authentication in Routes

### Basic Authentication

All routes under `/api/v1/*` are automatically protected by the auth middleware:

```typescript
fastify.get('/api/v1/projects', async (request, reply) => {
  // User is automatically authenticated
  const tenantId = request.user!.tenantId;
  const userId = request.user!.userId;

  const projects = await getProjectsForTenant(tenantId);
  return projects;
});
```

### Using Helper Functions

```typescript
import { getTenantId, getUserId, hasRole, hasTier } from './auth';

fastify.get('/api/v1/data', async (request, reply) => {
  const tenantId = getTenantId(request);
  const userId = getUserId(request);

  if (hasRole(request, 'admin')) {
    // Admin-specific logic
  }

  if (hasTier(request, 'professional')) {
    // Professional tier features
  }

  return { tenantId, userId };
});
```

### Role-Based Access Control

Protect routes with specific role requirements:

```typescript
import { requireRole } from './auth';

fastify.delete('/api/v1/admin/users/:id', {
  onRequest: [requireRole(['admin', 'superadmin'])]
}, async (request, reply) => {
  // Only admin and superadmin users can access this route
  const { id } = request.params;
  await deleteUser(id);
  return { success: true };
});
```

### Tier-Based Access Control

Protect premium features with tier requirements:

```typescript
import { requireTier } from './auth';

fastify.get('/api/v1/premium/analytics', {
  onRequest: [requireTier('professional')]
}, async (request, reply) => {
  // Only professional and enterprise users can access
  const tenantId = getTenantId(request);
  const analytics = await getAdvancedAnalytics(tenantId);
  return analytics;
});
```

### Manual Authentication

For routes that need explicit control:

```typescript
import { requireAuth } from './auth';

fastify.get('/api/v1/optional-auth', async (request, reply) => {
  try {
    // Try to authenticate
    await request.jwtVerify();
    const tenantId = request.user!.tenantId;
    return { authenticated: true, tenantId };
  } catch {
    // Not authenticated, return public data
    return { authenticated: false };
  }
});
```

## JWT Payload Structure

The JWT payload contains the following fields:

```typescript
interface JwtPayload {
  tenantId: string;        // Tenant ID for multi-tenant isolation
  userId: string;          // User ID within the tenant
  role: string;            // User role (admin, user, viewer, etc.)
  tier: 'free' | 'professional' | 'enterprise'; // Subscription tier
  iat?: number;            // Issued at timestamp
  exp?: number;            // Expiration timestamp
  sub?: string;            // Subject (user identifier)
  iss?: string;            // Issuer
}
```

## Security Considerations

1. **Private Key Protection**: Store private keys securely. Never commit them to version control.
2. **Environment Variables**: Use environment variables for sensitive configuration.
3. **HTTPS Only**: Always use HTTPS in production to prevent token interception.
4. **Token Expiration**: Keep access tokens short-lived (15 minutes recommended).
5. **Refresh Token Rotation**: Implement refresh token rotation in production.
6. **Rate Limiting**: Add rate limiting to login endpoints to prevent brute force attacks.
7. **Audit Logging**: Log all authentication events for security monitoring.

## Integration with Friendly API

The authentication flow works as follows:

1. User submits credentials (`uid` and `pw`) to `/api/v1/auth/login`
2. Gateway creates `FriendlyAuthAdapter` with tenant credentials
3. Adapter authenticates with Friendly Northbound API (JWT or Basic Auth)
4. On success, gateway issues local JWT tokens with tenant context
5. Subsequent requests use JWT for authentication
6. JWT is verified on each request to `/api/v1/*` routes
7. Tenant ID is extracted and used for data isolation

## Error Handling

The module provides proper error responses:

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### Login Failure

```json
{
  "error": "Unauthorized",
  "message": "Authentication failed"
}
```

## Testing

### Test Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "user@tenant123", "pw": "password123"}'
```

### Test Protected Route

```bash
curl http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Test Token Refresh

```bash
curl -X POST http://localhost:3000/api/v1/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

### Test Health Check (No Auth Required)

```bash
curl http://localhost:3000/health
```

## Troubleshooting

### JWT Verification Fails

- Check that the same key pair is used for signing and verification
- Ensure the token hasn't expired
- Verify the issuer matches the configuration

### Login Fails

- Check Friendly Northbound API connectivity
- Verify credentials are correct
- Check Redis connectivity
- Review encryption key configuration

### Keys Not Loading

- Verify environment variables are set correctly
- Check file paths are absolute
- Ensure private key has correct permissions (600)

## Module Reference

Based on **Friendly AI AEP Module Reference v2.2, Section 5.1** (aep-api-gateway):

> Unified HTTP/WS gateway on Fastify 4.x. Handles multi-method auth via auth-adapter against all three Friendly APIs (Basic Auth UID/PW, JWT exchange, API Key). Resolves tenant context, enriches downstream requests.

This module implements the authentication layer specified in the system architecture, providing:

- Multi-method authentication support (JWT, Basic Auth, API Key)
- Tenant context resolution from JWT payload
- Integration with `@friendly-tech/iot/auth-adapter`
- RS256 algorithm for enhanced security
- Role and tier-based access control for policy enforcement
