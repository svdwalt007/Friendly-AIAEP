import { EventEmitter } from 'events';

/**
 * Supported audit event types for authentication operations
 */
export enum AuditEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_EXPIRED = 'token_expired',
  CREDENTIAL_DECRYPTION_ERROR = 'credential_decryption_error',
}

/**
 * Authentication methods supported by the system
 */
export enum AuthMethod {
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  BASIC_AUTH = 'basic_auth',
  BEARER_TOKEN = 'bearer_token',
  CUSTOM = 'custom',
}

/**
 * Base interface for all audit events
 */
export interface BaseAuditEvent {
  timestamp: Date;
  tenantId: string;
  apiId: string;
  authMethod: AuthMethod;
  metadata?: Record<string, unknown>;
}

/**
 * Event payload for successful authentication
 */
export interface AuthSuccessEvent extends BaseAuditEvent {
  type: AuditEventType.AUTH_SUCCESS;
  userId?: string;
  sessionId?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
}

/**
 * Event payload for failed authentication
 */
export interface AuthFailureEvent extends BaseAuditEvent {
  type: AuditEventType.AUTH_FAILURE;
  reason: string;
  errorCode?: string;
  attemptCount?: number;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
}

/**
 * Event payload for token refresh operations
 */
export interface TokenRefreshEvent extends BaseAuditEvent {
  type: AuditEventType.TOKEN_REFRESH;
  oldTokenId?: string;
  newTokenId?: string;
  expiresAt?: Date;
  metadata?: {
    refreshReason?: string;
    [key: string]: unknown;
  };
}

/**
 * Event payload for token expiration
 */
export interface TokenExpiredEvent extends BaseAuditEvent {
  type: AuditEventType.TOKEN_EXPIRED;
  tokenId?: string;
  expiredAt: Date;
  metadata?: {
    gracePeriodUsed?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Event payload for credential decryption errors
 */
export interface CredentialDecryptionErrorEvent extends BaseAuditEvent {
  type: AuditEventType.CREDENTIAL_DECRYPTION_ERROR;
  errorMessage: string;
  credentialType: string;
  metadata?: {
    encryptionAlgorithm?: string;
    [key: string]: unknown;
  };
}

/**
 * Union type of all audit events
 */
export type AuditEvent =
  | AuthSuccessEvent
  | AuthFailureEvent
  | TokenRefreshEvent
  | TokenExpiredEvent
  | CredentialDecryptionErrorEvent;

/**
 * Event filter configuration
 */
export interface EventFilter {
  tenantIds?: string[];
  apiIds?: string[];
  authMethods?: AuthMethod[];
  eventTypes?: AuditEventType[];
}

/**
 * Event aggregation data
 */
export interface EventAggregation {
  eventType: AuditEventType;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  tenantId?: string;
  apiId?: string;
  authMethod?: AuthMethod;
}

/**
 * Configuration options for the audit event emitter
 */
export interface AuditEventEmitterConfig {
  maxListeners?: number;
  retentionPeriodMs?: number;
  aggregationIntervalMs?: number;
  enableAggregation?: boolean;
}

/**
 * Hook function type for audit service integration
 */
export type AuditServiceHook = (event: AuditEvent) => void | Promise<void>;

/**
 * AuditEventEmitter class for managing and emitting authentication audit events
 *
 * This class extends Node.js EventEmitter to provide a type-safe, feature-rich
 * audit event system for IoT authentication operations.
 *
 * Features:
 * - Type-safe event emission and handling
 * - Event filtering by tenant, API, and authentication method
 * - Event aggregation for monitoring and analytics
 * - Configurable event retention
 * - Integration hooks for audit service
 * - Helper methods for common audit operations
 *
 * @example
 * ```typescript
 * const emitter = new AuditEventEmitter({
 *   retentionPeriodMs: 3600000, // 1 hour
 *   enableAggregation: true
 * });
 *
 * emitter.on('auth_success', (event) => {
 *   console.log('Auth successful for tenant:', event.tenantId);
 * });
 *
 * emitter.emitAuthSuccess({
 *   tenantId: 'tenant-123',
 *   apiId: 'api-456',
 *   authMethod: AuthMethod.OAUTH2
 * });
 * ```
 */
export class AuditEventEmitter extends EventEmitter {
  private readonly config: Required<AuditEventEmitterConfig>;
  private readonly eventHistory: AuditEvent[] = [];
  private readonly aggregations: Map<string, EventAggregation> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private aggregationInterval?: NodeJS.Timeout;
  private auditServiceHooks: AuditServiceHook[] = [];

  constructor(config: AuditEventEmitterConfig = {}) {
    super();

    this.config = {
      maxListeners: config.maxListeners ?? 100,
      retentionPeriodMs: config.retentionPeriodMs ?? 3600000, // 1 hour default
      aggregationIntervalMs: config.aggregationIntervalMs ?? 60000, // 1 minute default
      enableAggregation: config.enableAggregation ?? true,
    };

    this.setMaxListeners(this.config.maxListeners);
    this.startCleanupScheduler();

    if (this.config.enableAggregation) {
      this.startAggregationScheduler();
    }
  }

  /**
   * Emit a successful authentication event
   */
  public emitAuthSuccess(
    params: Omit<AuthSuccessEvent, 'type' | 'timestamp'>
  ): void {
    const event: AuthSuccessEvent = {
      ...params,
      type: AuditEventType.AUTH_SUCCESS,
      timestamp: new Date(),
    };

    this.emitAuditEvent(event);
  }

  /**
   * Emit a failed authentication event
   */
  public emitAuthFailure(
    params: Omit<AuthFailureEvent, 'type' | 'timestamp'>
  ): void {
    const event: AuthFailureEvent = {
      ...params,
      type: AuditEventType.AUTH_FAILURE,
      timestamp: new Date(),
    };

    this.emitAuditEvent(event);
  }

  /**
   * Emit a token refresh event
   */
  public emitTokenRefresh(
    params: Omit<TokenRefreshEvent, 'type' | 'timestamp'>
  ): void {
    const event: TokenRefreshEvent = {
      ...params,
      type: AuditEventType.TOKEN_REFRESH,
      timestamp: new Date(),
    };

    this.emitAuditEvent(event);
  }

  /**
   * Emit a token expiration event
   */
  public emitTokenExpired(
    params: Omit<TokenExpiredEvent, 'type' | 'timestamp'>
  ): void {
    const event: TokenExpiredEvent = {
      ...params,
      type: AuditEventType.TOKEN_EXPIRED,
      timestamp: new Date(),
    };

    this.emitAuditEvent(event);
  }

  /**
   * Emit a credential decryption error event
   */
  public emitCredentialDecryptionError(
    params: Omit<CredentialDecryptionErrorEvent, 'type' | 'timestamp'>
  ): void {
    const event: CredentialDecryptionErrorEvent = {
      ...params,
      type: AuditEventType.CREDENTIAL_DECRYPTION_ERROR,
      timestamp: new Date(),
    };

    this.emitAuditEvent(event);
  }

  /**
   * Register an audit service hook for external integration
   */
  public registerAuditServiceHook(hook: AuditServiceHook): void {
    this.auditServiceHooks.push(hook);
  }

  /**
   * Unregister an audit service hook
   */
  public unregisterAuditServiceHook(hook: AuditServiceHook): void {
    const index = this.auditServiceHooks.indexOf(hook);
    if (index !== -1) {
      this.auditServiceHooks.splice(index, 1);
    }
  }

  /**
   * Get filtered events from history
   */
  public getFilteredEvents(filter: EventFilter): AuditEvent[] {
    return this.eventHistory.filter((event) => this.matchesFilter(event, filter));
  }

  /**
   * Get event count by type
   */
  public getEventCountByType(eventType: AuditEventType): number {
    return this.eventHistory.filter((event) => event.type === eventType).length;
  }

  /**
   * Get event count by tenant
   */
  public getEventCountByTenant(tenantId: string): number {
    return this.eventHistory.filter((event) => event.tenantId === tenantId).length;
  }

  /**
   * Get event count by API
   */
  public getEventCountByApi(apiId: string): number {
    return this.eventHistory.filter((event) => event.apiId === apiId).length;
  }

  /**
   * Get event count by authentication method
   */
  public getEventCountByAuthMethod(authMethod: AuthMethod): number {
    return this.eventHistory.filter((event) => event.authMethod === authMethod).length;
  }

  /**
   * Get all current aggregations
   */
  public getAggregations(): EventAggregation[] {
    return Array.from(this.aggregations.values());
  }

  /**
   * Get aggregations filtered by criteria
   */
  public getFilteredAggregations(filter: EventFilter): EventAggregation[] {
    return Array.from(this.aggregations.values()).filter((agg) => {
      if (filter.eventTypes && !filter.eventTypes.includes(agg.eventType)) {
        return false;
      }
      if (filter.tenantIds && agg.tenantId && !filter.tenantIds.includes(agg.tenantId)) {
        return false;
      }
      if (filter.apiIds && agg.apiId && !filter.apiIds.includes(agg.apiId)) {
        return false;
      }
      if (filter.authMethods && agg.authMethod && !filter.authMethods.includes(agg.authMethod)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Clear all event history
   */
  public clearHistory(): void {
    this.eventHistory.length = 0;
  }

  /**
   * Clear all aggregations
   */
  public clearAggregations(): void {
    this.aggregations.clear();
  }

  /**
   * Get total event count in history
   */
  public getHistorySize(): number {
    return this.eventHistory.length;
  }

  /**
   * Clean up resources and stop schedulers
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    this.removeAllListeners();
    this.clearHistory();
    this.clearAggregations();
    this.auditServiceHooks.length = 0;
  }

  /**
   * Internal method to emit audit events
   */
  private emitAuditEvent(event: AuditEvent): void {
    // Store in history
    this.eventHistory.push(event);

    // Emit the event
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard event for capturing all events

    // Update aggregations
    if (this.config.enableAggregation) {
      this.updateAggregation(event);
    }

    // Call audit service hooks
    this.callAuditServiceHooks(event);
  }

  /**
   * Check if an event matches the given filter
   */
  private matchesFilter(event: AuditEvent, filter: EventFilter): boolean {
    if (filter.tenantIds && !filter.tenantIds.includes(event.tenantId)) {
      return false;
    }
    if (filter.apiIds && !filter.apiIds.includes(event.apiId)) {
      return false;
    }
    if (filter.authMethods && !filter.authMethods.includes(event.authMethod)) {
      return false;
    }
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }
    return true;
  }

  /**
   * Update event aggregation data
   */
  private updateAggregation(event: AuditEvent): void {
    // Create aggregation key
    const key = `${event.type}:${event.tenantId}:${event.apiId}:${event.authMethod}`;

    const existing = this.aggregations.get(key);
    if (existing) {
      existing.count++;
      existing.lastOccurrence = event.timestamp;
    } else {
      this.aggregations.set(key, {
        eventType: event.type,
        count: 1,
        firstOccurrence: event.timestamp,
        lastOccurrence: event.timestamp,
        tenantId: event.tenantId,
        apiId: event.apiId,
        authMethod: event.authMethod,
      });
    }
  }

  /**
   * Call all registered audit service hooks
   */
  private async callAuditServiceHooks(event: AuditEvent): Promise<void> {
    for (const hook of this.auditServiceHooks) {
      try {
        await hook(event);
      } catch (error) {
        // Log error but don't throw to prevent hook failures from affecting event emission
        console.error('Error in audit service hook:', error);
      }
    }
  }

  /**
   * Start the cleanup scheduler for event retention
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEvents();
    }, this.config.retentionPeriodMs / 10); // Check 10 times per retention period
  }

  /**
   * Start the aggregation scheduler
   */
  private startAggregationScheduler(): void {
    this.aggregationInterval = setInterval(() => {
      // Emit aggregation summary event
      this.emit('aggregation_summary', this.getAggregations());
    }, this.config.aggregationIntervalMs);
  }

  /**
   * Remove events older than the retention period
   */
  private cleanupOldEvents(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriodMs;
    const initialSize = this.eventHistory.length;

    // Remove old events
    let i = 0;
    while (i < this.eventHistory.length) {
      if (this.eventHistory[i].timestamp.getTime() < cutoffTime) {
        this.eventHistory.splice(i, 1);
      } else {
        i++;
      }
    }

    // Emit cleanup event if events were removed
    if (this.eventHistory.length < initialSize) {
      this.emit('cleanup', {
        removed: initialSize - this.eventHistory.length,
        remaining: this.eventHistory.length,
      });
    }
  }
}

/**
 * Create a filtered listener that only receives events matching the filter
 */
export function createFilteredListener(
  emitter: AuditEventEmitter,
  filter: EventFilter,
  listener: (event: AuditEvent) => void
): void {
  emitter.on('*', (event: AuditEvent) => {
    if (matchesEventFilter(event, filter)) {
      listener(event);
    }
  });
}

/**
 * Helper function to check if an event matches a filter
 */
function matchesEventFilter(event: AuditEvent, filter: EventFilter): boolean {
  if (filter.tenantIds && !filter.tenantIds.includes(event.tenantId)) {
    return false;
  }
  if (filter.apiIds && !filter.apiIds.includes(event.apiId)) {
    return false;
  }
  if (filter.authMethods && !filter.authMethods.includes(event.authMethod)) {
    return false;
  }
  if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
    return false;
  }
  return true;
}

/**
 * Create a singleton instance of the audit event emitter
 */
let defaultEmitter: AuditEventEmitter | null = null;

/**
 * Get or create the default audit event emitter instance
 */
export function getDefaultAuditEmitter(
  config?: AuditEventEmitterConfig
): AuditEventEmitter {
  if (!defaultEmitter) {
    defaultEmitter = new AuditEventEmitter(config);
  }
  return defaultEmitter;
}

/**
 * Reset the default emitter (useful for testing)
 */
export function resetDefaultAuditEmitter(): void {
  if (defaultEmitter) {
    defaultEmitter.destroy();
    defaultEmitter = null;
  }
}
