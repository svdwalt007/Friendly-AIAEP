/**
 * Preview Runtime Service
 * Module Reference v2.2 Section 7.5
 *
 * Ephemeral Docker containers for preview with hot-reload support.
 * Three modes: Mock (all 3 APIs), Live (iot-api-proxy), Disconnected-sim (periodic connectivity drops)
 */

import { DockerLifecycleManager, PreviewContainerConfig } from './docker-manager';
import { SessionManager } from './session-manager';
import { CleanupService } from './cleanup-service';
import {
  PreviewMode,
  PreviewSession,
  PreviewStatus,
  PreviewSessionStatus,
  CreatePreviewSessionRequest,
  UpdatePreviewSessionRequest,
  ListPreviewSessionsResponse,
} from './types';
import { randomBytes } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { watch, FSWatcher } from 'chokidar';

/**
 * Configuration for PreviewRuntimeService
 */
export interface PreviewRuntimeConfig {
  /**
   * Docker options (for custom socket paths, etc.)
   */
  dockerOptions?: {
    socketPath?: string;
    host?: string;
    port?: number;
  };

  /**
   * Base path for generated project sources
   * Default: './dist/generated'
   */
  sourcesBasePath?: string;

  /**
   * Preview URL pattern
   * Local: http://localhost:{port}
   * Production: https://preview-{projectId}.aep.friendly-tech.com
   */
  previewUrlPattern?: 'local' | 'production';

  /**
   * Production domain for preview URLs
   * Only used when previewUrlPattern is 'production'
   */
  productionDomain?: string;

  /**
   * Cleanup interval in minutes (default: 5)
   */
  cleanupIntervalMinutes?: number;

  /**
   * Enable hot-reload file watching (default: true)
   */
  enableHotReload?: boolean;

  /**
   * Base image for preview containers (default: nginx:alpine)
   */
  baseImage?: string;

  /**
   * Mock API server image (default: node:20-alpine)
   */
  mockApiImage?: string;
}

/**
 * Preview Runtime Service
 *
 * Main service class that orchestrates preview container management,
 * session tracking, and hot-reload functionality.
 *
 * @example
 * ```typescript
 * const service = new PreviewRuntimeService({
 *   sourcesBasePath: './dist/generated',
 *   previewUrlPattern: 'local'
 * });
 *
 * await service.initialize();
 *
 * const session = await service.launchPreview({
 *   projectId: 'proj-123',
 *   tenantId: 'tenant-456',
 *   mode: PreviewMode.MOCK
 * });
 *
 * console.log(`Preview available at: ${session.previewUrl}`);
 *
 * // Later...
 * await service.stopPreview(session.sessionId);
 * await service.shutdown();
 * ```
 */
export class PreviewRuntimeService {
  private dockerManager: DockerLifecycleManager;
  private sessionManager: SessionManager;
  private cleanupService: CleanupService;
  private config: Required<PreviewRuntimeConfig>;
  private fileWatchers: Map<string, FSWatcher> = new Map();
  private initialized = false;

  constructor(config: PreviewRuntimeConfig = {}) {
    this.config = {
      dockerOptions: config.dockerOptions || {},
      sourcesBasePath: config.sourcesBasePath || './dist/generated',
      previewUrlPattern: config.previewUrlPattern || 'local',
      productionDomain: config.productionDomain || 'aep.friendly-tech.com',
      cleanupIntervalMinutes: config.cleanupIntervalMinutes || 5,
      enableHotReload: config.enableHotReload ?? true,
      baseImage: config.baseImage || 'nginx:alpine',
      mockApiImage: config.mockApiImage || 'node:20-alpine',
    };

    this.dockerManager = new DockerLifecycleManager(this.config.dockerOptions);
    this.sessionManager = new SessionManager();
    this.cleanupService = new CleanupService(
      this.dockerManager,
      this.sessionManager
    );
  }

  /**
   * Initializes the preview runtime service
   *
   * - Starts cleanup cron
   * - Verifies Docker connectivity
   * - Pulls required images
   *
   * @throws Error if initialization fails
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify Docker connectivity
      await this.dockerManager.getDockerInstance().ping();

      // Start cleanup service
      this.cleanupService.start(this.config.cleanupIntervalMinutes);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize PreviewRuntimeService: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Launches a new preview session
   *
   * Per Module Reference v2.2 Section 7.5:
   * - Creates ephemeral Docker container with generated source mounted
   * - Assigns random port (4300-4399 range)
   * - In mock mode: starts mock-api-server sidecar
   * - In live mode: configures iot-api-proxy endpoint
   * - Performs health check polling until 200
   * - Stores session in Prisma with 30-min auto-expire
   * - Enforces tier-based concurrent session limits (1/3/10)
   *
   * @param request - Session creation request
   * @returns Created preview session with URL
   * @throws Error if session limits exceeded or container creation fails
   */
  public async launchPreview(
    request: CreatePreviewSessionRequest & { tenantId: string }
  ): Promise<PreviewSession> {
    if (!this.initialized) {
      throw new Error('PreviewRuntimeService not initialized. Call initialize() first.');
    }

    const { projectId, tenantId, mode, enableHotReload } = request;

    try {
      // Generate session ID
      const sessionId = this.generateSessionId();

      // Get project source path
      const sourcePath = this.getProjectSourcePath(projectId);

      // Ensure source directory exists (create placeholder if needed)
      await this.ensureSourceDirectory(sourcePath, projectId);

      // Create preview container
      const containerConfig: PreviewContainerConfig = {
        image: this.config.baseImage,
        volumePath: sourcePath,
        mountPoint: '/usr/share/nginx/html',
        env: {
          PROJECT_ID: projectId,
          TENANT_ID: tenantId,
          PREVIEW_MODE: mode,
        },
        enableMockApi: mode === PreviewMode.MOCK,
        mockApiImage: this.config.mockApiImage,
        healthCheckPath: '/',
        healthCheckInterval: 5,
        labels: {
          'aep.session-id': sessionId,
          'aep.project-id': projectId,
          'aep.tenant-id': tenantId,
          'aep.mode': mode,
        },
      };

      const containerInfo = await this.dockerManager.createPreviewContainer(
        containerConfig
      );

      // Start container
      await this.dockerManager.startContainer(containerInfo.containerId);

      // Health check
      const healthy = await this.dockerManager.healthCheck(containerInfo.containerId, {
        maxRetries: 30,
        retryInterval: 1000,
      });

      if (!healthy) {
        // Cleanup failed container
        await this.dockerManager.stopContainer(containerInfo.containerId);
        await this.dockerManager.removeContainer(containerInfo.containerId);
        throw new Error('Container health check failed');
      }

      // Generate preview URL
      const previewUrl = this.generatePreviewUrl(projectId, containerInfo.port);

      // Create session in database
      const session = await this.sessionManager.createSession(
        projectId,
        tenantId,
        'preview-user-id', // TODO: Get from request context
        mode,
        [
          containerInfo.containerId,
          ...(containerInfo.sidecarId ? [containerInfo.sidecarId] : []),
        ],
        containerInfo.port
      );

      // Setup hot-reload if enabled
      if (this.config.enableHotReload && (enableHotReload ?? true)) {
        this.setupHotReload(sessionId, sourcePath, containerInfo.containerId);
      }

      // Map Prisma session to PreviewSession type
      const sessionConfig = session.config as unknown as {
        mode: PreviewMode;
        containerIds: string[];
        port: number;
        lastActivityAt: string;
      };

      return {
        sessionId: session.id,
        projectId: session.projectId,
        tenantId: session.tenantId,
        mode: sessionConfig.mode,
        containerIds: sessionConfig.containerIds,
        port: sessionConfig.port,
        previewUrl,
        status: session.status as PreviewSessionStatus,
        createdAt: session.createdAt,
        lastActivityAt: new Date(sessionConfig.lastActivityAt),
        expiresAt: session.expiresAt,
        error: session.error || undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to launch preview for project ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Stops a preview session
   *
   * - Stops and removes Docker container(s)
   * - Stops file watcher
   * - Marks session as stopped in database
   *
   * @param sessionId - Session to stop
   * @throws Error if session not found or stop fails
   */
  public async stopPreview(sessionId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('PreviewRuntimeService not initialized. Call initialize() first.');
    }

    try {
      // Get session
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const sessionConfig = session.config as unknown as {
        mode: PreviewMode;
        containerIds: string[];
        port: number;
        lastActivityAt: string;
      };

      // Stop file watcher
      const watcher = this.fileWatchers.get(sessionId);
      if (watcher) {
        await watcher.close();
        this.fileWatchers.delete(sessionId);
      }

      // Stop and remove containers
      for (const containerId of sessionConfig.containerIds) {
        try {
          await this.dockerManager.stopContainer(containerId);
          await this.dockerManager.removeContainer(containerId);
        } catch (error) {
          // Container might already be stopped/removed
          console.warn(`Failed to stop container ${containerId}:`, error);
        }
      }

      // Update session status
      await this.sessionManager.updateSession(sessionId, {
        status: 'stopped',
      });
    } catch (error) {
      throw new Error(
        `Failed to stop preview ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Gets the current status of a preview session
   *
   * @param sessionId - Session to query
   * @returns Current preview status
   * @throws Error if session not found
   */
  public async getPreviewStatus(sessionId: string): Promise<PreviewStatus> {
    if (!this.initialized) {
      throw new Error('PreviewRuntimeService not initialized. Call initialize() first.');
    }

    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionConfig = session.config as unknown as {
      mode: PreviewMode;
      containerIds: string[];
      port: number;
      lastActivityAt: string;
    };

    const now = Date.now();
    const expiresAt = session.expiresAt.getTime();
    const ttl = Math.max(0, Math.floor((expiresAt - now) / 1000));

    const previewUrl = this.generatePreviewUrl(session.projectId, sessionConfig.port);

    return {
      sessionId: session.id,
      status: session.status as PreviewSessionStatus,
      previewUrl: session.status === 'running' ? previewUrl : undefined,
      ttl,
      error: session.error || undefined,
      timestamp: new Date(),
    };
  }

  /**
   * Lists all active preview sessions for a tenant
   *
   * @param tenantId - Tenant to query
   * @returns List of active sessions with usage stats
   */
  public async listActiveSessions(
    tenantId: string
  ): Promise<ListPreviewSessionsResponse> {
    if (!this.initialized) {
      throw new Error('PreviewRuntimeService not initialized. Call initialize() first.');
    }

    const sessions = await this.sessionManager.listActiveSessions(tenantId);
    const sessionsToday = await this.sessionManager.countSessionsToday(tenantId);
    const limits = await this.sessionManager.getSessionLimits(tenantId);

    // Map Prisma sessions to PreviewSession type
    const mappedSessions: PreviewSession[] = sessions.map((session) => {
      const sessionConfig = session.config as unknown as {
        mode: PreviewMode;
        containerIds: string[];
        port: number;
        lastActivityAt: string;
      };

      return {
        sessionId: session.id,
        projectId: session.projectId,
        tenantId: session.tenantId,
        mode: sessionConfig.mode,
        containerIds: sessionConfig.containerIds,
        port: sessionConfig.port,
        previewUrl: this.generatePreviewUrl(session.projectId, sessionConfig.port),
        status: session.status as PreviewSessionStatus,
        createdAt: session.createdAt,
        lastActivityAt: new Date(sessionConfig.lastActivityAt),
        expiresAt: session.expiresAt,
        error: session.error || undefined,
      };
    });

    return {
      sessions: mappedSessions,
      total: sessions.length,
      usage: {
        activeSessions: sessions.length,
        maxSessions: limits.maxConcurrentSessions,
        sessionsToday,
        maxSessionsPerDay: limits.maxSessionsPerDay,
      },
    };
  }

  /**
   * Extends a preview session's expiration time
   *
   * @param request - Update request with extension time
   * @throws Error if session not found or extension exceeds tier limits
   */
  public async extendSession(request: UpdatePreviewSessionRequest): Promise<PreviewSession> {
    if (!this.initialized) {
      throw new Error('PreviewRuntimeService not initialized. Call initialize() first.');
    }

    const { sessionId, extendMinutes } = request;

    if (!extendMinutes || extendMinutes <= 0) {
      throw new Error('extendMinutes must be a positive number');
    }

    const session = await this.sessionManager.extendSession(sessionId, extendMinutes);
    const sessionConfig = session.config as unknown as {
      mode: PreviewMode;
      containerIds: string[];
      port: number;
      lastActivityAt: string;
    };

    return {
      sessionId: session.id,
      projectId: session.projectId,
      tenantId: session.tenantId,
      mode: sessionConfig.mode,
      containerIds: sessionConfig.containerIds,
      port: sessionConfig.port,
      previewUrl: this.generatePreviewUrl(session.projectId, sessionConfig.port),
      status: session.status as PreviewSessionStatus,
      createdAt: session.createdAt,
      lastActivityAt: new Date(sessionConfig.lastActivityAt),
      expiresAt: session.expiresAt,
      error: session.error || undefined,
    };
  }

  /**
   * Shuts down the preview runtime service
   *
   * - Stops cleanup cron
   * - Closes all file watchers
   * - Stops all active sessions
   */
  public async shutdown(): Promise<void> {
    // Stop cleanup service
    this.cleanupService.stop();

    // Close all file watchers
    for (const [_sessionId, watcher] of this.fileWatchers.entries()) {
      await watcher.close();
    }
    this.fileWatchers.clear();

    // Stop all active sessions (optional - can be commented out for graceful shutdown)
    // const allSessions = await this.sessionManager.listAllActiveSessions();
    // for (const session of allSessions) {
    //   await this.stopPreview(session.id);
    // }

    this.initialized = false;
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `preview-${randomBytes(16).toString('hex')}`;
  }

  /**
   * Gets the file system path for a project's generated source
   */
  private getProjectSourcePath(projectId: string): string {
    return path.join(this.config.sourcesBasePath, projectId);
  }

  /**
   * Ensures source directory exists, creates placeholder if needed (Phase 1 MVP)
   */
  private async ensureSourceDirectory(
    sourcePath: string,
    projectId: string
  ): Promise<void> {
    if (!fs.existsSync(sourcePath)) {
      fs.mkdirSync(sourcePath, { recursive: true });

      // Phase 1 MVP: Create placeholder HTML
      const placeholderHtml = this.createPlaceholderHtml(projectId);
      fs.writeFileSync(path.join(sourcePath, 'index.html'), placeholderHtml);
    }
  }

  /**
   * Creates Phase 1 MVP placeholder HTML
   *
   * Simple static page with project name and "Preview coming soon" message.
   * Full codegen integration happens in Phase 2.
   */
  private createPlaceholderHtml(projectId: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - ${projectId}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #12174C 0%, #1a1f6b 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        .container {
            text-align: center;
            max-width: 600px;
        }
        .logo {
            font-size: 3rem;
            margin-bottom: 2rem;
            color: #FF5900;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            color: #FF5900;
        }
        .project-id {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
            font-family: 'Courier New', monospace;
            background: rgba(255, 89, 0, 0.1);
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            display: inline-block;
        }
        .message {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            opacity: 0.95;
        }
        .info {
            font-size: 1rem;
            opacity: 0.8;
            line-height: 1.6;
            margin-bottom: 2rem;
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 89, 0, 0.2);
            border-top-color: #FF5900;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 2rem auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .footer {
            margin-top: 3rem;
            font-size: 0.9rem;
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀</div>
        <h1>Friendly AI AEP</h1>
        <div class="project-id">${projectId}</div>
        <div class="message">Preview Coming Soon</div>
        <div class="spinner"></div>
        <div class="info">
            Your preview environment is initializing.<br>
            Full code generation and preview features will be available in Phase 2.<br>
            <br>
            This is a Phase 1 MVP placeholder demonstrating the preview runtime infrastructure.
        </div>
        <div class="footer">
            Powered by Friendly Technologies | Module Reference v2.2 Section 7.5
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generates preview URL based on configuration
   */
  private generatePreviewUrl(projectId: string, port: number): string {
    if (this.config.previewUrlPattern === 'production') {
      return `https://preview-${projectId}.${this.config.productionDomain}`;
    }
    return `http://localhost:${port}`;
  }

  /**
   * Sets up hot-reload file watching for a session
   *
   * Phase 1 stub: Watches for file changes and triggers container restart.
   * Phase 2 will add incremental Angular rebuild.
   */
  private setupHotReload(
    sessionId: string,
    sourcePath: string,
    containerId: string
  ): void {
    const watcher = watch(sourcePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    watcher.on('change', async (filePath: string) => {
      console.log(`[Hot-reload] File changed: ${filePath}`);

      try {
        // Phase 1: Simple container restart
        await this.dockerManager.restartContainer(containerId);

        // Update last activity
        await this.sessionManager.updateLastActivity(sessionId);

        console.log(`[Hot-reload] Container ${containerId} restarted`);
      } catch (error) {
        console.error(`[Hot-reload] Failed to restart container:`, error);
      }
    });

    this.fileWatchers.set(sessionId, watcher);
  }
}

/**
 * Creates a new PreviewRuntimeService instance
 *
 * @param config - Service configuration
 * @returns PreviewRuntimeService instance
 */
export function createPreviewRuntimeService(
  config?: PreviewRuntimeConfig
): PreviewRuntimeService {
  return new PreviewRuntimeService(config);
}
