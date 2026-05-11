/**
 * @fileoverview Compliance audit logging service with tenant scoping and persistence
 * @module @friendly-aiaep/audit-service
 */

// ============================================================================
// Audit Entry Types
// ============================================================================

/**
 * Severity levels for audit log entries
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Categories of audit events
 */
export type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'billing'
  | 'configuration'
  | 'system'
  | 'llm_request'
  | 'agent_action'
  | 'compliance';

/**
 * Compliance-relevant fields for regulatory requirements
 */
export interface ComplianceFields {
  /** Whether this event is relevant to GDPR compliance */
  gdprRelevant?: boolean;
  /** Whether this event is relevant to SOC 2 compliance */
  soc2Relevant?: boolean;
  /** Whether personal data was accessed or processed */
  personalDataInvolved?: boolean;
  /** Data retention period in days */
  retentionDays?: number;
  /** Regulatory framework this event relates to */
  regulatoryFramework?: string[];
  /** Whether this is a sensitive operation requiring elevated audit */
  sensitiveOperation?: boolean;
}

/**
 * Actor information (who performed the action)
 */
export interface AuditActor {
  /** Type of actor */
  type: 'user' | 'agent' | 'system' | 'api_key';
  /** Actor identifier */
  id: string;
  /** Human-readable name */
  name?: string;
  /** IP address (if applicable) */
  ipAddress?: string;
  /** User agent string (if applicable) */
  userAgent?: string;
}

/**
 * Resource information (what was acted upon)
 */
export interface AuditResource {
  /** Resource type (e.g., 'project', 'agent', 'token') */
  type: string;
  /** Resource identifier */
  id: string;
  /** Human-readable name */
  name?: string;
}

/**
 * A single audit log entry
 */
export interface AuditEntry {
  /** Unique identifier for this audit entry */
  id: string;
  /** Tenant this entry belongs to */
  tenantId: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Audit event category */
  category: AuditCategory;
  /** Severity level */
  severity: AuditSeverity;
  /** Human-readable description of the event */
  message: string;
  /** The action performed */
  action: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Actor who performed the action */
  actor?: AuditActor;
  /** Resource that was acted upon */
  resource?: AuditResource;
  /** Compliance-relevant metadata */
  compliance?: ComplianceFields;
  /** Correlation ID for tracing across services */
  correlationId?: string;
  /** Request ID for HTTP request tracing */
  requestId?: string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
  /** Error details if success=false */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Parameters for creating an audit entry (id and timestamp are auto-generated)
 */
export type CreateAuditEntryParams = Omit<AuditEntry, 'id' | 'timestamp'> & {
  timestamp?: Date;
};

// ============================================================================
// Audit Query Types
// ============================================================================

/**
 * Filters for querying audit entries
 */
export interface AuditQueryFilters {
  tenantId: string;
  startTime?: Date;
  endTime?: Date;
  category?: AuditCategory;
  severity?: AuditSeverity;
  actorId?: string;
  resourceId?: string;
  success?: boolean;
  correlationId?: string;
}

/**
 * Pagination options for audit queries
 */
export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp_asc' | 'timestamp_desc';
}

/**
 * Paginated result of audit entry query
 */
export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Abstract interface for audit log persistence (allows mocking in tests)
 */
export interface AuditStorage {
  /**
   * Write a single audit entry to storage
   */
  write(entry: AuditEntry): Promise<void>;

  /**
   * Write multiple audit entries (batch write)
   */
  writeBatch(entries: AuditEntry[]): Promise<void>;

  /**
   * Query audit entries with filters
   */
  query(
    filters: AuditQueryFilters,
    options?: AuditQueryOptions
  ): Promise<AuditQueryResult>;

  /**
   * Retrieve a specific audit entry by ID
   */
  getById(tenantId: string, id: string): Promise<AuditEntry | null>;

  /**
   * Delete entries older than the specified date (for retention policy)
   */
  deleteOlderThan(tenantId: string, before: Date): Promise<number>;
}

// ============================================================================
// ID Generator Interface
// ============================================================================

/**
 * Interface for generating unique IDs (allows deterministic IDs in tests)
 */
export interface IdGenerator {
  generate(): string;
}

/**
 * Default UUID-like ID generator using crypto
 */
export class DefaultIdGenerator implements IdGenerator {
  generate(): string {
    // Simple UUID v4 generation without external deps
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// ============================================================================
// Audit Service Errors
// ============================================================================

/**
 * Error thrown when audit entry validation fails
 */
export class AuditValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'AuditValidationError';
  }
}

/**
 * Error thrown when storage operation fails
 */
export class AuditStorageError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'AuditStorageError';
  }
}

/**
 * Error thrown when tenant is not authorised to access an entry
 */
export class AuditTenantScopeError extends Error {
  constructor(tenantId: string, entryId: string) {
    super(`Tenant ${tenantId} is not authorised to access audit entry ${entryId}`);
    this.name = 'AuditTenantScopeError';
  }
}

// ============================================================================
// Main Audit Service
// ============================================================================

/**
 * Options for AuditService construction
 */
export interface AuditServiceOptions {
  storage: AuditStorage;
  idGenerator?: IdGenerator;
  /** Default retention period in days (default: 365) */
  defaultRetentionDays?: number;
  /** Whether to emit events synchronously (default: false = best-effort async) */
  synchronous?: boolean;
}

/**
 * Core compliance audit logging service
 *
 * Provides structured audit logging with tenant scoping, compliance fields,
 * and pluggable storage backend.
 */
export class AuditService {
  private storage: AuditStorage;
  private idGenerator: IdGenerator;
  private defaultRetentionDays: number;
  private synchronous: boolean;

  /** Batch buffer for non-synchronous writes */
  private batchBuffer: AuditEntry[] = [];
  private batchFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_FLUSH_INTERVAL_MS = 1000;
  private readonly MAX_BATCH_SIZE = 100;

  constructor(options: AuditServiceOptions) {
    this.storage = options.storage;
    this.idGenerator = options.idGenerator ?? new DefaultIdGenerator();
    this.defaultRetentionDays = options.defaultRetentionDays ?? 365;
    this.synchronous = options.synchronous ?? false;
  }

  // ============================================================================
  // Entry Creation
  // ============================================================================

  /**
   * Create and persist an audit entry
   */
  async log(params: CreateAuditEntryParams): Promise<AuditEntry> {
    this.validateParams(params);

    const entry: AuditEntry = {
      ...params,
      id: this.idGenerator.generate(),
      timestamp: params.timestamp ?? new Date(),
      compliance: this.enrichComplianceFields(params.compliance, params.category),
    };

    if (this.synchronous) {
      await this.writeToStorage(entry);
    } else {
      this.scheduleWrite(entry);
    }

    return entry;
  }

  /**
   * Log a successful action
   */
  async logSuccess(
    tenantId: string,
    category: AuditCategory,
    action: string,
    message: string,
    options?: Partial<Omit<CreateAuditEntryParams, 'tenantId' | 'category' | 'action' | 'message' | 'success'>>
  ): Promise<AuditEntry> {
    return this.log({
      tenantId,
      category,
      action,
      message,
      success: true,
      severity: options?.severity ?? 'info',
      ...options,
    });
  }

  /**
   * Log a failed action
   */
  async logFailure(
    tenantId: string,
    category: AuditCategory,
    action: string,
    message: string,
    error?: { message: string; code?: string },
    options?: Partial<Omit<CreateAuditEntryParams, 'tenantId' | 'category' | 'action' | 'message' | 'success' | 'error'>>
  ): Promise<AuditEntry> {
    return this.log({
      tenantId,
      category,
      action,
      message,
      success: false,
      severity: options?.severity ?? 'error',
      error,
      ...options,
    });
  }

  /**
   * Log an LLM request
   */
  async logLLMRequest(params: {
    tenantId: string;
    agentRole: string;
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    success: boolean;
    correlationId?: string;
    error?: { message: string; code?: string };
  }): Promise<AuditEntry> {
    return this.log({
      tenantId: params.tenantId,
      category: 'llm_request',
      action: 'llm.complete',
      message: `LLM request via ${params.provider}/${params.model} by agent ${params.agentRole}`,
      success: params.success,
      severity: params.success ? 'info' : 'error',
      correlationId: params.correlationId,
      error: params.error,
      metadata: {
        agentRole: params.agentRole,
        model: params.model,
        provider: params.provider,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.promptTokens + params.completionTokens,
      },
      compliance: {
        soc2Relevant: true,
      },
    });
  }

  /**
   * Log a billing event
   */
  async logBillingEvent(params: {
    tenantId: string;
    action: string;
    message: string;
    amount?: number;
    currency?: string;
    success: boolean;
    error?: { message: string; code?: string };
  }): Promise<AuditEntry> {
    return this.log({
      tenantId: params.tenantId,
      category: 'billing',
      action: params.action,
      message: params.message,
      success: params.success,
      severity: params.success ? 'info' : 'error',
      error: params.error,
      metadata: {
        amount: params.amount,
        currency: params.currency,
      },
      compliance: {
        soc2Relevant: true,
        sensitiveOperation: true,
      },
    });
  }

  // ============================================================================
  // Batch Writes
  // ============================================================================

  /**
   * Log multiple entries at once (batch write)
   */
  async logBatch(entries: CreateAuditEntryParams[]): Promise<AuditEntry[]> {
    const auditEntries: AuditEntry[] = entries.map((params) => {
      this.validateParams(params);
      return {
        ...params,
        id: this.idGenerator.generate(),
        timestamp: params.timestamp ?? new Date(),
        compliance: this.enrichComplianceFields(params.compliance, params.category),
      };
    });

    try {
      await this.storage.writeBatch(auditEntries);
    } catch (error) {
      throw new AuditStorageError('Failed to write batch audit entries', error);
    }

    return auditEntries;
  }

  // ============================================================================
  // Querying
  // ============================================================================

  /**
   * Query audit entries for a tenant
   * Enforces tenant scoping - a tenant can only query their own entries
   */
  async query(
    filters: AuditQueryFilters,
    options?: AuditQueryOptions
  ): Promise<AuditQueryResult> {
    if (!filters.tenantId) {
      throw new AuditValidationError('tenantId is required for audit queries', 'tenantId');
    }

    try {
      return await this.storage.query(filters, options);
    } catch (error) {
      throw new AuditStorageError('Failed to query audit entries', error);
    }
  }

  /**
   * Get a specific audit entry by ID, with tenant scope enforcement
   */
  async getById(tenantId: string, id: string): Promise<AuditEntry> {
    if (!tenantId) {
      throw new AuditValidationError('tenantId is required', 'tenantId');
    }
    if (!id) {
      throw new AuditValidationError('id is required', 'id');
    }

    const entry = await this.storage.getById(tenantId, id);

    if (!entry) {
      throw new AuditStorageError(`Audit entry not found: ${id}`);
    }

    // Enforce tenant scoping
    if (entry.tenantId !== tenantId) {
      throw new AuditTenantScopeError(tenantId, id);
    }

    return entry;
  }

  // ============================================================================
  // Retention Management
  // ============================================================================

  /**
   * Apply retention policy - delete entries older than the retention period
   */
  async applyRetentionPolicy(tenantId: string, retentionDays?: number): Promise<number> {
    const days = retentionDays ?? this.defaultRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      return await this.storage.deleteOlderThan(tenantId, cutoffDate);
    } catch (error) {
      throw new AuditStorageError('Failed to apply retention policy', error);
    }
  }

  // ============================================================================
  // Flush (for batch mode)
  // ============================================================================

  /**
   * Flush any buffered entries to storage
   */
  async flush(): Promise<void> {
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }

    if (this.batchBuffer.length > 0) {
      const entries = [...this.batchBuffer];
      this.batchBuffer = [];
      await this.storage.writeBatch(entries);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate audit entry parameters
   */
  private validateParams(params: CreateAuditEntryParams): void {
    if (!params.tenantId || params.tenantId.trim() === '') {
      throw new AuditValidationError('tenantId is required', 'tenantId');
    }
    if (!params.category) {
      throw new AuditValidationError('category is required', 'category');
    }
    if (!params.action || params.action.trim() === '') {
      throw new AuditValidationError('action is required', 'action');
    }
    if (!params.message || params.message.trim() === '') {
      throw new AuditValidationError('message is required', 'message');
    }
    if (typeof params.success !== 'boolean') {
      throw new AuditValidationError('success must be a boolean', 'success');
    }
  }

  /**
   * Enrich compliance fields based on category
   */
  private enrichComplianceFields(
    provided?: ComplianceFields,
    category?: AuditCategory
  ): ComplianceFields {
    const base: ComplianceFields = {
      retentionDays: this.defaultRetentionDays,
      ...provided,
    };

    // Auto-classify compliance relevance by category
    if (category === 'authentication' || category === 'authorization') {
      base.soc2Relevant = base.soc2Relevant ?? true;
      base.sensitiveOperation = base.sensitiveOperation ?? true;
    }

    if (category === 'data_access' || category === 'data_modification') {
      base.gdprRelevant = base.gdprRelevant ?? true;
      base.soc2Relevant = base.soc2Relevant ?? true;
    }

    if (category === 'billing') {
      base.soc2Relevant = base.soc2Relevant ?? true;
    }

    return base;
  }

  /**
   * Write to storage, wrapping errors
   */
  private async writeToStorage(entry: AuditEntry): Promise<void> {
    try {
      await this.storage.write(entry);
    } catch (error) {
      throw new AuditStorageError('Failed to write audit entry', error);
    }
  }

  /**
   * Schedule a write via batch buffer
   */
  private scheduleWrite(entry: AuditEntry): void {
    this.batchBuffer.push(entry);

    if (this.batchBuffer.length >= this.MAX_BATCH_SIZE) {
      void this.flush();
      return;
    }

    if (!this.batchFlushTimer) {
      this.batchFlushTimer = setTimeout(() => {
        void this.flush();
      }, this.BATCH_FLUSH_INTERVAL_MS);
    }
  }
}

// ============================================================================
// Backward-compatible stub export (kept, not removed)
// ============================================================================

/**
 * @deprecated Use AuditService class instead
 */
export function auditService(): string {
  return 'audit-service';
}
