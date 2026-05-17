# Quick Start: Security and Performance Features

## Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared libraries
pnpm nx build shared-secrets
pnpm nx build shared-cache

# 3. Set up environment variables
cp .env.example .env
# Edit .env and set JWT_SECRET and REDIS_URL
```

## Environment Variables (Minimum)

```bash
# .env
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
REDIS_URL=redis://localhost:46102  # Optional, will use in-memory if not set
```

## Optional: Start Redis

```bash
# Using Docker
docker run -d --name redis -p 6379:46102 redis:alpine
```

## Quick Usage Examples

### 1. Authentication Middleware

```typescript
// Register in app.ts
import { createAuthMiddleware } from './middleware/auth.middleware';

const authMiddleware = createAuthMiddleware({
  jwtSecret: process.env.JWT_SECRET!,
  enableMultiTenant: true,
});

fastify.addHook('onRequest', authMiddleware);
```

### 2. Role-Based Access Control

```typescript
import { createRoleMiddleware, UserRole } from './middleware/auth.middleware';

// Admin-only route
fastify.register(async function adminRoutes(instance) {
  const adminOnly = createRoleMiddleware([UserRole.ADMIN]);
  instance.addHook('onRequest', adminOnly);

  instance.get('/admin/users', handler);
});
```

### 3. Caching with Decorators

```typescript
import { Cacheable, CacheEvict } from '@friendly-aiaep/shared/cache';

class UserService {
  @Cacheable({ key: 'user', ttl: 600 })
  async getUser(id: string) {
    return await db.user.findUnique({ where: { id } });
  }

  @CacheEvict({ key: (id: string) => `user:${id}` })
  async updateUser(id: string, data: any) {
    return await db.user.update({ where: { id }, data });
  }
}
```

### 4. Manual Caching

```typescript
import { getCacheService } from '@friendly-aiaep/shared/cache';

const cache = getCacheService();

// In route handler
fastify.get('/api/data', async (request, reply) => {
  const cached = await cache.get('mydata');
  if (cached) return cached;

  const data = await fetchData();
  await cache.set('mydata', data, 300); // 5 minutes
  return data;
});
```

### 5. Secrets Management

```typescript
import { getSecretsService } from '@friendly-aiaep/shared/secrets';

const secrets = getSecretsService();

// Get a secret
const apiKey = await secrets.getSecret('API_KEY', { required: true });
```

### 6. Performance Monitoring

```bash
# View metrics
curl http://localhost:46000/metrics/performance

# View slow requests
curl http://localhost:46000/metrics/performance/slow

# View endpoint stats
curl http://localhost:46000/metrics/performance/endpoints
```

## Features Enabled by Default

- ✅ Helmet security headers (auto-loaded)
- ✅ HTTP compression (in main.ts)
- ✅ Smart caching headers (in main.ts)
- ✅ Performance timing headers (in main.ts)
- ✅ Graceful shutdown (in main.ts)

## Features That Need Registration

### Rate Limiting

```typescript
// In app.ts
import rateLimiting from './plugins/rate-limiting';
fastify.register(rateLimiting);
```

### Performance Monitoring

```typescript
// In app.ts
import performanceMonitoring from './middleware/performance.middleware';
fastify.register(performanceMonitoring, {
  slowQueryThreshold: 1000,
});
```

## Testing

```bash
# Test rate limiting
for i in {1..150}; do curl http://localhost:46000/api/health; done

# Test caching (second request should be faster)
curl -w "\nTime: %{time_total}s\n" http://localhost:46000/api/data
curl -w "\nTime: %{time_total}s\n" http://localhost:46000/api/data

# Test compression
curl -H "Accept-Encoding: gzip" -I http://localhost:46000/api/data

# Test performance metrics
curl http://localhost:46000/metrics/performance | jq
```

## Common Configurations

### Development

```bash
NODE_ENV=development
JWT_SECRET=dev-secret
ENABLE_REDIS=false  # Use in-memory
```

### Production

```bash
NODE_ENV=production
JWT_SECRET=strong-production-secret
REDIS_URL=redis://your-redis-host:46102
ENABLE_REDIS=true
SLOW_QUERY_THRESHOLD=1000
```

## Rate Limit Tiers

| Tier | Requests/Minute |
|------|----------------|
| FREE | 100 |
| STARTER | 1,000 |
| PROFESSIONAL | 10,000 |
| ENTERPRISE | 100,000 |

User tier is automatically extracted from JWT token.

## Cache TTL Recommendations

| Data Type | TTL |
|-----------|-----|
| User profiles | 600s (10 min) |
| Static data | 3600s (1 hour) |
| API responses | 300s (5 min) |
| Frequently changing | 60s (1 min) |

## Security Headers Added

- ✅ Content-Security-Policy
- ✅ Strict-Transport-Security (HSTS)
- ✅ X-Content-Type-Options
- ✅ X-Frame-Options
- ✅ X-XSS-Protection
- ✅ Referrer-Policy
- ✅ Permissions-Policy

## Monitoring Endpoints

| Endpoint | Description |
|----------|-------------|
| `/metrics/performance` | Overall performance summary |
| `/metrics/performance/endpoints` | Per-endpoint metrics |
| `/metrics/performance/slow` | Slow requests |
| `/metrics/performance/recent` | Recent requests |

## Troubleshooting

### Redis connection failed
- System will automatically use in-memory fallback
- Check `REDIS_URL` environment variable
- Verify Redis is running: `redis-cli ping`

### Rate limiting not working
- Ensure rate limiting plugin is registered
- Check Redis connection
- Verify user tier is in JWT token

### Cache not working
- Check Redis connection
- Get cache stats: `cache.getStats()`
- Verify TTL is set

### Auth middleware rejecting tokens
- Verify `JWT_SECRET` is set
- Check token expiration
- Review token format (should be Bearer token)

## Next Steps

1. Read [SECURITY-PERFORMANCE-ENHANCEMENTS.md](./SECURITY-PERFORMANCE-ENHANCEMENTS.md) for detailed documentation
2. See [IMPLEMENTATION-SUMMARY-SECURITY-PERFORMANCE.md](./IMPLEMENTATION-SUMMARY-SECURITY-PERFORMANCE.md) for implementation details
3. Review plugin README: `apps/aep-api-gateway/src/app/plugins/README.md`
4. Review middleware README: `apps/aep-api-gateway/src/app/middleware/README.md`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review detailed documentation
3. Check logs for specific error messages
4. Verify environment variables are set correctly
