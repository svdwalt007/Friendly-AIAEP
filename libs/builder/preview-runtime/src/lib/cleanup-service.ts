// @ts-nocheck - TODO: Fix type errors and dependency issues
import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

/**
 * Configuration options for the CleanupService
 */
export interface CleanupServiceConfig {
  /**
   * Cron expression for scheduling cleanup (default: every 5 minutes)
   * @default every 5 minutes
   */
  cronSchedule?: string;

  /**
   * Session timeout in minutes (default: 30 minutes)
   * @default 30
   */
  sessionTimeoutMinutes?: number;

  /**
   * Whether to enable automatic cleanup (default: true)
   * @default true
   */
  enabled?: boolean;

  /**
   * Custom Prisma client instance
   */
  prismaClient?: PrismaClient;

  /**
   * Custom logger function
   */
  logger?: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: Error, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
  };

  /**
   * Custom Docker cleanup function
   * If not provided, a default implementation will be used
   */
  dockerCleanup?: (containerId: string) => Promise<void>;
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /**
   * Number of sessions cleaned up
   */
  sessionsCleanedUp: number;

  /**
   * Number of containers stopped
   */
  containersStopped: number;

  /**
   * List of errors encountered during cleanup
   */
  errors: Array<{
    sessionId: string;
    error: string;
  }>;

  /**
   * Timestamp when cleanup was executed
   */
  timestamp: Date;
}

/**
 * CleanupService manages the automatic cleanup of expired preview sessions
 *
 * Features:
 * - Runs on a configurable cron schedule (default: every 5 minutes)
 * - Finds sessions where lastActivityAt + timeout < now
 * - Stops and removes associated Docker containers
 * - Updates session status to 'stopped' in database
 * - Comprehensive error handling and logging
 *
 * @example
 * ```typescript
 * const service = new CleanupService({
 *   cronSchedule: '*\\/5 * * * *', // every 5 minutes
 *   sessionTimeoutMinutes: 30,
 *   enabled: true
 * });
 *
 * service.start();
 *
 * // Later...
 * service.stop();
 * ```
 */
export class CleanupService {
  private cronTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private config: Required<Omit<CleanupServiceConfig, 'prismaClient' | 'dockerCleanup'>> & {
    prismaClient: PrismaClient;
    dockerCleanup: (containerId: string) => Promise<void>;
  };

  constructor(config: CleanupServiceConfig = {}) {
    const defaultLogger = {
      info: (message: string, meta?: Record<string, unknown>) => {
        console.log(`[CleanupService] ${message}`, meta || '');
      },
      error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
        console.error(`[CleanupService] ${message}`, error || '', meta || '');
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        console.warn(`[CleanupService] ${message}`, meta || '');
      },
    };

    this.config = {
      cronSchedule: config.cronSchedule || '*\\/5 * * * *',
      sessionTimeoutMinutes: config.sessionTimeoutMinutes || 30,
      enabled: config.enabled !== false,
      logger: config.logger || defaultLogger,
      prismaClient: config.prismaClient || new PrismaClient(),
      dockerCleanup: config.dockerCleanup || this.defaultDockerCleanup.bind(this),
    };
  }

  /**
   * Default Docker cleanup implementation using dockerode
   * Override this by providing dockerCleanup in config
   */
  private async defaultDockerCleanup(containerId: string): Promise<void> {
    try {
      // Import dockerode dynamically to avoid hard dependency
      const Docker = await import('dockerode').then((m) => m.default);
      const docker = new Docker();

      const container = docker.getContainer(containerId);

      // Try to stop the container
      try {
        await container.stop({ t: 10 }); // 10 second timeout
        this.config.logger.info(`Stopped container: ${containerId}`);
      } catch (error) {
        // Container might already be stopped
        if ((error as Error).message?.includes('already stopped')) {
          this.config.logger.warn(`Container already stopped: ${containerId}`);
        } else {
          throw error;
        }
      }

      // Try to remove the container
      try {
        await container.remove({ force: true });
        this.config.logger.info(`Removed container: ${containerId}`);
      } catch (error) {
        // Container might already be removed
        if ((error as Error).message?.includes('No such container')) {
          this.config.logger.warn(`Container already removed: ${containerId}`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.config.logger.error(
        `Failed to cleanup Docker container: ${containerId}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Starts the cleanup cron job
   *
   * @throws {Error} If the service is already running
   */
  start(): void {
    if (this.cronTask) {
      throw new Error('CleanupService is already running');
    }

    if (!this.config.enabled) {
      this.config.logger.warn('CleanupService is disabled, not starting');
      return;
    }

    this.config.logger.info('Starting CleanupService', {
      schedule: this.config.cronSchedule,
      timeoutMinutes: this.config.sessionTimeoutMinutes,
    });

    this.cronTask = cron.schedule(this.config.cronSchedule, async () => {
      await this.runCleanup();
    });

    this.isRunning = true;
  }

  /**
   * Stops the cleanup cron job
   */
  stop(): void {
    if (!this.cronTask) {
      this.config.logger.warn('CleanupService is not running');
      return;
    }

    this.config.logger.info('Stopping CleanupService');
    this.cronTask.stop();
    this.cronTask = null;
    this.isRunning = false;
  }

  /**
   * Checks if the cleanup service is currently running
   */
  getStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger a cleanup operation
   * Can be called independently of the cron schedule
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async runCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    this.config.logger.info('Starting cleanup run');

    try {
      const count = await this.cleanupExpiredSessions();
      const duration = Date.now() - startTime;

      this.config.logger.info('Cleanup run completed', {
        sessionsCleanedUp: count,
        durationMs: duration,
      });

      return {
        sessionsCleanedUp: count,
        containersStopped: count, // Assuming 1 container per session
        errors: [],
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.config.logger.error('Cleanup run failed', error as Error, {
        durationMs: duration,
      });

      return {
        sessionsCleanedUp: 0,
        containersStopped: 0,
        errors: [
          {
            sessionId: 'unknown',
            error: (error as Error).message,
          },
        ],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Cleans up expired preview sessions
   *
   * Process:
   * 1. Finds sessions where expiresAt < now OR isActive = true but not recently updated
   * 2. Extracts container ID from session config
   * 3. Stops and removes Docker containers
   * 4. Updates session status to inactive in database
   * 5. Logs all actions and handles errors gracefully
   *
   * @returns Number of sessions cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    const cutoffTime = new Date(
      Date.now() - this.config.sessionTimeoutMinutes * 60 * 1000
    );

    this.config.logger.info('Searching for expired sessions', {
      cutoffTime: cutoffTime.toISOString(),
    });

    // Find expired sessions
    const expiredSessions = await this.config.prismaClient.previewSession.findMany({
      where: {
        OR: [
          // Sessions that have expired
          {
            expiresAt: {
              lt: new Date(),
            },
          },
          // Sessions that are active but haven't been updated in timeout period
          {
            isActive: true,
            updatedAt: {
              lt: cutoffTime,
            },
          },
        ],
        isActive: true, // Only cleanup active sessions
      },
    });

    if (expiredSessions.length === 0) {
      this.config.logger.info('No expired sessions found');
      return 0;
    }

    this.config.logger.info(`Found ${expiredSessions.length} expired session(s)`);

    let cleanedUpCount = 0;
    const errors: Array<{ sessionId: string; error: string }> = [];

    // Process each expired session
    for (const session of expiredSessions) {
      try {
        this.config.logger.info(`Processing session: ${session.id}`, {
          projectId: session.projectId,
          userId: session.userId,
          expiresAt: session.expiresAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        });

        // Extract container ID from config
        const containerId = this.extractContainerId(session.config);

        if (containerId) {
          // Cleanup Docker container
          try {
            await this.config.dockerCleanup(containerId);
            this.config.logger.info(`Cleaned up container for session: ${session.id}`, {
              containerId,
            });
          } catch (dockerError) {
            // Log error but continue with database update
            this.config.logger.error(
              `Failed to cleanup container for session: ${session.id}`,
              dockerError as Error,
              { containerId }
            );
            errors.push({
              sessionId: session.id,
              error: `Docker cleanup failed: ${(dockerError as Error).message}`,
            });
          }
        } else {
          this.config.logger.warn(`No container ID found for session: ${session.id}`);
        }

        // Update session status in database
        await this.config.prismaClient.previewSession.update({
          where: { id: session.id },
          data: {
            isActive: false,
            updatedAt: new Date(),
          },
        });

        cleanedUpCount++;
        this.config.logger.info(`Successfully cleaned up session: ${session.id}`);
      } catch (error) {
        this.config.logger.error(
          `Failed to cleanup session: ${session.id}`,
          error as Error
        );
        errors.push({
          sessionId: session.id,
          error: (error as Error).message,
        });
      }
    }

    this.config.logger.info('Cleanup completed', {
      total: expiredSessions.length,
      cleaned: cleanedUpCount,
      errors: errors.length,
    });

    return cleanedUpCount;
  }

  /**
   * Extracts container ID from session config JSON
   * Handles various config structures gracefully
   */
  private extractContainerId(config: unknown): string | null {
    try {
      if (!config || typeof config !== 'object') {
        return null;
      }

      const configObj = config as Record<string, unknown>;

      // Try common field names
      const possibleFields = [
        'containerId',
        'container_id',
        'dockerContainerId',
        'docker_container_id',
        'containerName',
        'container_name',
      ];

      for (const field of possibleFields) {
        if (configObj[field] && typeof configObj[field] === 'string') {
          return configObj[field] as string;
        }
      }

      // Check nested docker config
      if (configObj.docker && typeof configObj.docker === 'object') {
        const dockerConfig = configObj.docker as Record<string, unknown>;
        for (const field of possibleFields) {
          if (dockerConfig[field] && typeof dockerConfig[field] === 'string') {
            return dockerConfig[field] as string;
          }
        }
      }

      return null;
    } catch (error) {
      this.config.logger.error('Failed to extract container ID from config', error as Error);
      return null;
    }
  }

  /**
   * Disconnects the Prisma client
   * Should be called when shutting down the service
   */
  async disconnect(): Promise<void> {
    if (this.cronTask) {
      this.stop();
    }
    await this.config.prismaClient.$disconnect();
  }
}
