# Audit Event Emitter Usage Guide

The `AuditEventEmitter` provides a comprehensive event-driven audit logging system for IoT authentication operations. This guide covers installation, configuration, and common usage patterns.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Event Types](#event-types)
- [Configuration](#configuration)
- [Event Filtering](#event-filtering)
- [Event Aggregation](#event-aggregation)
- [Audit Service Integration](#audit-service-integration)
- [Advanced Examples](#advanced-examples)

## Installation

The audit emitter is part of the `auth-adapter` library:

```typescript
import {
  AuditEventEmitter,
  AuditEventType,
  AuthMethod
} from '@friendly-aiaep/auth-adapter';
```

## Basic Usage

### Creating an Emitter

```typescript
import { AuditEventEmitter } from '@friendly-aiaep/auth-adapter';

// Create with default configuration
const emitter = new AuditEventEmitter();

// Or with custom configuration
const customEmitter = new AuditEventEmitter({
  maxListeners: 100,
  retentionPeriodMs: 3600000, // 1 hour
  aggregationIntervalMs: 60000, // 1 minute
  enableAggregation: true,
});
```

### Using the Default Singleton

```typescript
import { getDefaultAuditEmitter } from '@friendly-aiaep/auth-adapter';

const emitter = getDefaultAuditEmitter();
```

### Emitting Events

```typescript
import { AuthMethod } from '@friendly-aiaep/auth-adapter';

// Authentication success
emitter.emitAuthSuccess({
  tenantId: 'tenant-123',
  apiId: 'api-456',
  authMethod: AuthMethod.OAUTH2,
  userId: 'user-789',
  sessionId: 'session-abc',
  metadata: {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
  },
});

// Authentication failure
emitter.emitAuthFailure({
  tenantId: 'tenant-123',
  apiId: 'api-456',
  authMethod: AuthMethod.API_KEY,
  reason: 'Invalid API key',
  errorCode: 'AUTH_001',
  attemptCount: 3,
  metadata: {
    ipAddress: '192.168.1.100',
  },
});

// Token refresh
emitter.emitTokenRefresh({
  tenantId: 'tenant-123',
  apiId: 'api-456',
  authMethod: AuthMethod.OAUTH2,
  oldTokenId: 'token-old-123',
  newTokenId: 'token-new-456',
  expiresAt: new Date(Date.now() + 3600000),
  metadata: {
    refreshReason: 'token_expiration',
  },
});

// Token expired
emitter.emitTokenExpired({
  tenantId: 'tenant-123',
  apiId: 'api-456',
  authMethod: AuthMethod.BEARER_TOKEN,
  tokenId: 'token-expired-789',
  expiredAt: new Date(),
  metadata: {
    gracePeriodUsed: false,
  },
});

// Credential decryption error
emitter.emitCredentialDecryptionError({
  tenantId: 'tenant-123',
  apiId: 'api-456',
  authMethod: AuthMethod.CUSTOM,
  errorMessage: 'Failed to decrypt credential',
  credentialType: 'encrypted_password',
  metadata: {
    encryptionAlgorithm: 'AES-256-GCM',
  },
});
```

### Listening to Events

```typescript
import { AuditEventType, AuthSuccessEvent } from '@friendly-aiaep/auth-adapter';

// Listen to specific event types
emitter.on(AuditEventType.AUTH_SUCCESS, (event: AuthSuccessEvent) => {
  console.log(`Auth success for tenant ${event.tenantId}`);
  console.log(`User: ${event.userId}, Time: ${event.timestamp}`);
});

// Listen to all events
emitter.on('*', (event) => {
  console.log(`Event: ${event.type} at ${event.timestamp}`);
});

// Listen to aggregation summaries
emitter.on('aggregation_summary', (aggregations) => {
  console.log(`Total aggregations: ${aggregations.length}`);
});

// Listen to cleanup events
emitter.on('cleanup', (data) => {
  console.log(`Cleaned up ${data.removed} old events, ${data.remaining} remaining`);
});
```

## Event Types

### Available Event Types

```typescript
enum AuditEventType {
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_EXPIRED = 'token_expired',
  CREDENTIAL_DECRYPTION_ERROR = 'credential_decryption_error',
}
```

### Authentication Methods

```typescript
enum AuthMethod {
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  BASIC_AUTH = 'basic_auth',
  BEARER_TOKEN = 'bearer_token',
  CUSTOM = 'custom',
}
```

## Configuration

### Configuration Options

```typescript
interface AuditEventEmitterConfig {
  // Maximum number of event listeners (default: 100)
  maxListeners?: number;

  // How long to retain events in milliseconds (default: 3600000 - 1 hour)
  retentionPeriodMs?: number;

  // How often to emit aggregation summaries in milliseconds (default: 60000 - 1 minute)
  aggregationIntervalMs?: number;

  // Enable/disable event aggregation (default: true)
  enableAggregation?: boolean;
}
```

### Example Configuration

```typescript
const emitter = new AuditEventEmitter({
  maxListeners: 200,
  retentionPeriodMs: 7200000, // 2 hours
  aggregationIntervalMs: 300000, // 5 minutes
  enableAggregation: true,
});
```

## Event Filtering

### Filter by Tenant, API, and Method

```typescript
import { EventFilter } from '@friendly-aiaep/auth-adapter';

const filter: EventFilter = {
  tenantIds: ['tenant-123', 'tenant-456'],
  apiIds: ['api-789'],
  authMethods: [AuthMethod.OAUTH2, AuthMethod.API_KEY],
  eventTypes: [AuditEventType.AUTH_SUCCESS, AuditEventType.AUTH_FAILURE],
};

// Get filtered events from history
const filteredEvents = emitter.getFilteredEvents(filter);
console.log(`Found ${filteredEvents.length} matching events`);

// Get filtered aggregations
const filteredAggs = emitter.getFilteredAggregations(filter);
console.log(`Found ${filteredAggs.length} matching aggregations`);
```

### Create Filtered Listener

```typescript
import { createFilteredListener } from '@friendly-aiaep/auth-adapter';

// Only receive events for specific tenant
const tenantFilter: EventFilter = {
  tenantIds: ['tenant-123'],
};

createFilteredListener(emitter, tenantFilter, (event) => {
  console.log(`Event for tenant-123: ${event.type}`);
});
```

## Event Aggregation

### Accessing Aggregation Data

```typescript
// Get all aggregations
const allAggregations = emitter.getAggregations();

allAggregations.forEach((agg) => {
  console.log(`Event Type: ${agg.eventType}`);
  console.log(`Count: ${agg.count}`);
  console.log(`First: ${agg.firstOccurrence}`);
  console.log(`Last: ${agg.lastOccurrence}`);
  console.log(`Tenant: ${agg.tenantId}`);
  console.log(`API: ${agg.apiId}`);
  console.log(`Method: ${agg.authMethod}`);
});
```

### Monitoring Aggregations

```typescript
emitter.on('aggregation_summary', (aggregations) => {
  // Find high-frequency failures
  const failures = aggregations.filter(
    (a) => a.eventType === AuditEventType.AUTH_FAILURE && a.count > 10
  );

  if (failures.length > 0) {
    console.warn('High failure rate detected:', failures);
  }
});
```

## Audit Service Integration

### Registering Hooks

```typescript
import { AuditServiceHook, AuditEvent } from '@friendly-aiaep/auth-adapter';

// Synchronous hook
const syncHook: AuditServiceHook = (event: AuditEvent) => {
  // Send to logging service
  console.log('Audit event:', event);
};

// Asynchronous hook
const asyncHook: AuditServiceHook = async (event: AuditEvent) => {
  // Send to external audit service
  await fetch('https://audit-service.example.com/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
};

emitter.registerAuditServiceHook(syncHook);
emitter.registerAuditServiceHook(asyncHook);
```

### Integration with External Audit Service

```typescript
class AuditServiceIntegration {
  private emitter: AuditEventEmitter;

  constructor(emitter: AuditEventEmitter) {
    this.emitter = emitter;
    this.setupHooks();
  }

  private setupHooks(): void {
    // Hook for critical events
    this.emitter.registerAuditServiceHook(async (event) => {
      if (
        event.type === AuditEventType.AUTH_FAILURE ||
        event.type === AuditEventType.CREDENTIAL_DECRYPTION_ERROR
      ) {
        await this.sendToSecurityTeam(event);
      }
    });

    // Hook for all events
    this.emitter.registerAuditServiceHook(async (event) => {
      await this.persistToDatabase(event);
    });
  }

  private async sendToSecurityTeam(event: AuditEvent): Promise<void> {
    // Send alert to security team
    console.log('Security alert:', event);
  }

  private async persistToDatabase(event: AuditEvent): Promise<void> {
    // Save to database
    console.log('Persisting event:', event.type);
  }
}

const integration = new AuditServiceIntegration(emitter);
```

## Advanced Examples

### Monitoring Failed Authentications

```typescript
// Track failed authentication attempts per tenant
const failureTracker = new Map<string, number>();

emitter.on(AuditEventType.AUTH_FAILURE, (event) => {
  const count = failureTracker.get(event.tenantId) || 0;
  failureTracker.set(event.tenantId, count + 1);

  // Alert if too many failures
  if (count + 1 > 5) {
    console.warn(
      `High failure rate for tenant ${event.tenantId}: ${count + 1} failures`
    );
  }
});
```

### Security Monitoring Dashboard

```typescript
class SecurityMonitor {
  private emitter: AuditEventEmitter;
  private stats = {
    successCount: 0,
    failureCount: 0,
    refreshCount: 0,
    expiredCount: 0,
    decryptionErrors: 0,
  };

  constructor(emitter: AuditEventEmitter) {
    this.emitter = emitter;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.emitter.on(AuditEventType.AUTH_SUCCESS, () => {
      this.stats.successCount++;
    });

    this.emitter.on(AuditEventType.AUTH_FAILURE, () => {
      this.stats.failureCount++;
    });

    this.emitter.on(AuditEventType.TOKEN_REFRESH, () => {
      this.stats.refreshCount++;
    });

    this.emitter.on(AuditEventType.TOKEN_EXPIRED, () => {
      this.stats.expiredCount++;
    });

    this.emitter.on(AuditEventType.CREDENTIAL_DECRYPTION_ERROR, () => {
      this.stats.decryptionErrors++;
    });
  }

  public getStats() {
    return {
      ...this.stats,
      successRate: this.calculateSuccessRate(),
    };
  }

  private calculateSuccessRate(): number {
    const total = this.stats.successCount + this.stats.failureCount;
    return total > 0 ? (this.stats.successCount / total) * 100 : 0;
  }

  public printDashboard(): void {
    console.log('=== Security Monitor Dashboard ===');
    console.log(`Successful Authentications: ${this.stats.successCount}`);
    console.log(`Failed Authentications: ${this.stats.failureCount}`);
    console.log(`Token Refreshes: ${this.stats.refreshCount}`);
    console.log(`Token Expirations: ${this.stats.expiredCount}`);
    console.log(`Decryption Errors: ${this.stats.decryptionErrors}`);
    console.log(`Success Rate: ${this.getStats().successRate.toFixed(2)}%`);
  }
}

const monitor = new SecurityMonitor(emitter);

// Print dashboard every minute
setInterval(() => {
  monitor.printDashboard();
}, 60000);
```

### Per-API Analytics

```typescript
class APIAnalytics {
  private emitter: AuditEventEmitter;

  constructor(emitter: AuditEventEmitter) {
    this.emitter = emitter;
  }

  public getAPIMetrics(apiId: string) {
    const apiEvents = this.emitter.getFilteredEvents({
      apiIds: [apiId],
    });

    const successCount = apiEvents.filter(
      (e) => e.type === AuditEventType.AUTH_SUCCESS
    ).length;

    const failureCount = apiEvents.filter(
      (e) => e.type === AuditEventType.AUTH_FAILURE
    ).length;

    const refreshCount = apiEvents.filter(
      (e) => e.type === AuditEventType.TOKEN_REFRESH
    ).length;

    return {
      apiId,
      totalEvents: apiEvents.length,
      successCount,
      failureCount,
      refreshCount,
      successRate: successCount / (successCount + failureCount) * 100 || 0,
      authMethods: this.getAuthMethodsUsed(apiEvents),
    };
  }

  private getAuthMethodsUsed(events: AuditEvent[]): string[] {
    const methods = new Set(events.map((e) => e.authMethod));
    return Array.from(methods);
  }
}

const analytics = new APIAnalytics(emitter);
const metrics = analytics.getAPIMetrics('api-456');
console.log('API Metrics:', metrics);
```

### Cleanup and Lifecycle Management

```typescript
// Clean up when done
emitter.clearHistory();
emitter.clearAggregations();

// Destroy emitter and free resources
emitter.destroy();

// Reset default emitter (useful for testing)
import { resetDefaultAuditEmitter } from '@friendly-aiaep/auth-adapter';
resetDefaultAuditEmitter();
```

## Best Practices

1. **Use the Default Singleton**: For most applications, use `getDefaultAuditEmitter()` to ensure consistent audit logging across your application.

2. **Register Hooks Early**: Register audit service hooks during application initialization to ensure all events are captured.

3. **Filter Events Efficiently**: Use event filters to process only relevant events, reducing overhead.

4. **Monitor Aggregations**: Use aggregation data to detect patterns and anomalies without processing individual events.

5. **Handle Hook Errors**: Audit service hooks should handle errors gracefully to prevent failures from affecting event emission.

6. **Configure Retention**: Set appropriate retention periods based on your compliance requirements and memory constraints.

7. **Clean Up**: Always call `destroy()` when shutting down to properly clean up timers and listeners.

## TypeScript Type Definitions

All types are fully typed for TypeScript users:

```typescript
import {
  AuditEventEmitter,
  AuditEventType,
  AuthMethod,
  BaseAuditEvent,
  AuthSuccessEvent,
  AuthFailureEvent,
  TokenRefreshEvent,
  TokenExpiredEvent,
  CredentialDecryptionErrorEvent,
  AuditEvent,
  EventFilter,
  EventAggregation,
  AuditEventEmitterConfig,
  AuditServiceHook,
} from '@friendly-aiaep/auth-adapter';
```

## Testing

The audit emitter includes comprehensive test coverage. See `audit-emitter.spec.ts` for examples of testing patterns.

```typescript
import { AuditEventEmitter, AuditEventType } from '@friendly-aiaep/auth-adapter';

describe('My Audit Tests', () => {
  let emitter: AuditEventEmitter;

  beforeEach(() => {
    emitter = new AuditEventEmitter();
  });

  afterEach(() => {
    emitter.destroy();
  });

  it('should emit auth success event', (done) => {
    emitter.on(AuditEventType.AUTH_SUCCESS, (event) => {
      expect(event.tenantId).toBe('test-tenant');
      done();
    });

    emitter.emitAuthSuccess({
      tenantId: 'test-tenant',
      apiId: 'test-api',
      authMethod: AuthMethod.OAUTH2,
    });
  });
});
```
