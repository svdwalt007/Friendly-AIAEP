/**
 * Tenant-scoped middleware for aep-api-gateway
 *
 * Reference: Module Reference v2.2 Section 5.1
 * - In multi-tenant mode: all DB queries filtered by tenantId
 * - In dedicated mode: skip tenant filter (single-tenant optimization)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { DeploymentMode, TenantContext } from './types';

/**
 * Options for tenant middleware configuration
 */
export interface TenantMiddlewareOptions {
  /**
   * Override deployment mode (defaults to DEPLOYMENT_MODE env var)
   */
  deploymentMode?: DeploymentMode;

  /**
   * Whether to throw an error if tenantId is missing in multi-tenant mode
   * Default: false (logs warning instead)
   */
  requireTenantId?: boolean;

  /**
   * Custom function to extract tenantId from request
   * Default: extracts from request.user.tenantId (set by auth middleware)
   */
  extractTenantId?: (request: FastifyRequest) => string | undefined;
}

/**
 * Determines the deployment mode from environment variable
 */
function getDeploymentMode(override?: DeploymentMode): DeploymentMode {
  if (override) {
    return override;
  }

  const envMode = process.env.DEPLOYMENT_MODE?.toLowerCase();

  if (envMode === 'dedicated') {
    return 'dedicated';
  }

  // Default to multi-tenant if not specified or invalid
  return 'multi-tenant';
}

/**
 * Default tenant ID extractor - reads from JWT payload set by auth middleware
 */
function defaultExtractTenantId(request: FastifyRequest): string | undefined {
  const user = request.user;
  return user?.tenantId;
}

/**
 * Creates tenant context for the current request
 */
function createTenantContext(
  request: FastifyRequest,
  deploymentMode: DeploymentMode,
  extractTenantId: (request: FastifyRequest) => string | undefined
): TenantContext {
  const tenantId = extractTenantId(request);

  // In dedicated mode, we don't filter by tenant
  const shouldFilterByTenant = deploymentMode === 'multi-tenant' && !!tenantId;

  return {
    tenantId,
    deploymentMode,
    shouldFilterByTenant,
  };
}

/**
 * Fastify plugin that adds tenant context to all requests
 *
 * @example
 * ```typescript
 * // Register in your Fastify app
 * fastify.register(tenantMiddleware, {
 *   deploymentMode: 'multi-tenant',
 *   requireTenantId: true
 * });
 *
 * // Access in route handlers
 * fastify.get('/api/data', async (request, reply) => {
 *   const { tenantId, shouldFilterByTenant } = request.tenantContext;
 *
 *   if (shouldFilterByTenant) {
 *     // Apply tenant filter to database query
 *     return db.data.findMany({ where: { tenantId } });
 *   } else {
 *     // Dedicated mode - no tenant filtering
 *     return db.data.findMany();
 *   }
 * });
 * ```
 */
async function tenantMiddleware(
  fastify: FastifyInstance,
  options: TenantMiddlewareOptions = {}
) {
  const deploymentMode = getDeploymentMode(options.deploymentMode);
  const requireTenantId = options.requireTenantId ?? false;
  const extractTenantId = options.extractTenantId ?? defaultExtractTenantId;

  // Log the deployment mode on startup
  fastify.log.info(
    { deploymentMode },
    `Tenant middleware initialized in ${deploymentMode} mode`
  );

  // Decorate the request with tenantContext
  if (!fastify.hasRequestDecorator('tenantContext')) {
    fastify.decorateRequest('tenantContext', null as any);
  }

  // Add onRequest hook to populate tenant context for every request
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantContext = createTenantContext(
      request,
      deploymentMode,
      extractTenantId
    );

    // Attach tenant context to request
    request.tenantContext = tenantContext;

    // Log tenant context for debugging (in development)
    if (process.env.NODE_ENV === 'development') {
      fastify.log.debug(
        {
          tenantId: tenantContext.tenantId,
          deploymentMode: tenantContext.deploymentMode,
          shouldFilterByTenant: tenantContext.shouldFilterByTenant,
          path: request.url,
        },
        'Tenant context attached to request'
      );
    }

    // Validate tenant ID requirement in multi-tenant mode
    if (
      deploymentMode === 'multi-tenant' &&
      !tenantContext.tenantId &&
      requireTenantId
    ) {
      const errorMessage = 'Tenant ID is required in multi-tenant mode but was not found in JWT';

      fastify.log.error(
        {
          url: request.url,
          method: request.method,
          headers: request.headers,
        },
        errorMessage
      );

      reply.code(403).send({
        error: 'Forbidden',
        message: errorMessage,
        statusCode: 403,
      });

      return;
    }

    // Warn if tenant ID is missing in multi-tenant mode (when not required)
    if (
      deploymentMode === 'multi-tenant' &&
      !tenantContext.tenantId &&
      !requireTenantId
    ) {
      fastify.log.warn(
        {
          url: request.url,
          method: request.method,
        },
        'Tenant ID not found in JWT payload in multi-tenant mode'
      );
    }
  });
}

/**
 * Export as Fastify plugin with fastify-plugin to ensure it's registered
 * in the encapsulation context root
 */
export default fp(tenantMiddleware, {
  name: 'tenant-middleware',
  fastify: '5.x',
});
