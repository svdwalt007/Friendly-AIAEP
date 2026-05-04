import * as cron from 'node-cron';
import { DockerLifecycleManager } from './docker-manager';
import { SessionManager } from './session-manager';

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
   * Custom logger function
   */
  logger?: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: Error, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
  };
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
  private dockerManager: DockerLifecycleManager;
  private sessionManager: SessionManager;
  private config: Required<CleanupServiceConfig>;

  constructor(
    dockerManager: DockerLifecycleManager,
    sessionManager: SessionManager,
    config: CleanupServiceConfig = {}
  ) {
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

    this.dockerManager = dockerManager;
    this.sessionManager = sessionManager;
    this.config = {
      cronSchedule: config.cronSchedule || '*/5 * * * *',
      sessionTimeoutMinutes: config.sessionTimeoutMinutes || 30,
      enabled: config.enabled !== false,
      logger: config.logger || defaultLogger,
    };
  }

  /**
   * Cleanup Docker containers using the DockerLifecycleManager
   */
  private async cleanupContainer(containerId: string): Promise<void> {
    try {
      // Try to stop the container
      try {
        await this.dockerManager.stopContainer(containerId);
        this.config.logger.info(`Stopped container: ${containerId}`);
      } catch (error) {
        // Container might already be stopped
        this.config.logger.warn(`Failed to stop container: ${containerId}`, { error });
      }

      // Try to remove the container
      try {
        await this.dockerManager.removeContainer(containerId, true);
        this.config.logger.info(`Removed container: ${containerId}`);
      } catch (error) {
        // Container might already be removed
        this.config.logger.warn(`Failed to remove container: ${containerId}`, { error });
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
   * @param intervalMinutes - Optional interval in minutes (overrides config)
   * @throws {Error} If the service is already running
   */
  start(intervalMinutes?: number): void {
    if (this.cronTask) {
      throw new Error('CleanupService is already running');
    }

    if (!this.config.enabled) {
      this.config.logger.warn('CleanupService is disabled, not starting');
      return;
    }

    // Use provided interval or default from config
    const cronSchedule = intervalMinutes
      ? `*/${intervalMinutes} * * * *`
      : this.config.cronSchedule;

    this.config.logger.info('Starting CleanupService', {
      schedule: cronSchedule,
      timeoutMinutes: this.config.sessionTimeoutMinutes,
    });

    this.cronTask = cron.schedule(cronSchedule, async () => {
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
      const result = await this.cleanupExpiredSessions();
      const duration = Date.now() - startTime;

      this.config.logger.info('Cleanup run completed', {
        sessionsCleanedUp: result.sessionsCleanedUp,
        containersStopped: result.containersStopped,
        errors: result.errors.length,
        durationMs: duration,
      });

      return result;
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
   * 1. Finds sessions where expiresAt < now
   * 2. Extracts container IDs from session config
   * 3. Stops and removes Docker containers
   * 4. Updates session status to stopped in database
   * 5. Logs all actions and handles errors gracefully
   *
   * @returns Cleanup result with counts and errors
   */
  async cleanupExpiredSessions(): Promise<CleanupResult> {
    const now = new Date();

    this.config.logger.info('Searching for expired sessions', {
      now: now.toISOString(),
    });

    // Find expired sessions using the session manager
    const expiredSessions = await this.sessionManager.listExpiredSessions();

    if (expiredSessions.length === 0) {
      this.config.logger.info('No expired sessions found');
      return {
        sessionsCleanedUp: 0,
        containersStopped: 0,
        errors: [],
        timestamp: new Date(),
      };
    }

    this.config.logger.info(`Found ${expiredSessions.length} expired session(s)`);

    let cleanedUpCount = 0;
    let containersStopped = 0;
    const errors: Array<{ sessionId: string; error: string }> = [];

    // Process each expired session
    for (const session of expiredSessions) {
      try {
        this.config.logger.info(`Processing session: ${session.id}`, {
          projectId: session.projectId,
          tenantId: session.tenantId,
          expiresAt: session.expiresAt.toISOString(),
        });

        // Extract container IDs from config
        const sessionConfig = session.config as unknown as {
          containerIds?: string[];
          mode?: string;
          port?: number;
        };

        const containerIds = sessionConfig.containerIds || [];

        if (containerIds.length > 0) {
          // Cleanup Docker containers
          for (const containerId of containerIds) {
            try {
              await this.cleanupContainer(containerId);
              containersStopped++;
              this.config.logger.info(`Cleaned up container for session: ${session.id}`, {
                containerId,
              });
            } catch (dockerError) {
              // Log error but continue with next container
              this.config.logger.error(
                `Failed to cleanup container for session: ${session.id}`,
                dockerError as Error,
                { containerId }
              );
              errors.push({
                sessionId: session.id,
                error: `Docker cleanup failed for ${containerId}: ${(dockerError as Error).message}`,
              });
            }
          }
        } else {
          this.config.logger.warn(`No container IDs found for session: ${session.id}`);
        }

        // Update session status to stopped
        await this.sessionManager.updateSession(session.id, {
          status: 'stopped',
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
      containersStopped,
      errors: errors.length,
    });

    return {
      sessionsCleanedUp: cleanedUpCount,
      containersStopped,
      errors,
      timestamp: new Date(),
    };
  }

}
