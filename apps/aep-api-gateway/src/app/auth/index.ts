/**
 * Authentication Module for AEP API Gateway
 *
 * This module provides comprehensive JWT-based authentication with RS256 algorithm,
 * integrating with Friendly Northbound API for credential validation.
 *
 * @module auth
 */

// Export types
export type {
  JwtPayload,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  AuthenticatedRequest,
} from './types';

// Export JWT key utilities
export {
  generateJwtKeyPair,
  loadOrGenerateKeyPair,
  loadKeyPairFromEnv,
  getJwtKeyPair,
  validateKeyPair,
  type JwtKeyPair,
  type KeyGenerationConfig,
} from './jwt-keys';

// Export auth plugin
export {
  default as authPlugin,
  type AuthPluginConfig,
} from './auth-plugin';

// Export auth middleware and utilities
export {
  default as authMiddleware,
  requireAuth,
  requireRole,
  requireTier,
  getTenantId,
  getUserId,
  hasRole,
  hasTier,
  type AuthMiddlewareConfig,
} from './auth-middleware';
