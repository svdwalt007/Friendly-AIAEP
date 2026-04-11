/**
 * Authentication types for AEP API Gateway
 */

/**
 * JWT payload structure for AEP authentication tokens
 */
export interface JwtPayload {
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;

  /** User ID within the tenant */
  userId: string;

  /** User role (admin, user, viewer, etc.) */
  role: string;

  /** Subscription tier (free, professional, enterprise) */
  tier: 'free' | 'professional' | 'enterprise';

  /** Token issued at timestamp (Unix epoch seconds) */
  iat?: number;

  /** Token expiration timestamp (Unix epoch seconds) */
  exp?: number;

  /** Token subject (user identifier) */
  sub?: string;

  /** Token issuer */
  iss?: string;
}

/**
 * Login request body
 */
export interface LoginRequest {
  /** Username or email from Friendly Northbound API */
  uid: string;

  /** Password for Friendly Northbound API authentication */
  pw: string;
}

/**
 * Login response with JWT tokens
 */
export interface LoginResponse {
  /** Access token for API authentication */
  accessToken: string;

  /** Refresh token for obtaining new access tokens */
  refreshToken: string;

  /** Token type (always "Bearer") */
  tokenType: 'Bearer';

  /** Access token expiration in seconds */
  expiresIn: number;

  /** User information */
  user: {
    userId: string;
    tenantId: string;
    role: string;
    tier: 'free' | 'professional' | 'enterprise';
  };
}

/**
 * Token refresh request body
 */
export interface RefreshRequest {
  /** Refresh token from login response */
  refreshToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshResponse {
  /** New access token */
  accessToken: string;

  /** New refresh token */
  refreshToken: string;

  /** Token type (always "Bearer") */
  tokenType: 'Bearer';

  /** Access token expiration in seconds */
  expiresIn: number;
}

/**
 * Extended Fastify request with authenticated user context
 */
export interface AuthenticatedRequest {
  user: JwtPayload;
}
