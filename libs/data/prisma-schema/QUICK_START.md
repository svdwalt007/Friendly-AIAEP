# Prisma Schema - Quick Start Guide

Get up and running with the Friendly AI AEP Prisma schema in 5 minutes.

## Prerequisites

- Node.js 20.x or later
- pnpm 10.x or later
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)

## Step 1: Start Database (2 minutes)

### Option A: Using Docker Compose (Recommended)

```bash
# From the library directory
cd libs/data/prisma-schema
docker compose -f docker-compose.db.yml up -d

# Verify database is running
docker compose -f docker-compose.db.yml ps
```

### Option B: Using Existing PostgreSQL

Set the `DATABASE_URL` in your `.env` file:

```bash
DATABASE_URL="postgresql://username:password@localhost:5432/friendly_aep"
```

## Step 2: Set Up Environment (30 seconds)

Create a `.env` file in the library root or project root:

```bash
# Copy from example
cp .env.example .env

# Or create manually
echo 'DATABASE_URL="postgresql://friendly:friendly_dev_password@localhost:5432/friendly_aep"' > .env
```

## Step 3: Generate Prisma Client (30 seconds)

```bash
cd libs/data/prisma-schema

# Generate the Prisma client
pnpm prisma:generate
```

This creates a fully-typed TypeScript client in `node_modules/.prisma/client`.

## Step 4: Create Database Schema (1 minute)

```bash
# Create and apply the initial migration
pnpm prisma:migrate:dev --name init
```

This will:
1. Create the database if it doesn't exist
2. Apply all schema changes
3. Generate the Prisma client
4. Create a migration file in `prisma/migrations/`

## Step 5: Seed the Database (10 seconds)

```bash
# Seed billing plans
pnpm prisma:seed
```

This creates 3 billing plans:
- Starter ($499/month)
- Professional ($2,499/month)
- Enterprise ($7,999/month)

## Step 6: Verify Installation (30 seconds)

### Option A: Using Prisma Studio

```bash
# Open Prisma Studio (GUI)
pnpm prisma:studio
```

Navigate to `http://localhost:5555` to browse your data.

### Option B: Using Code

Create a test file `test-connection.ts`:

```typescript
import { prisma } from '@friendly-tech/data/prisma-schema';

async function main() {
  // Test connection
  const plans = await prisma.billingPlan.findMany();
  console.log('✅ Database connected!');
  console.log(`Found ${plans.length} billing plans:`, plans.map(p => p.name));

  // Create a test tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Corp',
      friendlyDmUrl: 'https://dm.test.com',
      friendlyEventsUrl: 'https://events.test.com',
      friendlyQoEUrl: 'https://qoe.test.com',
      deploymentMode: 'CLOUD_HOSTED',
      tier: 'STARTER',
      licenseKey: 'test-license-key'
    }
  });
  console.log('✅ Created test tenant:', tenant.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run it:

```bash
npx tsx test-connection.ts
```

## Step 7: Start Using in Your App

### Global Client (Admin Operations)

```typescript
import { prisma } from '@friendly-tech/data/prisma-schema';

// Query billing plans
const plans = await prisma.billingPlan.findMany();

// Get all tenants (admin)
const tenants = await prisma.tenant.findMany();
```

### Tenant-Scoped Client (Multi-Tenant Operations)

```typescript
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

// Create a tenant-scoped client
const tenantClient = createTenantScopedClient('tenant-id-here');

// All queries are automatically filtered by tenantId
const projects = await tenantClient.project.findMany();
const users = await tenantClient.user.findMany();

// Creates are automatically assigned to the tenant
const project = await tenantClient.project.create({
  data: {
    name: 'My IoT Dashboard',
    status: 'DRAFT',
    deploymentMode: 'CLOUD_HOSTED'
  }
});
```

## Common Commands

```bash
# Generate Prisma client
pnpm prisma:generate

# Create a new migration
pnpm prisma:migrate:dev --name <migration-name>

# Apply migrations (production)
pnpm prisma:migrate:deploy

# Reset database (DANGER: drops all data)
pnpm prisma:reset

# Seed database
pnpm prisma:seed

# Open Prisma Studio
pnpm prisma:studio

# Format schema file
pnpm exec prisma format

# Validate schema
pnpm exec prisma validate
```

## Troubleshooting

### Database Connection Failed

**Error**: `Can't reach database server`

**Solutions**:
1. Verify PostgreSQL is running: `docker compose -f docker-compose.db.yml ps`
2. Check DATABASE_URL in `.env`
3. Ensure port 5432 is not blocked
4. Try connecting manually: `psql postgresql://friendly:friendly_dev_password@localhost:5432/friendly_aep`

### Migration Failed

**Error**: `Migration failed to apply`

**Solutions**:
1. Check database connection
2. Ensure no conflicting migrations exist
3. Try resetting: `pnpm prisma:migrate:reset` (DANGER: drops all data)
4. Check PostgreSQL logs: `docker compose -f docker-compose.db.yml logs postgres`

### Prisma Client Not Found

**Error**: `Cannot find module '@prisma/client'`

**Solutions**:
1. Run `pnpm prisma:generate`
2. Ensure `@prisma/client` is in dependencies: `pnpm add @prisma/client`
3. Restart your IDE/terminal

### Seed Script Fails

**Error**: `Seed script failed`

**Solutions**:
1. Ensure database is migrated: `pnpm prisma:migrate:dev`
2. Check DATABASE_URL in `.env`
3. Run manually: `pnpm exec tsx prisma/seed.ts`

## Next Steps

1. **Read the Docs**: Check [README.md](./README.md) for comprehensive documentation
2. **Explore Examples**: See [EXAMPLES.md](./EXAMPLES.md) for code patterns
3. **Tenant Scoping**: Read [TENANT_SCOPING.md](./TENANT_SCOPING.md) for multi-tenant patterns
4. **Setup Guide**: Follow [SETUP.md](./SETUP.md) for production deployment

## Quick Reference

### Model Summary

| Model | Description | Tenant Scoped |
|-------|-------------|---------------|
| Tenant | Organizations | No (root) |
| User | Application users | Yes |
| Project | Builder projects | Yes |
| Page | Application pages | Yes (via Project) |
| Widget | Page widgets | Yes (via Page) |
| DataSource | IoT/API sources | Yes (via Project) |
| AppVersion | App versions | Yes (via Project) |
| DeploymentTarget | Deployment envs | Yes (via Project) |
| GitIntegration | Git repos | Yes (via Project) |
| BillingPlan | Subscription plans | No (global) |
| BillingSubscription | Active subscriptions | Yes |
| BillingEvent | Usage events | Yes |
| BillingInvoice | Invoices | Yes |
| AuditEvent | Audit log | Yes |
| PreviewSession | Preview sessions | Yes (via Project) |

### Enum Values

- **Tier**: FREE, STARTER, PROFESSIONAL, ENTERPRISE
- **DeploymentMode**: CLOUD_HOSTED, ON_PREMISE, HYBRID
- **ProjectStatus**: DRAFT, ACTIVE, ARCHIVED, DELETED
- **UserRole**: OWNER, ADMIN, DEVELOPER, VIEWER
- **DataSourceType**: REST_API, GRAPHQL, WEBSOCKET, DATABASE, IOT_PLATFORM, MQTT, CUSTOM
- **PublishStatus**: DRAFT, PUBLISHED, UNPUBLISHED, FAILED
- **EnvironmentType**: DEVELOPMENT, STAGING, PRODUCTION

## Support

For issues or questions:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review the [full documentation](./README.md)
3. Check Prisma docs: https://www.prisma.io/docs
4. Contact the development team

---

**You're all set! 🚀**

Start building with the Friendly AI AEP Prisma schema.
