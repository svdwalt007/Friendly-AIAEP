/**
 * JWT Authentication Handler Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JWTAuthHandler } from './jwt-handler';
import { AuthError, AuthErrorType } from './types';
import type Redis from 'ioredis';

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
  };

  return {
    default: vi.fn(() => mockRedis),
  };
});

// Mock fetch
global.fetch = vi.fn();

describe('JWTAuthHandler', () => {
  let handler: JWTAuthHandler;
  let mockRedisInstance: Redis;

  const mockConfig = {
    eventsUrl: 'https://api.example.com',
    username: 'testuser',
    password: 'testpass',
    redis: {
      host: 'localhost',
      port: 6379,
    },
  };

  const mockToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNTE2MjM5MDIyfQ.4Adcj0qnI2FXXhF8Lm4bKXQz8h_rVz-ixQZ3X9qJX9E';

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new JWTAuthHandler(mockConfig);

    // Get the mocked Redis instance
    const Redis = require('ioredis').default;
    mockRedisInstance = new Redis() as unknown as Redis;

    // Setup default Redis mock responses
    (mockRedisInstance.ping as ReturnType<typeof vi.fn>).mockResolvedValue(
      'PONG'
    );
    (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockRedisInstance.setex as ReturnType<typeof vi.fn>).mockResolvedValue(
      'OK'
    );
    (mockRedisInstance.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (mockRedisInstance.quit as ReturnType<typeof vi.fn>).mockResolvedValue(
      'OK'
    );
  });

  afterEach(async () => {
    await handler.close();
  });

  describe('initialize', () => {
    it('should initialize Redis connection successfully', async () => {
      await handler.initialize();
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should throw AuthError if Redis connection fails', async () => {
      (mockRedisInstance.ping as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(handler.initialize()).rejects.toThrow(AuthError);
      await expect(handler.initialize()).rejects.toThrow(
        'Failed to initialize Redis connection'
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await handler.initialize();
      await handler.initialize();
      expect(mockRedisInstance.ping).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAuthorizationHeader', () => {
    it('should return Authorization header with Bearer token', async () => {
      await handler.initialize();

      // Mock successful authentication
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      const header = await handler.getAuthorizationHeader();

      expect(header).toHaveProperty('Authorization');
      expect(header.Authorization).toMatch(/^Bearer /);
      expect(header.Authorization).toContain(mockToken);
    });

    it('should use cached token if available and valid', async () => {
      await handler.initialize();

      const cachedToken = {
        token: mockToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        cachedAt: Math.floor(Date.now() / 1000),
      };

      (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(cachedToken)
      );

      const header = await handler.getAuthorizationHeader();

      expect(header.Authorization).toBe(`Bearer ${mockToken}`);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should refresh token if cache is empty', async () => {
      await handler.initialize();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      await handler.getAuthorizationHeader();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/rest/v2/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'testuser',
            password: 'testpass',
          }),
        })
      );
    });

    it('should refresh token if expiring soon', async () => {
      await handler.initialize();

      // Token expiring in 30 seconds (less than 60 second buffer)
      const cachedToken = {
        token: mockToken,
        expiresAt: Math.floor(Date.now() / 1000) + 30,
        cachedAt: Math.floor(Date.now() / 1000),
      };

      (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(cachedToken)
      );

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      await handler.getAuthorizationHeader();

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      await expect(handler.getAuthorizationHeader()).rejects.toThrow(
        'not initialized'
      );
    });
  });

  describe('authenticate', () => {
    it('should authenticate with correct credentials', async () => {
      await handler.initialize();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      await handler.getAuthorizationHeader();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/rest/v2/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should throw AuthError on 401 unauthorized', async () => {
      await handler.initialize();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      });

      await expect(handler.getAuthorizationHeader()).rejects.toThrow(
        AuthError
      );
      await expect(handler.getAuthorizationHeader()).rejects.toMatchObject({
        type: AuthErrorType.INVALID_CREDENTIALS,
        statusCode: 401,
      });
    });

    it('should throw AuthError on network error', async () => {
      await handler.initialize();

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      await expect(handler.getAuthorizationHeader()).rejects.toThrow(
        AuthError
      );
    });

    it('should throw AuthError on timeout', async () => {
      await handler.initialize();

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

      await expect(handler.getAuthorizationHeader()).rejects.toMatchObject({
        type: AuthErrorType.NETWORK_ERROR,
        message: expect.stringContaining('timed out'),
      });
    });

    it('should throw AuthError if response missing token', async () => {
      await handler.initialize();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await expect(handler.getAuthorizationHeader()).rejects.toMatchObject({
        type: AuthErrorType.PARSE_ERROR,
      });
    });

    it('should retry on transient failures', async () => {
      await handler.initialize();

      // First call fails, second succeeds
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            token: mockToken,
            expiresIn: 3600,
          }),
        });

      const header = await handler.getAuthorizationHeader();

      expect(header.Authorization).toContain(mockToken);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('token caching', () => {
    it('should cache token with correct TTL', async () => {
      await handler.initialize();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      await handler.getAuthorizationHeader();

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.stringContaining(mockToken)
      );
    });

    it('should return null for expired cached token', async () => {
      await handler.initialize();

      // Token expired 10 seconds ago
      const expiredToken = {
        token: mockToken,
        expiresAt: Math.floor(Date.now() / 1000) - 10,
        cachedAt: Math.floor(Date.now() / 1000) - 3610,
      };

      (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(expiredToken)
      );

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      await handler.getAuthorizationHeader();

      // Should delete expired token and fetch new one
      expect(mockRedisInstance.del).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear cached token', async () => {
      await handler.initialize();

      await handler.clearCache();

      expect(mockRedisInstance.del).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      await expect(handler.clearCache()).rejects.toThrow('not initialized');
    });
  });

  describe('getTokenInfo', () => {
    it('should return token information when cached', async () => {
      await handler.initialize();

      const cachedToken = {
        token: mockToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        cachedAt: Math.floor(Date.now() / 1000),
      };

      (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(cachedToken)
      );

      const info = await handler.getTokenInfo();

      expect(info.hasCachedToken).toBe(true);
      expect(info.expiresAt).toBe(cachedToken.expiresAt);
      expect(info.expiresIn).toBeGreaterThan(0);
      expect(info.isExpiringSoon).toBe(false);
    });

    it('should indicate no cached token', async () => {
      await handler.initialize();

      const info = await handler.getTokenInfo();

      expect(info.hasCachedToken).toBe(false);
    });

    it('should detect expiring soon', async () => {
      await handler.initialize();

      const cachedToken = {
        token: mockToken,
        expiresAt: Math.floor(Date.now() / 1000) + 30, // 30 seconds
        cachedAt: Math.floor(Date.now() / 1000),
      };

      (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(cachedToken)
      );

      const info = await handler.getTokenInfo();

      expect(info.isExpiringSoon).toBe(true);
    });
  });

  describe('close', () => {
    it('should close Redis connection and clear timers', async () => {
      await handler.initialize();
      await handler.close();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should be safe to call multiple times', async () => {
      await handler.initialize();
      await handler.close();
      await handler.close();

      expect(mockRedisInstance.quit).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration', () => {
    it('should use default values for optional config', () => {
      const handlerWithDefaults = new JWTAuthHandler({
        eventsUrl: 'https://api.example.com',
        username: 'user',
        password: 'pass',
        redis: {
          host: 'localhost',
          port: 6379,
        },
      });

      expect(handlerWithDefaults).toBeDefined();
    });

    it('should accept custom refresh buffer', async () => {
      const customHandler = new JWTAuthHandler({
        ...mockConfig,
        refreshBufferSeconds: 120,
      });

      await customHandler.initialize();

      const cachedToken = {
        token: mockToken,
        expiresAt: Math.floor(Date.now() / 1000) + 100, // 100 seconds
        cachedAt: Math.floor(Date.now() / 1000),
      };

      (mockRedisInstance.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(cachedToken)
      );

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: mockToken,
          expiresIn: 3600,
        }),
      });

      await customHandler.getAuthorizationHeader();

      // Should refresh because 100s < 120s buffer
      expect(global.fetch).toHaveBeenCalled();

      await customHandler.close();
    });
  });

  describe('JWT token parsing', () => {
    it('should parse JWT token and extract expiration', async () => {
      await handler.initialize();

      const tokenWithExp =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNTE2MjM5MDIyfQ.4Adcj0qnI2FXXhF8Lm4bKXQz8h_rVz-ixQZ3X9qJX9E';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          token: tokenWithExp,
        }),
      });

      await handler.getAuthorizationHeader();

      // Verify token was cached with correct expiration
      expect(mockRedisInstance.setex).toHaveBeenCalled();
      const setexCall = (mockRedisInstance.setex as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      const cachedData = JSON.parse(setexCall[2]);
      expect(cachedData.expiresAt).toBe(9999999999);
    });
  });
});
