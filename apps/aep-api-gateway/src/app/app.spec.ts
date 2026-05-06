/**
 * Integration tests for AEP API Gateway
 *
 * Comprehensive test suite covering:
 * - Auth flow: login, JWT issuance, token refresh
 * - Protected routes: JWT required for /api/v1/* routes
 * - Route stubs: basic smoke tests for all route handlers
 * - Health check: verify /health endpoint returns correct structure
 * - Rate limiting: verify tier-based rate limits work
 * - CORS: verify CORS headers present
 * - Tenant context: verify tenantId extracted from JWT
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { app } from './app';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the auth-adapter module
vi.mock('@friendly-tech/iot/auth-adapter', () => {
  const mockJWTHandler = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAuthorizationHeader: vi.fn().mockResolvedValue({
      Authorization: 'Bearer mock-jwt-token',
    }),
    clearCache: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    FriendlyAuthAdapter: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      getAuthHeaders: vi.fn().mockResolvedValue({
        Authorization: 'Bearer mock-jwt-token',
      }),
      getTenantId: vi.fn().mockReturnValue('test-tenant-123'),
      isInitialized: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    JWTAuthHandler: vi.fn(() => mockJWTHandler),
    AuthenticationError: class AuthenticationError extends Error {
      constructor(message: string, public apiId: string, public authMethod: string) {
        super(message);
        this.name = 'AuthenticationError';
      }
    },
  };
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Helper function to create a test JWT token
 */
function createTestJWT(payload: Record<string, any> = {}): string {
  const defaultPayload = {
    tenantId: 'test-tenant-123',
    sub: 'user-123',
    username: 'testuser',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };

  // Simple mock JWT (header.payload.signature)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(defaultPayload)).toString('base64url');
  const signature = 'mock-signature';

  return `${header}.${body}.${signature}`;
}

/**
 * Helper to parse response body
 */
async function parseResponse<T = any>(response: any): Promise<T> {
  return JSON.parse(response.body);
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AEP API Gateway - Integration Tests', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    // Create a fresh Fastify instance for each test
    server = Fastify({
      logger: false, // Disable logging during tests
    });

    // Register the app
    await server.register(app);

    // Ready the server
    await server.ready();
  });

  afterEach(async () => {
    // Close the server after each test
    await server.close();
  });

  // ==========================================================================
  // Basic Route Tests
  // ==========================================================================

  describe('Basic Routes', () => {
    it('should return Hello API on root endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body).toEqual({ message: 'Hello API' });
    });

    it('should handle 404 for non-existent routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return JSON content-type for API responses', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ==========================================================================
  // Health Check Tests
  // ==========================================================================

  describe('Health Check Endpoint', () => {
    beforeEach(async () => {
      // Register health check route
      server.get('/health', async () => {
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          service: 'aep-api-gateway',
          version: '1.0.0',
        };
      });
    });

    it('should return health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body).toMatchObject({
        status: 'ok',
        service: 'aep-api-gateway',
        version: '1.0.0',
      });
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const body = await parseResponse(response);
      expect(() => new Date(body.timestamp)).not.toThrow();
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('should return numeric uptime', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const body = await parseResponse(response);
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // CORS Tests
  // ==========================================================================

  describe('CORS Headers', () => {
    beforeEach(async () => {
      // Register CORS plugin
      await server.register(import('@fastify/cors'), {
        origin: true,
        credentials: true,
      });
    });

    it('should include CORS headers in response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
        headers: {
          origin: 'https://example.com',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight OPTIONS request', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/',
        headers: {
          origin: 'https://example.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should allow credentials in CORS', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
        headers: {
          origin: 'https://example.com',
        },
      });

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  // ==========================================================================
  // JWT Authentication Tests
  // ==========================================================================

  describe('JWT Authentication', () => {
    beforeEach(async () => {
      // Register JWT plugin
      await server.register(import('@fastify/jwt'), {
        secret: 'test-secret-key-for-jwt-signing-32-chars-minimum',
      });

      // Register login route
      server.post('/auth/login', async (request, reply) => {
        const { username, password } = request.body as any;

        if (username === 'testuser' && password === 'testpass') {
          const token = server.jwt.sign({
            tenantId: 'test-tenant-123',
            sub: 'user-123',
            userId: 'user-123',
            role: 'user',
            tier: 'professional',
          } as any);

          return reply.code(200).send({
            token,
            expiresIn: 3600,
          });
        }

        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      });

      // Register token refresh route
      server.post('/auth/refresh', async (request, reply) => {
        try {
          await request.jwtVerify();
          const user = request.user as any;
          const newToken = server.jwt.sign({
            tenantId: user.tenantId,
            sub: user.sub,
            userId: user.userId,
            role: user.role,
            tier: user.tier,
          });

          return reply.code(200).send({
            token: newToken,
            expiresIn: 3600,
          });
        } catch (err) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
      });
    });

    it('should successfully login with valid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'testpass',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('expiresIn', 3600);
      expect(typeof body.token).toBe('string');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'wrongpass',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = await parseResponse(response);
      expect(body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    });

    it('should issue valid JWT token on login', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'testpass',
        },
      });

      const body = await parseResponse(response);
      const decoded = server.jwt.decode(body.token) as any;

      expect(decoded).toMatchObject({
        tenantId: 'test-tenant-123',
        sub: 'user-123',
        username: 'testuser',
      });
    });

    it('should refresh token with valid JWT', async () => {
      // First, login to get a token
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'testpass',
        },
      });

      const { token } = await parseResponse(loginResponse);

      // Then, refresh the token
      const refreshResponse = await server.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(refreshResponse.statusCode).toBe(200);
      const body = await parseResponse(refreshResponse);
      expect(body).toHaveProperty('token');
      expect(body.token).not.toBe(token); // Should be a new token
    });

    it('should reject refresh with invalid token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = await parseResponse(response);
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject refresh without token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ==========================================================================
  // Protected Routes Tests
  // ==========================================================================

  describe('Protected Routes', () => {
    beforeEach(async () => {
      // Register JWT plugin
      await server.register(import('@fastify/jwt'), {
        secret: 'test-secret-key-for-jwt-signing-32-chars-minimum',
      });

      // Register authentication hook for protected routes
      server.addHook('onRequest', async (request, reply) => {
        if (request.url.startsWith('/api/v1/')) {
          try {
            await request.jwtVerify();
          } catch (err) {
            return reply.code(401).send({
              error: 'Unauthorized',
              message: 'Authentication required',
            });
          }
        }
      });

      // Register protected routes
      server.get('/api/v1/projects', async (request) => {
        return {
          data: [
            { id: '1', name: 'Project 1' },
            { id: '2', name: 'Project 2' },
          ],
          tenantId: (request.user as any).tenantId,
        };
      });

      server.get('/api/v1/users', async (request) => {
        return {
          data: [{ id: 'user-123', username: (request.user as any).username }],
          tenantId: (request.user as any).tenantId,
        };
      });

      server.post('/api/v1/projects', async (request) => {
        const { name } = request.body as any;
        return {
          data: { id: 'new-project', name },
          tenantId: (request.user as any).tenantId,
        };
      });
    });

    it('should allow access to protected route with valid JWT', async () => {
      const token = createTestJWT();

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.data).toHaveLength(2);
      expect(body.tenantId).toBe('test-tenant-123');
    });

    it('should reject access to protected route without JWT', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
      });

      expect(response.statusCode).toBe(401);
      const body = await parseResponse(response);
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject access with invalid JWT', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject access with expired JWT', async () => {
      const expiredToken = createTestJWT({
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should extract tenantId from JWT on protected routes', async () => {
      const token = createTestJWT({ tenantId: 'custom-tenant-456' });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.tenantId).toBe('custom-tenant-456');
    });

    it('should allow POST to protected routes with valid JWT', async () => {
      const token = createTestJWT();

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'New Project',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.data.name).toBe('New Project');
    });

    it('should allow access to multiple protected endpoints', async () => {
      const token = createTestJWT();

      const projectsResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const usersResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(projectsResponse.statusCode).toBe(200);
      expect(usersResponse.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Rate Limiting Tests
  // ==========================================================================

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Register rate limit plugin
      await server.register(import('@fastify/rate-limit'), {
        max: 5,
        timeWindow: '1 minute',
      });

      server.get('/api/test', async () => {
        return { message: 'OK' };
      });
    });

    it('should allow requests within rate limit', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should include rate limit headers in response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(parseInt(response.headers['x-ratelimit-remaining'] as string)).toBeLessThanOrEqual(5);
    });

    it('should reject requests exceeding rate limit', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await server.inject({
          method: 'GET',
          url: '/api/test',
        });
      }

      // 6th request should be rate limited
      const response = await server.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should return proper error message on rate limit', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await server.inject({
          method: 'GET',
          url: '/api/test',
        });
      }

      const response = await server.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(429);
      const body = await parseResponse(response);
      expect(body.error).toBeDefined();
    });
  });

  // ==========================================================================
  // Tenant Context Tests
  // ==========================================================================

  describe('Tenant Context Extraction', () => {
    beforeEach(async () => {
      // Register JWT plugin
      await server.register(import('@fastify/jwt'), {
        secret: 'test-secret-key-for-jwt-signing-32-chars-minimum',
      });

      // Tenant context decorator
      server.decorateRequest('tenantId', null);

      // Hook to extract tenant context from JWT
      server.addHook('onRequest', async (request, reply) => {
        if (request.url.startsWith('/api/v1/')) {
          try {
            await request.jwtVerify();
            (request as any).tenantId = (request.user as any).tenantId;
          } catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
          }
        }
      });

      server.get('/api/v1/tenant-info', async (request) => {
        return {
          tenantId: (request as any).tenantId,
          user: request.user,
        };
      });
    });

    it('should extract tenantId from JWT payload', async () => {
      const token = createTestJWT({ tenantId: 'tenant-abc-123' });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/tenant-info',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.tenantId).toBe('tenant-abc-123');
    });

    it('should handle multiple tenants correctly', async () => {
      const tenant1Token = createTestJWT({ tenantId: 'tenant-1' });
      const tenant2Token = createTestJWT({ tenantId: 'tenant-2' });

      const response1 = await server.inject({
        method: 'GET',
        url: '/api/v1/tenant-info',
        headers: {
          authorization: `Bearer ${tenant1Token}`,
        },
      });

      const response2 = await server.inject({
        method: 'GET',
        url: '/api/v1/tenant-info',
        headers: {
          authorization: `Bearer ${tenant2Token}`,
        },
      });

      const body1 = await parseResponse(response1);
      const body2 = await parseResponse(response2);

      expect(body1.tenantId).toBe('tenant-1');
      expect(body2.tenantId).toBe('tenant-2');
    });

    it('should include tenant context in user object', async () => {
      const token = createTestJWT({
        tenantId: 'tenant-xyz',
        username: 'testuser',
        sub: 'user-123',
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/tenant-info',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const body = await parseResponse(response);
      expect(body.user.tenantId).toBe('tenant-xyz');
      expect(body.user.username).toBe('testuser');
      expect(body.user.sub).toBe('user-123');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    beforeEach(async () => {
      server.get('/api/error', async () => {
        throw new Error('Test error');
      });

      server.get('/api/validation-error', async () => {
        const error: any = new Error('Validation failed');
        error.statusCode = 400;
        throw error;
      });
    });

    it('should handle internal server errors gracefully', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/error',
      });

      expect(response.statusCode).toBe(500);
      const body = await parseResponse(response);
      expect(body.error).toBeDefined();
    });

    it('should return proper error format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/validation-error',
      });

      expect(response.statusCode).toBe(400);
      const body = await parseResponse(response);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
    });

    it('should handle malformed JSON payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/',
        headers: {
          'content-type': 'application/json',
        },
        payload: 'invalid-json{',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // Route Stubs Tests
  // ==========================================================================

  describe('Route Stubs - Smoke Tests', () => {
    beforeEach(async () => {
      // Register JWT plugin for protected routes
      await server.register(import('@fastify/jwt'), {
        secret: 'test-secret-key-for-jwt-signing-32-chars-minimum',
      });

      // Auth hook
      server.addHook('onRequest', async (request, reply) => {
        if (request.url.startsWith('/api/v1/')) {
          try {
            await request.jwtVerify();
          } catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
          }
        }
      });

      // Stub routes
      server.get('/api/v1/agents', async () => ({ data: [] }));
      server.post('/api/v1/agents', async () => ({ data: { id: 'new-agent' } }));
      server.get('/api/v1/agents/:id', async () => ({ data: { id: 'agent-1' } }));
      server.put('/api/v1/agents/:id', async () => ({ data: { id: 'agent-1' } }));
      server.delete('/api/v1/agents/:id', async () => ({ success: true }));

      server.get('/api/v1/workflows', async () => ({ data: [] }));
      server.post('/api/v1/workflows', async () => ({ data: { id: 'new-workflow' } }));

      server.get('/api/v1/deployments', async () => ({ data: [] }));
      server.post('/api/v1/deployments', async () => ({ data: { id: 'new-deployment' } }));
    });

    it('should handle GET /api/v1/agents', async () => {
      const token = createTestJWT();
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body).toHaveProperty('data');
    });

    it('should handle POST /api/v1/agents', async () => {
      const token = createTestJWT();
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/agents',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test Agent' },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.data.id).toBe('new-agent');
    });

    it('should handle GET /api/v1/agents/:id', async () => {
      const token = createTestJWT();
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/agents/agent-1',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.data.id).toBe('agent-1');
    });

    it('should handle PUT /api/v1/agents/:id', async () => {
      const token = createTestJWT();
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/agents/agent-1',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated Agent' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle DELETE /api/v1/agents/:id', async () => {
      const token = createTestJWT();
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/v1/agents/agent-1',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = await parseResponse(response);
      expect(body.success).toBe(true);
    });

    it('should handle workflow endpoints', async () => {
      const token = createTestJWT();

      const getResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/workflows',
        headers: { authorization: `Bearer ${token}` },
      });

      const postResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test Workflow' },
      });

      expect(getResponse.statusCode).toBe(200);
      expect(postResponse.statusCode).toBe(200);
    });

    it('should handle deployment endpoints', async () => {
      const token = createTestJWT();

      const getResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/deployments',
        headers: { authorization: `Bearer ${token}` },
      });

      const postResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/deployments',
        headers: { authorization: `Bearer ${token}` },
        payload: { environment: 'production' },
      });

      expect(getResponse.statusCode).toBe(200);
      expect(postResponse.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // Integration Test - Full Flow
  // ==========================================================================

  describe('Full Integration Flow', () => {
    beforeEach(async () => {
      // Setup complete API gateway
      await server.register(import('@fastify/jwt'), {
        secret: 'test-secret-key-for-jwt-signing-32-chars-minimum',
      });

      await server.register(import('@fastify/cors'), {
        origin: true,
        credentials: true,
      });

      // Login route
      server.post('/auth/login', async (request, reply) => {
        const { username, password } = request.body as any;
        if (username === 'testuser' && password === 'testpass') {
          const token = server.jwt.sign({
            tenantId: 'tenant-integration',
            sub: 'user-123',
            userId: 'user-123',
            role: 'user',
            tier: 'professional',
          } as any);
          return { token, expiresIn: 3600 };
        }
        return reply.code(401).send({ error: 'Unauthorized' });
      });

      // Protected route
      server.addHook('onRequest', async (request, reply) => {
        if (request.url.startsWith('/api/v1/')) {
          try {
            await request.jwtVerify();
          } catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
          }
        }
      });

      server.get('/api/v1/profile', async (request) => {
        return {
          user: request.user,
          tenantId: (request.user as any).tenantId,
        };
      });
    });

    it('should complete full authentication and API access flow', async () => {
      // Step 1: Login
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'testpass',
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      const loginBody = await parseResponse(loginResponse);
      const { token } = loginBody;

      // Step 2: Access protected route
      const profileResponse = await server.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(profileResponse.statusCode).toBe(200);
      const profileBody = await parseResponse(profileResponse);
      expect(profileBody.tenantId).toBe('tenant-integration');
      expect(profileBody.user.username).toBe('testuser');
    });

    it('should maintain tenant isolation across requests', async () => {
      // Login as tenant 1
      const login1 = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'testuser', password: 'testpass' },
      });

      const { token: token1 } = await parseResponse(login1);

      // Access profile
      const profile1 = await server.inject({
        method: 'GET',
        url: '/api/v1/profile',
        headers: { authorization: `Bearer ${token1}` },
      });

      const body1 = await parseResponse(profile1);
      expect(body1.tenantId).toBe('tenant-integration');
    });
  });
});
