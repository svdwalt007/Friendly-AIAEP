import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AuditService,
  AuditStorage,
  AuditEntry,
  AuditQueryFilters,
  AuditQueryOptions,
  AuditQueryResult,
  CreateAuditEntryParams,
  AuditCategory,
  AuditValidationError,
  AuditStorageError,
  AuditTenantScopeError,
  DefaultIdGenerator,
  IdGenerator,
  auditService,
} from './audit-service';

// ============================================================================
// Test helpers
// ============================================================================

class MockStorage implements AuditStorage {
  write = vi.fn<(entry: AuditEntry) => Promise<void>>(async () => undefined);
  writeBatch = vi.fn<(entries: AuditEntry[]) => Promise<void>>(async () => undefined);
  query = vi.fn<
    (filters: AuditQueryFilters, options?: AuditQueryOptions) => Promise<AuditQueryResult>
  >(async () => ({ entries: [], total: 0, limit: 50, offset: 0 }));
  getById = vi.fn<(tenantId: string, id: string) => Promise<AuditEntry | null>>(
    async () => null
  );
  deleteOlderThan = vi.fn<(tenantId: string, before: Date) => Promise<number>>(
    async () => 0
  );
}

class FixedIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

const baseParams = (overrides: Partial<CreateAuditEntryParams> = {}): CreateAuditEntryParams => ({
  tenantId: 'tenant-1',
  category: 'system',
  action: 'test.action',
  message: 'test message',
  success: true,
  severity: 'info',
  ...overrides,
});

// ============================================================================
// Backward-compat stub
// ============================================================================

describe('auditService stub', () => {
  it('returns the string "audit-service"', () => {
    expect(auditService()).toEqual('audit-service');
  });
});

// ============================================================================
// DefaultIdGenerator
// ============================================================================

describe('DefaultIdGenerator', () => {
  it('generates a string of the expected UUID-v4 shape', () => {
    const gen = new DefaultIdGenerator();
    const id = gen.generate();
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('produces different ids on subsequent calls', () => {
    const gen = new DefaultIdGenerator();
    const a = gen.generate();
    const b = gen.generate();
    // Statistically near-certain to differ
    expect(a).not.toBe(b);
  });
});

// ============================================================================
// Error classes
// ============================================================================

describe('Error classes', () => {
  it('AuditValidationError exposes name and field', () => {
    const err = new AuditValidationError('bad', 'tenantId');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AuditValidationError');
    expect(err.message).toBe('bad');
    expect(err.field).toBe('tenantId');
  });

  it('AuditValidationError works without a field', () => {
    const err = new AuditValidationError('bad');
    expect(err.field).toBeUndefined();
  });

  it('AuditStorageError exposes name and originalError', () => {
    const cause = new Error('boom');
    const err = new AuditStorageError('storage failed', cause);
    expect(err.name).toBe('AuditStorageError');
    expect(err.message).toBe('storage failed');
    expect(err.originalError).toBe(cause);
  });

  it('AuditStorageError works without an originalError', () => {
    const err = new AuditStorageError('storage failed');
    expect(err.originalError).toBeUndefined();
  });

  it('AuditTenantScopeError builds a descriptive message', () => {
    const err = new AuditTenantScopeError('tenant-x', 'entry-y');
    expect(err.name).toBe('AuditTenantScopeError');
    expect(err.message).toContain('tenant-x');
    expect(err.message).toContain('entry-y');
  });
});

// ============================================================================
// AuditService — construction + defaults
// ============================================================================

describe('AuditService construction', () => {
  it('uses provided storage and idGenerator', async () => {
    const storage = new MockStorage();
    const idGen = new FixedIdGenerator();
    const svc = new AuditService({ storage, idGenerator: idGen, synchronous: true });
    const entry = await svc.log(baseParams());
    expect(entry.id).toBe('id-1');
    expect(storage.write).toHaveBeenCalledOnce();
  });

  it('falls back to DefaultIdGenerator when idGenerator omitted', async () => {
    const storage = new MockStorage();
    const svc = new AuditService({ storage, synchronous: true });
    const entry = await svc.log(baseParams());
    expect(entry.id).toMatch(/^[0-9a-f-]+$/);
  });

  it('applies default retention days (365) when not specified', async () => {
    const storage = new MockStorage();
    const svc = new AuditService({ storage, synchronous: true });
    const entry = await svc.log(baseParams());
    expect(entry.compliance?.retentionDays).toBe(365);
  });

  it('respects custom defaultRetentionDays', async () => {
    const storage = new MockStorage();
    const svc = new AuditService({ storage, defaultRetentionDays: 90, synchronous: true });
    const entry = await svc.log(baseParams());
    expect(entry.compliance?.retentionDays).toBe(90);
  });

  it('defaults synchronous=false (uses batch buffer)', async () => {
    const storage = new MockStorage();
    const svc = new AuditService({ storage });
    await svc.log(baseParams());
    // No write should have happened yet (batch buffer)
    expect(storage.write).not.toHaveBeenCalled();
    expect(storage.writeBatch).not.toHaveBeenCalled();
    await svc.flush();
    expect(storage.writeBatch).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// AuditService.log — validation
// ============================================================================

describe('AuditService.log validation', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('rejects when tenantId is missing', async () => {
    await expect(svc.log(baseParams({ tenantId: '' }))).rejects.toBeInstanceOf(
      AuditValidationError
    );
  });

  it('rejects when tenantId is whitespace', async () => {
    await expect(svc.log(baseParams({ tenantId: '   ' }))).rejects.toBeInstanceOf(
      AuditValidationError
    );
  });

  it('rejects when category is missing', async () => {
    await expect(
      svc.log(baseParams({ category: undefined as unknown as AuditCategory }))
    ).rejects.toBeInstanceOf(AuditValidationError);
  });

  it('rejects when action is missing', async () => {
    await expect(svc.log(baseParams({ action: '' }))).rejects.toBeInstanceOf(
      AuditValidationError
    );
  });

  it('rejects when action is whitespace', async () => {
    await expect(svc.log(baseParams({ action: '   ' }))).rejects.toBeInstanceOf(
      AuditValidationError
    );
  });

  it('rejects when message is missing', async () => {
    await expect(svc.log(baseParams({ message: '' }))).rejects.toBeInstanceOf(
      AuditValidationError
    );
  });

  it('rejects when message is whitespace', async () => {
    await expect(svc.log(baseParams({ message: '  ' }))).rejects.toBeInstanceOf(
      AuditValidationError
    );
  });

  it('rejects when success is not a boolean', async () => {
    await expect(
      svc.log(baseParams({ success: undefined as unknown as boolean }))
    ).rejects.toBeInstanceOf(AuditValidationError);
  });

  it('rejects when success is a string', async () => {
    await expect(
      svc.log(baseParams({ success: 'true' as unknown as boolean }))
    ).rejects.toBeInstanceOf(AuditValidationError);
  });
});

// ============================================================================
// AuditService.log — entry creation + persistence
// ============================================================================

describe('AuditService.log entry creation', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('auto-generates id and timestamp when not provided', async () => {
    const before = new Date();
    const entry = await svc.log(baseParams());
    const after = new Date();
    expect(entry.id).toBe('id-1');
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('preserves explicit timestamp when provided', async () => {
    const ts = new Date('2024-01-01T00:00:00Z');
    const entry = await svc.log(baseParams({ timestamp: ts }));
    expect(entry.timestamp).toBe(ts);
  });

  it('writes the synchronous entry through storage.write', async () => {
    const entry = await svc.log(baseParams());
    expect(storage.write).toHaveBeenCalledOnce();
    expect(storage.write).toHaveBeenCalledWith(entry);
  });

  it('preserves all caller-supplied fields on the resulting entry', async () => {
    const entry = await svc.log(
      baseParams({
        actor: { type: 'user', id: 'u1', name: 'Alice', ipAddress: '127.0.0.1' },
        resource: { type: 'project', id: 'p1', name: 'P1' },
        correlationId: 'corr-1',
        requestId: 'req-1',
        metadata: { foo: 'bar' },
      })
    );
    expect(entry.actor?.id).toBe('u1');
    expect(entry.resource?.type).toBe('project');
    expect(entry.correlationId).toBe('corr-1');
    expect(entry.requestId).toBe('req-1');
    expect(entry.metadata).toEqual({ foo: 'bar' });
  });

  it('wraps storage write errors in AuditStorageError', async () => {
    storage.write.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.log(baseParams())).rejects.toBeInstanceOf(AuditStorageError);
  });

  it('exposes the original error on the wrapped storage error', async () => {
    const original = new Error('db down');
    storage.write.mockRejectedValueOnce(original);
    try {
      await svc.log(baseParams());
      expect.fail('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AuditStorageError);
      expect((e as AuditStorageError).originalError).toBe(original);
    }
  });
});

// ============================================================================
// AuditService.log — compliance enrichment
// ============================================================================

describe('AuditService.log compliance enrichment', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('auto-flags soc2 + sensitive for authentication events', async () => {
    const entry = await svc.log(baseParams({ category: 'authentication' }));
    expect(entry.compliance?.soc2Relevant).toBe(true);
    expect(entry.compliance?.sensitiveOperation).toBe(true);
  });

  it('auto-flags soc2 + sensitive for authorization events', async () => {
    const entry = await svc.log(baseParams({ category: 'authorization' }));
    expect(entry.compliance?.soc2Relevant).toBe(true);
    expect(entry.compliance?.sensitiveOperation).toBe(true);
  });

  it('auto-flags gdpr + soc2 for data_access events', async () => {
    const entry = await svc.log(baseParams({ category: 'data_access' }));
    expect(entry.compliance?.gdprRelevant).toBe(true);
    expect(entry.compliance?.soc2Relevant).toBe(true);
  });

  it('auto-flags gdpr + soc2 for data_modification events', async () => {
    const entry = await svc.log(baseParams({ category: 'data_modification' }));
    expect(entry.compliance?.gdprRelevant).toBe(true);
    expect(entry.compliance?.soc2Relevant).toBe(true);
  });

  it('auto-flags soc2 for billing events', async () => {
    const entry = await svc.log(baseParams({ category: 'billing' }));
    expect(entry.compliance?.soc2Relevant).toBe(true);
    // billing branch does NOT auto-set sensitiveOperation by itself (only logBillingEvent does)
    expect(entry.compliance?.sensitiveOperation).toBeUndefined();
  });

  it('does not override compliance fields explicitly provided by caller', async () => {
    const entry = await svc.log(
      baseParams({
        category: 'authentication',
        compliance: {
          soc2Relevant: false,
          sensitiveOperation: false,
          retentionDays: 30,
        },
      })
    );
    expect(entry.compliance?.soc2Relevant).toBe(false);
    expect(entry.compliance?.sensitiveOperation).toBe(false);
    expect(entry.compliance?.retentionDays).toBe(30);
  });

  it('does not override gdprRelevant when caller supplies it for data_access', async () => {
    const entry = await svc.log(
      baseParams({
        category: 'data_access',
        compliance: { gdprRelevant: false, soc2Relevant: false },
      })
    );
    expect(entry.compliance?.gdprRelevant).toBe(false);
    expect(entry.compliance?.soc2Relevant).toBe(false);
  });

  it('leaves compliance defaults alone for unrelated categories (e.g. system)', async () => {
    const entry = await svc.log(baseParams({ category: 'system' }));
    // Only retentionDays should be present from defaults
    expect(entry.compliance?.gdprRelevant).toBeUndefined();
    expect(entry.compliance?.soc2Relevant).toBeUndefined();
    expect(entry.compliance?.sensitiveOperation).toBeUndefined();
    expect(entry.compliance?.retentionDays).toBe(365);
  });

  it('merges custom compliance metadata with defaults', async () => {
    const entry = await svc.log(
      baseParams({
        category: 'compliance',
        compliance: { regulatoryFramework: ['HIPAA'], personalDataInvolved: true },
      })
    );
    expect(entry.compliance?.regulatoryFramework).toEqual(['HIPAA']);
    expect(entry.compliance?.personalDataInvolved).toBe(true);
    expect(entry.compliance?.retentionDays).toBe(365);
  });
});

// ============================================================================
// AuditService — async / batch buffer behaviour
// ============================================================================

describe('AuditService async batching', () => {
  let storage: MockStorage;
  let svc: AuditService;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buffers entries and flushes on the timer', async () => {
    await svc.log(baseParams());
    await svc.log(baseParams());
    expect(storage.writeBatch).not.toHaveBeenCalled();

    // Advance past the 1 s flush interval
    await vi.advanceTimersByTimeAsync(1100);
    expect(storage.writeBatch).toHaveBeenCalledOnce();
    const args = storage.writeBatch.mock.calls[0][0];
    expect(args).toHaveLength(2);
  });

  it('flushes immediately when buffer hits MAX_BATCH_SIZE', async () => {
    // Push 100 entries in a row — the 100th triggers flush()
    for (let i = 0; i < 100; i += 1) {
      await svc.log(baseParams({ message: `m-${i}` }));
    }
    // flush() runs synchronously inside scheduleWrite (await microtask)
    await Promise.resolve();
    await Promise.resolve();
    expect(storage.writeBatch).toHaveBeenCalledOnce();
    expect(storage.writeBatch.mock.calls[0][0]).toHaveLength(100);
  });

  it('flush() with empty buffer is a no-op', async () => {
    await svc.flush();
    expect(storage.writeBatch).not.toHaveBeenCalled();
  });

  it('flush() clears any pending timer', async () => {
    await svc.log(baseParams());
    // Manually flush — should null out the timer so a later timer fire is a no-op
    await svc.flush();
    expect(storage.writeBatch).toHaveBeenCalledOnce();
    storage.writeBatch.mockClear();
    await vi.advanceTimersByTimeAsync(2000);
    expect(storage.writeBatch).not.toHaveBeenCalled();
  });

  it('does not start a second timer while one is already scheduled', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await svc.log(baseParams());
    await svc.log(baseParams());
    await svc.log(baseParams());
    // Only the first scheduleWrite should have called setTimeout
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });
});

// ============================================================================
// AuditService.logSuccess / logFailure
// ============================================================================

describe('AuditService.logSuccess', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('marks the entry as success=true with default severity=info', async () => {
    const entry = await svc.logSuccess('tenant-1', 'system', 'svc.start', 'started');
    expect(entry.success).toBe(true);
    expect(entry.severity).toBe('info');
    expect(entry.tenantId).toBe('tenant-1');
    expect(entry.category).toBe('system');
  });

  it('honours an overridden severity', async () => {
    const entry = await svc.logSuccess('tenant-1', 'system', 'svc.start', 'started', {
      severity: 'warning',
    });
    expect(entry.severity).toBe('warning');
  });

  it('passes additional options through (actor, resource, metadata)', async () => {
    const entry = await svc.logSuccess('tenant-1', 'system', 'svc.start', 'started', {
      actor: { type: 'system', id: 'sys' },
      metadata: { foo: 1 },
    });
    expect(entry.actor?.id).toBe('sys');
    expect(entry.metadata).toEqual({ foo: 1 });
  });
});

describe('AuditService.logFailure', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('marks the entry as success=false with default severity=error', async () => {
    const entry = await svc.logFailure('tenant-1', 'system', 'svc.start', 'failed', {
      message: 'boom',
    });
    expect(entry.success).toBe(false);
    expect(entry.severity).toBe('error');
    expect(entry.error?.message).toBe('boom');
  });

  it('honours an overridden severity', async () => {
    const entry = await svc.logFailure(
      'tenant-1',
      'system',
      'svc.start',
      'failed',
      { message: 'boom' },
      { severity: 'critical' }
    );
    expect(entry.severity).toBe('critical');
  });

  it('works without an explicit error object', async () => {
    const entry = await svc.logFailure('tenant-1', 'system', 'svc.start', 'failed');
    expect(entry.success).toBe(false);
    expect(entry.error).toBeUndefined();
  });

  it('passes additional options through', async () => {
    const entry = await svc.logFailure(
      'tenant-1',
      'system',
      'svc.start',
      'failed',
      { message: 'boom', code: 'E_FAIL' },
      { correlationId: 'corr-9' }
    );
    expect(entry.correlationId).toBe('corr-9');
    expect(entry.error?.code).toBe('E_FAIL');
  });
});

// ============================================================================
// AuditService.logLLMRequest
// ============================================================================

describe('AuditService.logLLMRequest', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('builds an llm_request entry with correct metadata on success', async () => {
    const entry = await svc.logLLMRequest({
      tenantId: 'tenant-1',
      agentRole: 'orchestrator',
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      promptTokens: 100,
      completionTokens: 50,
      success: true,
      correlationId: 'corr-llm',
    });
    expect(entry.category).toBe('llm_request');
    expect(entry.action).toBe('llm.complete');
    expect(entry.success).toBe(true);
    expect(entry.severity).toBe('info');
    expect(entry.correlationId).toBe('corr-llm');
    expect(entry.metadata).toMatchObject({
      agentRole: 'orchestrator',
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    expect(entry.compliance?.soc2Relevant).toBe(true);
  });

  it('uses severity=error when success=false and propagates error', async () => {
    const entry = await svc.logLLMRequest({
      tenantId: 'tenant-1',
      agentRole: 'planning',
      model: 'gpt-4',
      provider: 'openai',
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      error: { message: 'rate limit', code: '429' },
    });
    expect(entry.success).toBe(false);
    expect(entry.severity).toBe('error');
    expect(entry.error?.code).toBe('429');
    expect(entry.metadata?.totalTokens).toBe(0);
  });
});

// ============================================================================
// AuditService.logBillingEvent
// ============================================================================

describe('AuditService.logBillingEvent', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('builds a billing entry with sensitive=true and soc2=true', async () => {
    const entry = await svc.logBillingEvent({
      tenantId: 'tenant-1',
      action: 'invoice.create',
      message: 'Invoice created',
      amount: 100.5,
      currency: 'USD',
      success: true,
    });
    expect(entry.category).toBe('billing');
    expect(entry.action).toBe('invoice.create');
    expect(entry.success).toBe(true);
    expect(entry.severity).toBe('info');
    expect(entry.metadata).toEqual({ amount: 100.5, currency: 'USD' });
    expect(entry.compliance?.soc2Relevant).toBe(true);
    expect(entry.compliance?.sensitiveOperation).toBe(true);
  });

  it('marks failure with severity=error and propagates error', async () => {
    const entry = await svc.logBillingEvent({
      tenantId: 'tenant-1',
      action: 'invoice.create',
      message: 'Invoice failed',
      success: false,
      error: { message: 'declined' },
    });
    expect(entry.success).toBe(false);
    expect(entry.severity).toBe('error');
    expect(entry.error?.message).toBe('declined');
  });

  it('handles missing amount/currency (undefined metadata fields)', async () => {
    const entry = await svc.logBillingEvent({
      tenantId: 'tenant-1',
      action: 'subscription.cancel',
      message: 'cancelled',
      success: true,
    });
    expect(entry.metadata).toEqual({ amount: undefined, currency: undefined });
  });
});

// ============================================================================
// AuditService.logBatch
// ============================================================================

describe('AuditService.logBatch', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('writes all entries through writeBatch in one call', async () => {
    const entries = await svc.logBatch([
      baseParams({ message: 'a' }),
      baseParams({ message: 'b' }),
      baseParams({ message: 'c' }),
    ]);
    expect(entries).toHaveLength(3);
    expect(storage.writeBatch).toHaveBeenCalledOnce();
    expect(storage.writeBatch.mock.calls[0][0]).toHaveLength(3);
  });

  it('auto-generates id and timestamp for each entry', async () => {
    const entries = await svc.logBatch([baseParams(), baseParams()]);
    expect(entries[0].id).toBe('id-1');
    expect(entries[1].id).toBe('id-2');
    expect(entries[0].timestamp).toBeInstanceOf(Date);
    expect(entries[1].timestamp).toBeInstanceOf(Date);
  });

  it('respects explicit timestamps inside a batch', async () => {
    const ts = new Date('2024-06-01T00:00:00Z');
    const entries = await svc.logBatch([baseParams({ timestamp: ts })]);
    expect(entries[0].timestamp).toBe(ts);
  });

  it('enriches compliance fields per entry', async () => {
    const entries = await svc.logBatch([
      baseParams({ category: 'authentication' }),
      baseParams({ category: 'data_access' }),
    ]);
    expect(entries[0].compliance?.soc2Relevant).toBe(true);
    expect(entries[0].compliance?.sensitiveOperation).toBe(true);
    expect(entries[1].compliance?.gdprRelevant).toBe(true);
  });

  it('validates each entry and throws AuditValidationError on bad input', async () => {
    await expect(
      svc.logBatch([baseParams(), baseParams({ tenantId: '' })])
    ).rejects.toBeInstanceOf(AuditValidationError);
  });

  it('wraps storage errors in AuditStorageError', async () => {
    storage.writeBatch.mockRejectedValueOnce(new Error('db gone'));
    await expect(svc.logBatch([baseParams()])).rejects.toBeInstanceOf(AuditStorageError);
  });

  it('preserves the original error on the wrapped storage error', async () => {
    const original = new Error('db gone');
    storage.writeBatch.mockRejectedValueOnce(original);
    try {
      await svc.logBatch([baseParams()]);
      expect.fail('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AuditStorageError);
      expect((e as AuditStorageError).originalError).toBe(original);
    }
  });
});

// ============================================================================
// AuditService.query
// ============================================================================

describe('AuditService.query', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('rejects when tenantId is missing', async () => {
    await expect(
      svc.query({ tenantId: '' } as AuditQueryFilters)
    ).rejects.toBeInstanceOf(AuditValidationError);
    expect(storage.query).not.toHaveBeenCalled();
  });

  it('delegates to storage.query and returns the result verbatim', async () => {
    const expected: AuditQueryResult = {
      entries: [],
      total: 0,
      limit: 50,
      offset: 0,
    };
    storage.query.mockResolvedValueOnce(expected);
    const out = await svc.query({ tenantId: 'tenant-1' });
    expect(out).toBe(expected);
    expect(storage.query).toHaveBeenCalledWith({ tenantId: 'tenant-1' }, undefined);
  });

  it('forwards filters and options to storage', async () => {
    const filters: AuditQueryFilters = {
      tenantId: 'tenant-1',
      category: 'data_access',
      severity: 'warning',
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-12-31'),
      success: true,
      actorId: 'u1',
      resourceId: 'r1',
      correlationId: 'corr-1',
    };
    const options: AuditQueryOptions = { limit: 10, offset: 5, orderBy: 'timestamp_desc' };
    await svc.query(filters, options);
    expect(storage.query).toHaveBeenCalledWith(filters, options);
  });

  it('wraps storage errors in AuditStorageError', async () => {
    storage.query.mockRejectedValueOnce(new Error('db gone'));
    await expect(svc.query({ tenantId: 'tenant-1' })).rejects.toBeInstanceOf(
      AuditStorageError
    );
  });
});

// ============================================================================
// AuditService.getById
// ============================================================================

describe('AuditService.getById', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  const sampleEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
    id: 'entry-1',
    tenantId: 'tenant-1',
    timestamp: new Date(),
    category: 'system',
    severity: 'info',
    message: 'm',
    action: 'a',
    success: true,
    ...overrides,
  });

  it('rejects when tenantId is missing', async () => {
    await expect(svc.getById('', 'entry-1')).rejects.toBeInstanceOf(AuditValidationError);
  });

  it('rejects when id is missing', async () => {
    await expect(svc.getById('tenant-1', '')).rejects.toBeInstanceOf(AuditValidationError);
  });

  it('returns the entry when found and tenant matches', async () => {
    storage.getById.mockResolvedValueOnce(sampleEntry());
    const entry = await svc.getById('tenant-1', 'entry-1');
    expect(entry.id).toBe('entry-1');
  });

  it('throws AuditStorageError when storage returns null', async () => {
    storage.getById.mockResolvedValueOnce(null);
    await expect(svc.getById('tenant-1', 'missing')).rejects.toBeInstanceOf(AuditStorageError);
  });

  it('enforces tenant scope - throws AuditTenantScopeError when entry tenant differs', async () => {
    storage.getById.mockResolvedValueOnce(sampleEntry({ tenantId: 'tenant-other' }));
    await expect(svc.getById('tenant-1', 'entry-1')).rejects.toBeInstanceOf(
      AuditTenantScopeError
    );
  });
});

// ============================================================================
// AuditService.applyRetentionPolicy
// ============================================================================

describe('AuditService.applyRetentionPolicy', () => {
  let storage: MockStorage;
  let svc: AuditService;
  beforeEach(() => {
    storage = new MockStorage();
    svc = new AuditService({ storage, idGenerator: new FixedIdGenerator(), synchronous: true });
  });

  it('uses defaultRetentionDays when no override is supplied', async () => {
    storage.deleteOlderThan.mockResolvedValueOnce(7);
    const before = Date.now();
    const removed = await svc.applyRetentionPolicy('tenant-1');
    expect(removed).toBe(7);
    expect(storage.deleteOlderThan).toHaveBeenCalledOnce();
    const [tenantId, cutoff] = storage.deleteOlderThan.mock.calls[0];
    expect(tenantId).toBe('tenant-1');
    expect(cutoff).toBeInstanceOf(Date);
    // Cutoff should be ~365 days before now
    const expectedMs = before - 365 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedMs)).toBeLessThan(60_000);
  });

  it('honours an explicit retentionDays override', async () => {
    storage.deleteOlderThan.mockResolvedValueOnce(2);
    const before = Date.now();
    const removed = await svc.applyRetentionPolicy('tenant-1', 30);
    expect(removed).toBe(2);
    const [, cutoff] = storage.deleteOlderThan.mock.calls[0];
    const expectedMs = before - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedMs)).toBeLessThan(60_000);
  });

  it('wraps storage errors in AuditStorageError', async () => {
    storage.deleteOlderThan.mockRejectedValueOnce(new Error('db gone'));
    await expect(svc.applyRetentionPolicy('tenant-1')).rejects.toBeInstanceOf(
      AuditStorageError
    );
  });
});

// ============================================================================
// AuditService.flush — direct tests
// ============================================================================

describe('AuditService.flush direct', () => {
  it('flushes a buffered entry and resets the buffer', async () => {
    const storage = new MockStorage();
    const svc = new AuditService({
      storage,
      idGenerator: new FixedIdGenerator(),
      synchronous: false,
    });
    await svc.log(baseParams());
    await svc.flush();
    expect(storage.writeBatch).toHaveBeenCalledOnce();
    expect(storage.writeBatch.mock.calls[0][0]).toHaveLength(1);
    // Subsequent flush should be a no-op
    storage.writeBatch.mockClear();
    await svc.flush();
    expect(storage.writeBatch).not.toHaveBeenCalled();
  });

  it('handles the case where the timer fires after a manual flush has cleared it', async () => {
    vi.useFakeTimers();
    try {
      const storage = new MockStorage();
      const svc = new AuditService({
        storage,
        idGenerator: new FixedIdGenerator(),
        synchronous: false,
      });
      await svc.log(baseParams());
      await svc.flush();
      // Advance past the original 1s timer that flush() should have cleared
      await vi.advanceTimersByTimeAsync(2000);
      // Only the manual flush should have fired
      expect(storage.writeBatch).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
