# Prisma Schema Setup Guide

This guide explains how to set up the Prisma schema for the first time.

## Prerequisites

- Node.js and pnpm installed
- PostgreSQL database running (or another supported database)

## Initial Setup

### 1. Create Prisma Schema

Create a `schema.prisma` file in `libs/data/prisma-schema/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Example: Global model (no tenantId)
model BillingPlan {
  id          String   @id @default(cuid())
  name        String
  price       Decimal
  features    Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Example: Tenant-scoped model
model User {
  id        String   @id @default(cuid())
  tenantId  String   // Required for tenant scoping
  email     String   @unique
  name      String
  role      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  projects  Project[]

  @@index([tenantId])
}

model Project {
  id          String   @id @default(cuid())
  tenantId    String   // Required for tenant scoping
  name        String
  description String?
  status      String   @default("ACTIVE")
  ownerId     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  owner User @relation(fields: [ownerId], references: [id])

  @@index([tenantId])
  @@index([ownerId])
}
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Database connection string
DATABASE_URL="postgresql://user:password@localhost:46100/mydb?schema=public"

# Environment
NODE_ENV="development"
```

### 3. Generate Prisma Client

```bash
cd libs/data/prisma-schema
pnpm run prisma:generate
```

This will generate the Prisma Client types in `node_modules/.prisma/client`.

### 4. Create Initial Migration

```bash
pnpm run prisma:migrate:dev --name init
```

This creates the database tables based on your schema.

### 5. Build the Library

```bash
cd ../../..
pnpm nx build prisma-schema
```

## Development Workflow

### Making Schema Changes

1. Update `schema.prisma` with your changes
2. Generate the client: `pnpm run prisma:generate`
3. Create a migration: `pnpm run prisma:migrate:dev --name <description>`

### Viewing Database

Open Prisma Studio to view and edit data:

```bash
cd libs/data/prisma-schema
pnpm run prisma:studio
```

### Seeding Database

Create a seed file at `libs/data/prisma-schema/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('Start seeding...');

  // Create billing plans
  await prisma.billingPlan.createMany({
    data: [
      {
        name: 'Free',
        price: 0,
        features: { users: 1, projects: 5 },
      },
      {
        name: 'Pro',
        price: 29.99,
        features: { users: 10, projects: 50 },
      },
    ],
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run the seed:

```bash
pnpm run prisma:seed
```

## Important Notes

### Tenant-Scoped Models

All models that should be scoped to a tenant MUST include:

1. A `tenantId` field
2. An index on `tenantId` for performance

```prisma
model YourModel {
  id       String @id @default(cuid())
  tenantId String  // Required!
  // ... other fields

  @@index([tenantId])
}
```

### Global Models

Models that don't require tenant scoping (like `BillingPlan`, `SystemConfig`) should:

1. NOT have a `tenantId` field
2. Be added to the global models list in code if needed:

```typescript
import { addGlobalModel } from '@friendly-tech/data/prisma-schema';

addGlobalModel('YourGlobalModel');
```

### Production Deployment

For production deployments:

1. Use `prisma:migrate:deploy` instead of `migrate:dev`
2. Set `NODE_ENV=production` in environment
3. Ensure database connection string is secure

```bash
# In production
pnpm run prisma:migrate:deploy
```

## Troubleshooting

### Error: Cannot find module '@prisma/client'

**Solution**: Run `pnpm run prisma:generate` to generate the Prisma Client.

### Error: Can't reach database server

**Solution**: Check your `DATABASE_URL` in `.env` and ensure the database is running.

### Build errors with TypeScript

**Solution**: Ensure you've run `prisma:generate` before building. The Prisma Client types are generated dynamically.

### Migration conflicts

**Solution**: Reset the database (development only):

```bash
pnpm run prisma:reset
```

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Tenant Scoping Guide](./TENANT_SCOPING.md)
- [Usage Examples](./EXAMPLES.md)
