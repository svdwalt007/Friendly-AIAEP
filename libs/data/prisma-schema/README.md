# prisma-schema

Prisma database schema and client utilities for the Friendly AI AEP platform.

## Overview

This library provides:

- **Prisma Schema**: Database models and migrations
- **Global Prisma Client**: Singleton client for non-tenant-scoped operations
- **Tenant-Scoped Client**: Automatically filters queries by `tenantId` for multi-tenant applications
- **Type-safe Database Access**: Full TypeScript support for all database operations

## Installation

```typescript
import {
  prisma,                      // Global Prisma client
  createTenantScopedClient,   // Create tenant-scoped client
  TenantScopingError,         // Error class
} from '@friendly-tech/data/prisma-schema';
```

## Quick Start

### Global Client (Non-Tenant Operations)

```typescript
import { prisma } from '@friendly-tech/data/prisma-schema';

// Query global models
const billingPlans = await prisma.billingPlan.findMany();

// Administrative queries
const allUsers = await prisma.user.findMany();
```

### Tenant-Scoped Client (Multi-Tenant Operations)

```typescript
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

// Create a client scoped to a specific tenant
const tenantClient = createTenantScopedClient('tenant-123');

// All queries are automatically filtered by tenantId
const projects = await tenantClient.project.findMany();
const user = await tenantClient.user.create({
  data: { email: 'user@example.com', name: 'John Doe' }
});
```

## Documentation

For comprehensive documentation on tenant scoping, see [TENANT_SCOPING.md](./TENANT_SCOPING.md).

## Prisma Commands

```bash
# Generate Prisma client
pnpm nx run prisma-schema:prisma:generate

# Run migrations (development)
pnpm nx run prisma-schema:prisma:migrate:dev

# Deploy migrations (production)
pnpm nx run prisma-schema:prisma:migrate:deploy

# Open Prisma Studio
pnpm nx run prisma-schema:prisma:studio

# Seed database
pnpm nx run prisma-schema:prisma:seed

# Reset database
pnpm nx run prisma-schema:prisma:reset
```

## Building

Run `nx build prisma-schema` to build the library.

## Running unit tests

Run `nx test prisma-schema` to execute the unit tests via [Vitest](https://vitest.dev/).

## Database Schema

The schema includes **15 models** and **7 enums** for a complete multi-tenant application:

### Models

1. **Tenant** - Multi-tenant organizations with tier, deployment mode, and LLM configuration
2. **User** - Users with role-based access control
3. **Project** - Builder projects with metadata and status tracking
4. **Page** - Application pages with layout configuration
5. **Widget** - Page widgets with position and data bindings
6. **DataSource** - IoT and API data sources with authentication
7. **AppVersion** - Application versions with publish status
8. **DeploymentTarget** - Deployment environments (dev/staging/production)
9. **GitIntegration** - Git repository integration with encrypted credentials
10. **BillingPlan** - Subscription plans (Starter $499, Professional $2499, Enterprise $7999)
11. **BillingSubscription** - Active tenant subscriptions with Stripe integration
12. **BillingEvent** - Usage tracking and billing events
13. **BillingInvoice** - Generated invoices with line items
14. **AuditEvent** - Comprehensive audit trail for all operations
15. **PreviewSession** - Live preview sessions for the builder

### Enums

- **Tier**: FREE, STARTER, PROFESSIONAL, ENTERPRISE
- **DeploymentMode**: CLOUD_HOSTED, ON_PREMISE, HYBRID
- **ProjectStatus**: DRAFT, ACTIVE, ARCHIVED, DELETED
- **UserRole**: OWNER, ADMIN, DEVELOPER, VIEWER
- **DataSourceType**: REST_API, GRAPHQL, WEBSOCKET, DATABASE, IOT_PLATFORM, MQTT, CUSTOM
- **PublishStatus**: DRAFT, PUBLISHED, UNPUBLISHED, FAILED
- **EnvironmentType**: DEVELOPMENT, STAGING, PRODUCTION

### Seeded Data

The database is automatically seeded with 3 billing plans:

- **Starter** ($499/month): 100 devices, 100K API calls, 10GB storage
- **Professional** ($2,499/month): 500 devices, 1M API calls, 100GB storage
- **Enterprise** ($7,999/month): Unlimited devices/calls, 1TB storage

Run `pnpm prisma:seed` to seed the database.

## Features

### Multi-Tenancy Support

Automatic tenant isolation for all database queries with middleware-based filtering.

### Type Safety

Full TypeScript support with generated types from Prisma schema.

### Transaction Support

Both global and tenant-scoped clients support Prisma transactions.

### Error Handling

Custom error types for tenant scoping violations.

### Global Models

Configure which models don't require tenant scoping (e.g., billing plans, system settings).

### 49 Indexes

Comprehensive indexing on foreign keys and frequently queried fields for optimal performance.

## License

UNLICENSED
