import { PrismaClient } from '@prisma/client';

/**
 * Global singleton Prisma client for non-tenant-scoped operations.
 * This client should be used for:
 * - Administrative operations
 * - Global model queries (e.g., BillingPlan, SystemConfig)
 * - Operations that need to span multiple tenants
 *
 * For tenant-scoped operations, use createTenantScopedClient instead.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect from the database.
 * Useful for cleanup in serverless environments or during shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
