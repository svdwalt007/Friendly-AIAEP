# Tenant Scoping Guide

This guide explains how to use the tenant-scoped Prisma client for multi-tenant applications.

## Overview

The `@friendly-tech/data/prisma-schema` library provides two types of Prisma clients:

1. **Global Prisma Client** - For non-tenant-scoped operations
2. **Tenant-Scoped Client** - Automatically filters all queries by `tenantId`

## Installation

```typescript
import {
  prisma,
  createTenantScopedClient,
  TenantScopingError,
} from '@friendly-tech/data/prisma-schema';
```

## Global Prisma Client

Use the global client for:
- Administrative operations
- Global model queries (e.g., `BillingPlan`, `SystemConfig`)
- Operations that need to span multiple tenants

```typescript
import { prisma } from '@friendly-tech/data/prisma-schema';

// Query global models
const plans = await prisma.billingPlan.findMany();

// Administrative operations across all tenants
const allUsers = await prisma.user.findMany();
```

## Tenant-Scoped Client

### Basic Usage

Create a tenant-scoped client by providing a `tenantId`:

```typescript
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

const tenantClient = createTenantScopedClient('tenant-123');

// All queries are automatically filtered by tenantId
const projects = await tenantClient.project.findMany();
// Equivalent to: prisma.project.findMany({ where: { tenantId: 'tenant-123' } })

const users = await tenantClient.user.findMany({
  where: { email: { contains: '@example.com' } },
});
// tenantId filter is automatically added to the where clause
```

### CRUD Operations

#### Create

The `tenantId` is automatically injected into all create operations:

```typescript
const user = await tenantClient.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
  },
});
// tenantId is automatically added to the data
```

#### Read

All read operations are automatically scoped:

```typescript
// Find many
const projects = await tenantClient.project.findMany({
  where: { status: 'ACTIVE' },
});

// Find first
const project = await tenantClient.project.findFirst({
  where: { name: 'My Project' },
});

// Find unique
const user = await tenantClient.user.findUnique({
  where: { id: 'user-123' },
});

// Count
const count = await tenantClient.project.count();
```

#### Update

Updates are automatically scoped to the tenant:

```typescript
const updated = await tenantClient.project.update({
  where: { id: 'project-123' },
  data: { name: 'Updated Name' },
});
// Only updates if the project belongs to the tenant

const updatedMany = await tenantClient.project.updateMany({
  where: { status: 'DRAFT' },
  data: { status: 'ACTIVE' },
});
```

#### Delete

Deletes are automatically scoped to the tenant:

```typescript
const deleted = await tenantClient.project.delete({
  where: { id: 'project-123' },
});
// Only deletes if the project belongs to the tenant

const deletedMany = await tenantClient.project.deleteMany({
  where: { status: 'ARCHIVED' },
});
```

#### Upsert

Upsert operations handle both create and update with automatic scoping:

```typescript
const project = await tenantClient.project.upsert({
  where: { id: 'project-123' },
  create: {
    id: 'project-123',
    name: 'New Project',
  },
  update: {
    name: 'Updated Project',
  },
});
```

### Global Models

Some models are global and don't require tenant scoping (e.g., `BillingPlan`, `SystemConfig`). These models can be queried through a tenant-scoped client without tenant filtering:

```typescript
// Global models are not filtered by tenantId
const plans = await tenantClient.billingPlan.findMany();
```

#### Managing Global Models

```typescript
import {
  isGlobalModel,
  addGlobalModel,
  removeGlobalModel,
  getGlobalModels,
} from '@friendly-tech/data/prisma-schema';

// Check if a model is global
if (isGlobalModel('BillingPlan')) {
  console.log('BillingPlan is a global model');
}

// Add a custom global model
addGlobalModel('CustomGlobalModel');

// Remove a model from global list
removeGlobalModel('CustomGlobalModel');

// Get all global models
const globalModels = getGlobalModels();
console.log(globalModels); // ['BillingPlan', 'SystemConfig', 'GlobalSettings']
```

## Error Handling

### TenantScopingError

Thrown when attempting to create a tenant-scoped client without a valid `tenantId`:

```typescript
try {
  const client = createTenantScopedClient('');
} catch (error) {
  if (error instanceof TenantScopingError) {
    console.error('Invalid tenant ID:', error.message);
  }
}
```

## Best Practices

### 1. Use Tenant-Scoped Clients in Request Handlers

Create a new tenant-scoped client for each request:

```typescript
// Fastify example
app.get('/projects', async (request, reply) => {
  const tenantId = request.user.tenantId;
  const tenantClient = createTenantScopedClient(tenantId);

  const projects = await tenantClient.project.findMany();
  return { projects };
});
```

### 2. Dependency Injection

Inject the tenant-scoped client into your services:

```typescript
class ProjectService {
  constructor(private tenantClient: TenantScopedClient) {}

  async getProjects() {
    return this.tenantClient.project.findMany();
  }

  async createProject(data: CreateProjectInput) {
    return this.tenantClient.project.create({ data });
  }
}

// Usage
const tenantClient = createTenantScopedClient(tenantId);
const projectService = new ProjectService(tenantClient);
```

### 3. Transaction Support

Tenant-scoped clients support transactions:

```typescript
const result = await tenantClient.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: 'user@example.com', name: 'John' },
  });

  const project = await tx.project.create({
    data: { name: 'My Project', ownerId: user.id },
  });

  return { user, project };
});
```

### 4. Cleanup

Don't forget to disconnect clients when done (especially in serverless environments):

```typescript
try {
  const tenantClient = createTenantScopedClient(tenantId);
  const projects = await tenantClient.project.findMany();
  return projects;
} finally {
  await tenantClient.$disconnect();
}
```

### 5. Testing

Mock the tenant-scoped client in tests:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

vi.mock('@friendly-tech/data/prisma-schema', () => ({
  createTenantScopedClient: vi.fn(() => ({
    project: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', name: 'Test Project' },
      ]),
    },
    $disconnect: vi.fn(),
  })),
}));
```

## Type Safety

The tenant-scoped client maintains full TypeScript type safety:

```typescript
import type { TenantScopedClient } from '@friendly-tech/data/prisma-schema';

function processProjects(client: TenantScopedClient) {
  // Full autocomplete and type checking
  return client.project.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
}
```

## Advanced Usage

### Custom Middleware

Add additional middleware to tenant-scoped clients:

```typescript
const tenantClient = createTenantScopedClient('tenant-123');

tenantClient.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const end = Date.now();
  console.log(`Query took ${end - start}ms`);
  return result;
});
```

### Extending the Client

Use Prisma's `$extends` API:

```typescript
const extendedClient = tenantClient.$extends({
  model: {
    project: {
      async findActive() {
        return this.findMany({
          where: { status: 'ACTIVE' },
        });
      },
    },
  },
});

const activeProjects = await extendedClient.project.findActive();
```

## Limitations

1. **Raw Queries**: Raw queries (`$queryRaw`, `$executeRaw`) are not automatically scoped. Always include `tenantId` manually:

```typescript
const result = await tenantClient.$queryRaw`
  SELECT * FROM projects WHERE tenantId = ${tenantId}
`;
```

2. **Nested Creates**: When creating nested relations, ensure the parent record has the `tenantId` injected by the middleware.

3. **Include/Select**: The middleware works with `include` and `select`, but nested relation queries inherit the tenant scope from the parent.

## Migration Guide

### From Global Client to Tenant-Scoped Client

Before:
```typescript
const projects = await prisma.project.findMany({
  where: { tenantId: req.user.tenantId },
});
```

After:
```typescript
const tenantClient = createTenantScopedClient(req.user.tenantId);
const projects = await tenantClient.project.findMany();
```

## Security Considerations

1. **Always validate tenantId**: Ensure the `tenantId` comes from authenticated sources
2. **Use tenant-scoped clients in application code**: Only use global client for admin operations
3. **Audit global client usage**: Log and monitor all uses of the global client
4. **Test tenant isolation**: Verify that users cannot access other tenants' data

## Troubleshooting

### Issue: Queries returning empty results

**Cause**: The model might not have a `tenantId` field in the schema.

**Solution**: Add `tenantId` field to the model or add it to the global models list:

```typescript
addGlobalModel('YourModel');
```

### Issue: TenantScopingError on client creation

**Cause**: Empty or invalid `tenantId` passed to `createTenantScopedClient`.

**Solution**: Validate tenant ID before creating client:

```typescript
const tenantId = req.user?.tenantId;
if (!tenantId) {
  throw new Error('User must belong to a tenant');
}
const client = createTenantScopedClient(tenantId);
```

## Additional Resources

- [Prisma Client Documentation](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Prisma Middleware](https://www.prisma.io/docs/concepts/components/prisma-client/middleware)
- [Multi-Tenancy Patterns](https://www.prisma.io/docs/guides/database/multi-tenancy)
