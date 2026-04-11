import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @prisma/client before importing
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = vi.fn().mockResolvedValue(undefined);
    $disconnect = vi.fn().mockResolvedValue(undefined);
    $transaction = vi.fn();
    $use = vi.fn();
    $extends = vi.fn().mockReturnThis();
  }

  return {
    PrismaClient: MockPrismaClient,
    Prisma: {},
  };
});

describe('tenant-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTenantScopedClient', () => {
    it('should throw TenantScopingError when tenantId is empty', async () => {
      const { createTenantScopedClient, TenantScopingError } = await import('./tenant-client');

      expect(() => createTenantScopedClient('')).toThrow(TenantScopingError);
      expect(() => createTenantScopedClient('')).toThrow(
        'Tenant ID is required for tenant-scoped operations'
      );
    });

    it('should throw TenantScopingError when tenantId is whitespace', async () => {
      const { createTenantScopedClient, TenantScopingError } = await import('./tenant-client');

      expect(() => createTenantScopedClient('   ')).toThrow(TenantScopingError);
    });

    it('should create a client instance with valid tenantId', async () => {
      const { createTenantScopedClient } = await import('./tenant-client');

      const client = createTenantScopedClient('tenant-123');
      expect(client).toBeDefined();
      expect(client.$connect).toBeDefined();
      expect(client.$disconnect).toBeDefined();
    });

    it('should create different instances for different tenants', async () => {
      const { createTenantScopedClient } = await import('./tenant-client');

      const client1 = createTenantScopedClient('tenant-123');
      const client2 = createTenantScopedClient('tenant-456');
      expect(client1).not.toBe(client2);
    });
  });

  describe('TenantScopingError', () => {
    it('should be instanceof Error', async () => {
      const { TenantScopingError } = await import('./tenant-client');

      const error = new TenantScopingError('Test error');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', async () => {
      const { TenantScopingError } = await import('./tenant-client');

      const error = new TenantScopingError('Test error');
      expect(error.name).toBe('TenantScopingError');
    });

    it('should preserve error message', async () => {
      const { TenantScopingError } = await import('./tenant-client');

      const message = 'Custom error message';
      const error = new TenantScopingError(message);
      expect(error.message).toBe(message);
    });
  });

  describe('global model utilities', () => {
    describe('isGlobalModel', () => {
      it('should return true for BillingPlan', async () => {
        const { isGlobalModel } = await import('./tenant-client');
        expect(isGlobalModel('BillingPlan')).toBe(true);
      });

      it('should return true for SystemConfig', async () => {
        const { isGlobalModel } = await import('./tenant-client');
        expect(isGlobalModel('SystemConfig')).toBe(true);
      });

      it('should return true for GlobalSettings', async () => {
        const { isGlobalModel } = await import('./tenant-client');
        expect(isGlobalModel('GlobalSettings')).toBe(true);
      });

      it('should return false for non-global models', async () => {
        const { isGlobalModel } = await import('./tenant-client');
        expect(isGlobalModel('User')).toBe(false);
        expect(isGlobalModel('Project')).toBe(false);
        expect(isGlobalModel('Organization')).toBe(false);
      });
    });

    describe('addGlobalModel', () => {
      it('should add a model to global models list', async () => {
        const { isGlobalModel, addGlobalModel, removeGlobalModel } = await import('./tenant-client');

        // Clean up first
        removeGlobalModel('TestModel');

        expect(isGlobalModel('TestModel')).toBe(false);
        addGlobalModel('TestModel');
        expect(isGlobalModel('TestModel')).toBe(true);

        // Cleanup
        removeGlobalModel('TestModel');
      });

      it('should handle adding duplicate models', async () => {
        const { isGlobalModel, addGlobalModel, removeGlobalModel, getGlobalModels } = await import('./tenant-client');

        // Clean up first
        removeGlobalModel('TestModel');

        addGlobalModel('TestModel');
        addGlobalModel('TestModel');
        expect(isGlobalModel('TestModel')).toBe(true);
        expect(getGlobalModels().filter((m) => m === 'TestModel').length).toBe(1);

        // Cleanup
        removeGlobalModel('TestModel');
      });
    });

    describe('removeGlobalModel', () => {
      it('should remove a model from global models list', async () => {
        const { isGlobalModel, addGlobalModel, removeGlobalModel } = await import('./tenant-client');

        addGlobalModel('TestModel');
        expect(isGlobalModel('TestModel')).toBe(true);
        removeGlobalModel('TestModel');
        expect(isGlobalModel('TestModel')).toBe(false);
      });

      it('should handle removing non-existent models gracefully', async () => {
        const { removeGlobalModel } = await import('./tenant-client');
        expect(() => removeGlobalModel('NonExistentModel')).not.toThrow();
      });
    });

    describe('getGlobalModels', () => {
      it('should return array of global models', async () => {
        const { getGlobalModels } = await import('./tenant-client');

        const models = getGlobalModels();
        expect(Array.isArray(models)).toBe(true);
        expect(models).toContain('BillingPlan');
        expect(models).toContain('SystemConfig');
        expect(models).toContain('GlobalSettings');
      });

      it('should include dynamically added models', async () => {
        const { addGlobalModel, removeGlobalModel, getGlobalModels } = await import('./tenant-client');

        addGlobalModel('DynamicModel');
        const models = getGlobalModels();
        expect(models).toContain('DynamicModel');
        removeGlobalModel('DynamicModel');
      });
    });
  });

  describe('middleware behavior', () => {
    it('should create client with middleware', async () => {
      const { createTenantScopedClient } = await import('./tenant-client');

      const client = createTenantScopedClient('tenant-123');
      // Middleware is internal, we verify it exists by checking client creation doesn't throw
      expect(client).toBeDefined();
      expect(client.$use).toBeDefined();
    });
  });
});
