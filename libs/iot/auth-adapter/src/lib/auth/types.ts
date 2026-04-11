/**
 * JWT Authentication Types
 * Defines interfaces and types for JWT token management and authentication
 */

/**
 * Configuration options for JWT authentication handler
 */
export interface JWTAuthConfig {
  /**
   * Base URL for the events service (e.g., 'https://api.example.com')
   */
  eventsUrl: string;

  /**
   * Username for authentication
   */
  username: string;

  /**
   * Password for authentication
   */
  password: string;

  /**
   * Redis connection options
   */
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };

  /**
   * Number of seconds before token expiry to trigger refresh
   * @default 60
   */
  refreshBufferSeconds?: number;

  /**
   * Maximum number of retry attempts on 401 errors
   * @default 3
   */
  maxRetries?: number;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  requestTimeout?: number;
}

/**
 * Response from the login endpoint
 */
export interface JWTLoginResponse {
  /**
   * The JWT access token
   */
  token: string;

  /**
   * Token type (typically 'Bearer')
   */
  tokenType?: string;

  /**
   * Token expiration time in seconds from now
   */
  expiresIn?: number;

  /**
   * Absolute expiration timestamp (Unix epoch in seconds)
   */
  expiresAt?: number;

  /**
   * Refresh token (if provided)
   */
  refreshToken?: string;
}

/**
 * Decoded JWT token payload
 */
export interface JWTTokenData {
  /**
   * Subject (user ID)
   */
  sub?: string;

  /**
   * Issued at timestamp (Unix epoch in seconds)
   */
  iat?: number;

  /**
   * Expiration timestamp (Unix epoch in seconds)
   */
  exp?: number;

  /**
   * Not before timestamp (Unix epoch in seconds)
   */
  nbf?: number;

  /**
   * JWT ID
   */
  jti?: string;

  /**
   * Username or email
   */
  username?: string;

  /**
   * User roles
   */
  roles?: string[];

  /**
   * Additional custom claims
   */
  [key: string]: unknown;
}

/**
 * Cached token information stored in Redis
 */
export interface CachedToken {
  /**
   * The JWT token
   */
  token: string;

  /**
   * Expiration timestamp (Unix epoch in seconds)
   */
  expiresAt: number;

  /**
   * When the token was cached (Unix epoch in seconds)
   */
  cachedAt: number;

  /**
   * Refresh token (if available)
   */
  refreshToken?: string;
}

/**
 * Authentication error types
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  REFRESH_FAILED = 'REFRESH_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom authentication error
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly type: AuthErrorType,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Authorization header result
 */
export interface AuthorizationHeader {
  /**
   * The Authorization header value (e.g., 'Bearer eyJhbGc...')
   */
  Authorization: string;
  /**
   * Index signature to allow HeadersInit compatibility
   */
  [key: string]: string;
}
