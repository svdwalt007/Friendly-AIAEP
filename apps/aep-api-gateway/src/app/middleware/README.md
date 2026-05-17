# Tenant-Scoped Middleware

This middleware implements tenant-scoped database query filtering as specified in Module Reference v2.2 Section 5.1.

## Overview

The tenant middleware provides automatic tenant context management for multi-tenant and dedicated deployment modes:

- **Multi-tenant mode**: All database queries are automatically filtered by `tenantId` extracted from JWT
- **Dedicated mode**: Single-tenant optimization - skips tenant filtering entirely

## Deployment Modes

Set the deployment mode using the `DEPLOYMENT_MODE` environment variable:

```bash
# Multi-tenant mode (default)
DEPLOYMENT_MODE=multi-tenant

# Dedicated mode (single tenant)
DEPLOYMENT_MODE=dedicated
```

## How It Works

1. The middleware reads `DEPLOYMENT_MODE` from environment variables
2. For each request, it extracts `tenantId` from the JWT payload (set by auth middleware)
3. It creates a `tenantContext` object and attaches it to `fastify.request`
4. Your route handlers can use this context to apply tenant filtering

## Request Decoration

The middleware adds the following to each Fastify request:

```typescript
interface FastifyRequest {
  tenantContext: {
    tenantId?: string;              // Extracted from JWT
    deploymentMode: DeploymentMode; // 'multi-tenant' | 'dedicated'
    shouldFilterByTenant: boolean;  // true only in multi-tenant mode with valid tenantId
  };
  user?: JwtPayload;                // Set by auth middleware
}
```

## Usage in Route Handlers

### Basic Usage

```typescript
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/api/projects', async (request, reply) => {
    const { tenantId, shouldFilterByTenant } = request.tenantContext;

    if (shouldFilterByTenant) {
      // Multi-tenant mode: filter by tenantId
      return prisma.project.findMany({
        where: { tenantId }
      });
    } else {
      // Dedicated mode: no tenant filtering needed
      return prisma.project.findMany();
    }
  });
}
```

### With Prisma Client Extension

For automatic tenant filtering, use the tenant-scoped Prisma client from `@friendly-aiaep/prisma-schema`:

```typescript
import { createTenantClient } from '@friendly-aiaep/prisma-schema';
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/api/projects', async (request, reply) => {
    const { tenantId, shouldFilterByTenant } = request.tenantContext;

    // Create tenant-scoped client
    const db = shouldFilterByTenant
      ? createTenantClient(tenantId!)
      : prisma; // Use regular client in dedicated mode

    // Queries are automatically scoped
    return db.project.findMany();
  });
}
```

### Helper Function Pattern

Create a reusable helper to get the appropriate database client:

```typescript
import { PrismaClient } from '@prisma/client';
import { createTenantClient } from '@friendly-aiaep/prisma-schema';
import { FastifyRequest } from 'fastify';

const prisma = new PrismaClient();

export function getDbClient(request: FastifyRequest) {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;

  if (shouldFilterByTenant) {
    return createTenantClient(tenantId!);
  }

  return prisma;
}

// Usage in routes
fastify.get('/api/data', async (request, reply) => {
  const db = getDbClient(request);
  return db.someModel.findMany();
});
```

## Configuration Options

### Require Tenant ID

Force tenant ID to be present in multi-tenant mode:

```bash
REQUIRE_TENANT_ID=true
```

When enabled, requests without a tenant ID will receive a 403 Forbidden response.

### Custom Tenant Extraction

You can provide a custom function to extract tenant ID:

```typescript
import tenantMiddleware from './middleware/tenant';

fastify.register(tenantMiddleware, {
  extractTenantId: (request) => {
    // Custom logic to extract tenant ID
    return request.headers['x-tenant-id'] as string;
  }
});
```

## Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `DEPLOYMENT_MODE` | `multi-tenant`, `dedicated` | `multi-tenant` | Deployment mode for tenant filtering |
| `REQUIRE_TENANT_ID` | `true`, `false` | `false` | Whether to enforce tenant ID in multi-tenant mode |
| `NODE_ENV` | `development`, `production` | - | When set to `development`, enables debug logging |

## Integration with Auth Middleware

The tenant middleware expects the auth middleware to set `request.user` with a JWT payload containing:

```typescript
interface JwtPayload {
  tenantId?: string;  // Required for multi-tenant mode
  userId?: string;
  sub?: string;
  // ... other claims
}
```

Ensure your auth middleware runs before the tenant middleware by loading it first in the plugin order.

## Testing

### Multi-tenant Mode Testing

```typescript
// Set environment
process.env.DEPLOYMENT_MODE = 'multi-tenant';

// Mock request with JWT payload
const request = {
  user: { tenantId: 'tenant-123', userId: 'user-456' }
};

// Tenant context will be:
// {
//   tenantId: 'tenant-123',
//   deploymentMode: 'multi-tenant',
//   shouldFilterByTenant: true
// }
```

### Dedicated Mode Testing

```typescript
// Set environment
process.env.DEPLOYMENT_MODE = 'dedicated';

// Tenant context will be:
// {
//   tenantId: undefined,
//   deploymentMode: 'dedicated',
//   shouldFilterByTenant: false
// }
```

## Security Considerations

1. **Always validate tenant ownership**: Even with tenant filtering, validate that users can only access their own tenant's data
2. **Use HTTPS**: Tenant IDs are transmitted in JWTs - always use HTTPS in production
3. **Audit logging**: Consider logging tenant context in audit trails for compliance
4. **Tenant isolation**: In multi-tenant mode, ensure database queries are always filtered by tenant

## Troubleshooting

### Tenant ID not found warning

```
Tenant ID not found in JWT payload in multi-tenant mode
```

**Solution**: Ensure your auth middleware is setting `request.user.tenantId` from the JWT.

### 403 Forbidden in multi-tenant mode

```
Tenant ID is required in multi-tenant mode but was not found in JWT
```

**Solution**: Either provide a valid JWT with `tenantId` claim, or set `REQUIRE_TENANT_ID=false`.

### Queries not filtered by tenant

**Solution**: Check that `request.tenantContext.shouldFilterByTenant` is `true` and you're using the tenant context in your queries.

## Performance

- **Multi-tenant mode**: Minimal overhead - single property check per request
- **Dedicated mode**: Zero overhead for tenant filtering (skipped entirely)
- **JWT extraction**: Cached from auth middleware, no additional parsing

## References

- Module Reference v2.2 Section 5.1: Tenant-scoped middleware requirements
- Prisma Schema Library: `libs/data/prisma-schema/TENANT_SCOPING.md`
- Auth Adapter Library: `libs/iot/auth-adapter/JWT_IMPLEMENTATION_SUMMARY.md`
