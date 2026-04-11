import { PrismaClient } from '@prisma/client';

/**
 * List of Prisma models that don't require tenant scoping.
 * These are global models that exist outside of tenant boundaries.
 */
const GLOBAL_MODELS = new Set([
  'BillingPlan',
  'SystemConfig',
  'GlobalSettings',
  // Add other global models here as needed
]);

/**
 * Error thrown when attempting to perform operations without a valid tenant ID.
 */
export class TenantScopingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopingError';
  }
}

/**
 * Creates a tenant-scoped Prisma client that automatically filters all queries by tenantId.
 *
 * @param tenantId - The tenant identifier to scope all queries to
 * @returns A Prisma client instance with automatic tenant filtering
 *
 * @example
 * ```typescript
 * const tenantClient = createTenantScopedClient('tenant-123');
 *
 * // All queries are automatically scoped to tenant-123
 * const projects = await tenantClient.project.findMany();
 * const user = await tenantClient.user.create({
 *   data: { email: 'user@example.com', name: 'John Doe' }
 * });
 * ```
 *
 * @throws {TenantScopingError} When tenantId is not provided or is empty
 */
export function createTenantScopedClient(tenantId: string): any {
  if (!tenantId || tenantId.trim() === '') {
    throw new TenantScopingError('Tenant ID is required for tenant-scoped operations');
  }

  const baseClient = new PrismaClient({
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

  // Use client extensions for tenant scoping (Prisma 5+)
  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          // Skip tenant scoping for global models
          if (!model || GLOBAL_MODELS.has(model)) {
            return query(args);
          }

          // Handle different query operations
          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
              // Add tenantId filter to WHERE clause
              args = {
                ...args,
                where: {
                  ...args?.where,
                  tenantId,
                },
              };
              break;

            case 'create':
              // Inject tenantId into data
              args = {
                ...args,
                data: {
                  ...args?.data,
                  tenantId,
                },
              };
              break;

            case 'createMany':
              // Inject tenantId into all records
              if (Array.isArray(args?.data)) {
                args = {
                  ...args,
                  data: args.data.map((record: any) => ({
                    ...record,
                    tenantId,
                  })),
                };
              } else {
                args = {
                  ...args,
                  data: {
                    ...args?.data,
                    tenantId,
                  },
                };
              }
              break;

            case 'update':
            case 'updateMany':
            case 'upsert':
              // Add tenantId filter to WHERE clause
              args = {
                ...args,
                where: {
                  ...args?.where,
                  tenantId,
                },
              };

              // For upsert, also inject tenantId into create data
              if (operation === 'upsert' && args?.create) {
                args = {
                  ...args,
                  create: {
                    ...args.create,
                    tenantId,
                  },
                };
              }
              break;

            case 'delete':
            case 'deleteMany':
              // Add tenantId filter to WHERE clause
              args = {
                ...args,
                where: {
                  ...args?.where,
                  tenantId,
                },
              };
              break;

            default:
              // For any other operations, pass through as-is
              break;
          }

          return query(args);
        },
      },
    },
  });

  return client;
}

/**
 * Type helper to extract tenant-scoped client type
 * Using any due to Prisma extension type complexity
 */
export type TenantScopedClient = any;

/**
 * Checks if a model is globally scoped (doesn't require tenantId)
 *
 * @param modelName - The Prisma model name to check
 * @returns true if the model is global, false if it requires tenant scoping
 */
export function isGlobalModel(modelName: string): boolean {
  return GLOBAL_MODELS.has(modelName);
}

/**
 * Adds a model to the global models list.
 * Useful for dynamically configuring which models don't require tenant scoping.
 *
 * @param modelName - The Prisma model name to add to global models
 */
export function addGlobalModel(modelName: string): void {
  GLOBAL_MODELS.add(modelName);
}

/**
 * Removes a model from the global models list.
 *
 * @param modelName - The Prisma model name to remove from global models
 */
export function removeGlobalModel(modelName: string): void {
  GLOBAL_MODELS.delete(modelName);
}

/**
 * Gets all currently configured global models.
 *
 * @returns Array of global model names
 */
export function getGlobalModels(): string[] {
  return Array.from(GLOBAL_MODELS);
}
