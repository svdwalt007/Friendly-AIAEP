/**
 * Preview Runtime Types
 * Module Reference v2.2 Section 7.5
 *
 * Ephemeral Docker containers for preview with three modes:
 * Mock (all 3 APIs), Live (iot-api-proxy), Disconnected-sim (periodic connectivity drops)
 */

/**
 * Preview mode determines how the preview session connects to Friendly APIs
 */
export enum PreviewMode {
  /**
   * Mock mode - uses mock-api-server for all three Friendly APIs
   * Ideal for development and testing without live API credentials
   */
  MOCK = 'mock',

  /**
   * Live mode - connects through iot-api-proxy to real Friendly APIs
   * Requires valid credentials for Northbound, Events, and QoE APIs
   */
  LIVE = 'live',

  /**
   * Disconnected simulation mode - periodic connectivity drops to test grace periods
   * Simulates real-world network interruptions and tests offline caching
   */
  DISCONNECTED_SIM = 'disconnected-sim',
}

/**
 * Preview session status lifecycle
 */
export type PreviewSessionStatus =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * Complete preview session metadata and runtime state
 * Tracks ephemeral Docker containers with 30-min auto-destroy
 */
export interface PreviewSession {
  /** Unique session identifier */
  sessionId: string;

  /** Associated project from project-registry */
  projectId: string;

  /** Tenant scope for multi-tenant SaaS or dedicated mode */
  tenantId: string;

  /** Preview mode determining API connectivity */
  mode: PreviewMode;

  /**
   * Docker container IDs for this preview session
   * Includes main container + sidecar containers (nginx, mock servers, etc.)
   */
  containerIds: string[];

  /** Exposed port for preview access (auto-assigned) */
  port: number;

  /**
   * Preview URL following pattern: preview-{projectId}.aep.friendly-tech.com
   * In local development: localhost:{port}
   */
  previewUrl: string;

  /** Current runtime status */
  status: PreviewSessionStatus;

  /** Session creation timestamp */
  createdAt: Date;

  /** Last activity timestamp for auto-destroy calculation */
  lastActivityAt: Date;

  /**
   * Session expiration timestamp (default 30 minutes from creation)
   * Auto-destroy triggers cleanup of Docker containers
   */
  expiresAt: Date;

  /** Optional error message if status is 'error' */
  error?: string;

  /** WebSocket connection ID for hot-reload */
  wsConnectionId?: string;
}

/**
 * Preview status response for client polling or real-time updates
 */
export interface PreviewStatus {
  /** Session identifier */
  sessionId: string;

  /** Current status */
  status: PreviewSessionStatus;

  /** Preview URL if running */
  previewUrl?: string;

  /** Time remaining before auto-destroy (in seconds) */
  ttl?: number;

  /** Build/deployment logs for debugging */
  logs?: string[];

  /** Error details if status is 'error' */
  error?: string;

  /** Timestamp of this status snapshot */
  timestamp: Date;
}

/**
 * Docker container configuration for preview deployment
 * Supports nginx:alpine + Angular CLI dev server
 */
export interface ContainerConfig {
  /** Container image (e.g., 'nginx:alpine', 'node:20-alpine') */
  image: string;

  /** Container name prefix */
  name: string;

  /** Port mappings: { [containerPort]: hostPort } */
  ports: Record<number, number>;

  /** Environment variables */
  env: Record<string, string>;

  /** Volume mounts: { [hostPath]: containerPath } */
  volumes?: Record<string, string>;

  /** Network mode (default: 'bridge') */
  network?: string;

  /** Command to run in container */
  command?: string[];

  /** Working directory */
  workingDir?: string;

  /** Auto-remove on stop */
  autoRemove?: boolean;

  /** Resource limits */
  resources?: {
    /** Memory limit in MB */
    memoryMB?: number;
    /** CPU shares (relative weight) */
    cpuShares?: number;
  };
}

/**
 * Session limits by license tier
 * Module Reference v2.2 Section 12.1
 */
export interface SessionLimits {
  /**
   * Maximum concurrent preview sessions
   * Starter: 1, Pro: 3, Enterprise: 10
   */
  maxConcurrentSessions: number;

  /**
   * Maximum session duration in minutes
   * Default: 30 minutes for all tiers
   */
  maxDurationMinutes: number;

  /**
   * Maximum preview sessions per day
   * Starter: 10, Pro: 100, Enterprise: unlimited (0 = unlimited)
   */
  maxSessionsPerDay: number;

  /**
   * Hot-reload enabled
   * All tiers: true
   */
  hotReloadEnabled: boolean;

  /**
   * Disconnected simulation mode enabled
   * Starter: false, Pro: true, Enterprise: true
   */
  disconnectedSimEnabled: boolean;
}

/**
 * Predefined session limits by tier
 */
export const SESSION_LIMITS_BY_TIER: Record<
  'starter' | 'pro' | 'enterprise',
  SessionLimits
> = {
  starter: {
    maxConcurrentSessions: 1,
    maxDurationMinutes: 30,
    maxSessionsPerDay: 10,
    hotReloadEnabled: true,
    disconnectedSimEnabled: false,
  },
  pro: {
    maxConcurrentSessions: 3,
    maxDurationMinutes: 30,
    maxSessionsPerDay: 100,
    hotReloadEnabled: true,
    disconnectedSimEnabled: true,
  },
  enterprise: {
    maxConcurrentSessions: 10,
    maxDurationMinutes: 30,
    maxSessionsPerDay: 0, // unlimited
    hotReloadEnabled: true,
    disconnectedSimEnabled: true,
  },
};

/**
 * Preview session creation request
 */
export interface CreatePreviewSessionRequest {
  /** Project to preview */
  projectId: string;

  /** Preview mode */
  mode: PreviewMode;

  /** Optional session duration override (in minutes, max per tier limits) */
  durationMinutes?: number;

  /** Enable hot-reload WebSocket (default: true) */
  enableHotReload?: boolean;

  /**
   * Disconnected simulation settings (only for DISCONNECTED_SIM mode)
   */
  disconnectedSimConfig?: {
    /** Interval between connectivity drops (in seconds, default: 300) */
    dropIntervalSeconds?: number;
    /** Duration of each drop (in seconds, default: 30) */
    dropDurationSeconds?: number;
    /** Probability of drop occurring (0-1, default: 0.5) */
    dropProbability?: number;
  };
}

/**
 * Preview session update (for extending TTL or changing mode)
 */
export interface UpdatePreviewSessionRequest {
  /** Session to update */
  sessionId: string;

  /** Extend expiration by N minutes (subject to tier limits) */
  extendMinutes?: number;

  /** Change preview mode (requires rebuild) */
  mode?: PreviewMode;
}

/**
 * Preview session metrics for billing
 */
export interface PreviewSessionMetrics {
  /** Session identifier */
  sessionId: string;

  /** Tenant identifier for billing */
  tenantId: string;

  /** Project identifier */
  projectId: string;

  /** Total session duration in minutes (for billing) */
  durationMinutes: number;

  /** Preview mode used */
  mode: PreviewMode;

  /** Number of hot-reload events */
  hotReloadCount: number;

  /** Build time in seconds */
  buildTimeSeconds: number;

  /** Resource usage */
  resources: {
    /** Peak memory usage in MB */
    peakMemoryMB: number;
    /** Average CPU usage (0-100%) */
    avgCpuPercent: number;
  };

  /** Session start timestamp */
  startedAt: Date;

  /** Session end timestamp */
  endedAt: Date;
}

/**
 * Hot-reload event payload for WebSocket streaming
 */
export interface HotReloadEvent {
  /** Event type */
  type: 'file-change' | 'rebuild-start' | 'rebuild-complete' | 'rebuild-error';

  /** Changed file path (for file-change events) */
  filePath?: string;

  /** Rebuild status message */
  message?: string;

  /** Error details (for rebuild-error) */
  error?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Preview session list response
 */
export interface ListPreviewSessionsResponse {
  /** Active sessions */
  sessions: PreviewSession[];

  /** Total count (for pagination) */
  total: number;

  /** Current usage against tier limits */
  usage: {
    /** Currently running sessions */
    activeSessions: number;
    /** Maximum allowed concurrent sessions */
    maxSessions: number;
    /** Sessions created today */
    sessionsToday: number;
    /** Maximum sessions per day */
    maxSessionsPerDay: number;
  };
}
