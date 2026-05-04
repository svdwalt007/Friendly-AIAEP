# Authentication Module - Example Usage

This document provides practical examples for integrating and using the authentication module.

## Table of Contents

1. [Application Setup](#application-setup)
2. [Key Management](#key-management)
3. [Route Protection Examples](#route-protection-examples)
4. [Client Integration](#client-integration)
5. [Advanced Scenarios](#advanced-scenarios)

## Application Setup

### Complete Integration in app.ts

```typescript
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import * as path from 'path';
import authPlugin from './auth/auth-plugin';
import authMiddleware from './auth/auth-middleware';

export interface AppOptions {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };
}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // 1. Register the auth plugin first (provides JWT and auth routes)
  await fastify.register(authPlugin, {
    redis: {
      host: opts.redis?.host || process.env.REDIS_HOST || 'localhost',
      port: opts.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: opts.redis?.password || process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'aep:auth:',
    },
    encryptionKey: process.env.ENCRYPTION_KEY,
    friendlyNorthboundUrl: process.env.FRIENDLY_NORTHBOUND_URL || 'https://dm.friendly.example.com',
    jwt: {
      // Use environment variables in production
      privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
      publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH,
      generateIfMissing: process.env.NODE_ENV === 'development',
      accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
      refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
      issuer: 'aep-api-gateway',
    },
    verboseErrors: process.env.NODE_ENV !== 'production',
  });

  // 2. Register the auth middleware (protects routes globally)
  await fastify.register(authMiddleware, {
    exemptRoutes: [
      '/api/v1/auth/login',
      '/api/v1/auth/token/refresh',
      '/health',
      '/health/ready',
      '/health/live',
      '/',
    ],
    // Optional: Add regex patterns for dynamic exempt routes
    exemptPatterns: [
      /^\/api\/v1\/public\//,  // All routes under /api/v1/public/
      /^\/docs/,               // Documentation routes
    ],
    verboseErrors: process.env.NODE_ENV !== 'production',
  });

  // 3. Load all plugins (sensible, cors, rate-limit, etc.)
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  // 4. Load all routes (these will be protected by auth middleware)
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
```

### Alternative: Conditional Auth Middleware

If you want more control over which routes are protected:

```typescript
export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Register auth plugin
  await fastify.register(authPlugin, { /* config */ });

  // Don't register global middleware
  // Instead, use decorators on specific routes

  // Load plugins and routes
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
```

## Key Management

### Development: Auto-Generate Keys

```typescript
import { getJwtKeyPair } from './auth/jwt-keys';

// In development, generate keys automatically
const keyPair = getJwtKeyPair({
  privateKeyPath: './keys/jwt-private.pem',
  publicKeyPath: './keys/jwt-public.pem',
  generateIfMissing: true, // Auto-generate if missing
});
```

### Production: Environment Variables

```bash
# Generate keys using OpenSSL
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Convert to base64 for environment variables
cat jwt-private.pem | base64 -w 0 > jwt-private.b64
cat jwt-public.pem | base64 -w 0 > jwt-public.b64

# Set environment variables
export JWT_PRIVATE_KEY=$(cat jwt-private.b64)
export JWT_PUBLIC_KEY=$(cat jwt-public.b64)
```

In your code:

```typescript
import { loadKeyPairFromEnv } from './auth/jwt-keys';

// In production, load from environment
const keyPair = loadKeyPairFromEnv();
```

### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: jwt-keys
type: Opaque
data:
  private-key: LS0tLS1CRUdJTi... # base64 encoded PEM
  public-key: LS0tLS1CRUdJTi...  # base64 encoded PEM
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aep-api-gateway
spec:
  template:
    spec:
      containers:
      - name: api-gateway
        env:
        - name: JWT_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: jwt-keys
              key: private-key
        - name: JWT_PUBLIC_KEY
          valueFrom:
            secretKeyRef:
              name: jwt-keys
              key: public-key
```

## Route Protection Examples

### Example 1: Protected Projects Route

```typescript
// routes/projects.ts
import { FastifyInstance } from 'fastify';
import { getTenantId, getUserId } from '../auth';

export default async function (fastify: FastifyInstance) {
  // GET /api/v1/projects
  // Automatically protected by global auth middleware
  fastify.get('/api/v1/projects', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            projects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  tenantId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Extract tenant context from JWT
    const tenantId = getTenantId(request);
    const userId = getUserId(request);

    // Fetch projects scoped to tenant
    const projects = await fetchProjectsForTenant(tenantId);

    return { projects };
  });

  // POST /api/v1/projects
  // Create a new project
  fastify.post('/api/v1/projects', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = getTenantId(request);
    const userId = getUserId(request);
    const { name, description } = request.body as any;

    const project = await createProject({
      name,
      description,
      tenantId,
      createdBy: userId,
    });

    return reply.code(201).send(project);
  });
}

// Mock functions (replace with actual database calls)
async function fetchProjectsForTenant(tenantId: string) {
  return [
    { id: '1', name: 'Project Alpha', tenantId },
    { id: '2', name: 'Project Beta', tenantId },
  ];
}

async function createProject(data: any) {
  return { id: '3', ...data, createdAt: new Date() };
}
```

### Example 2: Admin-Only Routes

```typescript
// routes/admin.ts
import { FastifyInstance } from 'fastify';
import { requireRole } from '../auth';

export default async function (fastify: FastifyInstance) {
  // DELETE /api/v1/admin/users/:id
  // Only admins can delete users
  fastify.delete('/api/v1/admin/users/:id', {
    onRequest: [requireRole(['admin', 'superadmin'])],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as any;
    await deleteUser(id);
    return { success: true };
  });

  // GET /api/v1/admin/stats
  // Only admins can view system stats
  fastify.get('/api/v1/admin/stats', {
    onRequest: [requireRole(['admin', 'superadmin'])],
  }, async (request, reply) => {
    const stats = await getSystemStats();
    return stats;
  });
}

async function deleteUser(id: string) {
  // Implementation
}

async function getSystemStats() {
  return {
    totalUsers: 1250,
    activeProjects: 89,
    apiCalls24h: 125000,
  };
}
```

### Example 3: Tier-Based Premium Features

```typescript
// routes/analytics.ts
import { FastifyInstance } from 'fastify';
import { requireTier, hasTier, getTenantId } from '../auth';

export default async function (fastify: FastifyInstance) {
  // GET /api/v1/analytics/basic
  // Available to all tiers
  fastify.get('/api/v1/analytics/basic', async (request, reply) => {
    const tenantId = getTenantId(request);
    const basicAnalytics = await getBasicAnalytics(tenantId);
    return basicAnalytics;
  });

  // GET /api/v1/analytics/advanced
  // Only for professional and enterprise tiers
  fastify.get('/api/v1/analytics/advanced', {
    onRequest: [requireTier('professional')],
  }, async (request, reply) => {
    const tenantId = getTenantId(request);
    const advancedAnalytics = await getAdvancedAnalytics(tenantId);
    return advancedAnalytics;
  });

  // GET /api/v1/analytics/enterprise
  // Only for enterprise tier
  fastify.get('/api/v1/analytics/enterprise', {
    onRequest: [requireTier('enterprise')],
  }, async (request, reply) => {
    const tenantId = getTenantId(request);
    const enterpriseAnalytics = await getEnterpriseAnalytics(tenantId);
    return enterpriseAnalytics;
  });

  // GET /api/v1/analytics/features
  // Return features based on user's tier
  fastify.get('/api/v1/analytics/features', async (request, reply) => {
    const features = {
      basic: true,
      advanced: hasTier(request, 'professional'),
      enterprise: hasTier(request, 'enterprise'),
    };
    return features;
  });
}

async function getBasicAnalytics(tenantId: string) {
  return { totalProjects: 10, totalUsers: 5 };
}

async function getAdvancedAnalytics(tenantId: string) {
  return { trends: [], predictions: [] };
}

async function getEnterpriseAnalytics(tenantId: string) {
  return { customReports: [], dataExports: [] };
}
```

### Example 4: Optional Authentication

```typescript
// routes/public.ts
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  // GET /api/v1/public/templates
  // Public route - no authentication required
  fastify.get('/api/v1/public/templates', async (request, reply) => {
    const templates = await getPublicTemplates();
    return { templates };
  });

  // GET /api/v1/templates
  // Shows different content based on authentication
  fastify.get('/api/v1/templates', async (request, reply) => {
    try {
      // Try to authenticate
      await request.jwtVerify();
      const tenantId = request.user!.tenantId;

      // Return tenant-specific templates
      const templates = await getTenanttemplates(tenantId);
      return { templates, authenticated: true };
    } catch {
      // Not authenticated, return public templates only
      const templates = await getPublicTemplates();
      return { templates, authenticated: false };
    }
  });
}

async function getPublicTemplates() {
  return [
    { id: '1', name: 'Basic Template', public: true },
  ];
}

async function getTenanttemplates(tenantId: string) {
  return [
    { id: '1', name: 'Basic Template', public: true },
    { id: '2', name: 'Custom Template', tenantId, public: false },
  ];
}
```

## Client Integration

### JavaScript/TypeScript Client

```typescript
class AepApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(uid: string, pw: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, pw }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;

    return data.user;
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
  }

  async request(path: string, options: RequestInit = {}) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    // Handle 401 and retry with refresh
    if (response.status === 401) {
      await this.refreshAccessToken();
      return this.request(path, options);
    }

    return response;
  }

  async getProjects() {
    const response = await this.request('/api/v1/projects');
    return response.json();
  }
}

// Usage
const client = new AepApiClient('http://localhost:45001');
await client.login('user@tenant123', 'password123');
const projects = await client.getProjects();
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:45001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"uid":"user@tenant123","pw":"password123"}' \
  | jq -r '.accessToken' > token.txt

# Use access token
curl http://localhost:45001/api/v1/projects \
  -H "Authorization: Bearer $(cat token.txt)"

# Refresh token
curl -X POST http://localhost:45001/api/v1/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$(cat token.txt)\"}"
```

## Advanced Scenarios

### Custom JWT Claims

```typescript
// Extend the JWT payload with custom claims
interface CustomJwtPayload extends JwtPayload {
  customClaim: string;
  metadata?: Record<string, any>;
}

// In auth-plugin.ts, modify the payload creation
const payload: CustomJwtPayload = {
  tenantId,
  userId,
  role,
  tier,
  customClaim: 'value',
  metadata: { source: 'friendly-api' },
};
```

### Multi-Tenant Isolation

```typescript
// Ensure all database queries are scoped to tenant
fastify.get('/api/v1/data', async (request, reply) => {
  const tenantId = getTenantId(request);

  // Use tenant ID in all queries
  const data = await prisma.data.findMany({
    where: { tenantId },
  });

  return data;
});
```

### Audit Logging

```typescript
// Add audit logging hook
fastify.addHook('onResponse', async (request, reply) => {
  if (request.user) {
    await auditLog.create({
      tenantId: request.user.tenantId,
      userId: request.user.userId,
      action: request.method,
      resource: request.url,
      statusCode: reply.statusCode,
      timestamp: new Date(),
    });
  }
});
```

### Rate Limiting by Tier

```typescript
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: async (request, key) => {
    // Different limits based on tier
    if (!request.user) return 100; // Anonymous

    switch (request.user.tier) {
      case 'enterprise': return 10000;
      case 'professional': return 1000;
      case 'free': return 100;
      default: return 100;
    }
  },
  timeWindow: '1 minute',
});
```
