/**
 * Comprehensive tests for FriendlyAuthAdapter
 *
 * Coverage includes:
 * - Configuration validation
 * - Adapter initialization
 * - Basic auth header generation
 * - API key header generation
 * - JWT auth flow with mocked handler
 * - OAuth2 auth flow with mocked handler
 * - Primary auth method with fallback
 * - 401 handling and token refresh
 * - Credential decryption
 * - fromPrismaTenant factory method
 * - Error scenarios
 * - Audit event emission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import {
  FriendlyAuthAdapter,
  AuthenticationError,
  ConfigurationError,
  type FriendlyAuthAdapterConfig,
} from './friendly-auth-adapter';
import { JWTAuthHandler } from './auth/jwt-handler';
import { OAuth2AuthHandler } from './auth/oauth2-handler';
import { AuditEventEmitter } from './audit-emitter';
import { encrypt } from './encryption';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Redis module
vi.mock('ioredis', () => {
  const MockRedis = vi.fn();
  MockRedis.prototype.get = vi.fn();
  MockRedis.prototype.set = vi.fn();
  MockRedis.prototype.setex = vi.fn();
  MockRedis.prototype.del = vi.fn();
  MockRedis.prototype.ping = vi.fn().mockResolvedValue('PONG');
  MockRedis.prototype.quit = vi.fn().mockResolvedValue('OK');
  MockRedis.prototype.on = vi.fn();

  return { Redis: MockRedis };
});

vi.mock('./auth/jwt-handler');
vi.mock('./auth/oauth2-handler');

// Helper to create mock Redis instance
const createMockRedis = () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
  };

  return mockRedis;
};

// Create mock implementations
const mockJWTHandlerInstance = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getAuthorizationHeader: vi
    .fn()
    .mockResolvedValue({ Authorization: 'Bearer mock-jwt-token' }),
  clearCache: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockOAuth2HandlerInstance = {
  getToken: vi
    .fn()
    .mockResolvedValue({ Authorization: 'Bearer mock-oauth2-token' }),
  clearCache: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
};

// Mock the constructors
(JWTAuthHandler as unknown as ReturnType<typeof vi.fn>) = vi.fn(
  () => mockJWTHandlerInstance
);
(OAuth2AuthHandler as unknown as ReturnType<typeof vi.fn>) = vi.fn(
  () => mockOAuth2HandlerInstance
);

// ============================================================================
// Test Suite
// ============================================================================

describe('FriendlyAuthAdapter', () => {
  let auditEmitter: AuditEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockJWTHandlerInstance.initialize.mockResolvedValue(undefined);
    mockJWTHandlerInstance.getAuthorizationHeader.mockResolvedValue({
      Authorization: 'Bearer mock-jwt-token',
    });
    mockJWTHandlerInstance.clearCache.mockResolvedValue(undefined);
    mockJWTHandlerInstance.close.mockResolvedValue(undefined);

    mockOAuth2HandlerInstance.getToken.mockResolvedValue({
      Authorization: 'Bearer mock-oauth2-token',
    });
    mockOAuth2HandlerInstance.clearCache.mockResolvedValue(undefined);
    mockOAuth2HandlerInstance.destroy.mockResolvedValue(undefined);

    auditEmitter = new AuditEventEmitter();
  });

  afterEach(async () => {
    auditEmitter.destroy();
  });

  // ==========================================================================
  // Configuration Validation Tests
  // ==========================================================================

  describe('Configuration Validation', () => {
    it('should throw ConfigurationError when tenantId is missing', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: '',
          apis: {
            events: {
              id: 'events',
              baseUrl: 'https://events.example.com',
              authMethods: ['jwt'],
              primaryAuth: 'jwt',
              credentials: { username: 'user', password: 'pass' },
            },
          },
          redis: { host: 'localhost', port: 6379 },
        });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when no APIs are configured', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: 'tenant-123',
          apis: {},
          redis: { host: 'localhost', port: 6379 },
        });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when API baseUrl is missing', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: 'tenant-123',
          apis: {
            events: {
              id: 'events',
              baseUrl: '',
              authMethods: ['jwt'],
              primaryAuth: 'jwt',
              credentials: { username: 'user', password: 'pass' },
            },
          },
          redis: { host: 'localhost', port: 6379 },
        });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when no authMethods are specified', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: 'tenant-123',
          apis: {
            events: {
              id: 'events',
              baseUrl: 'https://events.example.com',
              authMethods: [],
              primaryAuth: 'jwt',
              credentials: { username: 'user', password: 'pass' },
            },
          },
          redis: { host: 'localhost', port: 6379 },
        });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when primaryAuth is missing', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: 'tenant-123',
          apis: {
            events: {
              id: 'events',
              baseUrl: 'https://events.example.com',
              authMethods: ['jwt'],
              primaryAuth: '' as any,
              credentials: { username: 'user', password: 'pass' },
            },
          },
          redis: { host: 'localhost', port: 6379 },
        });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when primaryAuth is not in authMethods', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: 'tenant-123',
          apis: {
            events: {
              id: 'events',
              baseUrl: 'https://events.example.com',
              authMethods: ['basic'],
              primaryAuth: 'jwt',
              credentials: { username: 'user', password: 'pass' },
            },
          },
          redis: { host: 'localhost', port: 6379 },
        });
      }).toThrow(ConfigurationError);
    });

    it('should accept valid configuration', () => {
      expect(() => {
        new FriendlyAuthAdapter({
          tenantId: 'tenant-123',
          apis: {
            events: {
              id: 'events',
              baseUrl: 'https://events.example.com',
              authMethods: ['jwt', 'basic'],
              primaryAuth: 'jwt',
              credentials: { username: 'user', password: 'pass' },
            },
          },
          redis: { host: 'localhost', port: 6379 },
        });
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Adapter Initialization Tests
  // ==========================================================================

  describe('Adapter Initialization', () => {
    it('should initialize Redis client with default values', () => {
      new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: {},
      });

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          db: 0,
          keyPrefix: 'friendly:auth:',
        })
      );
    });

    it('should initialize Redis client with custom values', () => {
      new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: {
          host: 'redis.example.com',
          port: 6380,
          password: 'secret',
          db: 2,
          keyPrefix: 'custom:',
        },
      });

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis.example.com',
          port: 6380,
          password: 'secret',
          db: 2,
          keyPrefix: 'custom:',
        })
      );
    });

    it('should initialize JWT handler when JWT auth is configured', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      expect(JWTAuthHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          eventsUrl: 'https://events.example.com',
          username: 'user',
          password: 'pass',
        })
      );
      expect(mockJWTHandlerInstance.initialize).toHaveBeenCalled();
    });

    it('should initialize OAuth2 handler when OAuth2 auth is configured', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['oauth2'],
            primaryAuth: 'oauth2',
            credentials: {
              oauth2Config: {
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'client-123',
                clientSecret: 'secret',
                scope: 'read write',
              },
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      expect(OAuth2AuthHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenEndpoint: 'https://auth.example.com/token',
          clientId: 'client-123',
          clientSecret: 'secret',
          scope: 'read write',
        })
      );
    });

    it('should emit audit event on successful initialization', async () => {
      const emitSpy = vi.spyOn(auditEmitter, 'emit');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();

      expect(emitSpy).toHaveBeenCalledWith(
        'auth_success',
        expect.objectContaining({
          tenantId: 'tenant-123',
          apiId: 'adapter',
          authMethod: 'none',
        })
      );
    });

    it('should not re-initialize if already initialized', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      const firstCallCount = (JWTAuthHandler as unknown as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      await adapter.initialize();
      const secondCallCount = (JWTAuthHandler as unknown as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      expect(firstCallCount).toBe(secondCallCount);
    });
  });

  // ==========================================================================
  // Basic Auth Header Generation Tests
  // ==========================================================================

  describe('Basic Auth Header Generation', () => {
    it('should generate Basic auth headers with username and password', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['basic'],
            primaryAuth: 'basic',
            credentials: { username: 'testuser', password: 'testpass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('events');

      const expectedBase64 = Buffer.from('testuser:testpass').toString('base64');
      expect(headers).toEqual({
        Authorization: `Basic ${expectedBase64}`,
      });
    });

    it('should throw error when username is missing for Basic auth', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['basic'],
            primaryAuth: 'basic',
            credentials: { password: 'testpass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        'Username and password required for Basic auth'
      );
    });

    it('should throw error when password is missing for Basic auth', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['basic'],
            primaryAuth: 'basic',
            credentials: { username: 'testuser' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        'Username and password required for Basic auth'
      );
    });
  });

  // ==========================================================================
  // API Key Header Generation Tests
  // ==========================================================================

  describe('API Key Header Generation', () => {
    it('should generate API key headers', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          qoe: {
            id: 'qoe',
            baseUrl: 'https://qoe.example.com',
            authMethods: ['apikey'],
            primaryAuth: 'apikey',
            credentials: { apiKey: 'test-api-key-123' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('qoe');

      expect(headers).toEqual({
        'X-API-Key': 'test-api-key-123',
      });
    });

    it('should throw error when apiKey is missing for API key auth', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          qoe: {
            id: 'qoe',
            baseUrl: 'https://qoe.example.com',
            authMethods: ['apikey'],
            primaryAuth: 'apikey',
            credentials: {},
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('qoe')).rejects.toThrow(
        'API key required for API key auth'
      );
    });
  });

  // ==========================================================================
  // JWT Auth Flow Tests
  // ==========================================================================

  describe('JWT Auth Flow', () => {
    it('should return JWT Bearer token headers', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('events');

      expect(headers).toEqual({
        Authorization: 'Bearer mock-jwt-token',
      });
      expect(mockJWTHandlerInstance.getAuthorizationHeader).toHaveBeenCalled();
    });

    it('should throw error when JWT handler is not initialized', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: {},
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        'JWT handler not initialized for API: events'
      );
    });
  });

  // ==========================================================================
  // OAuth2 Auth Flow Tests
  // ==========================================================================

  describe('OAuth2 Auth Flow', () => {
    it('should return OAuth2 Bearer token headers', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['oauth2'],
            primaryAuth: 'oauth2',
            credentials: {
              oauth2Config: {
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'client-123',
                clientSecret: 'secret',
              },
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('events');

      expect(headers).toEqual({
        Authorization: 'Bearer mock-oauth2-token',
      });
      expect(mockOAuth2HandlerInstance.getToken).toHaveBeenCalled();
    });

    it('should throw error when OAuth2 handler is not initialized', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['oauth2'],
            primaryAuth: 'oauth2',
            credentials: {},
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        'OAuth2 handler not initialized for API: events'
      );
    });
  });

  // ==========================================================================
  // Primary Auth with Fallback Tests
  // ==========================================================================

  describe('Primary Auth with Fallback', () => {
    it('should use primary auth method when successful', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt', 'basic'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('events');

      expect(headers).toEqual({
        Authorization: 'Bearer mock-jwt-token',
      });
      expect(mockJWTHandlerInstance.getAuthorizationHeader).toHaveBeenCalled();
    });

    it('should fallback to secondary auth when primary fails', async () => {
      mockJWTHandlerInstance.getAuthorizationHeader.mockRejectedValueOnce(
        new Error('JWT auth failed')
      );

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt', 'basic'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('events');

      const expectedBase64 = Buffer.from('user:pass').toString('base64');
      expect(headers).toEqual({
        Authorization: `Basic ${expectedBase64}`,
      });
    });

    it('should emit auth failure event when primary fails', async () => {
      mockJWTHandlerInstance.getAuthorizationHeader.mockRejectedValueOnce(
        new Error('JWT auth failed')
      );

      const emitSpy = vi.spyOn(auditEmitter, 'emitAuthFailure');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt', 'basic'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();
      await adapter.getAuthHeaders('events');

      expect(emitSpy).toHaveBeenCalledWith(
        'tenant-123',
        'events',
        'jwt',
        expect.any(Error)
      );
    });

    it('should emit auth success event when fallback succeeds', async () => {
      mockJWTHandlerInstance.getAuthorizationHeader.mockRejectedValueOnce(
        new Error('JWT auth failed')
      );

      const emitSpy = vi.spyOn(auditEmitter, 'emitAuthSuccess');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt', 'basic'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();
      await adapter.getAuthHeaders('events');

      expect(emitSpy).toHaveBeenCalledWith(
        'tenant-123',
        'events',
        'basic',
        expect.objectContaining({ method: 'fallback', primaryMethod: 'jwt' })
      );
    });

    it('should throw AuthenticationError when all auth methods fail', async () => {
      mockJWTHandlerInstance.getAuthorizationHeader.mockRejectedValue(
        new Error('JWT auth failed')
      );

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  // ==========================================================================
  // 401 Handling and Token Refresh Tests
  // ==========================================================================

  describe('401 Handling and Token Refresh', () => {
    it('should clear cache and refresh JWT token on 401', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      await adapter.handle401('events');

      expect(mockJWTHandlerInstance.clearCache).toHaveBeenCalled();
      expect(mockJWTHandlerInstance.getAuthorizationHeader).toHaveBeenCalled();
    });

    it('should clear cache and refresh OAuth2 token on 401', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['oauth2'],
            primaryAuth: 'oauth2',
            credentials: {
              oauth2Config: {
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'client-123',
                clientSecret: 'secret',
              },
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      await adapter.handle401('events');

      expect(mockOAuth2HandlerInstance.clearCache).toHaveBeenCalled();
      expect(mockOAuth2HandlerInstance.getToken).toHaveBeenCalled();
    });

    it('should emit token expired event on 401', async () => {
      const emitSpy = vi.spyOn(auditEmitter, 'emitTokenExpired');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();
      await adapter.handle401('events');

      expect(emitSpy).toHaveBeenCalledWith('tenant-123', 'events', 'jwt');
    });

    it('should throw ConfigurationError when API not found on 401', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.handle401('nonexistent')).rejects.toThrow(
        ConfigurationError
      );
    });
  });

  // ==========================================================================
  // Credential Decryption Tests
  // ==========================================================================

  describe('Credential Decryption', () => {
    it('should decrypt encrypted password during initialization', async () => {
      const encryptionKey = 'test-encryption-key-32-characters';
      const plainPassword = 'my-secret-password';
      const encryptedPassword = encrypt(plainPassword, encryptionKey);

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: {
              username: 'user',
              password: `encrypted:${encryptedPassword}`,
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        encryptionKey,
      });

      await adapter.initialize();

      expect(JWTAuthHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'user',
          password: plainPassword,
        })
      );
    });

    it('should decrypt encrypted API key during initialization', async () => {
      const encryptionKey = 'test-encryption-key-32-characters';
      const plainApiKey = 'my-secret-api-key';
      const encryptedApiKey = encrypt(plainApiKey, encryptionKey);

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          qoe: {
            id: 'qoe',
            baseUrl: 'https://qoe.example.com',
            authMethods: ['apikey'],
            primaryAuth: 'apikey',
            credentials: {
              apiKey: `encrypted:${encryptedApiKey}`,
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        encryptionKey,
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('qoe');

      expect(headers).toEqual({
        'X-API-Key': plainApiKey,
      });
    });

    it('should use plaintext credentials when no encryption key is provided', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['basic'],
            primaryAuth: 'basic',
            credentials: {
              username: 'user',
              password: 'plaintext-password',
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      const headers = await adapter.getAuthHeaders('events');

      const expectedBase64 = Buffer.from('user:plaintext-password').toString(
        'base64'
      );
      expect(headers).toEqual({
        Authorization: `Basic ${expectedBase64}`,
      });
    });

    it('should throw ConfigurationError when decryption fails', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: {
              username: 'user',
              password: 'encrypted:invalid-encrypted-data',
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        encryptionKey: 'test-key',
      });

      await expect(adapter.initialize()).rejects.toThrow(ConfigurationError);
    });

    it('should emit credential decryption error event when decryption fails', async () => {
      const emitSpy = vi.spyOn(auditEmitter, 'emitCredentialDecryptionError');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: {
              username: 'user',
              password: 'encrypted:invalid-encrypted-data',
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        encryptionKey: 'test-key',
        auditEmitter,
      });

      await expect(adapter.initialize()).rejects.toThrow();

      expect(emitSpy).toHaveBeenCalledWith(
        'tenant-123',
        'unknown',
        'none',
        expect.any(Error)
      );
    });
  });

  // ==========================================================================
  // fromPrismaTenant Factory Method Tests
  // ==========================================================================

  describe('fromPrismaTenant Factory Method', () => {
    it('should create adapter from Prisma tenant data', async () => {
      const tenant = {
        id: 'tenant-456',
        friendlyDmUrl: 'https://dm.example.com',
        friendlyEventsUrl: 'https://events.example.com',
        friendlyQoEUrl: 'https://qoe.example.com',
        encryptedCredentials: {
          username: 'user',
          password: 'pass',
          apiKey: 'key123',
        },
      };

      const adapter = await FriendlyAuthAdapter.fromPrismaTenant(
        tenant,
        { host: 'localhost', port: 6379 },
        'encryption-key'
      );

      expect(adapter).toBeInstanceOf(FriendlyAuthAdapter);
      expect(adapter.getTenantId()).toBe('tenant-456');
      expect(adapter.getConfiguredApis()).toEqual([
        'northbound',
        'events',
        'qoe',
      ]);
    });

    it('should configure northbound API with JWT primary auth', async () => {
      const tenant = {
        id: 'tenant-456',
        friendlyDmUrl: 'https://dm.example.com',
        friendlyEventsUrl: 'https://events.example.com',
        friendlyQoEUrl: 'https://qoe.example.com',
        encryptedCredentials: {
          username: 'user',
          password: 'pass',
        },
      };

      await FriendlyAuthAdapter.fromPrismaTenant(
        tenant,
        { host: 'localhost', port: 6379 },
        'encryption-key'
      );

      expect(JWTAuthHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          eventsUrl: 'https://dm.example.com',
        })
      );
    });

    it('should configure events API with JWT primary auth', async () => {
      const tenant = {
        id: 'tenant-456',
        friendlyDmUrl: 'https://dm.example.com',
        friendlyEventsUrl: 'https://events.example.com',
        friendlyQoEUrl: 'https://qoe.example.com',
        encryptedCredentials: {
          username: 'user',
          password: 'pass',
        },
      };

      await FriendlyAuthAdapter.fromPrismaTenant(
        tenant,
        { host: 'localhost', port: 6379 },
        'encryption-key'
      );

      expect(JWTAuthHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          eventsUrl: 'https://events.example.com',
        })
      );
    });
  });

  // ==========================================================================
  // Error Scenarios Tests
  // ==========================================================================

  describe('Error Scenarios', () => {
    it('should throw error when getAuthHeaders called before initialization', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        'Adapter not initialized'
      );
    });

    it('should throw ConfigurationError when API not found', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('nonexistent')).rejects.toThrow(
        ConfigurationError
      );
    });

    it('should throw error for unsupported auth method', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['custom' as any],
            primaryAuth: 'custom' as any,
            credentials: {},
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();

      await expect(adapter.getAuthHeaders('events')).rejects.toThrow(
        'Unsupported auth method'
      );
    });
  });

  // ==========================================================================
  // Utility Methods Tests
  // ==========================================================================

  describe('Utility Methods', () => {
    it('should return initialization status', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      expect(adapter.isInitialized()).toBe(false);

      await adapter.initialize();

      expect(adapter.isInitialized()).toBe(true);
    });

    it('should return tenant ID', () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      expect(adapter.getTenantId()).toBe('tenant-123');
    });

    it('should return configured API IDs', () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt'],
            primaryAuth: 'jwt',
            credentials: { username: 'user', password: 'pass' },
          },
          qoe: {
            id: 'qoe',
            baseUrl: 'https://qoe.example.com',
            authMethods: ['apikey'],
            primaryAuth: 'apikey',
            credentials: { apiKey: 'key123' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      expect(adapter.getConfiguredApis()).toEqual(['events', 'qoe']);
    });

    it('should close all handlers and Redis on close', async () => {
      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['jwt', 'oauth2'],
            primaryAuth: 'jwt',
            credentials: {
              username: 'user',
              password: 'pass',
              oauth2Config: {
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'client-123',
                clientSecret: 'secret',
              },
            },
          },
        },
        redis: { host: 'localhost', port: 6379 },
      });

      await adapter.initialize();
      await adapter.close();

      expect(mockJWTHandlerInstance.close).toHaveBeenCalled();
      expect(mockOAuth2HandlerInstance.destroy).toHaveBeenCalled();
      expect(Redis.prototype.quit).toHaveBeenCalled();
      expect(adapter.isInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // Audit Event Emission Tests
  // ==========================================================================

  describe('Audit Event Emission', () => {
    it('should emit auth success event on successful authentication', async () => {
      const emitSpy = vi.spyOn(auditEmitter, 'emitAuthSuccess');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['basic'],
            primaryAuth: 'basic',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter,
      });

      await adapter.initialize();
      await adapter.getAuthHeaders('events');

      expect(emitSpy).toHaveBeenCalledWith(
        'tenant-123',
        'events',
        'basic',
        expect.objectContaining({ method: 'primary' })
      );
    });

    it('should use custom audit emitter when provided', async () => {
      const customEmitter = new AuditEventEmitter();
      const emitSpy = vi.spyOn(customEmitter, 'emit');

      const adapter = new FriendlyAuthAdapter({
        tenantId: 'tenant-123',
        apis: {
          events: {
            id: 'events',
            baseUrl: 'https://events.example.com',
            authMethods: ['basic'],
            primaryAuth: 'basic',
            credentials: { username: 'user', password: 'pass' },
          },
        },
        redis: { host: 'localhost', port: 6379 },
        auditEmitter: customEmitter,
      });

      await adapter.initialize();

      expect(emitSpy).toHaveBeenCalled();

      customEmitter.destroy();
    });
  });
});
