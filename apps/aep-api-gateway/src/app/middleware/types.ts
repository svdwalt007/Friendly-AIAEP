/**
 * Tenant context types for request decoration
 */

/**
 * Deployment mode for the application
 * - 'multi-tenant': All database queries are filtered by tenantId
 * - 'dedicated': Single-tenant mode, skips tenant filtering for optimization
 */
export type DeploymentMode = 'multi-tenant' | 'dedicated';

/**
 * Tenant context attached to each request
 */
export interface TenantContext {
  /**
   * The tenant ID extracted from the JWT payload
   * Only present in multi-tenant mode and when authenticated
   */
  tenantId?: string;

  /**
   * Current deployment mode
   */
  deploymentMode: DeploymentMode;

  /**
   * Whether tenant filtering should be applied to database queries
   */
  shouldFilterByTenant: boolean;
}

/**
 * Extend Fastify request type with tenant context
 */
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Tenant context for database query filtering
     */
    tenantContext: TenantContext;
  }
}
