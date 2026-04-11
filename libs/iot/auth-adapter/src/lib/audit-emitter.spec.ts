import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AuditEventEmitter,
  AuditEventType,
  AuthMethod,
  AuthSuccessEvent,
  AuthFailureEvent,
  TokenRefreshEvent,
  TokenExpiredEvent,
  CredentialDecryptionErrorEvent,
  createFilteredListener,
  getDefaultAuditEmitter,
  resetDefaultAuditEmitter,
  type AuditEvent,
  type EventFilter,
} from './audit-emitter';

describe('AuditEventEmitter', () => {
  let emitter: AuditEventEmitter;

  beforeEach(() => {
    emitter = new AuditEventEmitter({
      retentionPeriodMs: 1000, // 1 second for testing
      aggregationIntervalMs: 100, // 100ms for testing
      enableAggregation: true,
    });
  });

  afterEach(() => {
    emitter.destroy();
  });

  describe('Event Emission', () => {
    describe('emitAuthSuccess', () => {
      it('should emit auth success event with correct type and timestamp', (done) => {
        const testData = {
          tenantId: 'tenant-123',
          apiId: 'api-456',
          authMethod: AuthMethod.OAUTH2,
          userId: 'user-789',
          sessionId: 'session-abc',
        };

        emitter.on(AuditEventType.AUTH_SUCCESS, (event: AuthSuccessEvent) => {
          expect(event.type).toBe(AuditEventType.AUTH_SUCCESS);
          expect(event.tenantId).toBe(testData.tenantId);
          expect(event.apiId).toBe(testData.apiId);
          expect(event.authMethod).toBe(testData.authMethod);
          expect(event.userId).toBe(testData.userId);
          expect(event.sessionId).toBe(testData.sessionId);
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        });

        emitter.emitAuthSuccess(testData);
      });

      it('should emit auth success event with metadata', (done) => {
        const testData = {
          tenantId: 'tenant-123',
          apiId: 'api-456',
          authMethod: AuthMethod.API_KEY,
          metadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'TestAgent/1.0',
          },
        };

        emitter.on(AuditEventType.AUTH_SUCCESS, (event: AuthSuccessEvent) => {
          expect(event.metadata?.ipAddress).toBe('192.168.1.1');
          expect(event.metadata?.userAgent).toBe('TestAgent/1.0');
          done();
        });

        emitter.emitAuthSuccess(testData);
      });
    });

    describe('emitAuthFailure', () => {
      it('should emit auth failure event with reason', (done) => {
        const testData = {
          tenantId: 'tenant-123',
          apiId: 'api-456',
          authMethod: AuthMethod.BASIC_AUTH,
          reason: 'Invalid credentials',
          errorCode: 'AUTH_001',
          attemptCount: 3,
        };

        emitter.on(AuditEventType.AUTH_FAILURE, (event: AuthFailureEvent) => {
          expect(event.type).toBe(AuditEventType.AUTH_FAILURE);
          expect(event.reason).toBe(testData.reason);
          expect(event.errorCode).toBe(testData.errorCode);
          expect(event.attemptCount).toBe(testData.attemptCount);
          done();
        });

        emitter.emitAuthFailure(testData);
      });
    });

    describe('emitTokenRefresh', () => {
      it('should emit token refresh event', (done) => {
        const testData = {
          tenantId: 'tenant-123',
          apiId: 'api-456',
          authMethod: AuthMethod.OAUTH2,
          oldTokenId: 'token-old',
          newTokenId: 'token-new',
          expiresAt: new Date(Date.now() + 3600000),
        };

        emitter.on(AuditEventType.TOKEN_REFRESH, (event: TokenRefreshEvent) => {
          expect(event.type).toBe(AuditEventType.TOKEN_REFRESH);
          expect(event.oldTokenId).toBe(testData.oldTokenId);
          expect(event.newTokenId).toBe(testData.newTokenId);
          expect(event.expiresAt).toEqual(testData.expiresAt);
          done();
        });

        emitter.emitTokenRefresh(testData);
      });
    });

    describe('emitTokenExpired', () => {
      it('should emit token expired event', (done) => {
        const expiredAt = new Date(Date.now() - 1000);
        const testData = {
          tenantId: 'tenant-123',
          apiId: 'api-456',
          authMethod: AuthMethod.BEARER_TOKEN,
          tokenId: 'token-expired',
          expiredAt,
        };

        emitter.on(AuditEventType.TOKEN_EXPIRED, (event: TokenExpiredEvent) => {
          expect(event.type).toBe(AuditEventType.TOKEN_EXPIRED);
          expect(event.tokenId).toBe(testData.tokenId);
          expect(event.expiredAt).toEqual(expiredAt);
          done();
        });

        emitter.emitTokenExpired(testData);
      });
    });

    describe('emitCredentialDecryptionError', () => {
      it('should emit credential decryption error event', (done) => {
        const testData = {
          tenantId: 'tenant-123',
          apiId: 'api-456',
          authMethod: AuthMethod.CUSTOM,
          errorMessage: 'Decryption failed',
          credentialType: 'encrypted_password',
          metadata: {
            encryptionAlgorithm: 'AES-256-GCM',
          },
        };

        emitter.on(
          AuditEventType.CREDENTIAL_DECRYPTION_ERROR,
          (event: CredentialDecryptionErrorEvent) => {
            expect(event.type).toBe(AuditEventType.CREDENTIAL_DECRYPTION_ERROR);
            expect(event.errorMessage).toBe(testData.errorMessage);
            expect(event.credentialType).toBe(testData.credentialType);
            expect(event.metadata?.encryptionAlgorithm).toBe('AES-256-GCM');
            done();
          }
        );

        emitter.emitCredentialDecryptionError(testData);
      });
    });

    it('should emit wildcard event for all event types', (done) => {
      let eventCount = 0;

      emitter.on('*', (event: AuditEvent) => {
        eventCount++;
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('tenantId');
        expect(event).toHaveProperty('apiId');
        expect(event).toHaveProperty('authMethod');

        if (eventCount === 3) {
          done();
        }
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthFailure({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
        reason: 'Test failure',
      });

      emitter.emitTokenRefresh({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });
    });
  });

  describe('Event History', () => {
    it('should store events in history', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthFailure({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
        reason: 'Test',
      });

      expect(emitter.getHistorySize()).toBe(2);
    });

    it('should clear history', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      expect(emitter.getHistorySize()).toBe(1);
      emitter.clearHistory();
      expect(emitter.getHistorySize()).toBe(0);
    });

    it('should clean up old events based on retention period', (done) => {
      // Set up a short retention period for testing
      const shortRetentionEmitter = new AuditEventEmitter({
        retentionPeriodMs: 100,
      });

      shortRetentionEmitter.on('cleanup', (data) => {
        expect(data.removed).toBeGreaterThan(0);
        expect(data.remaining).toBeLessThan(2);
        shortRetentionEmitter.destroy();
        done();
      });

      shortRetentionEmitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      shortRetentionEmitter.emitAuthSuccess({
        tenantId: 'tenant-456',
        apiId: 'api-789',
        authMethod: AuthMethod.API_KEY,
      });

      expect(shortRetentionEmitter.getHistorySize()).toBe(2);
    }, 1000);
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      // Set up test data
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-2',
        apiId: 'api-2',
        authMethod: AuthMethod.API_KEY,
      });

      emitter.emitAuthFailure({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
        reason: 'Test',
      });

      emitter.emitTokenRefresh({
        tenantId: 'tenant-3',
        apiId: 'api-3',
        authMethod: AuthMethod.BEARER_TOKEN,
      });
    });

    it('should filter events by tenant ID', () => {
      const filter: EventFilter = {
        tenantIds: ['tenant-1'],
      };

      const filtered = emitter.getFilteredEvents(filter);
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.tenantId === 'tenant-1')).toBe(true);
    });

    it('should filter events by API ID', () => {
      const filter: EventFilter = {
        apiIds: ['api-2'],
      };

      const filtered = emitter.getFilteredEvents(filter);
      expect(filtered.length).toBe(1);
      expect(filtered[0].apiId).toBe('api-2');
    });

    it('should filter events by auth method', () => {
      const filter: EventFilter = {
        authMethods: [AuthMethod.OAUTH2],
      };

      const filtered = emitter.getFilteredEvents(filter);
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.authMethod === AuthMethod.OAUTH2)).toBe(true);
    });

    it('should filter events by event type', () => {
      const filter: EventFilter = {
        eventTypes: [AuditEventType.AUTH_SUCCESS],
      };

      const filtered = emitter.getFilteredEvents(filter);
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.type === AuditEventType.AUTH_SUCCESS)).toBe(
        true
      );
    });

    it('should filter events by multiple criteria', () => {
      const filter: EventFilter = {
        tenantIds: ['tenant-1'],
        eventTypes: [AuditEventType.AUTH_SUCCESS],
      };

      const filtered = emitter.getFilteredEvents(filter);
      expect(filtered.length).toBe(1);
      expect(filtered[0].tenantId).toBe('tenant-1');
      expect(filtered[0].type).toBe(AuditEventType.AUTH_SUCCESS);
    });
  });

  describe('Event Counting', () => {
    beforeEach(() => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-2',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthFailure({
        tenantId: 'tenant-2',
        apiId: 'api-1',
        authMethod: AuthMethod.API_KEY,
        reason: 'Test',
      });
    });

    it('should count events by type', () => {
      const successCount = emitter.getEventCountByType(
        AuditEventType.AUTH_SUCCESS
      );
      const failureCount = emitter.getEventCountByType(
        AuditEventType.AUTH_FAILURE
      );

      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
    });

    it('should count events by tenant', () => {
      const tenant1Count = emitter.getEventCountByTenant('tenant-1');
      const tenant2Count = emitter.getEventCountByTenant('tenant-2');

      expect(tenant1Count).toBe(2);
      expect(tenant2Count).toBe(1);
    });

    it('should count events by API', () => {
      const api1Count = emitter.getEventCountByApi('api-1');
      const api2Count = emitter.getEventCountByApi('api-2');

      expect(api1Count).toBe(2);
      expect(api2Count).toBe(1);
    });

    it('should count events by auth method', () => {
      const oauth2Count = emitter.getEventCountByAuthMethod(AuthMethod.OAUTH2);
      const apiKeyCount = emitter.getEventCountByAuthMethod(AuthMethod.API_KEY);

      expect(oauth2Count).toBe(2);
      expect(apiKeyCount).toBe(1);
    });
  });

  describe('Event Aggregation', () => {
    it('should aggregate events', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      const aggregations = emitter.getAggregations();
      expect(aggregations.length).toBeGreaterThan(0);

      const matchingAgg = aggregations.find(
        (a) =>
          a.eventType === AuditEventType.AUTH_SUCCESS &&
          a.tenantId === 'tenant-1' &&
          a.apiId === 'api-1' &&
          a.authMethod === AuthMethod.OAUTH2
      );

      expect(matchingAgg).toBeDefined();
      expect(matchingAgg?.count).toBe(3);
      expect(matchingAgg?.firstOccurrence).toBeInstanceOf(Date);
      expect(matchingAgg?.lastOccurrence).toBeInstanceOf(Date);
    });

    it('should aggregate different event types separately', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthFailure({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
        reason: 'Test',
      });

      const aggregations = emitter.getAggregations();
      expect(aggregations.length).toBe(2);
    });

    it('should filter aggregations', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthFailure({
        tenantId: 'tenant-2',
        apiId: 'api-2',
        authMethod: AuthMethod.API_KEY,
        reason: 'Test',
      });

      const filter: EventFilter = {
        tenantIds: ['tenant-1'],
      };

      const filtered = emitter.getFilteredAggregations(filter);
      expect(filtered.length).toBe(1);
      expect(filtered[0].tenantId).toBe('tenant-1');
    });

    it('should clear aggregations', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      expect(emitter.getAggregations().length).toBeGreaterThan(0);
      emitter.clearAggregations();
      expect(emitter.getAggregations().length).toBe(0);
    });

    it('should emit aggregation summary periodically', (done) => {
      emitter.on('aggregation_summary', (aggregations) => {
        expect(Array.isArray(aggregations)).toBe(true);
        done();
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });
    }, 500);
  });

  describe('Audit Service Hooks', () => {
    it('should call registered hooks on event emission', (done) => {
      const mockHook = vi.fn((event: AuditEvent) => {
        expect(event.type).toBe(AuditEventType.AUTH_SUCCESS);
        expect(event.tenantId).toBe('tenant-123');
        done();
      });

      emitter.registerAuditServiceHook(mockHook);

      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });
    });

    it('should call multiple hooks', async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      emitter.registerAuditServiceHook(hook1);
      emitter.registerAuditServiceHook(hook2);

      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      // Wait for async hooks
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
    });

    it('should support async hooks', async () => {
      let hookCalled = false;

      const asyncHook = async (event: AuditEvent) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        hookCalled = true;
      };

      emitter.registerAuditServiceHook(asyncHook);

      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(hookCalled).toBe(true);
    });

    it('should handle hook errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHook = () => {
        throw new Error('Hook error');
      };

      emitter.registerAuditServiceHook(errorHook);

      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should unregister hooks', async () => {
      const mockHook = vi.fn();

      emitter.registerAuditServiceHook(mockHook);
      emitter.unregisterAuditServiceHook(mockHook);

      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockHook).not.toHaveBeenCalled();
    });
  });

  describe('Filtered Listeners', () => {
    it('should create filtered listener', (done) => {
      const filter: EventFilter = {
        tenantIds: ['tenant-1'],
        eventTypes: [AuditEventType.AUTH_SUCCESS],
      };

      createFilteredListener(emitter, filter, (event) => {
        expect(event.tenantId).toBe('tenant-1');
        expect(event.type).toBe(AuditEventType.AUTH_SUCCESS);
        done();
      });

      // This should not trigger the listener
      emitter.emitAuthSuccess({
        tenantId: 'tenant-2',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      // This should trigger the listener
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });
    });

    it('should filter by auth method', (done) => {
      const filter: EventFilter = {
        authMethods: [AuthMethod.API_KEY],
      };

      let callCount = 0;

      createFilteredListener(emitter, filter, (event) => {
        callCount++;
        expect(event.authMethod).toBe(AuthMethod.API_KEY);
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-2',
        apiId: 'api-2',
        authMethod: AuthMethod.API_KEY,
      });

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 50);
    });
  });

  describe('Configuration', () => {
    it('should respect custom max listeners', () => {
      const customEmitter = new AuditEventEmitter({
        maxListeners: 50,
      });

      expect(customEmitter.getMaxListeners()).toBe(50);
      customEmitter.destroy();
    });

    it('should disable aggregation when configured', () => {
      const noAggEmitter = new AuditEventEmitter({
        enableAggregation: false,
      });

      noAggEmitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      expect(noAggEmitter.getAggregations().length).toBe(0);
      noAggEmitter.destroy();
    });
  });

  describe('Lifecycle', () => {
    it('should clean up resources on destroy', () => {
      const testEmitter = new AuditEventEmitter();

      testEmitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      expect(testEmitter.getHistorySize()).toBe(1);

      testEmitter.destroy();

      expect(testEmitter.getHistorySize()).toBe(0);
      expect(testEmitter.getAggregations().length).toBe(0);
    });
  });

  describe('Default Emitter', () => {
    afterEach(() => {
      resetDefaultAuditEmitter();
    });

    it('should create default emitter', () => {
      const emitter1 = getDefaultAuditEmitter();
      const emitter2 = getDefaultAuditEmitter();

      expect(emitter1).toBe(emitter2); // Same instance
    });

    it('should reset default emitter', () => {
      const emitter1 = getDefaultAuditEmitter();

      resetDefaultAuditEmitter();

      const emitter2 = getDefaultAuditEmitter();

      expect(emitter1).not.toBe(emitter2); // Different instances
    });

    it('should accept custom config for default emitter', () => {
      const emitter = getDefaultAuditEmitter({
        maxListeners: 200,
      });

      expect(emitter.getMaxListeners()).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with no metadata', (done) => {
      emitter.on(AuditEventType.AUTH_SUCCESS, (event: AuthSuccessEvent) => {
        expect(event.metadata).toBeUndefined();
        done();
      });

      emitter.emitAuthSuccess({
        tenantId: 'tenant-123',
        apiId: 'api-456',
        authMethod: AuthMethod.OAUTH2,
      });
    });

    it('should handle empty filter', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      const filter: EventFilter = {};
      const filtered = emitter.getFilteredEvents(filter);

      expect(filtered.length).toBe(1);
    });

    it('should handle filter with no matches', () => {
      emitter.emitAuthSuccess({
        tenantId: 'tenant-1',
        apiId: 'api-1',
        authMethod: AuthMethod.OAUTH2,
      });

      const filter: EventFilter = {
        tenantIds: ['non-existent'],
      };

      const filtered = emitter.getFilteredEvents(filter);
      expect(filtered.length).toBe(0);
    });

    it('should handle concurrent event emissions', () => {
      const eventCount = 100;

      for (let i = 0; i < eventCount; i++) {
        emitter.emitAuthSuccess({
          tenantId: `tenant-${i}`,
          apiId: `api-${i}`,
          authMethod: AuthMethod.OAUTH2,
        });
      }

      expect(emitter.getHistorySize()).toBe(eventCount);
    });
  });
});
