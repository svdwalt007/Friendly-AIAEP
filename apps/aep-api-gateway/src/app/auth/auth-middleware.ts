/**
 * Authentication Middleware for AEP API Gateway
 *
 * Provides JWT verification middleware as an onRequest hook that:
 * - Verifies JWT tokens on protected routes
 * - Extracts tenantId from JWT payload
 * - Attaches user context to request
 * - Exempts specific routes from authentication
 */

import {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginAsync,
  onRequestHookHandler,
} from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { JwtPayload } from './types';

/**
 * Configuration for authentication middleware
 */
export interface AuthMiddlewareConfig {
  /**
   * Routes that should be exempt from authentication
   * Default: ['/api/v1/auth/login', '/api/v1/auth/token/refresh', '/health', '/']
   */
  exemptRoutes?: string[];

  /**
   * Route patterns that should be exempt from authentication (regex patterns)
   * Default: []
   */
  exemptPatterns?: RegExp[];

  /**
   * Whether to enable verbose error logging
   * Default: false
   */
  verboseErrors?: boolean;
}

/**
 * Default exempt routes
 */
const DEFAULT_EXEMPT_ROUTES = [
  '/api/v1/auth/login',
  '/api/v1/auth/token/refresh',
  '/health',
  '/health/ready',
  '/health/live',
  '/',
];

/**
 * Extended Fastify request with authenticated user
 * Extends @fastify/jwt types
 */
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

/**
 * Checks if a route should be exempt from authentication
 */
function isExemptRoute(
  url: string,
  exemptRoutes: string[],
  exemptPatterns: RegExp[]
): boolean {
  // Check exact matches
  if (exemptRoutes.includes(url)) {
    return true;
  }

  // Check pattern matches
  for (const pattern of exemptPatterns) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Authentication middleware plugin
 *
 * This plugin registers an onRequest hook that verifies JWT tokens
 * on all routes except those explicitly exempted.
 *
 * @example
 * ```typescript
 * await fastify.register(authMiddleware, {
 *   exemptRoutes: ['/health', '/api/v1/auth/login'],
 *   verboseErrors: false
 * });
 * ```
 */
const authMiddleware: FastifyPluginAsync<AuthMiddlewareConfig> = async (
  fastify: FastifyInstance,
  options: AuthMiddlewareConfig
) => {
  const exemptRoutes = options.exemptRoutes ?? DEFAULT_EXEMPT_ROUTES;
  const exemptPatterns = options.exemptPatterns ?? [];
  const verboseErrors = options.verboseErrors ?? false;

  /**
   * onRequest hook for JWT verification
   */
  const authenticateRequest: onRequestHookHandler = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    // Parse the URL to get the path without query params
    const url = new URL(request.url, `http://${request.hostname}`);
    const path = url.pathname;

    // Check if route is exempt from authentication
    if (isExemptRoute(path, exemptRoutes, exemptPatterns)) {
      return; // Skip authentication
    }

    // Only apply to /api/v1/* routes (except exempt ones)
    if (!path.startsWith('/api/v1/')) {
      return; // Skip authentication for non-API routes
    }

    try {
      // Verify JWT token
      const payload = await request.jwtVerify<JwtPayload>();

      // Attach user context to request
      request.user = payload;

      // Log successful authentication (at debug level)
      fastify.log.debug({
        tenantId: payload.tenantId,
        userId: payload.userId,
        role: payload.role,
        path,
      }, 'Request authenticated');

    } catch (error) {
      // Log authentication failure
      fastify.log.warn({
        path,
        error: verboseErrors ? error : 'JWT verification failed',
      }, 'Authentication failed');

      // Return 401 Unauthorized
      return reply.code(401).send({
        error: 'Unauthorized',
        message: verboseErrors && error instanceof Error
          ? error.message
          : 'Authentication required',
      });
    }
  };

  // Register the authentication hook
  fastify.addHook('onRequest', authenticateRequest);
};

/**
 * Decorator for protecting specific routes (alternative to global middleware)
 *
 * Use this decorator when you want explicit control over which routes
 * require authentication instead of using the global middleware.
 *
 * @example
 * ```typescript
 * fastify.get('/api/v1/protected',
 *   { onRequest: [requireAuth] },
 *   async (request, reply) => {
 *     const { tenantId, userId } = request.user!;
 *     return { message: `Hello ${userId} from ${tenantId}` };
 *   }
 * );
 * ```
 */
export const requireAuth: onRequestHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const payload = await request.jwtVerify<JwtPayload>();
    request.user = payload;
  } catch (error) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
};

/**
 * Decorator for role-based access control
 *
 * @param allowedRoles - Array of roles that are allowed to access the route
 *
 * @example
 * ```typescript
 * fastify.delete('/api/v1/admin/users/:id',
 *   { onRequest: [requireRole(['admin'])] },
 *   async (request, reply) => {
 *     // Only admin users can access this route
 *     return { message: 'User deleted' };
 *   }
 * );
 * ```
 */
export function requireRole(allowedRoles: string[]): onRequestHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<JwtPayload>();
      request.user = payload;

      if (!allowedRoles.includes(payload.role)) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
    } catch (error) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
  };
}

/**
 * Decorator for tier-based access control
 *
 * @param minimumTier - Minimum tier required ('free', 'professional', or 'enterprise')
 *
 * @example
 * ```typescript
 * fastify.get('/api/v1/premium/features',
 *   { onRequest: [requireTier('professional')] },
 *   async (request, reply) => {
 *     // Only professional and enterprise users can access
 *     return { features: ['advanced-analytics', 'custom-dashboards'] };
 *   }
 * );
 * ```
 */
export function requireTier(
  minimumTier: 'free' | 'professional' | 'enterprise'
): onRequestHookHandler {
  const tierHierarchy: Record<string, number> = {
    free: 0,
    professional: 1,
    enterprise: 2,
  };

  const requiredLevel = tierHierarchy[minimumTier] ?? 0;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<JwtPayload>();
      request.user = payload;

      const userLevel = tierHierarchy[payload.tier] ?? 0;

      if (userLevel < requiredLevel) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `This feature requires ${minimumTier} tier or higher`,
        });
      }
    } catch (error) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
  };
}

/**
 * Utility to get tenant ID from authenticated request
 *
 * @param request - Fastify request with authenticated user
 * @returns Tenant ID from JWT payload
 * @throws Error if request is not authenticated
 *
 * @example
 * ```typescript
 * fastify.get('/api/v1/data', async (request, reply) => {
 *   const tenantId = getTenantId(request);
 *   const data = await fetchDataForTenant(tenantId);
 *   return data;
 * });
 * ```
 */
export function getTenantId(request: FastifyRequest): string {
  if (!request.user) {
    throw new Error('Request is not authenticated');
  }
  return request.user.tenantId;
}

/**
 * Utility to get user ID from authenticated request
 *
 * @param request - Fastify request with authenticated user
 * @returns User ID from JWT payload
 * @throws Error if request is not authenticated
 */
export function getUserId(request: FastifyRequest): string {
  if (!request.user) {
    throw new Error('Request is not authenticated');
  }
  return request.user.userId;
}

/**
 * Utility to check if user has a specific role
 *
 * @param request - Fastify request with authenticated user
 * @param role - Role to check
 * @returns true if user has the specified role
 */
export function hasRole(request: FastifyRequest, role: string): boolean {
  return request.user?.role === role;
}

/**
 * Utility to check if user has minimum tier
 *
 * @param request - Fastify request with authenticated user
 * @param minimumTier - Minimum tier required
 * @returns true if user meets the tier requirement
 */
export function hasTier(
  request: FastifyRequest,
  minimumTier: 'free' | 'professional' | 'enterprise'
): boolean {
  if (!request.user) {
    return false;
  }

  const tierHierarchy: Record<string, number> = {
    free: 0,
    professional: 1,
    enterprise: 2,
  };

  const userLevel = tierHierarchy[request.user.tier] ?? 0;
  const requiredLevel = tierHierarchy[minimumTier] ?? 0;

  return userLevel >= requiredLevel;
}

// Export as Fastify plugin
export default fastifyPlugin(authMiddleware, {
  name: 'aep-auth-middleware',
  fastify: '5.x',
  dependencies: ['@fastify/jwt'], // Requires JWT plugin to be registered first
});
