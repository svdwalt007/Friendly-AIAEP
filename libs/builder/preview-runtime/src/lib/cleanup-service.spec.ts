import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CleanupService } from './cleanup-service';
import type { PrismaClient } from '@prisma/client';

// Mock node-cron
vi.mock('node-cron', () => {
  const mockTask = {
    stop: vi.fn(),
    start: vi.fn(),
  };
  return {
    default: {
      schedule: vi.fn(() => mockTask),
    },
    schedule: vi.fn(() => mockTask),
  };
});

describe('CleanupService', () => {
  let service: CleanupService;
  let mockPrismaClient: Partial<PrismaClient>;
  let mockDockerCleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup mock Prisma client
    mockPrismaClient = {
      previewSession: {
        findMany: vi.fn(),
        update: vi.fn(),
      } as any,
      $disconnect: vi.fn(),
    };

    // Setup mock Docker cleanup
    mockDockerCleanup = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (service) {
      await service.disconnect();
    }
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create service with default configuration', () => {
      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      expect(service).toBeDefined();
      expect(service.getStatus()).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      };

      service = new CleanupService({
        cronSchedule: '*/10 * * * *',
        sessionTimeoutMinutes: 60,
        enabled: true,
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
        logger: customLogger,
      });

      expect(service).toBeDefined();
    });
  });

  describe('start() and stop()', () => {
    it('should start the cron job', () => {
      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      service.start();
      expect(service.getStatus()).toBe(true);
    });

    it('should throw error if already running', () => {
      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      service.start();
      expect(() => service.start()).toThrow('CleanupService is already running');
    });

    it('should stop the cron job', () => {
      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      service.start();
      service.stop();
      expect(service.getStatus()).toBe(false);
    });

    it('should not start if disabled', () => {
      const logger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      };

      service = new CleanupService({
        enabled: false,
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
        logger,
      });

      service.start();
      expect(service.getStatus()).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'CleanupService is disabled, not starting'
      );
    });
  });

  describe('cleanupExpiredSessions()', () => {
    it('should return 0 when no expired sessions found', async () => {
      (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue([]);

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      const count = await service.cleanupExpiredSessions();
      expect(count).toBe(0);
    });

    it('should cleanup expired sessions', async () => {
      const expiredSessions = [
        {
          id: 'session1',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token1',
          config: { containerId: 'container1' },
          expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60),
        },
        {
          id: 'session2',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token2',
          config: { docker: { containerId: 'container2' } },
          expiresAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 30),
        },
      ];

      (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue(
        expiredSessions
      );
      (mockPrismaClient.previewSession!.update as any).mockResolvedValue({});

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(2);
      expect(mockDockerCleanup).toHaveBeenCalledTimes(2);
      expect(mockDockerCleanup).toHaveBeenCalledWith('container1');
      expect(mockDockerCleanup).toHaveBeenCalledWith('container2');
      expect(mockPrismaClient.previewSession!.update).toHaveBeenCalledTimes(2);
    });

    it('should handle Docker cleanup errors gracefully', async () => {
      const expiredSessions = [
        {
          id: 'session1',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token1',
          config: { containerId: 'container1' },
          expiresAt: new Date(Date.now() - 1000 * 60 * 60),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60),
        },
      ];

      (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue(
        expiredSessions
      );
      (mockPrismaClient.previewSession!.update as any).mockResolvedValue({});
      mockDockerCleanup.mockRejectedValue(new Error('Docker error'));

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      // Should still cleanup the session in database even if Docker fails
      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(1);
      expect(mockPrismaClient.previewSession!.update).toHaveBeenCalledTimes(1);
    });

    it('should continue cleaning other sessions if one fails', async () => {
      const expiredSessions = [
        {
          id: 'session1',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token1',
          config: { containerId: 'container1' },
          expiresAt: new Date(Date.now() - 1000 * 60 * 60),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60),
        },
        {
          id: 'session2',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token2',
          config: { containerId: 'container2' },
          expiresAt: new Date(Date.now() - 1000 * 60 * 30),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 30),
        },
      ];

      (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue(
        expiredSessions
      );
      (mockPrismaClient.previewSession!.update as any)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({});

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      const count = await service.cleanupExpiredSessions();

      // Only second session should be cleaned up successfully
      expect(count).toBe(1);
      expect(mockDockerCleanup).toHaveBeenCalledTimes(2);
    });

    it('should handle sessions without container IDs', async () => {
      const expiredSessions = [
        {
          id: 'session1',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token1',
          config: {}, // No container ID
          expiresAt: new Date(Date.now() - 1000 * 60 * 60),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60),
        },
      ];

      (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue(
        expiredSessions
      );
      (mockPrismaClient.previewSession!.update as any).mockResolvedValue({});

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(1);
      expect(mockDockerCleanup).not.toHaveBeenCalled();
      expect(mockPrismaClient.previewSession!.update).toHaveBeenCalledTimes(1);
    });

    it('should extract container ID from various config formats', async () => {
      const testCases = [
        { config: { containerId: 'test1' }, expected: 'test1' },
        { config: { container_id: 'test2' }, expected: 'test2' },
        { config: { dockerContainerId: 'test3' }, expected: 'test3' },
        { config: { docker_container_id: 'test4' }, expected: 'test4' },
        { config: { containerName: 'test5' }, expected: 'test5' },
        { config: { container_name: 'test6' }, expected: 'test6' },
        { config: { docker: { containerId: 'test7' } }, expected: 'test7' },
      ];

      for (const testCase of testCases) {
        const expiredSessions = [
          {
            id: 'session1',
            projectId: 'project1',
            userId: 'user1',
            sessionToken: 'token1',
            config: testCase.config,
            expiresAt: new Date(Date.now() - 1000 * 60 * 60),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(Date.now() - 1000 * 60 * 60),
          },
        ];

        (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue(
          expiredSessions
        );
        (mockPrismaClient.previewSession!.update as any).mockResolvedValue({});

        service = new CleanupService({
          prismaClient: mockPrismaClient as PrismaClient,
          dockerCleanup: mockDockerCleanup,
        });

        await service.cleanupExpiredSessions();

        expect(mockDockerCleanup).toHaveBeenCalledWith(testCase.expected);
        mockDockerCleanup.mockClear();
      }
    });
  });

  describe('runCleanup()', () => {
    it('should return cleanup result with success', async () => {
      const expiredSessions = [
        {
          id: 'session1',
          projectId: 'project1',
          userId: 'user1',
          sessionToken: 'token1',
          config: { containerId: 'container1' },
          expiresAt: new Date(Date.now() - 1000 * 60 * 60),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60),
        },
      ];

      (mockPrismaClient.previewSession!.findMany as any).mockResolvedValue(
        expiredSessions
      );
      (mockPrismaClient.previewSession!.update as any).mockResolvedValue({});

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      const result = await service.runCleanup();

      expect(result.sessionsCleanedUp).toBe(1);
      expect(result.containersStopped).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return cleanup result with errors', async () => {
      (mockPrismaClient.previewSession!.findMany as any).mockRejectedValue(
        new Error('Database error')
      );

      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      const result = await service.runCleanup();

      expect(result.sessionsCleanedUp).toBe(0);
      expect(result.containersStopped).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Database error');
    });
  });

  describe('disconnect()', () => {
    it('should stop cron and disconnect Prisma', async () => {
      service = new CleanupService({
        prismaClient: mockPrismaClient as PrismaClient,
        dockerCleanup: mockDockerCleanup,
      });

      service.start();
      await service.disconnect();

      expect(service.getStatus()).toBe(false);
      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });
  });
});
