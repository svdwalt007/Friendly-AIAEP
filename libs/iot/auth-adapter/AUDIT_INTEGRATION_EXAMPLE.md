# Audit Event Emitter Integration Example

This document demonstrates how to integrate the `AuditEventEmitter` with the existing authentication handlers in the auth-adapter library.

## Integration with OAuth2 Handler

Here's a complete example showing how to integrate audit events with the OAuth2 authentication handler:

```typescript
import {
  OAuth2AuthHandler,
  AuditEventEmitter,
  AuthMethod,
  AuditEventType,
  getDefaultAuditEmitter,
  type OAuth2Config,
} from '@friendly-aiaep/auth-adapter';

// Initialize the audit emitter
const auditEmitter = getDefaultAuditEmitter({
  retentionPeriodMs: 7200000, // 2 hours
  aggregationIntervalMs: 300000, // 5 minutes
  enableAggregation: true,
});

// Configure OAuth2
const oauth2Config: OAuth2Config = {
  clientId: process.env.OAUTH2_CLIENT_ID!,
  clientSecret: process.env.OAUTH2_CLIENT_SECRET!,
  tokenUrl: process.env.OAUTH2_TOKEN_URL!,
  authUrl: process.env.OAUTH2_AUTH_URL!,
  redirectUri: process.env.OAUTH2_REDIRECT_URI!,
  scope: 'read write',
  grantType: 'client_credentials',
};

// Create OAuth2 handler
const oauth2Handler = createOAuth2Handler(oauth2Config);

// Wrapper function with audit events
async function authenticateWithAudit(
  tenantId: string,
  apiId: string
): Promise<string> {
  try {
    // Attempt to get access token
    const token = await oauth2Handler.getAccessToken();

    // Emit success event
    auditEmitter.emitAuthSuccess({
      tenantId,
      apiId,
      authMethod: AuthMethod.OAUTH2,
      metadata: {
        tokenType: 'access_token',
        scope: oauth2Config.scope,
      },
    });

    return token;
  } catch (error) {
    // Emit failure event
    auditEmitter.emitAuthFailure({
      tenantId,
      apiId,
      authMethod: AuthMethod.OAUTH2,
      reason: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'OAUTH2_AUTH_FAILED',
      metadata: {
        error: String(error),
      },
    });

    throw error;
  }
}

// Example: Token refresh with audit
async function refreshTokenWithAudit(
  tenantId: string,
  apiId: string,
  refreshToken: string
): Promise<string> {
  try {
    const oldToken = await oauth2Handler.getAccessToken();
    const newToken = await oauth2Handler.refreshAccessToken(refreshToken);

    // Emit token refresh event
    auditEmitter.emitTokenRefresh({
      tenantId,
      apiId,
      authMethod: AuthMethod.OAUTH2,
      oldTokenId: oldToken.substring(0, 16) + '...', // Truncate for security
      newTokenId: newToken.substring(0, 16) + '...',
      expiresAt: new Date(Date.now() + 3600000), // Assuming 1 hour expiry
      metadata: {
        refreshReason: 'token_expiration',
      },
    });

    return newToken;
  } catch (error) {
    auditEmitter.emitAuthFailure({
      tenantId,
      apiId,
      authMethod: AuthMethod.OAUTH2,
      reason: 'Token refresh failed',
      errorCode: 'OAUTH2_REFRESH_FAILED',
      metadata: {
        error: String(error),
      },
    });

    throw error;
  }
}

// Usage
async function main() {
  try {
    const token = await authenticateWithAudit('tenant-123', 'api-456');
    console.log('Authentication successful, token:', token.substring(0, 16) + '...');
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}
```

## Integration with Encryption Module

Here's how to emit audit events when credential decryption fails:

```typescript
import {
  decryptCredential,
  AuditEventEmitter,
  AuthMethod,
  getDefaultAuditEmitter,
  type EncryptedCredential,
} from '@friendly-aiaep/auth-adapter';

const auditEmitter = getDefaultAuditEmitter();

async function decryptCredentialWithAudit(
  encryptedCred: EncryptedCredential,
  tenantId: string,
  apiId: string,
  authMethod: AuthMethod
): Promise<string> {
  try {
    const decrypted = await decryptCredential(
      encryptedCred,
      process.env.ENCRYPTION_KEY!
    );
    return decrypted;
  } catch (error) {
    // Emit decryption error event
    auditEmitter.emitCredentialDecryptionError({
      tenantId,
      apiId,
      authMethod,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      credentialType: encryptedCred.type,
      metadata: {
        encryptionAlgorithm: 'AES-256-GCM',
        error: String(error),
      },
    });

    throw error;
  }
}
```

## Complete Authentication Service with Audit

Here's a complete example of an authentication service with integrated audit logging:

```typescript
import {
  OAuth2AuthHandler,
  AuditEventEmitter,
  AuthMethod,
  AuditEventType,
  getDefaultAuditEmitter,
  createFilteredListener,
  type OAuth2Config,
  type EventFilter,
} from '@friendly-aiaep/auth-adapter';

export class AuthenticationService {
  private oauth2Handler: OAuth2AuthHandler;
  private auditEmitter: AuditEventEmitter;
  private tenantId: string;
  private apiId: string;

  constructor(
    oauth2Config: OAuth2Config,
    tenantId: string,
    apiId: string
  ) {
    this.oauth2Handler = new OAuth2AuthHandler(oauth2Config);
    this.auditEmitter = getDefaultAuditEmitter();
    this.tenantId = tenantId;
    this.apiId = apiId;

    this.setupAuditListeners();
  }

  /**
   * Set up audit event listeners for monitoring
   */
  private setupAuditListeners(): void {
    // Monitor all events for this tenant/API combination
    const filter: EventFilter = {
      tenantIds: [this.tenantId],
      apiIds: [this.apiId],
    };

    createFilteredListener(this.auditEmitter, filter, (event) => {
      console.log(`[${event.type}] ${event.timestamp.toISOString()}`);

      // Log failures prominently
      if (event.type === AuditEventType.AUTH_FAILURE) {
        console.error(`Authentication failed: ${event.reason}`);
      }
    });

    // Monitor high failure rates
    this.auditEmitter.on('aggregation_summary', (aggregations) => {
      const failures = aggregations.filter(
        (a) =>
          a.eventType === AuditEventType.AUTH_FAILURE &&
          a.tenantId === this.tenantId &&
          a.apiId === this.apiId &&
          a.count > 5
      );

      if (failures.length > 0) {
        console.warn(
          `High failure rate detected for ${this.tenantId}/${this.apiId}`
        );
      }
    });
  }

  /**
   * Authenticate and get access token
   */
  public async authenticate(): Promise<string> {
    try {
      const token = await this.oauth2Handler.getAccessToken();

      this.auditEmitter.emitAuthSuccess({
        tenantId: this.tenantId,
        apiId: this.apiId,
        authMethod: AuthMethod.OAUTH2,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      return token;
    } catch (error) {
      this.auditEmitter.emitAuthFailure({
        tenantId: this.tenantId,
        apiId: this.apiId,
        authMethod: AuthMethod.OAUTH2,
        reason: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'AUTH_FAILED',
      });

      throw error;
    }
  }

  /**
   * Refresh access token
   */
  public async refreshToken(refreshToken: string): Promise<string> {
    try {
      const newToken = await this.oauth2Handler.refreshAccessToken(refreshToken);

      this.auditEmitter.emitTokenRefresh({
        tenantId: this.tenantId,
        apiId: this.apiId,
        authMethod: AuthMethod.OAUTH2,
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {
          refreshReason: 'manual_refresh',
        },
      });

      return newToken;
    } catch (error) {
      this.auditEmitter.emitAuthFailure({
        tenantId: this.tenantId,
        apiId: this.apiId,
        authMethod: AuthMethod.OAUTH2,
        reason: 'Token refresh failed',
        errorCode: 'REFRESH_FAILED',
      });

      throw error;
    }
  }

  /**
   * Revoke access token
   */
  public async revokeToken(token: string): Promise<void> {
    try {
      await this.oauth2Handler.revokeAccessToken(token);

      this.auditEmitter.emitTokenExpired({
        tenantId: this.tenantId,
        apiId: this.apiId,
        authMethod: AuthMethod.OAUTH2,
        tokenId: token.substring(0, 16) + '...',
        expiredAt: new Date(),
        metadata: {
          revocationReason: 'manual_revocation',
        },
      });
    } catch (error) {
      console.error('Token revocation failed:', error);
      throw error;
    }
  }

  /**
   * Get authentication statistics for this service
   */
  public getStats() {
    const filter: EventFilter = {
      tenantIds: [this.tenantId],
      apiIds: [this.apiId],
    };

    const events = this.auditEmitter.getFilteredEvents(filter);

    const successCount = events.filter(
      (e) => e.type === AuditEventType.AUTH_SUCCESS
    ).length;

    const failureCount = events.filter(
      (e) => e.type === AuditEventType.AUTH_FAILURE
    ).length;

    const refreshCount = events.filter(
      (e) => e.type === AuditEventType.TOKEN_REFRESH
    ).length;

    return {
      tenantId: this.tenantId,
      apiId: this.apiId,
      totalEvents: events.length,
      successCount,
      failureCount,
      refreshCount,
      successRate: successCount / (successCount + failureCount) * 100 || 0,
    };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Note: We don't destroy the default emitter as it may be shared
    // Only remove listeners specific to this instance if needed
  }
}

// Usage example
async function exampleUsage() {
  const oauth2Config: OAuth2Config = {
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
    tokenUrl: 'https://oauth.example.com/token',
    authUrl: 'https://oauth.example.com/authorize',
    redirectUri: 'https://myapp.example.com/callback',
    scope: 'read write',
    grantType: 'client_credentials',
  };

  const authService = new AuthenticationService(
    oauth2Config,
    'tenant-123',
    'api-456'
  );

  try {
    // Authenticate
    const token = await authService.authenticate();
    console.log('Token obtained:', token.substring(0, 16) + '...');

    // Get stats
    const stats = authService.getStats();
    console.log('Authentication stats:', stats);

    // Clean up
    authService.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Integration with Audit Service

Here's how to connect the audit emitter to an external audit service:

```typescript
import {
  getDefaultAuditEmitter,
  type AuditServiceHook,
  type AuditEvent,
} from '@friendly-aiaep/auth-adapter';

// Example audit service client
class AuditServiceClient {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async sendEvent(event: AuditEvent): Promise<void> {
    try {
      await fetch(`${this.apiUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AUDIT_SERVICE_TOKEN}`,
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to send audit event:', error);
      // Don't throw - we don't want audit failures to break auth
    }
  }
}

// Set up integration
function setupAuditServiceIntegration() {
  const emitter = getDefaultAuditEmitter();
  const auditClient = new AuditServiceClient('https://audit.example.com/api');

  // Register hook to send all events to audit service
  const auditServiceHook: AuditServiceHook = async (event) => {
    await auditClient.sendEvent(event);
  };

  emitter.registerAuditServiceHook(auditServiceHook);

  console.log('Audit service integration configured');
}
```

## Real-time Security Monitoring

Example of using audit events for real-time security monitoring:

```typescript
import {
  getDefaultAuditEmitter,
  AuditEventType,
  AuthMethod,
  type AuthFailureEvent,
} from '@friendly-aiaep/auth-adapter';

class SecurityMonitor {
  private emitter = getDefaultAuditEmitter();
  private failureThreshold = 5;
  private failureWindow = 300000; // 5 minutes
  private failureTracker = new Map<string, number[]>();

  constructor() {
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    // Monitor authentication failures
    this.emitter.on(
      AuditEventType.AUTH_FAILURE,
      (event: AuthFailureEvent) => {
        this.trackFailure(event);
        this.checkForBruteForce(event);
      }
    );

    // Monitor credential decryption errors
    this.emitter.on(
      AuditEventType.CREDENTIAL_DECRYPTION_ERROR,
      (event) => {
        this.handleCriticalError(event);
      }
    );

    // Clean up old tracking data periodically
    setInterval(() => {
      this.cleanupOldFailures();
    }, 60000); // Every minute
  }

  private trackFailure(event: AuthFailureEvent): void {
    const key = `${event.tenantId}:${event.apiId}`;
    const failures = this.failureTracker.get(key) || [];
    failures.push(Date.now());
    this.failureTracker.set(key, failures);
  }

  private checkForBruteForce(event: AuthFailureEvent): void {
    const key = `${event.tenantId}:${event.apiId}`;
    const failures = this.failureTracker.get(key) || [];
    const now = Date.now();

    // Count recent failures
    const recentFailures = failures.filter(
      (timestamp) => now - timestamp < this.failureWindow
    );

    if (recentFailures.length >= this.failureThreshold) {
      this.alertBruteForce(event, recentFailures.length);
    }
  }

  private alertBruteForce(
    event: AuthFailureEvent,
    failureCount: number
  ): void {
    console.error(
      `SECURITY ALERT: Possible brute force attack detected!`,
      {
        tenantId: event.tenantId,
        apiId: event.apiId,
        authMethod: event.authMethod,
        failureCount,
        lastFailure: event.timestamp,
      }
    );

    // In production, send alert to security team
    // await this.notifySecurityTeam(event, failureCount);
  }

  private handleCriticalError(event: AuditEvent): void {
    console.error('SECURITY ALERT: Credential decryption error!', {
      tenantId: event.tenantId,
      apiId: event.apiId,
      timestamp: event.timestamp,
    });
  }

  private cleanupOldFailures(): void {
    const now = Date.now();

    for (const [key, failures] of this.failureTracker.entries()) {
      const recentFailures = failures.filter(
        (timestamp) => now - timestamp < this.failureWindow
      );

      if (recentFailures.length === 0) {
        this.failureTracker.delete(key);
      } else {
        this.failureTracker.set(key, recentFailures);
      }
    }
  }
}

// Initialize security monitoring
const securityMonitor = new SecurityMonitor();
```

## Summary

The audit event emitter provides:

1. **Type-safe event emission** for all authentication operations
2. **Flexible filtering** by tenant, API, and authentication method
3. **Event aggregation** for monitoring and analytics
4. **Easy integration** with external audit services via hooks
5. **Real-time monitoring** capabilities for security events
6. **Configurable retention** for compliance requirements

Use these patterns to integrate comprehensive audit logging throughout your authentication workflows.
