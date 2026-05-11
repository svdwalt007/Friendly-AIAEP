# Tenant-Scoped Middleware Implementation

This document describes the tenant-scoped middleware implementation for the AEP API Gateway, fulfilling requirements from Module Reference v2.2 Section 5.1.

## Overview

The tenant middleware provides automatic tenant context management for both multi-tenant and dedicated deployment modes:

- **Multi-tenant mode**: All database queries filtered by `tenantId` extracted from JWT
- **Dedicated mode**: Single-tenant optimization - skips tenant filtering entirely

## Architecture

### File Structure

```
apps/aep-api-gateway/src/app/
├── middleware/
│   ├── index.ts                 # Exports for middleware
│   ├── types.ts                 # TypeScript type definitions
│   ├── tenant.ts                # Core tenant middleware implementation
│   ├── tenant.spec.ts           # Unit tests
│   └── README.md                # Detailed usage documentation
├── plugins/
│   └── tenant.ts                # Fastify plugin auto-loader
└── routes/
    └── example-tenant.ts        # Example route demonstrating usage
```

### Component Responsibilities

#### 1. `middleware/types.ts`
- Defines `DeploymentMode` type (`'multi-tenant' | 'dedicated'`)
- Defines `TenantContext` interface with tenant information
- Defines `JwtPayload` interface for auth integration
- Extends Fastify's request type with `tenantContext` and `user` properties

#### 2. `middleware/tenant.ts`
- Core middleware implementation
- Reads `DEPLOYMENT_MODE` environment variable
- Extracts `tenantId` from JWT payload (via `request.user`)
- Decorates request with `tenantContext`
- Provides configuration options for custom behavior

#### 3. `plugins/tenant.ts`
- Fastify plugin wrapper for auto-loading
- Registers tenant middleware with configuration from environment
- Loaded automatically by `@fastify/autoload` in `app.ts`

#### 4. `routes/example-tenant.ts`
- Example route handlers demonstrating tenant middleware usage
- Shows multi-tenant and dedicated mode query patterns
- Provides mock implementations and Prisma integration examples

## Features

### 1. Deployment Mode Detection

The middleware reads the `DEPLOYMENT_MODE` environment variable:

```bash
# Multi-tenant mode (default)
DEPLOYMENT_MODE=multi-tenant

# Dedicated mode
DEPLOYMENT_MODE=dedicated
```

If not set or invalid, defaults to `multi-tenant` mode.

### 2. Tenant ID Extraction

By default, extracts `tenantId` from the JWT payload set by auth middleware:

```typescript
// Auth middleware sets:
request.user = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  // ... other claims
};

// Tenant middleware extracts:
request.tenantContext = {
  tenantId: 'tenant-123',
  deploymentMode: 'multi-tenant',
  shouldFilterByTenant: true
};
```

### 3. Request Decoration

Adds `tenantContext` to every Fastify request:

```typescript
interface FastifyRequest {
  tenantContext: {
    tenantId?: string;              // From JWT
    deploymentMode: DeploymentMode; // From env var
    shouldFilterByTenant: boolean;  // Computed flag
  };
}
```

### 4. Smart Filtering Flag

The `shouldFilterByTenant` flag is computed based on:
- Deployment mode is `multi-tenant`
- AND tenant ID is present in JWT

This makes route handlers simple:

```typescript
fastify.get('/api/data', async (request) => {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;

  if (shouldFilterByTenant) {
    return db.data.findMany({ where: { tenantId } });
  } else {
    return db.data.findMany();
  }
});
```

### 5. Configuration Options

```typescript
interface TenantMiddlewareOptions {
  // Override deployment mode
  deploymentMode?: 'multi-tenant' | 'dedicated';

  // Require tenant ID in multi-tenant mode (returns 403 if missing)
  requireTenantId?: boolean;

  // Custom tenant ID extractor
  extractTenantId?: (request: FastifyRequest) => string | undefined;
}
```

### 6. Validation and Error Handling

- In multi-tenant mode with `requireTenantId: true`, returns 403 if tenant ID is missing
- Logs warnings when tenant ID is missing in multi-tenant mode
- Logs debug information in development mode

## Usage

### Basic Route Handler

```typescript
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/api/projects', async (request, reply) => {
    const { tenantId, shouldFilterByTenant } = request.tenantContext;

    if (shouldFilterByTenant) {
      // Multi-tenant: filter by tenant
      return prisma.project.findMany({
        where: { tenantId }
      });
    } else {
      // Dedicated: no filtering
      return prisma.project.findMany();
    }
  });
}
```

### With Prisma Tenant Client

Using the tenant-scoped Prisma client from `@friendly-aiaep/prisma-schema`:

```typescript
import { createTenantClient } from '@friendly-aiaep/prisma-schema';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

fastify.get('/api/projects', async (request) => {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;

  const db = shouldFilterByTenant
    ? createTenantClient(tenantId!)
    : prisma;

  // Automatically scoped in multi-tenant mode
  return db.project.findMany();
});
```

### Helper Function Pattern

```typescript
// utils/db.ts
import { FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createTenantClient } from '@friendly-aiaep/prisma-schema';

const prisma = new PrismaClient();

export function getDbClient(request: FastifyRequest) {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;
  return shouldFilterByTenant ? createTenantClient(tenantId!) : prisma;
}

// routes/projects.ts
import { getDbClient } from '../utils/db';

fastify.get('/api/projects', async (request) => {
  const db = getDbClient(request);
  return db.project.findMany();
});
```

## Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `DEPLOYMENT_MODE` | `multi-tenant`, `dedicated` | `multi-tenant` | Deployment mode for tenant filtering |
| `REQUIRE_TENANT_ID` | `true`, `false` | `false` | Enforce tenant ID presence in multi-tenant mode |
| `NODE_ENV` | `development`, `production` | - | Enables debug logging in development |

## Integration Points

### Auth Middleware

The tenant middleware expects auth middleware to set `request.user` with JWT payload:

```typescript
interface JwtPayload {
  tenantId?: string;  // Required for multi-tenant mode
  userId?: string;
  sub?: string;
  iat?: number;
  exp?: number;
}
```

Ensure auth middleware (e.g., `@fastify/jwt`) runs before tenant middleware.

### Prisma Integration

Works seamlessly with `@friendly-aiaep/prisma-schema` tenant client:

```typescript
import { createTenantClient } from '@friendly-aiaep/prisma-schema';

const db = shouldFilterByTenant
  ? createTenantClient(tenantId!)
  : regularPrismaClient;
```

### Audit Service

Tenant context can be passed to audit service for compliance logging:

```typescript
import { auditEmitter } from '@friendly-aiaep/audit-service';

fastify.post('/api/data', async (request) => {
  const { tenantId } = request.tenantContext;

  await auditEmitter.emit('data.created', {
    tenantId,
    userId: request.user?.userId,
    action: 'create',
    resource: 'data'
  });
});
```

## Testing

### Unit Tests

Tests cover:
- Multi-tenant mode with tenant ID
- Multi-tenant mode without tenant ID
- Dedicated mode behavior
- Custom tenant extraction
- Validation and error handling
- Request decoration

Run tests:

```bash
pnpm nx test aep-api-gateway
```

### Integration Testing

Example test with Fastify:

```typescript
import Fastify from 'fastify';
import tenantMiddleware from './middleware/tenant';

const fastify = Fastify();
await fastify.register(tenantMiddleware);

// Test multi-tenant request
fastify.addHook('onRequest', async (request) => {
  request.user = { tenantId: 'tenant-123' };
});

const response = await fastify.inject({
  method: 'GET',
  url: '/api/test'
});
```

## Security Considerations

1. **Tenant Isolation**: Always validate tenant ownership in addition to filtering
2. **HTTPS Required**: Tenant IDs transmitted in JWTs require HTTPS in production
3. **Audit Logging**: Log tenant context in audit trails for compliance
4. **SQL Injection**: Use parameterized queries (Prisma handles this)
5. **Authorization**: Validate user permissions within tenant scope

## Performance

### Multi-tenant Mode
- Minimal overhead: single property check per request
- JWT parsing done by auth middleware (cached)
- No additional database queries

### Dedicated Mode
- Zero overhead for tenant filtering
- Bypasses all tenant context checks
- Optimal for single-tenant deployments

## Troubleshooting

### Issue: Tenant ID not found

**Symptom**: Warning in logs: "Tenant ID not found in JWT payload"

**Solutions**:
1. Verify auth middleware is setting `request.user.tenantId`
2. Check JWT token includes `tenantId` claim
3. Ensure auth middleware runs before tenant middleware

### Issue: 403 Forbidden

**Symptom**: "Tenant ID is required in multi-tenant mode"

**Solutions**:
1. Set `REQUIRE_TENANT_ID=false` to make tenant ID optional
2. Ensure authenticated requests include valid JWT with `tenantId`

### Issue: Queries not filtered

**Symptom**: Seeing data from other tenants

**Solutions**:
1. Check `request.tenantContext.shouldFilterByTenant` is `true`
2. Verify you're using tenant context in query filters
3. In dedicated mode, filtering is disabled by design

## References

- **Module Reference v2.2 Section 5.1**: Tenant-scoped middleware requirements
- **Prisma Schema**: `libs/data/prisma-schema/TENANT_SCOPING.md`
- **Auth Adapter**: `libs/iot/auth-adapter/JWT_IMPLEMENTATION_SUMMARY.md`
- **Fastify Documentation**: https://fastify.dev/docs/latest/
- **fastify-plugin**: https://github.com/fastify/fastify-plugin

## Examples

See `apps/aep-api-gateway/src/app/routes/example-tenant.ts` for complete working examples:
- GET `/example/tenant-info` - Display current tenant context
- GET `/example/projects` - Tenant-aware data fetching
- POST `/example/projects` - Tenant-aware data creation
- GET `/example/health` - Health check endpoint

## Future Enhancements

Potential improvements for future iterations:

1. **Tenant Caching**: Cache tenant metadata to reduce database lookups
2. **Tenant Switching**: Support for admin users to switch tenant context
3. **Multi-Tenancy Strategies**: Support for schema-per-tenant and database-per-tenant
4. **Rate Limiting**: Per-tenant rate limiting integration
5. **Metrics**: Per-tenant performance and usage metrics
6. **Tenant Middleware Events**: Emit events for tenant context changes

## Changelog

### v1.0.0 (2026-04-11)
- Initial implementation
- Multi-tenant and dedicated mode support
- JWT-based tenant ID extraction
- Request decoration with tenant context
- Comprehensive unit tests
- Documentation and examples
