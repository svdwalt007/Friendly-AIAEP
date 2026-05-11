import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SessionManager,
  SessionLimitError,
  SessionNotFoundError,
  SessionExpiredError,
  SessionConfig,
} from './session-manager';
import { PreviewMode } from './types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const Tier = { STARTER: 'STARTER', PROFESSIONAL: 'PROFESSIONAL', ENTERPRISE: 'ENTERPRISE' };

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let testTenantId: string;
  let testUserId: string;
  let testProjectId: string;

  beforeEach(async () => {
    sessionManager = new SessionManager();

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        subdomain: `test-${Date.now()}`,
        tier: Tier.STARTER,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
      },
    });
    testUserId = user.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        tenantId: testTenantId,
        ownerId: testUserId,
        name: 'Test Project',
      },
    });
    testProjectId = project.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.previewSession.deleteMany({
      where: {
        project: {
          tenantId: testTenantId,
        },
      },
    });
    await prisma.project.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
  });

  describe('createSession', () => {
    it('should create a new preview session', async () => {
      const session = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      expect(session).toBeDefined();
      expect(session.projectId).toBe(testProjectId);
      expect(session.userId).toBe(testUserId);
      expect(session.isActive).toBe(true);
      expect(session.sessionToken).toBeTruthy();

      const config = session.config as SessionConfig;
      expect(config.mode).toBe(PreviewMode.MOCK);
      expect(config.containerIds).toEqual(['container-1']);
      expect(config.port).toBe(3000);
      expect(config.lastActivityAt).toBeTruthy();
    });

    it('should throw error when tenant not found', async () => {
      await expect(
        sessionManager.createSession(
          testProjectId,
          'invalid-tenant',
          testUserId,
          PreviewMode.MOCK,
          ['container-1'],
          3000
        )
      ).rejects.toThrow('Tenant not found');
    });

    it('should enforce FREE tier limit (1 session)', async () => {
      // Update tenant to FREE tier
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: { tier: Tier.FREE },
      });

      // Create first session
      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      // Try to create second session - should fail
      await expect(
        sessionManager.createSession(
          testProjectId,
          testTenantId,
          testUserId,
          PreviewMode.MOCK,
          ['container-2'],
          3001
        )
      ).rejects.toThrow(SessionLimitError);
    });

    it('should enforce STARTER tier limit (3 sessions)', async () => {
      // Create 3 sessions
      for (let i = 0; i < 3; i++) {
        await sessionManager.createSession(
          testProjectId,
          testTenantId,
          testUserId,
          PreviewMode.MOCK,
          [`container-${i}`],
          3000 + i
        );
      }

      // Try to create 4th session - should fail
      await expect(
        sessionManager.createSession(
          testProjectId,
          testTenantId,
          testUserId,
          PreviewMode.MOCK,
          ['container-4'],
          3004
        )
      ).rejects.toThrow(SessionLimitError);
    });

    it('should enforce PROFESSIONAL tier limit (10 sessions)', async () => {
      // Update tenant to PROFESSIONAL tier
      await prisma.tenant.update({
        where: { id: testTenantId },
        data: { tier: Tier.PROFESSIONAL },
      });

      // Create 10 sessions
      for (let i = 0; i < 10; i++) {
        await sessionManager.createSession(
          testProjectId,
          testTenantId,
          testUserId,
          PreviewMode.MOCK,
          [`container-${i}`],
          3000 + i
        );
      }

      // Try to create 11th session - should fail
      await expect(
        sessionManager.createSession(
          testProjectId,
          testTenantId,
          testUserId,
          PreviewMode.MOCK,
          ['container-11'],
          3011
        )
      ).rejects.toThrow(SessionLimitError);
    });

    it('should generate unique session tokens', async () => {
      const session1 = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      // Expire first session to allow creating another
      await sessionManager.expireSession(session1.id);

      const session2 = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-2'],
        3001
      );

      expect(session1.sessionToken).not.toBe(session2.sessionToken);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivityAt timestamp', async () => {
      const session = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const originalConfig = session.config as SessionConfig;
      const originalActivity = new Date(originalConfig.lastActivityAt);

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      await sessionManager.updateActivity(session.id);

      const updated = await sessionManager.getSession(session.id);
      const updatedConfig = updated!.config as SessionConfig;
      const newActivity = new Date(updatedConfig.lastActivityAt);

      expect(newActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.updateActivity('invalid-session-id')
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw error for expired session', async () => {
      const session = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      await sessionManager.expireSession(session.id);

      await expect(
        sessionManager.updateActivity(session.id)
      ).rejects.toThrow(SessionExpiredError);
    });
  });

  describe('getSession', () => {
    it('should retrieve session by ID', async () => {
      const created = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const retrieved = await sessionManager.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.sessionToken).toBe(created.sessionToken);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('invalid-id');
      expect(session).toBeNull();
    });

    it('should include project and user relations', async () => {
      const created = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const retrieved = await sessionManager.getSession(created.id);

      expect(retrieved!.project).toBeDefined();
      expect(retrieved!.project.id).toBe(testProjectId);
      expect(retrieved!.user).toBeDefined();
      expect(retrieved!.user.id).toBe(testUserId);
    });
  });

  describe('getSessionByToken', () => {
    it('should retrieve session by token', async () => {
      const created = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const retrieved = await sessionManager.getSessionByToken(created.sessionToken);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return null for invalid token', async () => {
      const session = await sessionManager.getSessionByToken('invalid-token');
      expect(session).toBeNull();
    });
  });

  describe('listActiveSessions', () => {
    it('should list all active sessions for a tenant', async () => {
      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.LIVE,
        ['container-2'],
        3001
      );

      const sessions = await sessionManager.listActiveSessions(testTenantId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].isActive).toBe(true);
      expect(sessions[1].isActive).toBe(true);
    });

    it('should not include expired sessions', async () => {
      const session1 = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-2'],
        3001
      );

      await sessionManager.expireSession(session1.id);

      const sessions = await sessionManager.listActiveSessions(testTenantId);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).not.toBe(session1.id);
    });

    it('should return empty array for tenant with no sessions', async () => {
      const sessions = await sessionManager.listActiveSessions(testTenantId);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('checkConcurrencyLimit', () => {
    it('should return true when under limit', async () => {
      const canCreate = await sessionManager.checkConcurrencyLimit(
        testTenantId,
        Tier.STARTER
      );
      expect(canCreate).toBe(true);
    });

    it('should return false when at limit', async () => {
      // Create 3 sessions (STARTER limit)
      for (let i = 0; i < 3; i++) {
        await sessionManager.createSession(
          testProjectId,
          testTenantId,
          testUserId,
          PreviewMode.MOCK,
          [`container-${i}`],
          3000 + i
        );
      }

      const canCreate = await sessionManager.checkConcurrencyLimit(
        testTenantId,
        Tier.STARTER
      );
      expect(canCreate).toBe(false);
    });
  });

  describe('expireSession', () => {
    it('should mark session as inactive', async () => {
      const session = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      await sessionManager.expireSession(session.id);

      const expired = await sessionManager.getSession(session.id);
      expect(expired!.isActive).toBe(false);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.expireSession('invalid-id')
      ).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('expireInactiveSessions', () => {
    it('should expire sessions with no activity for 30+ minutes', async () => {
      const session = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      // Manually set lastActivityAt to 31 minutes ago
      const oldActivity = new Date(Date.now() - 31 * 60 * 1000);
      const config = session.config as SessionConfig;
      await prisma.previewSession.update({
        where: { id: session.id },
        data: {
          config: {
            ...config,
            lastActivityAt: oldActivity.toISOString(),
          },
        },
      });

      const expiredCount = await sessionManager.expireInactiveSessions();

      expect(expiredCount).toBe(1);

      const expired = await sessionManager.getSession(session.id);
      expect(expired!.isActive).toBe(false);
    });

    it('should not expire recently active sessions', async () => {
      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const expiredCount = await sessionManager.expireInactiveSessions();

      expect(expiredCount).toBe(0);
    });
  });

  describe('expireExpiredSessions', () => {
    it('should expire sessions past expiresAt time', async () => {
      const session = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      // Manually set expiresAt to the past
      await prisma.previewSession.update({
        where: { id: session.id },
        data: {
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const expiredCount = await sessionManager.expireExpiredSessions();

      expect(expiredCount).toBe(1);

      const expired = await sessionManager.getSession(session.id);
      expect(expired!.isActive).toBe(false);
    });

    it('should not expire sessions with future expiresAt', async () => {
      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const expiredCount = await sessionManager.expireExpiredSessions();

      expect(expiredCount).toBe(0);
    });
  });

  describe('getSessionStats', () => {
    it('should return correct session statistics', async () => {
      await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-1'],
        3000
      );

      const session2 = await sessionManager.createSession(
        testProjectId,
        testTenantId,
        testUserId,
        PreviewMode.MOCK,
        ['container-2'],
        3001
      );

      // Expire one session
      await sessionManager.expireSession(session2.id);

      const stats = await sessionManager.getSessionStats(testTenantId);

      expect(stats.active).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.tier).toBe(Tier.STARTER);
      expect(stats.limit).toBe(3);
    });

    it('should throw error for non-existent tenant', async () => {
      await expect(
        sessionManager.getSessionStats('invalid-tenant')
      ).rejects.toThrow('Tenant not found');
    });
  });
});
