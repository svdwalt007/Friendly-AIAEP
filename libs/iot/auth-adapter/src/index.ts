export const MODULE_NAME = 'auth-adapter';

// Main Friendly Auth Adapter
export {
  FriendlyAuthAdapter,
  AuthenticationError,
  ConfigurationError,
  type FriendlyAuthAdapterConfig,
} from './lib/friendly-auth-adapter';

// Core Types
export {
  type FriendlyApiConfig,
  type TenantCredentials,
  type OAuth2Config as OAuth2ConfigType,
} from './lib/types';

// OAuth2 Authentication Handler
export {
  OAuth2AuthHandler,
  createOAuth2Handler,
  type OAuth2Config,
  type OAuth2TokenResponse,
  type RedisConfig,
  type CachedToken,
  type AuthorizationHeader,
  type RevocationResult,
} from './lib/auth/oauth2-handler';

// JWT Authentication Handler
export {
  JWTAuthHandler,
  type JWTAuthConfig,
  type JWTLoginResponse,
  type JWTTokenData,
  AuthError,
  AuthErrorType,
} from './lib/auth';

// Encryption Utilities
export {
  encrypt,
  decrypt,
  deriveKey,
  encryptCredential,
  decryptCredential,
  parseEncryptedData,
  formatEncryptedData,
  isEncryptedFormat,
  generateEncryptionKey,
  EncryptionError,
  DecryptionError,
  type EncryptedData,
  type EncryptionOptions,
  type Credential,
  type EncryptedCredential,
} from './lib/encryption';

// Audit Event Emitter
export {
  AuditEventEmitter,
  AuditEventType,
  AuthMethod,
  createFilteredListener,
  getDefaultAuditEmitter,
  resetDefaultAuditEmitter,
  type BaseAuditEvent,
  type AuthSuccessEvent,
  type AuthFailureEvent,
  type TokenRefreshEvent,
  type TokenExpiredEvent,
  type CredentialDecryptionErrorEvent,
  type AuditEvent,
  type EventFilter,
  type EventAggregation,
  type AuditEventEmitterConfig,
  type AuditServiceHook,
} from './lib/audit-emitter';
