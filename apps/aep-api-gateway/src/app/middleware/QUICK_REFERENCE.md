# Tenant Middleware - Quick Reference

## Setup

The middleware is automatically loaded via `@fastify/autoload`. No manual registration needed.

## Environment Variables

```bash
# Choose deployment mode
DEPLOYMENT_MODE=multi-tenant  # Default
DEPLOYMENT_MODE=dedicated     # Single-tenant

# Optional: require tenant ID in multi-tenant mode
REQUIRE_TENANT_ID=true
```

## Access Tenant Context

```typescript
fastify.get('/api/data', async (request, reply) => {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;
});
```

## Common Patterns

### Pattern 1: Conditional Filtering

```typescript
fastify.get('/api/projects', async (request) => {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;

  if (shouldFilterByTenant) {
    return db.project.findMany({ where: { tenantId } });
  }
  return db.project.findMany();
});
```

### Pattern 2: Helper Function

```typescript
// utils/db.ts
import { createTenantClient } from '@friendly-aiaep/prisma-schema';

export function getDbClient(request: FastifyRequest) {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;
  return shouldFilterByTenant ? createTenantClient(tenantId!) : prisma;
}

// routes/projects.ts
fastify.get('/api/projects', async (request) => {
  const db = getDbClient(request);
  return db.project.findMany();
});
```

### Pattern 3: Create with Tenant

```typescript
fastify.post('/api/projects', async (request) => {
  const { tenantId, shouldFilterByTenant } = request.tenantContext;
  const { name, description } = request.body;

  const data = shouldFilterByTenant
    ? { name, description, tenantId: tenantId! }
    : { name, description };

  return db.project.create({ data });
});
```

## TypeScript Types

```typescript
interface TenantContext {
  tenantId?: string;
  deploymentMode: 'multi-tenant' | 'dedicated';
  shouldFilterByTenant: boolean;
}

// Available on all requests
request.tenantContext: TenantContext
```

## Decision Flow

```
Request arrives
    ↓
Read DEPLOYMENT_MODE env var
    ↓
Multi-tenant? ──No──→ shouldFilterByTenant = false
    ↓ Yes
Extract tenantId from JWT
    ↓
tenantId exists? ──No──→ shouldFilterByTenant = false
    ↓ Yes
shouldFilterByTenant = true
```

## Testing

```typescript
// Multi-tenant test
process.env.DEPLOYMENT_MODE = 'multi-tenant';
request.user = { tenantId: 'tenant-123' };
// → shouldFilterByTenant = true

// Dedicated test
process.env.DEPLOYMENT_MODE = 'dedicated';
// → shouldFilterByTenant = false
```

## Error Handling

```typescript
// If REQUIRE_TENANT_ID=true and no tenantId in JWT:
// → 403 Forbidden response

// Otherwise:
// → Warning logged, shouldFilterByTenant = false
```

## See Also

- Full documentation: `middleware/README.md`
- Implementation guide: `../../TENANT_MIDDLEWARE.md`
- Examples: `routes/example-tenant.ts`
