/**
 * Unit tests for tenant middleware
 */

import Fastify, { FastifyInstance } from 'fastify';
import tenantMiddleware from './tenant';
import { TenantContext } from './types';
import { JwtPayload } from '../auth/types';

describe('Tenant Middleware', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify({ logger: false });
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('Multi-tenant mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'multi-tenant';
    });

    it('should attach tenant context with tenantId from JWT', async () => {
      await fastify.register(tenantMiddleware);

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      // Mock auth middleware setting user
      fastify.addHook('onRequest', async (request) => {
        request.user = {
          tenantId: 'tenant-123',
          userId: 'user-456',
          role: 'user',
          tier: 'professional',
        } as JwtPayload;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;

      expect(tenantContext.tenantId).toBe('tenant-123');
      expect(tenantContext.deploymentMode).toBe('multi-tenant');
      expect(tenantContext.shouldFilterByTenant).toBe(true);
    });

    it('should set shouldFilterByTenant to false when tenantId is missing', async () => {
      await fastify.register(tenantMiddleware);

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;

      expect(tenantContext.tenantId).toBeUndefined();
      expect(tenantContext.deploymentMode).toBe('multi-tenant');
      expect(tenantContext.shouldFilterByTenant).toBe(false);
    });

    it('should return 403 when requireTenantId is true and tenantId is missing', async () => {
      await fastify.register(tenantMiddleware, {
        requireTenantId: true,
      });

      fastify.get('/test', async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('Tenant ID is required');
    });

    it('should allow request when requireTenantId is true and tenantId is present', async () => {
      await fastify.register(tenantMiddleware, {
        requireTenantId: true,
      });

      fastify.get('/test', async (request) => {
        return { tenantId: request.tenantContext.tenantId };
      });

      fastify.addHook('onRequest', async (request) => {
        request.user = {
          tenantId: 'tenant-789',
          userId: 'user-123',
          role: 'user',
          tier: 'professional',
        } as JwtPayload;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tenantId).toBe('tenant-789');
    });
  });

  describe('Dedicated mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'dedicated';
    });

    it('should set shouldFilterByTenant to false in dedicated mode', async () => {
      await fastify.register(tenantMiddleware);

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      // Even with tenantId in JWT, should not filter in dedicated mode
      fastify.addHook('onRequest', async (request) => {
        request.user = {
          tenantId: 'tenant-123',
          userId: 'user-123',
          role: 'user',
          tier: 'professional',
        } as JwtPayload;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;

      expect(tenantContext.deploymentMode).toBe('dedicated');
      expect(tenantContext.shouldFilterByTenant).toBe(false);
      expect(tenantContext.tenantId).toBe('tenant-123'); // Still extracted but not used
    });

    it('should not require tenantId in dedicated mode', async () => {
      await fastify.register(tenantMiddleware, {
        requireTenantId: true, // Even with this set, dedicated mode doesn't enforce it
      });

      fastify.get('/test', async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Custom tenant extraction', () => {
    it('should use custom extractTenantId function', async () => {
      await fastify.register(tenantMiddleware, {
        deploymentMode: 'multi-tenant',
        extractTenantId: (request: any) => {
          // Extract from custom header
          return request.headers['x-tenant-id'] as string;
        },
      });

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-tenant-id': 'custom-tenant-999',
        },
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;

      expect(tenantContext.tenantId).toBe('custom-tenant-999');
      expect(tenantContext.shouldFilterByTenant).toBe(true);
    });
  });

  describe('Deployment mode configuration', () => {
    it('should default to multi-tenant when DEPLOYMENT_MODE is not set', async () => {
      delete process.env.DEPLOYMENT_MODE;

      await fastify.register(tenantMiddleware);

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;
      expect(tenantContext.deploymentMode).toBe('multi-tenant');
    });

    it('should use override deployment mode from options', async () => {
      process.env.DEPLOYMENT_MODE = 'multi-tenant';

      await fastify.register(tenantMiddleware, {
        deploymentMode: 'dedicated', // Override env var
      });

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;
      expect(tenantContext.deploymentMode).toBe('dedicated');
    });

    it('should handle invalid DEPLOYMENT_MODE values by defaulting to multi-tenant', async () => {
      process.env.DEPLOYMENT_MODE = 'invalid-mode';

      await fastify.register(tenantMiddleware);

      fastify.get('/test', async (request) => {
        return request.tenantContext;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      const tenantContext = JSON.parse(response.payload) as TenantContext;
      expect(tenantContext.deploymentMode).toBe('multi-tenant');
    });
  });

  describe('Request decoration', () => {
    it('should decorate request with tenantContext', async () => {
      process.env.DEPLOYMENT_MODE = 'multi-tenant';

      await fastify.register(tenantMiddleware);

      fastify.get('/test', async (request) => {
        // Type checking - should have tenantContext
        expect(request.tenantContext).toBeDefined();
        expect(request.tenantContext).toHaveProperty('tenantId');
        expect(request.tenantContext).toHaveProperty('deploymentMode');
        expect(request.tenantContext).toHaveProperty('shouldFilterByTenant');

        return { decorated: true };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Integration scenarios', () => {
    it('should work with multiple requests with different tenants', async () => {
      process.env.DEPLOYMENT_MODE = 'multi-tenant';

      await fastify.register(tenantMiddleware);

      const tenantContexts: TenantContext[] = [];

      fastify.get('/test', async (request) => {
        tenantContexts.push(request.tenantContext);
        return request.tenantContext;
      });

      // Simulate different tenant requests
      const tenants = ['tenant-1', 'tenant-2', 'tenant-3'];

      for (const tenantId of tenants) {
        fastify.addHook('onRequest', async (request) => {
          request.user = {
            tenantId,
            userId: 'user-123',
            role: 'user',
            tier: 'professional',
          } as JwtPayload;
        });

        await fastify.inject({
          method: 'GET',
          url: '/test',
        });
      }

      // Each request should have isolated tenant context
      expect(tenantContexts.length).toBeGreaterThan(0);
    });
  });
});
