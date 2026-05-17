# Preview Runtime — Ephemeral Docker Containers for Preview

**Manages ephemeral Docker containers for live preview with hot-reload support**

Version: 1.0.0 | Module Reference v2.2 Section 7.5 | Layer 3 — Builder

---

## Overview

The `preview-runtime` library provides comprehensive management of ephemeral Docker containers for live preview environments. It supports three preview modes (Mock, Live, Disconnected-sim), automatic session cleanup, tier-based concurrency limits, and hot-reload file watching.

### Key Features

- ✅ **Three Preview Modes**: Mock (all 3 APIs), Live (iot-api-proxy), Disconnected-sim (connectivity testing)
- ✅ **Docker Container Management**: Full lifecycle with Dockerode
- ✅ **Session Management**: Prisma-backed with 30-minute auto-expire
- ✅ **Tier-Based Limits**: 1/3/10 concurrent sessions (Starter/Pro/Enterprise)
- ✅ **Hot-Reload**: File watching with automatic container restart
- ✅ **Health Checks**: Automatic HTTP polling until container is ready
- ✅ **Auto-Cleanup**: Cron-based cleanup every 5 minutes
- ✅ **Phase 1 MVP**: Placeholder HTML with Friendly brand theme
- ✅ **Type Safety**: Full TypeScript with strict mode

---

## Quick Start

### 1. Installation

Dependencies are managed by the Nx workspace:

```bash
# Already installed via workspace package.json
pnpm install
```

### 2. Basic Usage

```typescript
import {
  PreviewRuntimeService,
  PreviewMode,
} from '@friendly-tech/builder/preview-runtime';

// Create and initialize service
const service = new PreviewRuntimeService({
  sourcesBasePath: './dist/generated',
  previewUrlPattern: 'local',
  enableHotReload: true,
});

await service.initialize();

// Launch preview session
const session = await service.launchPreview({
  projectId: 'proj-123',
  tenantId: 'tenant-456',
  mode: PreviewMode.MOCK,
});

console.log(`Preview available at: ${session.previewUrl}`);
// Output: Preview available at: http://localhost:4350

// Check status
const status = await service.getPreviewStatus(session.sessionId);
console.log(`TTL: ${status.ttl} seconds`);

// Stop preview
await service.stopPreview(session.sessionId);

// Shutdown service
await service.shutdown();
```

---

## Architecture

### Preview Modes

#### 1. Mock Mode (`PreviewMode.MOCK`)

- Uses **mock-api-server** sidecar container
- All three Friendly APIs mocked (Northbound, Events, QoE)
- Ideal for development without live credentials
- No external API calls

#### 2. Live Mode (`PreviewMode.LIVE`)

- Connects through **iot-api-proxy** to real Friendly APIs
- Requires valid credentials
- Production-like testing
- Real device data

#### 3. Disconnected-Sim Mode (`PreviewMode.DISCONNECTED_SIM`)

- Periodic connectivity drops to test grace periods
- Simulates network interruptions
- Tests offline caching and resilience
- Professional/Enterprise tiers only

### Container Architecture

```
[nginx:alpine container]
  ├─ Volume Mount: ./dist/generated/{projectId}
  ├─ Port Mapping: 4300-4399 (auto-assigned)
  └─ Health Check: HTTP GET / → 200

[Mock Mode: node:20-alpine sidecar]
  ├─ mock-api-server
  ├─ Network: linked to main container
  └─ Port: 3000 (internal)

[File Watcher]
  ├─ chokidar watching source directory
  ├─ On change: restart container
  └─ Update last activity timestamp
```

### Session Lifecycle

```
1. launchPreview()
   ├─ Check tier limits (1/3/10)
   ├─ Generate session ID
   ├─ Create source directory (+ placeholder if Phase 1)
   ├─ Pull Docker image (nginx:alpine)
   ├─ Create container with volume mount
   ├─ Start container
   ├─ Health check (30 retries, 1s interval)
   ├─ Create session in Prisma
   ├─ Setup hot-reload watcher
   └─ Return PreviewSession

2. Active Session (30 min default)
   ├─ File changes trigger hot-reload
   ├─ Last activity timestamp updated
   └─ Auto-cleanup cron checks expiration

3. stopPreview() or Auto-Expire
   ├─ Stop file watcher
   ├─ Stop Docker container
   ├─ Remove Docker container
   ├─ Update session status: 'stopped'
   └─ Cleanup resources
```

---

## API Reference

### PreviewRuntimeService

Main service class for preview management.

#### Constructor

```typescript
constructor(config?: PreviewRuntimeConfig)
```

**Configuration Options:**

```typescript
interface PreviewRuntimeConfig {
  /** Docker options (socket path, host, port) */
  dockerOptions?: Docker.DockerOptions;

  /** Base path for generated sources (default: './dist/generated') */
  sourcesBasePath?: string;

  /** Preview URL pattern: 'local' | 'production' */
  previewUrlPattern?: 'local' | 'production';

  /** Production domain (default: 'aep.friendly-tech.com') */
  productionDomain?: string;

  /** Cleanup interval in minutes (default: 5) */
  cleanupIntervalMinutes?: number;

  /** Enable hot-reload (default: true) */
  enableHotReload?: boolean;

  /** Base image (default: 'nginx:alpine') */
  baseImage?: string;

  /** Mock API image (default: 'node:20-alpine') */
  mockApiImage?: string;
}
```

#### Methods

##### `initialize(): Promise<void>`

Initializes the service:
- Verifies Docker connectivity
- Starts cleanup cron
- Must be called before other methods

**Throws:** Error if Docker is not accessible

##### `launchPreview(request): Promise<PreviewSession>`

Launches a new preview session.

**Parameters:**
```typescript
interface CreatePreviewSessionRequest {
  projectId: string;
  tenantId: string;
  mode: PreviewMode;
  durationMinutes?: number; // default: 30
  enableHotReload?: boolean; // default: true
}
```

**Returns:** `PreviewSession` with URL and container info

**Throws:**
- SessionLimitError if tier limits exceeded
- Error if container creation fails

##### `stopPreview(sessionId: string): Promise<void>`

Stops a preview session and cleans up resources.

##### `getPreviewStatus(sessionId: string): Promise<PreviewStatus>`

Gets current status of a session.

**Returns:**
```typescript
interface PreviewStatus {
  sessionId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  previewUrl?: string;
  ttl?: number; // seconds remaining
  error?: string;
  timestamp: Date;
}
```

##### `listActiveSessions(tenantId: string): Promise<ListPreviewSessionsResponse>`

Lists all active sessions for a tenant with usage stats.

##### `extendSession(request): Promise<PreviewSession>`

Extends session expiration time (subject to tier limits).

##### `shutdown(): Promise<void>`

Gracefully shuts down the service:
- Stops cleanup cron
- Closes file watchers
- Releases resources

---

## Tier-Based Limits

Per Module Reference v2.2 Section 12.1:

| Feature | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| **Max Concurrent Sessions** | 1 | 3 | 10 |
| **Max Sessions Per Day** | 10 | 100 | Unlimited |
| **Session Duration** | 30 min | 30 min | 30 min |
| **Hot-Reload** | ✅ | ✅ | ✅ |
| **Disconnected-Sim Mode** | ❌ | ✅ | ✅ |

Limits are automatically enforced by `SessionManager` based on tenant's license tier.

---

## Preview Modes

### Mock Mode

**Use Case:** Development without live API access

**Setup:**
```typescript
const session = await service.launchPreview({
  projectId: 'proj-123',
  tenantId: 'tenant-456',
  mode: PreviewMode.MOCK,
});
```

**Container Architecture:**
- Main: `nginx:alpine` serving Angular app
- Sidecar: `node:20-alpine` running mock-api-server
- Network: Docker bridge with internal DNS

**Mock API Endpoints:**
- Northbound: `http://mock-api:45001/northbound/*`
- Events: `http://mock-api:45001/events/*`
- QoE: `http://mock-api:45001/qoe/*`

### Live Mode

**Use Case:** Testing with real Friendly API data

**Setup:**
```typescript
const session = await service.launchPreview({
  projectId: 'proj-123',
  tenantId: 'tenant-456',
  mode: PreviewMode.LIVE,
});
```

**Requirements:**
- Valid Friendly API credentials in environment
- iot-api-proxy configured and running
- Network access to Friendly APIs

**Container Architecture:**
- Main: `nginx:alpine` serving Angular app
- Proxy: Configured to route to iot-api-proxy endpoint
- No sidecar container

### Disconnected-Sim Mode

**Use Case:** Testing offline resilience and grace periods

**Setup:**
```typescript
const session = await service.launchPreview({
  projectId: 'proj-123',
  tenantId: 'tenant-456',
  mode: PreviewMode.DISCONNECTED_SIM,
  disconnectedSimConfig: {
    dropIntervalSeconds: 300,  // Drop every 5 minutes
    dropDurationSeconds: 30,   // 30-second outages
    dropProbability: 0.5,      // 50% chance per interval
  },
});
```

**Simulation Logic:**
- Periodically blocks network requests
- Tests caching and offline behavior
- Validates error handling and retry logic

---

## Hot-Reload

### Phase 1 Implementation

**Current Behavior:**
- Watches source directory with `chokidar`
- On file change: restart Docker container
- Updates `lastActivityAt` timestamp

**Configuration:**
```typescript
const service = new PreviewRuntimeService({
  enableHotReload: true, // default
});
```

**File Watch Settings:**
- Debounce: 500ms stability threshold
- Ignored: node_modules, .git, *.tmp
- Recursive: true

### Phase 2 Roadmap

**Planned Features:**
- Incremental Angular rebuild (Webpack HMR)
- WebSocket push to client
- Selective module reload
- Build error reporting

---

## Auto-Cleanup

### Cron Schedule

**Default:** Every 5 minutes

**Configuration:**
```typescript
const service = new PreviewRuntimeService({
  cleanupIntervalMinutes: 5, // default
});
```

### Cleanup Logic

1. Query all sessions with `status = 'running'`
2. Check `expiresAt < now()`
3. For each expired session:
   - Stop file watcher
   - Stop Docker container(s)
   - Remove Docker container(s)
   - Update session status: 'stopped'
4. Log cleanup metrics

**Expiration Calculation:**
```typescript
expiresAt = createdAt + durationMinutes (default: 30)
```

---

## Phase 1 MVP Placeholder

### Placeholder HTML

For Phase 1, if no generated source exists, a branded placeholder is created:

**Features:**
- Friendly brand colors (navy #12174C, orange #FF5900)
- Animated spinner
- Project ID display
- "Preview Coming Soon" message
- Responsive design
- Gradient background

**Generated Automatically:**
- On first `launchPreview()` if source directory doesn't exist
- Located at: `{sourcesBasePath}/{projectId}/index.html`

**Phase 2 Integration:**
- Full code generation from `libs/builder/codegen`
- Real Angular application
- Dynamic component rendering

---

## Docker Configuration

### Port Range

**Assigned Ports:** 4300-4399 (100 concurrent sessions max)

**Port Assignment:**
- Random selection within range
- Checked against active containers
- Tracked in memory to avoid collisions

### Container Labels

All preview containers are labeled for identification:

```yaml
labels:
  aep.session-id: preview-abc123...
  aep.project-id: proj-123
  aep.tenant-id: tenant-456
  aep.mode: mock | live | disconnected-sim
```

### Health Check

**Default Configuration:**
- Method: HTTP GET
- Path: `/`
- Expected Status: 200
- Max Retries: 30
- Retry Interval: 1000ms (1 second)
- Total Timeout: ~30 seconds

**Custom Health Check:**
```typescript
const containerInfo = await dockerManager.healthCheck(containerId, {
  maxRetries: 60,
  retryInterval: 500,
  method: 'HEAD',
  expectedStatus: 200,
});
```

---

## Session Management

### Prisma Schema

```prisma
model PreviewSession {
  id          String   @id @default(cuid())
  tenantId    String
  projectId   String
  status      String   // 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  config      Json     // { mode, containerIds, port, lastActivityAt }
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  error       String?

  @@index([tenantId])
  @@index([status])
  @@index([expiresAt])
}
```

### Session Config JSON

```json
{
  "mode": "mock",
  "containerIds": ["abc123...", "def456..."],
  "port": 4350,
  "lastActivityAt": "2026-04-11T10:30:00.000Z"
}
```

### Session Queries

**List Active Sessions:**
```typescript
const sessions = await service.listActiveSessions('tenant-123');
```

**Extend Session:**
```typescript
await service.extendSession({
  sessionId: 'preview-abc123',
  extendMinutes: 15,
});
```

---

## Error Handling

### Common Errors

#### SessionLimitError

**Cause:** Tier concurrent session limit exceeded

**Example:**
```typescript
try {
  await service.launchPreview({ ... });
} catch (error) {
  if (error instanceof SessionLimitError) {
    console.error(`Limit: ${error.limit}, Tier: ${error.tier}`);
  }
}
```

#### Docker Connectivity Error

**Cause:** Docker daemon not accessible

**Solution:**
- Ensure Docker is running
- Check socket path: `/var/run/docker.sock` (Unix) or `//./pipe/docker_engine` (Windows)
- Verify permissions

#### Health Check Failure

**Cause:** Container failed to start or respond

**Troubleshooting:**
```bash
# Check container logs
docker logs <container-id>

# Inspect container
docker inspect <container-id>

# Test manually
curl http://localhost:4350
```

---

## Testing

### Run Tests

```bash
# Run all tests
pnpm nx test preview-runtime

# Coverage
pnpm nx test preview-runtime --coverage

# Watch mode
pnpm nx test preview-runtime --watch
```

### Test Structure

Tests use **dockerode-mock** for Docker operations:

```typescript
import { DockerLifecycleManager } from './docker-manager';

describe('DockerLifecycleManager', () => {
  let manager: DockerLifecycleManager;

  beforeEach(() => {
    manager = new DockerLifecycleManager();
  });

  it('should create preview container', async () => {
    const containerInfo = await manager.createPreviewContainer({
      volumePath: '/test/path',
      enableMockApi: true,
    });

    expect(containerInfo.containerId).toBeDefined();
    expect(containerInfo.port).toBeGreaterThanOrEqual(4300);
    expect(containerInfo.port).toBeLessThanOrEqual(4399);
  });
});
```

---

## Building

```bash
# Build library
pnpm nx build preview-runtime

# Type check
pnpm nx run preview-runtime:typecheck

# Lint
pnpm nx lint preview-runtime
```

---

## Documentation

| File | Purpose |
|------|---------|
| `README.md` | This file - overview and API reference |
| `QUICK_START.md` | 5-minute tutorial |
| `DOCKER_LIFECYCLE_MANAGER.md` | Docker container management |
| `SESSION_MANAGER_IMPLEMENTATION.md` | Session tracking and limits |
| `CLEANUP_SERVICE.md` | Auto-expiry and cleanup |
| `examples/` | Usage examples |

---

## Module Reference Compliance

✅ **Module Reference v2.2 Section 7.5** — Fully Implemented

**Requirements:**
- ✅ Ephemeral Docker containers with volume mounts
- ✅ Three modes: Mock (mock-api-server), Live (iot-api-proxy), Disconnected-sim
- ✅ Hot-reload with file watching
- ✅ 30-minute auto-destroy with cleanup cron
- ✅ Tier-based concurrent limits (1/3/10)
- ✅ Preview URL pattern: `preview-{projectId}.aep.friendly-tech.com`
- ✅ Random port assignment (4300-4399)
- ✅ Health check polling until 200
- ✅ Phase 1 MVP placeholder HTML

---

## Dependencies

```json
{
  "dependencies": {
    "dockerode": "^4.0.10",
    "chokidar": "^5.0.0",
    "node-cron": "^3.0.3",
    "@friendly-tech/data/prisma-schema": "*"
  },
  "devDependencies": {
    "@types/dockerode": "^4.0.1",
    "@types/node-cron": "^3.0.11"
  }
}
```

---

## License

UNLICENSED - Proprietary Friendly Technologies Software

---

**Status**: ✅ Phase 1 MVP Complete
**Version**: 1.0.0
**Module Reference**: v2.2 Section 7.5
**Next Phase**: Full code generation integration (Phase 2)
