# Session Manager Quick Start Guide

## Overview

The `SessionManager` manages preview session lifecycle in the Friendly AI AEP Tool. It provides:

- Preview session creation and tracking in Prisma database
- Tier-based concurrent session limits (FREE: 1, STARTER: 3, PROFESSIONAL: 10, ENTERPRISE: 50)
- Activity tracking with 30-minute auto-expiration
- Session status and listing capabilities
- Background cleanup for inactive and expired sessions

## Installation

The session manager is part of the `@friendly-tech/builder/preview-runtime` library:

```typescript
import {
  SessionManager,
  sessionManager, // singleton instance
  SessionLimitError,
  SessionNotFoundError,
  SessionExpiredError,
  SessionConfig,
} from '@friendly-tech/builder/preview-runtime';

import { PreviewMode } from '@friendly-tech/builder/preview-runtime';
```

## Quick Start

### 1. Create a Preview Session

```typescript
import { sessionManager, PreviewMode } from '@friendly-tech/builder/preview-runtime';

// Create a new preview session
const session = await sessionManager.createSession(
  'project-123',        // projectId
  'tenant-456',         // tenantId
  'user-789',           // userId
  PreviewMode.MOCK,     // mode (MOCK, LIVE, or DISCONNECTED_SIM)
  ['container-abc'],    // containerIds
  3000                  // port
);

console.log('Session created:', session.id);
console.log('Session token:', session.sessionToken);
```

### 2. Update Session Activity

```typescript
// Update activity timestamp (extends session lifetime)
await sessionManager.updateActivity(session.id);
```

### 3. Get Session Information

```typescript
// Get session by ID
const session = await sessionManager.getSession('session-123');

// Get session by token
const sessionByToken = await sessionManager.getSessionByToken('abc123token');

// Access session config
const config = session.config as SessionConfig;
console.log('Mode:', config.mode);
console.log('Port:', config.port);
console.log('Container IDs:', config.containerIds);
```

### 4. List Active Sessions

```typescript
// List all active sessions for a tenant
const sessions = await sessionManager.listActiveSessions('tenant-456');

console.log(`Found ${sessions.length} active sessions`);
sessions.forEach(s => {
  console.log(`- ${s.id}: ${s.project.name} (${s.user.name})`);
});
```

### 5. Check Session Limits

```typescript
import { Tier } from '@friendly-tech/data/prisma-schema';

// Check if tenant can create a new session
const canCreate = await sessionManager.checkConcurrencyLimit(
  'tenant-456',
  Tier.STARTER
);

if (!canCreate) {
  console.log('Session limit reached!');
}
```

### 6. Expire Sessions

```typescript
// Manually expire a session
await sessionManager.expireSession('session-123');

// Background cleanup: expire sessions inactive for 30+ minutes
const inactiveCount = await sessionManager.expireInactiveSessions();
console.log(`Expired ${inactiveCount} inactive sessions`);

// Background cleanup: expire sessions past expiresAt
const expiredCount = await sessionManager.expireExpiredSessions();
console.log(`Expired ${expiredCount} expired sessions`);
```

### 7. Get Session Statistics

```typescript
// Get session stats for a tenant
const stats = await sessionManager.getSessionStats('tenant-456');

console.log(`Active sessions: ${stats.active}/${stats.limit}`);
console.log(`Total sessions: ${stats.total}`);
console.log(`Tier: ${stats.tier}`);
```

## Preview Modes

The session manager supports three preview modes:

```typescript
enum PreviewMode {
  MOCK = 'mock',                    // Mock APIs (development/testing)
  LIVE = 'live',                    // Real Friendly APIs (requires credentials)
  DISCONNECTED_SIM = 'disconnected-sim'  // Simulated connectivity drops
}
```

## Tier Limits

Session limits by tenant tier:

| Tier          | Concurrent Sessions | Description           |
|---------------|--------------------|-----------------------|
| FREE          | 1                  | Single preview only   |
| STARTER       | 3                  | Limited previews      |
| PROFESSIONAL  | 10                 | Multiple previews     |
| ENTERPRISE    | 50                 | High capacity         |

## Session Lifecycle

1. **Created**: Session is created with a 24-hour expiration time
2. **Active**: Session is active and tracks activity
3. **Inactive**: No activity for 30+ minutes (auto-expired by cleanup job)
4. **Expired**: Past expiresAt time or manually expired

## Error Handling

```typescript
import {
  SessionLimitError,
  SessionNotFoundError,
  SessionExpiredError,
} from '@friendly-tech/builder/preview-runtime';

try {
  const session = await sessionManager.createSession(
    projectId,
    tenantId,
    userId,
    PreviewMode.MOCK,
    ['container-1'],
    3000
  );
} catch (error) {
  if (error instanceof SessionLimitError) {
    console.error(`Session limit reached: ${error.limit} for ${error.tier} tier`);
  } else if (error instanceof SessionNotFoundError) {
    console.error('Session not found');
  } else if (error instanceof SessionExpiredError) {
    console.error('Session has expired');
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Background Cleanup Job

Set up a periodic cleanup job to expire inactive sessions:

```typescript
// Run every 5 minutes
setInterval(async () => {
  const inactiveCount = await sessionManager.expireInactiveSessions();
  const expiredCount = await sessionManager.expireExpiredSessions();

  console.log(`Cleanup: ${inactiveCount} inactive, ${expiredCount} expired`);
}, 5 * 60 * 1000);
```

## Session Config Structure

The `config` field in PreviewSession is a JSON object with the following structure:

```typescript
interface SessionConfig {
  mode: PreviewMode;                // Preview mode
  containerIds: string[];           // Docker container IDs
  port: number;                     // Preview port
  lastActivityAt: string;           // ISO timestamp of last activity
}
```

## Integration Example

### Fastify Route for Creating Preview Session

```typescript
import { sessionManager, PreviewMode } from '@friendly-tech/builder/preview-runtime';
import { SessionLimitError } from '@friendly-tech/builder/preview-runtime';

app.post('/api/preview/sessions', async (request, reply) => {
  const { projectId, mode, containerIds, port } = request.body;
  const { tenantId, userId } = request.user; // From JWT

  try {
    const session = await sessionManager.createSession(
      projectId,
      tenantId,
      userId,
      mode as PreviewMode,
      containerIds,
      port
    );

    return reply.code(201).send({
      sessionId: session.id,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    if (error instanceof SessionLimitError) {
      return reply.code(429).send({
        error: 'Session limit reached',
        tier: error.tier,
        limit: error.limit,
      });
    }
    throw error;
  }
});
```

## Advanced Usage

### Custom Session Manager Instance

```typescript
// Create a custom instance (instead of using singleton)
const customManager = new SessionManager();

const session = await customManager.createSession(
  projectId,
  tenantId,
  userId,
  PreviewMode.LIVE,
  containerIds,
  port
);
```

### Extending Session Lifetime

To extend a session's lifetime, update its activity:

```typescript
// Update activity on each preview access
app.get('/preview/:sessionId/*', async (request, reply) => {
  const { sessionId } = request.params;

  try {
    await sessionManager.updateActivity(sessionId);
    // Serve preview content...
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return reply.code(410).send({ error: 'Session expired' });
    }
    throw error;
  }
});
```

## Best Practices

1. **Use the singleton instance**: The exported `sessionManager` is a singleton for consistency
2. **Update activity regularly**: Call `updateActivity()` on each preview access to prevent premature expiration
3. **Handle session limits gracefully**: Provide clear feedback when users hit tier limits
4. **Run background cleanup**: Set up periodic jobs to expire inactive/expired sessions
5. **Clean up on container shutdown**: Call `expireSession()` when containers are stopped
6. **Monitor session usage**: Use `getSessionStats()` to track usage patterns
7. **Validate session tokens**: Always check session validity before allowing preview access

## Related Documentation

- [Preview Runtime Types](./src/lib/types.ts) - Type definitions for preview sessions
- [Prisma Schema](../../data/prisma-schema/prisma/schema.prisma) - Database schema
- [Module Reference v2.2](../../../docs/Module_Reference_v2.2.md) - System architecture

## Testing

Run tests with:

```bash
pnpm nx test preview-runtime
```

See [session-manager.spec.ts](./src/lib/session-manager.spec.ts) for comprehensive test coverage.
