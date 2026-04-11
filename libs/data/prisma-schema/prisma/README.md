# Prisma Schema - Database Seeding

This directory contains the Prisma schema and seed scripts for the Friendly AI AEP platform.

## Schema

The `schema.prisma` file defines the complete database schema for the platform including:

- **Tenant**: Multi-tenant organization management
- **User**: User accounts and authentication
- **Project**: Application projects
- **Page**: Page definitions and layouts
- **Widget**: UI components and configurations
- **DataSource**: External data integrations
- **BillingPlan**: Subscription tiers and pricing
- **BillingSubscription**: Active subscriptions
- **AuditEvent**: Audit trail and logging
- And more...

## Seeding the Database

### Prerequisites

1. Ensure you have a PostgreSQL database running
2. Set the `DATABASE_URL` environment variable in your `.env` file:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/friendlyai_aep?schema=public"
   ```

### Running the Seed Script

From the library root (`libs/data/prisma-schema`):

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:dev

# Seed the database
npm run prisma:seed
```

Or from the workspace root using pnpm:

```bash
# Navigate to the library
cd libs/data/prisma-schema

# Generate Prisma Client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev

# Seed the database
pnpm prisma:seed
```

### Seed Data

The seed script creates/updates the following billing plans:

#### Starter Plan
- **Tier**: STARTER
- **Price**: $499/month (USD)
- **Max Projects**: 5
- **Max Users**: 10
- **Features**:
  - Device Limit: 100 devices
  - API Calls: 100,000 calls/month
  - Storage: 10 GB
  - Overage Rates:
    - $5.00 per additional device
    - $0.001 per additional API call
    - $0.10 per additional GB
  - Priority Support: No
  - Custom Branding: No
  - SLA: Best effort

#### Professional Plan
- **Tier**: PROFESSIONAL
- **Price**: $2,499/month (USD)
- **Max Projects**: 25
- **Max Users**: 50
- **Features**:
  - Device Limit: 500 devices
  - API Calls: 1,000,000 calls/month
  - Storage: 100 GB
  - Overage Rates:
    - $4.00 per additional device
    - $0.0008 per additional API call
    - $0.08 per additional GB
  - Priority Support: Yes
  - Custom Branding: Yes
  - SLA: 99.5% uptime

#### Enterprise Plan
- **Tier**: ENTERPRISE
- **Price**: $7,999/month (USD)
- **Max Projects**: Unlimited
- **Max Users**: Unlimited
- **Features**:
  - Device Limit: Unlimited
  - API Calls: Unlimited
  - Storage: 1 TB (1024 GB)
  - Overage Rates: Custom pricing (contact sales)
  - Priority Support: Yes
  - Custom Branding: Yes
  - Dedicated Account Manager: Yes
  - SLA: 99.9% uptime with dedicated support

## Features

- **Idempotent Seeding**: Running the seed script multiple times is safe - it will update existing plans instead of creating duplicates
- **Error Handling**: Comprehensive error handling with detailed logging
- **Type Safety**: Full TypeScript support with Prisma Client types
- **Programmatic Export**: The `main()` function is exported as `seedDatabase` for use in other scripts

## Database Management

From the library directory:

```bash
# Open Prisma Studio (GUI for database)
npm run prisma:studio

# Reset database (WARNING: deletes all data and re-runs migrations + seed)
npm run prisma:reset

# Deploy migrations to production
npm run prisma:migrate:deploy
```

## Development

When modifying the schema:

1. Edit `schema.prisma`
2. Create a migration: `npm run prisma:migrate:dev --name description_of_change`
3. Update seed script if needed (`prisma/seed.ts`)
4. Test seeding: `npm run prisma:seed`

## Using in Code

Import the Prisma Client and types from the library:

```typescript
import { PrismaClient, Tier } from '@friendly-aiaep/prisma-schema';

const prisma = new PrismaClient();

// Query billing plans
const starterPlan = await prisma.billingPlan.findUnique({
  where: { tier: Tier.STARTER }
});
```

Or use the seed function programmatically:

```typescript
import { seedDatabase } from '@friendly-aiaep/prisma-schema';

await seedDatabase();
```
