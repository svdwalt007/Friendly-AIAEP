import { PrismaClient, Prisma, Tier, PreviewSession } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PreviewMode } from './types';

const prisma = new PrismaClient();

/**
 * Session configuration stored in the PreviewSession.config JSON field
 */
export interface SessionConfig {
  mode: PreviewMode;
  containerIds: string[];
  port: number;
  lastActivityAt: string; // ISO timestamp
}

/**
 * Tier-based concurrent session limits
 */
const TIER_SESSION_LIMITS: Record<Tier, number> = {
  [Tier.FREE]: 1,
  [Tier.STARTER]: 3,
  [Tier.PROFESSIONAL]: 10,
  [Tier.ENTERPRISE]: 50, // Higher limit for enterprise
};

/**
 * Session inactivity timeout in milliseconds (30 minutes)
 */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Session expiration time in milliseconds (24 hours from creation)
 */
const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Error thrown when session limits are exceeded
 */
export class SessionLimitError extends Error {
  constructor(message: string, public readonly tier: Tier, public readonly limit: number) {
    super(message);
    this.name = 'SessionLimitError';
  }
}

/**
 * Error thrown when session is not found
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Error thrown when session has expired
 */
export class SessionExpiredError extends Error {
  constructor(sessionId: string) {
    super(`Session expired: ${sessionId}`);
    this.name = 'SessionExpiredError';
  }
}

/**
 * SessionManager handles preview session lifecycle management.
 *
 * Features:
 * - Creates and tracks preview sessions in Prisma database
 * - Enforces tier-based concurrent session limits
 * - Tracks session activity and auto-expires inactive sessions
 * - Provides session status and listing capabilities
 *
 * @example
 * ```typescript
 * const sessionManager = new SessionManager();
 *
 * // Create a new session
 * const session = await sessionManager.createSession(
 *   'project-123',
 *   'tenant-456',
 *   'user-789',
 *   PreviewMode.DEVELOPMENT,
 *   ['container-1', 'container-2'],
 *   3000
 * );
 *
 * // Update activity
 * await sessionManager.updateActivity(session.id);
 *
 * // Get session
 * const retrieved = await sessionManager.getSession(session.id);
 *
 * // List active sessions
 * const sessions = await sessionManager.listActiveSessions('tenant-456');
 *
 * // Expire session
 * await sessionManager.expireSession(session.id);
 * ```
 */
export class SessionManager {
  /**
   * Creates a new preview session.
   *
   * @param projectId - The project identifier
   * @param tenantId - The tenant identifier (for limit checking)
   * @param userId - The user identifier
   * @param mode - The preview mode (DEVELOPMENT, STAGING, PRODUCTION)
   * @param containerIds - Array of container identifiers
   * @param port - The port number for the preview
   * @returns Promise resolving to the created PreviewSession
   * @throws {SessionLimitError} When tenant has reached concurrent session limit
   *
   * @example
   * ```typescript
   * const session = await sessionManager.createSession(
   *   'project-123',
   *   'tenant-456',
   *   'user-789',
   *   PreviewMode.DEVELOPMENT,
   *   ['container-abc'],
   *   3000
   * );
   * ```
   */
  async createSession(
    projectId: string,
    tenantId: string,
    userId: string,
    mode: PreviewMode,
    containerIds: string[],
    port: number
  ): Promise<PreviewSession> {
    // Get tenant to check tier
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Check if tenant has reached concurrent session limit
    const canCreate = await this.checkConcurrencyLimit(tenantId, tenant.tier);
    if (!canCreate) {
      const limit = TIER_SESSION_LIMITS[tenant.tier];
      throw new SessionLimitError(
        `Concurrent session limit reached for ${tenant.tier} tier (${limit} sessions)`,
        tenant.tier,
        limit
      );
    }

    // Generate unique session token
    const sessionToken = this.generateSessionToken();

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);

    // Create session config
    const config: SessionConfig = {
      mode,
      containerIds,
      port,
      lastActivityAt: new Date().toISOString(),
    };

    // Create the session
    const session = await prisma.previewSession.create({
      data: {
        projectId,
        userId,
        sessionToken,
        config: config as unknown as Prisma.InputJsonValue,
        expiresAt,
        isActive: true,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return session;
  }

  /**
   * Updates the last activity timestamp for a session.
   *
   * @param sessionId - The session identifier
   * @throws {SessionNotFoundError} When session doesn't exist
   * @throws {SessionExpiredError} When session has expired
   *
   * @example
   * ```typescript
   * await sessionManager.updateActivity('session-123');
   * ```
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = await prisma.previewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (!session.isActive || new Date() > session.expiresAt) {
      throw new SessionExpiredError(sessionId);
    }

    // Update lastActivityAt in config
    const config = session.config as SessionConfig;
    const updatedConfig: SessionConfig = {
      ...config,
      lastActivityAt: new Date().toISOString(),
    };

    await prisma.previewSession.update({
      where: { id: sessionId },
      data: {
        config: updatedConfig as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Retrieves a session by ID.
   *
   * @param sessionId - The session identifier
   * @returns Promise resolving to the PreviewSession or null if not found
   *
   * @example
   * ```typescript
   * const session = await sessionManager.getSession('session-123');
   * if (session) {
   *   console.log('Session found:', session.sessionToken);
   * }
   * ```
   */
  async getSession(sessionId: string): Promise<PreviewSession | null> {
    const session = await prisma.previewSession.findUnique({
      where: { id: sessionId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return session;
  }

  /**
   * Retrieves a session by session token.
   *
   * @param sessionToken - The session token
   * @returns Promise resolving to the PreviewSession or null if not found
   *
   * @example
   * ```typescript
   * const session = await sessionManager.getSessionByToken('abc123token');
   * ```
   */
  async getSessionByToken(sessionToken: string): Promise<PreviewSession | null> {
    const session = await prisma.previewSession.findUnique({
      where: { sessionToken },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return session;
  }

  /**
   * Lists all active sessions for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to array of active PreviewSessions
   *
   * @example
   * ```typescript
   * const sessions = await sessionManager.listActiveSessions('tenant-123');
   * console.log(`Found ${sessions.length} active sessions`);
   * ```
   */
  async listActiveSessions(tenantId: string): Promise<PreviewSession[]> {
    const sessions = await prisma.previewSession.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: new Date(),
        },
        project: {
          tenantId,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions;
  }

  /**
   * Checks if a tenant can create a new session based on their tier limit.
   *
   * @param tenantId - The tenant identifier
   * @param tier - The tenant's tier
   * @returns Promise resolving to true if session can be created, false otherwise
   *
   * @example
   * ```typescript
   * const canCreate = await sessionManager.checkConcurrencyLimit('tenant-123', Tier.STARTER);
   * if (canCreate) {
   *   // Create session
   * }
   * ```
   */
  async checkConcurrencyLimit(tenantId: string, tier: Tier): Promise<boolean> {
    const limit = TIER_SESSION_LIMITS[tier];

    const activeSessions = await this.listActiveSessions(tenantId);

    return activeSessions.length < limit;
  }

  /**
   * Expires a session (marks it as inactive).
   *
   * @param sessionId - The session identifier
   * @throws {SessionNotFoundError} When session doesn't exist
   *
   * @example
   * ```typescript
   * await sessionManager.expireSession('session-123');
   * ```
   */
  async expireSession(sessionId: string): Promise<void> {
    const session = await prisma.previewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    await prisma.previewSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Expires all inactive sessions (no activity for 30+ minutes).
   * This should be run periodically via a background job.
   *
   * @returns Promise resolving to the number of sessions expired
   *
   * @example
   * ```typescript
   * const expired = await sessionManager.expireInactiveSessions();
   * console.log(`Expired ${expired} inactive sessions`);
   * ```
   */
  async expireInactiveSessions(): Promise<number> {
    const now = new Date();
    const inactivityThreshold = new Date(now.getTime() - SESSION_TIMEOUT_MS);

    // Find all active sessions
    const activeSessions = await prisma.previewSession.findMany({
      where: {
        isActive: true,
      },
    });

    // Filter sessions with lastActivityAt older than threshold
    const sessionsToExpire = activeSessions.filter((session) => {
      const config = session.config as SessionConfig;
      const lastActivity = new Date(config.lastActivityAt);
      return lastActivity < inactivityThreshold;
    });

    // Expire the sessions
    if (sessionsToExpire.length > 0) {
      await prisma.previewSession.updateMany({
        where: {
          id: {
            in: sessionsToExpire.map((s) => s.id),
          },
        },
        data: {
          isActive: false,
          updatedAt: now,
        },
      });
    }

    return sessionsToExpire.length;
  }

  /**
   * Expires all sessions that have passed their expiration time.
   * This should be run periodically via a background job.
   *
   * @returns Promise resolving to the number of sessions expired
   *
   * @example
   * ```typescript
   * const expired = await sessionManager.expireExpiredSessions();
   * console.log(`Expired ${expired} sessions`);
   * ```
   */
  async expireExpiredSessions(): Promise<number> {
    const result = await prisma.previewSession.updateMany({
      where: {
        isActive: true,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Lists all expired sessions (sessions past their expiration time)
   *
   * @returns Promise resolving to array of expired sessions
   *
   * @example
   * ```typescript
   * const expired = await sessionManager.listExpiredSessions();
   * console.log(`Found ${expired.length} expired sessions`);
   * ```
   */
  async listExpiredSessions(): Promise<PreviewSession[]> {
    const sessions = await prisma.previewSession.findMany({
      where: {
        status: 'running',
        expiresAt: {
          lt: new Date(),
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    return sessions;
  }

  /**
   * Gets session statistics for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to session statistics
   *
   * @example
   * ```typescript
   * const stats = await sessionManager.getSessionStats('tenant-123');
   * console.log(`Active: ${stats.active}, Total: ${stats.total}`);
   * ```
   */
  async getSessionStats(tenantId: string): Promise<{
    active: number;
    total: number;
    tier: Tier;
    limit: number;
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const [activeSessions, totalSessions] = await Promise.all([
      prisma.previewSession.count({
        where: {
          isActive: true,
          expiresAt: {
            gte: new Date(),
          },
          project: {
            tenantId,
          },
        },
      }),
      prisma.previewSession.count({
        where: {
          project: {
            tenantId,
          },
        },
      }),
    ]);

    return {
      active: activeSessions,
      total: totalSessions,
      tier: tenant.tier,
      limit: TIER_SESSION_LIMITS[tenant.tier],
    };
  }

  /**
   * Generates a cryptographically secure session token.
   *
   * @returns A random session token
   * @private
   */
  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Get tenant tier from database
   *
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to the tenant tier
   */
  async getTenantTier(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true }
    });
    return tenant?.tier || 'FREE';
  }

  /**
   * Count sessions created today for a tenant
   *
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to the count of sessions created today
   */
  async countSessionsToday(tenantId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.previewSession.count({
      where: {
        project: {
          tenantId
        },
        createdAt: { gte: startOfDay }
      }
    });
  }

  /**
   * Get session limits based on tenant tier
   *
   * @param tenantId - The tenant identifier
   * @returns Promise resolving to session limits
   */
  async getSessionLimits(tenantId: string): Promise<{
    maxConcurrentSessions: number;
    maxSessionsPerDay: number;
    maxDurationMinutes: number;
  }> {
    const tier = await this.getTenantTier(tenantId);
    const tierLimits: Record<string, any> = {
      FREE: { maxConcurrentSessions: 1, maxSessionsPerDay: 10, maxDurationMinutes: 30 },
      STARTER: { maxConcurrentSessions: 3, maxSessionsPerDay: Infinity, maxDurationMinutes: 120 },
      PROFESSIONAL: { maxConcurrentSessions: 10, maxSessionsPerDay: Infinity, maxDurationMinutes: 240 },
      ENTERPRISE: { maxConcurrentSessions: 50, maxSessionsPerDay: Infinity, maxDurationMinutes: 480 }
    };

    const limits = tierLimits[tier] || tierLimits.FREE;
    return {
      maxConcurrentSessions: limits.maxConcurrentSessions,
      maxSessionsPerDay: limits.maxSessionsPerDay,
      maxDurationMinutes: limits.maxDurationMinutes
    };
  }

  /**
   * Update session with partial data
   *
   * @param sessionId - The session identifier
   * @param data - Partial session data to update
   * @returns Promise resolving to the updated session
   */
  async updateSession(sessionId: string, data: {
    status?: string;
    error?: string;
    config?: any;
  }): Promise<PreviewSession> {
    return prisma.previewSession.update({
      where: { id: sessionId },
      data: {
        config: data.config ? (data.config as unknown as Prisma.InputJsonValue) : undefined,
        updatedAt: new Date()
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Update last activity timestamp
   *
   * @param sessionId - The session identifier
   */
  async updateLastActivity(sessionId: string): Promise<void> {
    const session = await prisma.previewSession.findUnique({
      where: { id: sessionId }
    });

    if (session) {
      const config = session.config as any;
      config.lastActivityAt = new Date().toISOString();

      await prisma.previewSession.update({
        where: { id: sessionId },
        data: {
          config: config as unknown as Prisma.InputJsonValue,
          updatedAt: new Date()
        }
      });
    }
  }

  /**
   * Extend session expiration time
   *
   * @param sessionId - The session identifier
   * @param extendMinutes - Number of minutes to extend
   * @returns Promise resolving to the updated session
   */
  async extendSession(sessionId: string, extendMinutes: number): Promise<PreviewSession> {
    const session = await prisma.previewSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const newExpiresAt = new Date(session.expiresAt.getTime() + extendMinutes * 60 * 1000);

    return prisma.previewSession.update({
      where: { id: sessionId },
      data: { expiresAt: newExpiresAt },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            tenantId: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }
}

/**
 * Default singleton instance of SessionManager
 */
export const sessionManager = new SessionManager();
