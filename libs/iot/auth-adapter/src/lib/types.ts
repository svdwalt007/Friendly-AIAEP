/**
 * Common types for FriendlyAuthAdapter
 */

/**
 * Supported authentication methods
 */
export type AuthMethod = 'basic' | 'apikey' | 'jwt' | 'oauth2' | 'none';

/**
 * Authorization header format
 */
export interface AuthorizationHeader {
  Authorization?: string;
  'X-API-Key'?: string;
  [key: string]: string | undefined;
}

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

/**
 * Tenant credentials for authentication
 */
export interface TenantCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  oauth2Config?: OAuth2Config;
}

/**
 * Configuration for a single Friendly API
 */
export interface FriendlyApiConfig {
  /** Unique identifier for the API */
  id: string;

  /** Base URL of the API */
  baseUrl: string;

  /** Supported authentication methods for this API */
  authMethods: AuthMethod[];

  /** Primary authentication method to try first */
  primaryAuth: AuthMethod;

  /** Credentials for authentication */
  credentials: TenantCredentials;
}
