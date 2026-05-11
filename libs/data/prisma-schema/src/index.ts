// Re-export Prisma Client and all generated types
export * from '@prisma/client';

// Export singleton Prisma client for non-tenant-scoped operations
export { prisma, disconnectPrisma } from './lib/prisma-client';

// Export tenant-scoped client utilities
export {
  createTenantScopedClient,
  isGlobalModel,
  addGlobalModel,
  removeGlobalModel,
  getGlobalModels,
  TenantScopingError,
  type TenantScopedClient,
} from './lib/tenant-client';

// Export module name for identification
export const MODULE_NAME = 'prisma-schema';
