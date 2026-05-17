# Security and Performance Enhancements

This document outlines the comprehensive security enhancements and performance optimizations implemented in the Friendly-AIAEP platform.

## Table of Contents

1. [Security Enhancements](#security-enhancements)
2. [Performance Optimizations](#performance-optimizations)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage Examples](#usage-examples)

## Security Enhancements

### 1. Enhanced Helmet Configuration

**Location:** `apps/aep-api-gateway/src/app/plugins/helmet.ts`

#### Features:
- **Comprehensive Content Security Policy (CSP)**
  - Environment-specific directives (development vs production)
  - Nonce support for inline scripts in production
  - Strict source whitelisting
  - Upgrade insecure requests in production

- **HTTP Strict Transport Security (HSTS)**
  - 1-year max-age
  - Includes subdomains
  - Preload directive for browser preload lists

- **Additional Security Headers**
  - Permissions Policy (Feature Policy)
  - Clear-Site-Data for logout endpoints
  - X-Content-Type-Options: nosniff
  - X-Download-Options: noopen
  - Cache-Control for sensitive endpoints

#### Configuration:
```typescript
// Automatically configured based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
```

### 2. Tiered Rate Limiting

**Location:** `apps/aep-api-gateway/src/app/plugins/rate-limiting.ts`

#### Features:
- **Subscription Tier Support**
  - FREE: 100 requests/minute
  - STARTER: 1,000 requests/minute
  - PROFESSIONAL: 10,000 requests/minute
  - ENTERPRISE: 100,000 requests/minute

- **Redis-Backed Storage**
  - Distributed rate limiting across instances
  - Automatic failover to in-memory storage
  - Graceful degradation on Redis failure

- **Advanced Features**
  - Automatic ban after consecutive violations
  - Custom rate limit keys per user/tenant
  - Whitelist for health check endpoints
  - Detailed error responses with retry information

#### Configuration:
```bash
# .env
REDIS_URL=redis://localhost:46102
ENABLE_REDIS=true
```

#### Usage:
```typescript
// Already registered globally in the plugin
// User tier is automatically extracted from JWT token
```

### 3. Secrets Management Service

**Location:** `libs/shared/secrets/src/lib/secrets.service.ts`

#### Features:
- **Multiple Backend Support**
  - Environment variables (default, active)
  - HashiCorp Vault (ready for production)
  - AWS Secrets Manager (ready for production)

- **Automatic Caching**
  - Configurable TTL (default: 5 minutes)
  - Reduces backend API calls
  - Automatic expiration

- **Error Handling**
  - Graceful fallback to environment variables
  - Required secret validation
  - Comprehensive error logging

#### Configuration:
```typescript
import { createSecretsService, SecretBackend } from '@friendly-aiaep/shared/secrets';

const secretsService = createSecretsService({
  backend: SecretBackend.ENV, // or VAULT or AWS_SECRETS_MANAGER
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes
});
```

#### Usage:
```typescript
// Get a single secret
const dbPassword = await secretsService.getSecret('DATABASE_PASSWORD', { required: true });

// Get multiple secrets
const secrets = await secretsService.getSecrets([
  'DATABASE_URL',
  'JWT_SECRET',
  'API_KEY'
]);

// Refresh a secret
await secretsService.refreshSecret('API_KEY');
```

### 4. Enhanced Authentication Middleware

**Location:** `apps/aep-api-gateway/src/app/middleware/auth.middleware.ts`

#### Features:
- **Enhanced JWT Verification**
  - Multiple algorithm support (HS256, RS256)
  - Token expiration validation
  - Issuer and audience verification
  - Token type validation (access vs refresh)

- **Multi-Tenant Support**
  - Tenant ID validation from JWT
  - Super admin bypass
  - Tenant isolation

- **Role-Based Access Control (RBAC)**
  - User roles: SUPER_ADMIN, ADMIN, USER, VIEWER
  - Role validation middleware
  - Permission-based access control

- **Token Management**
  - Token blacklisting support
  - Refresh token handling
  - Multiple token extraction methods

#### Configuration:
```typescript
import { createAuthMiddleware } from './middleware/auth.middleware';

const authMiddleware = createAuthMiddleware({
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  enableMultiTenant: true,
  enableTokenBlacklist: true,
  enableAuditLog: true,
});

fastify.addHook('onRequest', authMiddleware);
```

#### Usage:
```typescript
// Role-based protection
import { createRoleMiddleware, UserRole } from './middleware/auth.middleware';

const adminOnly = createRoleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
fastify.addHook('onRequest', adminOnly);

// Permission-based protection
import { createPermissionMiddleware } from './middleware/auth.middleware';

const requirePermissions = createPermissionMiddleware(['users:write', 'users:delete']);
fastify.addHook('onRequest', requirePermissions);

// Route-level authentication
import { requireAuth } from './middleware/auth.middleware';

fastify.route({
  method: 'GET',
  url: '/protected',
  onRequest: [requireAuth],
  handler: async (request, reply) => { ... }
});
```

## Performance Optimizations

### 5. Redis Caching Service

**Location:** `libs/shared/cache/src/lib/cache.service.ts`

#### Features:
- **Redis-Backed Caching**
  - Distributed caching across instances
  - Automatic failover to in-memory storage
  - Connection pooling and retry logic

- **TTL Management**
  - Configurable default TTL
  - Per-key TTL override
  - Automatic expiration

- **Cache Operations**
  - Get/Set/Delete
  - Pattern-based deletion
  - Cache existence check
  - Bulk clear

- **Statistics & Monitoring**
  - Hit/miss tracking
  - Hit rate calculation
  - Error tracking
  - Performance metrics

#### Configuration:
```typescript
import { createCacheService } from '@friendly-aiaep/shared/cache';

const cache = createCacheService({
  redis: {
    url: process.env.REDIS_URL,
    // or
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0,
  },
  defaultTTL: 300, // 5 minutes
  namespace: 'myapp',
  enableFallback: true,
});
```

#### Usage:
```typescript
// Set a value
await cache.set('user:123', { name: 'John' }, 600);

// Get a value
const user = await cache.get<User>('user:123');

// Delete a value
await cache.delete('user:123');

// Delete by pattern
await cache.deletePattern('user:*');

// Check existence
const exists = await cache.has('user:123');

// Get statistics
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);
```

### 6. Cache Decorators

**Location:** `libs/shared/cache/src/lib/cache.decorator.ts`

#### Features:
- **@Cacheable Decorator**
  - Automatic method result caching
  - Custom cache key generation
  - Conditional caching
  - TTL configuration

- **@CacheEvict Decorator**
  - Cache invalidation on method execution
  - Pattern-based eviction
  - Before/after invocation options
  - All entries eviction

- **@CachePut Decorator**
  - Always execute and update cache
  - Conditional cache updates
  - Useful for refresh operations

#### Usage:
```typescript
import { Cacheable, CacheEvict, CachePut } from '@friendly-aiaep/shared/cache';

class UserService {
  @Cacheable({ key: 'user', ttl: 600 })
  async getUser(id: string) {
    // This will be cached for 10 minutes
    return await db.user.findUnique({ where: { id } });
  }

  @CacheEvict({ key: 'user' })
  async updateUser(id: string, data: UserUpdate) {
    // This will evict the cache after updating
    return await db.user.update({ where: { id }, data });
  }

  @CachePut({ key: 'user', ttl: 600 })
  async refreshUser(id: string) {
    // This will always execute and update the cache
    return await db.user.findUnique({ where: { id } });
  }

  @Cacheable({
    key: (id: string) => `user:${id}`,
    condition: (id: string) => id !== 'admin'
  })
  async getUserConditional(id: string) {
    // Only cache non-admin users
    return await db.user.findUnique({ where: { id } });
  }
}
```

### 7. Enhanced API Gateway with Compression

**Location:** `apps/aep-api-gateway/src/main.ts`

#### Features:
- **HTTP Compression**
  - Gzip and Deflate support
  - Automatic content type detection
  - Configurable compression threshold
  - Excludes already compressed formats

- **Smart Caching Headers**
  - Static assets: Aggressive caching (1 year)
  - API responses: Short-term caching with validation
  - Auth endpoints: No caching for security
  - HTML pages: Moderate caching with validation

- **Performance Headers**
  - Server-Timing header
  - X-Response-Time header
  - ETag support for conditional requests

- **Request Deduplication**
  - Prevents duplicate GET requests
  - In-memory pending request tracking

- **Graceful Shutdown**
  - SIGINT/SIGTERM handling
  - Connection draining
  - Cleanup on exit

#### Configuration:
```bash
# .env
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
```

### 8. Performance Monitoring Middleware

**Location:** `apps/aep-api-gateway/src/app/middleware/performance.middleware.ts`

#### Features:
- **Request Timing**
  - High-resolution timing (nanosecond precision)
  - Duration tracking
  - Response time calculation

- **Slow Query Detection**
  - Configurable threshold (default: 1000ms)
  - Automatic logging
  - Custom handler support

- **Endpoint Aggregation**
  - Per-endpoint metrics
  - Min/max/average duration
  - Success/error rates
  - Slow request tracking

- **Memory Monitoring**
  - Heap usage tracking
  - External memory monitoring
  - RSS tracking

- **Metrics Endpoints**
  - `/metrics/performance` - Overall summary
  - `/metrics/performance/endpoints` - Per-endpoint metrics
  - `/metrics/performance/slow` - Slow requests
  - `/metrics/performance/recent` - Recent requests

#### Configuration:
```typescript
import performanceMonitoring from './middleware/performance.middleware';

fastify.register(performanceMonitoring, {
  slowQueryThreshold: 1000, // 1 second
  enableMemoryMonitoring: true,
  enableSizeTracking: true,
  enableAggregation: true,
  onSlowQuery: (metrics) => {
    // Custom handler for slow queries
    console.warn('Slow query detected:', metrics);
  },
});
```

#### Usage:
```bash
# Get performance summary
curl http://localhost:46000/metrics/performance

# Get endpoint metrics
curl http://localhost:46000/metrics/performance/endpoints

# Get slow requests
curl http://localhost:46000/metrics/performance/slow?limit=50

# Reset metrics
curl -X POST http://localhost:46000/metrics/performance/reset
```

## Installation

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Install Redis (for production)**
   ```bash
   # Docker
   docker run -d -p 6379:46102 redis:alpine

   # Or use your cloud provider's Redis service
   ```

3. **Configure Environment Variables**
   ```bash
   # .env
   NODE_ENV=production
   REDIS_URL=redis://localhost:46102
   JWT_SECRET=your-secret-key
   JWT_REFRESH_SECRET=your-refresh-secret
   ```

## Configuration

### Environment Variables

```bash
# Server Configuration
NODE_ENV=production
HOST=0.0.0.0
PORT=3001

# Redis Configuration
REDIS_URL=redis://localhost:46102
ENABLE_REDIS=true

# JWT Configuration
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Security Configuration
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true

# Performance Configuration
ENABLE_COMPRESSION=true
ENABLE_PERFORMANCE_MONITORING=true
SLOW_QUERY_THRESHOLD=1000
```

### Registering Plugins and Middleware

The security and performance enhancements are automatically loaded through Fastify's autoload plugin system:

1. **Plugins** (`apps/aep-api-gateway/src/app/plugins/`)
   - `helmet.ts` - Loaded automatically
   - `rate-limiting.ts` - Needs manual registration

2. **Middleware** (`apps/aep-api-gateway/src/app/middleware/`)
   - `auth.middleware.ts` - Register as needed
   - `performance.middleware.ts` - Register as plugin

#### Example Registration:

```typescript
// apps/aep-api-gateway/src/app/app.ts
import rateLimiting from './plugins/rate-limiting';
import performanceMonitoring from './middleware/performance.middleware';
import { createAuthMiddleware } from './middleware/auth.middleware';

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Register rate limiting
  fastify.register(rateLimiting);

  // Register performance monitoring
  fastify.register(performanceMonitoring, {
    slowQueryThreshold: 1000,
  });

  // Register auth middleware
  const authMiddleware = createAuthMiddleware({
    jwtSecret: process.env.JWT_SECRET!,
    enableMultiTenant: true,
  });
  fastify.addHook('onRequest', authMiddleware);

  // ... rest of your app
}
```

## Usage Examples

### Complete Security Setup

```typescript
// apps/aep-api-gateway/src/app/app.ts
import { FastifyInstance } from 'fastify';
import rateLimiting from './plugins/rate-limiting';
import { createAuthMiddleware, createRoleMiddleware, UserRole } from './middleware/auth.middleware';

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // 1. Helmet is auto-loaded from plugins directory

  // 2. Register rate limiting
  fastify.register(rateLimiting);

  // 3. Register auth middleware
  const authMiddleware = createAuthMiddleware({
    jwtSecret: process.env.JWT_SECRET!,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    enableMultiTenant: true,
    enableTokenBlacklist: true,
    enableAuditLog: true,
  });
  fastify.addHook('onRequest', authMiddleware);

  // 4. Protected admin routes
  fastify.register(async function adminRoutes(instance) {
    const adminOnly = createRoleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    instance.addHook('onRequest', adminOnly);

    instance.get('/admin/users', async (request, reply) => {
      // Only accessible to admins
    });
  });
}
```

### Complete Performance Setup

```typescript
// apps/aep-api-gateway/src/app/app.ts
import { FastifyInstance } from 'fastify';
import performanceMonitoring from './middleware/performance.middleware';
import { getCacheService } from '@friendly-aiaep/shared/cache';

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // 1. Compression and caching headers are in main.ts

  // 2. Initialize cache service
  const cache = getCacheService({
    redis: { url: process.env.REDIS_URL },
    defaultTTL: 300,
    namespace: 'aep',
  });

  // 3. Register performance monitoring
  fastify.register(performanceMonitoring, {
    slowQueryThreshold: 1000,
    enableMemoryMonitoring: true,
    onSlowQuery: (metrics) => {
      fastify.log.warn({ metrics }, 'Slow query detected');
    },
  });

  // 4. Use cache in routes
  fastify.get('/api/projects', async (request, reply) => {
    const cacheKey = 'projects:all';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const projects = await db.project.findMany();
    await cache.set(cacheKey, projects, 300);

    return projects;
  });
}
```

### Using Cache Decorators in Services

```typescript
// Example service using cache decorators
import { Cacheable, CacheEvict, CachePut } from '@friendly-aiaep/shared/cache';

export class ProjectService {
  @Cacheable({ key: 'project', ttl: 600 })
  async getProject(id: string) {
    return await db.project.findUnique({ where: { id } });
  }

  @Cacheable({ key: 'projects:list', ttl: 300 })
  async listProjects(userId: string) {
    return await db.project.findMany({ where: { userId } });
  }

  @CacheEvict({ key: (id: string) => `project:${id}` })
  async updateProject(id: string, data: ProjectUpdate) {
    return await db.project.update({ where: { id }, data });
  }

  @CacheEvict({ allEntries: true })
  async clearProjectCache() {
    // This will clear all cached project data
  }

  @CachePut({ key: 'project', ttl: 600 })
  async refreshProject(id: string) {
    // This will always fetch fresh data and update cache
    return await db.project.findUnique({ where: { id } });
  }
}
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure Redis for rate limiting and caching
- [ ] Set strong JWT secrets
- [ ] Configure HTTPS/TLS
- [ ] Review CSP directives for your domain
- [ ] Set up monitoring for performance metrics
- [ ] Configure log aggregation
- [ ] Review rate limit tiers for your use case
- [ ] Enable token blacklisting with Redis backend
- [ ] Set up secrets management (Vault or AWS Secrets Manager)
- [ ] Configure CORS for production domains
- [ ] Review and test error handling
- [ ] Set up health check monitoring
- [ ] Configure graceful shutdown in container orchestration

## Monitoring and Observability

### Performance Metrics
- Access `/metrics/performance` for overall performance summary
- Monitor slow query endpoint for performance issues
- Track endpoint-specific metrics for optimization

### Security Monitoring
- Review auth middleware logs for failed authentication attempts
- Monitor rate limit violations
- Track token blacklist usage
- Review security header violations in browser console

### Health Checks
- Use `/health` endpoint for liveness probes
- Monitor Redis connection status
- Track memory usage trends

## Troubleshooting

### Redis Connection Issues
- Check `REDIS_URL` environment variable
- Verify Redis is running: `redis-cli ping`
- Check logs for Redis connection errors
- System will fall back to in-memory storage

### Rate Limiting Not Working
- Verify rate limiting plugin is registered
- Check user tier is properly set in JWT token
- Review rate limit headers in response
- Ensure Redis is connected for distributed limiting

### Cache Not Working
- Verify Redis connection
- Check cache statistics: `cache.getStats()`
- Review cache key generation
- Ensure TTL is set appropriately

### Performance Issues
- Check `/metrics/performance/slow` for slow endpoints
- Review memory usage in performance metrics
- Monitor response times in Server-Timing header
- Check compression is enabled for large responses

## Security Best Practices

1. **Always use HTTPS in production**
2. **Rotate JWT secrets regularly**
3. **Use strong, unique secrets for each environment**
4. **Enable token blacklisting for logout functionality**
5. **Review and update CSP directives regularly**
6. **Monitor failed authentication attempts**
7. **Use environment-specific rate limits**
8. **Enable audit logging for sensitive operations**
9. **Keep dependencies up to date**
10. **Use multi-tenant isolation in production**

## Performance Best Practices

1. **Use Redis for distributed caching**
2. **Enable compression for API responses**
3. **Set appropriate cache TTLs**
4. **Use cache decorators for frequently accessed data**
5. **Monitor slow queries and optimize**
6. **Enable request deduplication**
7. **Use CDN for static assets**
8. **Implement pagination for large datasets**
9. **Monitor memory usage and set limits**
10. **Use connection pooling for databases**

---

## License

UNLICENSED - Proprietary Software
Copyright (c) 2026 Friendly Technology
