import { FastifyRequest, FastifyReply } from 'fastify';
import { verify, decode, JwtPayload } from 'jsonwebtoken';

/**
 * Enhanced JWT Authentication Middleware
 *
 * Features:
 * - JWT token verification with multiple algorithms
 * - Token refresh handling
 * - Multi-tenant validation
 * - Role-based access control (RBAC)
 * - Comprehensive error handling
 * - Token blacklist support
 * - Audit logging
 */

/**
 * User roles for RBAC
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

/**
 * Subscription tiers
 */
export enum SubscriptionTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * Extended JWT payload with application-specific claims
 */
export interface AuthToken extends JwtPayload {
  sub: string; // User ID
  email?: string;
  role?: UserRole;
  tier?: SubscriptionTier;
  tenantId?: string;
  organizationId?: string;
  permissions?: string[];
  sessionId?: string;
  type?: 'access' | 'refresh';
}

/**
 * Auth middleware configuration
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret?: string;
  algorithms?: string[];
  issuer?: string;
  audience?: string;
  enableTokenBlacklist?: boolean;
  enableMultiTenant?: boolean;
  enableAuditLog?: boolean;
}

/**
 * Token blacklist (in-memory for now, should be Redis in production)
 */
const tokenBlacklist = new Set<string>();

/**
 * Check if a token is blacklisted
 */
export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

/**
 * Add a token to the blacklist
 */
export function blacklistToken(token: string, expiresIn?: number): void {
  tokenBlacklist.add(token);

  // Auto-remove after expiration
  if (expiresIn) {
    setTimeout(() => {
      tokenBlacklist.delete(token);
    }, expiresIn * 1000);
  }
}

/**
 * Verify JWT token and extract payload
 *
 * @param token JWT token string
 * @param config Auth configuration
 * @returns Decoded token payload
 */
export function verifyToken(token: string, config: AuthConfig): AuthToken {
  try {
    const payload = verify(token, config.jwtSecret, {
      algorithms: (config.algorithms as any) || ['HS256', 'RS256'],
      issuer: config.issuer,
      audience: config.audience,
    }) as AuthToken;

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not yet valid');
      }
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Verify refresh token
 *
 * @param token Refresh token string
 * @param config Auth configuration
 * @returns Decoded token payload
 */
export function verifyRefreshToken(token: string, config: AuthConfig): AuthToken {
  const secret = config.jwtRefreshSecret || config.jwtSecret;

  try {
    const payload = verify(token, secret, {
      algorithms: (config.algorithms as any) || ['HS256', 'RS256'],
      issuer: config.issuer,
      audience: config.audience,
    }) as AuthToken;

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return payload;
  } catch (error) {
    throw new Error('Refresh token verification failed');
  }
}

/**
 * Extract token from request headers
 *
 * Supports:
 * - Authorization: Bearer <token>
 * - X-Access-Token: <token>
 * - Cookie: access_token=<token>
 *
 * @param request Fastify request object
 * @returns Token string or undefined
 */
export function extractToken(request: FastifyRequest): string | undefined {
  // Check Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-Access-Token header
  const accessTokenHeader = request.headers['x-access-token'];
  if (accessTokenHeader && typeof accessTokenHeader === 'string') {
    return accessTokenHeader;
  }

  // Check cookies
  const cookies = (request as any).cookies;
  if (cookies?.access_token) {
    return cookies.access_token;
  }

  return undefined;
}

/**
 * Validate tenant access
 *
 * @param user User payload
 * @param requiredTenantId Required tenant ID
 * @returns True if user has access to tenant
 */
export function validateTenantAccess(user: AuthToken, requiredTenantId?: string): boolean {
  if (!requiredTenantId) {
    return true;
  }

  // Super admins have access to all tenants
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  // Check user's tenant ID
  const userTenantId = user.tenantId || user.organizationId;
  return userTenantId === requiredTenantId;
}

/**
 * Validate user role
 *
 * @param user User payload
 * @param requiredRoles Required roles
 * @returns True if user has any of the required roles
 */
export function validateRole(user: AuthToken, requiredRoles: UserRole[]): boolean {
  if (!user.role) {
    return false;
  }

  return requiredRoles.includes(user.role);
}

/**
 * Validate user permission
 *
 * @param user User payload
 * @param requiredPermissions Required permissions
 * @returns True if user has all required permissions
 */
export function validatePermissions(user: AuthToken, requiredPermissions: string[]): boolean {
  if (!user.permissions || user.permissions.length === 0) {
    return false;
  }

  return requiredPermissions.every((permission) => user.permissions!.includes(permission));
}

/**
 * Create authentication middleware
 *
 * Usage:
 * ```typescript
 * const authMiddleware = createAuthMiddleware({
 *   jwtSecret: process.env.JWT_SECRET,
 *   enableMultiTenant: true,
 * });
 *
 * fastify.addHook('onRequest', authMiddleware);
 * ```
 */
export function createAuthMiddleware(config: AuthConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Skip auth for public routes
      if (isPublicRoute(request.url)) {
        return;
      }

      // Extract token
      const token = extractToken(request);

      if (!token) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'No authentication token provided',
        });
      }

      // Check blacklist
      if (config.enableTokenBlacklist && isTokenBlacklisted(token)) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token has been revoked',
        });
      }

      // Verify token
      const user = verifyToken(token, config);

      // Attach user to request
      (request as any).user = user;
      (request as any).token = token;

      // Multi-tenant validation
      if (config.enableMultiTenant) {
        const tenantId = request.headers['x-tenant-id'] as string;
        if (tenantId && !validateTenantAccess(user, tenantId)) {
          return reply.code(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Access denied to this tenant',
          });
        }
      }

      // Audit logging
      if (config.enableAuditLog) {
        request.log.info({
          userId: user.sub,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          path: request.url,
          method: request.method,
          ip: request.ip,
        }, 'Authenticated request');
      }
    } catch (error) {
      request.log.error({ error }, 'Authentication failed');

      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication failed',
      });
    }
  };
}

/**
 * Create role-based access control middleware
 *
 * Usage:
 * ```typescript
 * const adminOnly = createRoleMiddleware([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
 * fastify.addHook('onRequest', adminOnly);
 * ```
 */
export function createRoleMiddleware(requiredRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthToken;

    if (!user) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!validateRole(user, requiredRoles)) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
        requiredRoles,
        userRole: user.role,
      });
    }
  };
}

/**
 * Create permission-based access control middleware
 *
 * Usage:
 * ```typescript
 * const requirePermissions = createPermissionMiddleware(['users:write', 'users:delete']);
 * fastify.addHook('onRequest', requirePermissions);
 * ```
 */
export function createPermissionMiddleware(requiredPermissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthToken;

    if (!user) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!validatePermissions(user, requiredPermissions)) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
        requiredPermissions,
        userPermissions: user.permissions || [],
      });
    }
  };
}

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(url: string): boolean {
  const publicRoutes = [
    '/health',
    '/metrics',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/swagger',
    '/documentation',
  ];

  return publicRoutes.some((route) => url.startsWith(route));
}

/**
 * Decorator for route-level authentication
 *
 * Usage:
 * ```typescript
 * fastify.route({
 *   method: 'GET',
 *   url: '/protected',
 *   onRequest: [requireAuth],
 *   handler: async (request, reply) => { ... }
 * });
 * ```
 */
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user;

  if (!user) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
};
