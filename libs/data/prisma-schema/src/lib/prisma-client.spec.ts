import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @prisma/client before importing
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = vi.fn().mockResolvedValue(undefined);
    $disconnect = vi.fn().mockResolvedValue(undefined);
    $transaction = vi.fn();
    $queryRaw = vi.fn();
    $executeRaw = vi.fn();
    $use = vi.fn();
    $extends = vi.fn();
  }

  return {
    PrismaClient: MockPrismaClient,
  };
});

describe('prisma-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('module exports', () => {
    it('should export prisma client', async () => {
      const { prisma } = await import('./prisma-client');
      expect(prisma).toBeDefined();
    });

    it('should export disconnectPrisma function', async () => {
      const { disconnectPrisma } = await import('./prisma-client');
      expect(typeof disconnectPrisma).toBe('function');
    });
  });

  describe('prisma singleton', () => {
    it('should have client methods', async () => {
      const { prisma } = await import('./prisma-client');
      expect(prisma.$connect).toBeDefined();
      expect(prisma.$disconnect).toBeDefined();
      expect(prisma.$transaction).toBeDefined();
    });

    it('should have query execution methods', async () => {
      const { prisma } = await import('./prisma-client');
      expect(prisma.$queryRaw).toBeDefined();
      expect(prisma.$executeRaw).toBeDefined();
    });

    it('should have middleware support', async () => {
      const { prisma } = await import('./prisma-client');
      expect(prisma.$use).toBeDefined();
    });

    it('should have extends functionality', async () => {
      const { prisma } = await import('./prisma-client');
      expect(prisma.$extends).toBeDefined();
    });
  });

  describe('disconnectPrisma', () => {
    it('should disconnect the prisma client', async () => {
      const { disconnectPrisma, prisma } = await import('./prisma-client');
      await disconnectPrisma();
      expect(prisma.$disconnect).toHaveBeenCalled();
    });
  });
});
