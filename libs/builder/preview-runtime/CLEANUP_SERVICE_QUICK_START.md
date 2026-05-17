# CleanupService Quick Start

## Basic Usage

```typescript
import { CleanupService } from '@friendly-aiaep/preview-runtime';

// Create and start service with defaults (every 5 minutes, 30 min timeout)
const cleanupService = new CleanupService();
cleanupService.start();

// Later, during shutdown
cleanupService.stop();
await cleanupService.disconnect();
```

## Custom Configuration

```typescript
import { CleanupService } from '@friendly-aiaep/preview-runtime';

const cleanupService = new CleanupService({
  cronSchedule: '*/10 * * * *',    // Every 10 minutes
  sessionTimeoutMinutes: 60,        // 60 minute timeout
  enabled: true,                    // Enable/disable

  // Optional: custom logger
  logger: {
    info: (msg, meta) => console.log(msg, meta),
    error: (msg, err, meta) => console.error(msg, err, meta),
    warn: (msg, meta) => console.warn(msg, meta),
  },

  // Optional: custom Docker cleanup
  dockerCleanup: async (containerId) => {
    // Your custom cleanup logic
  },
});

cleanupService.start();
```

## Manual Cleanup Trigger

```typescript
// Run cleanup on-demand
const result = await cleanupService.runCleanup();

console.log(`Sessions cleaned: ${result.sessionsCleanedUp}`);
console.log(`Containers stopped: ${result.containersStopped}`);
console.log(`Errors: ${result.errors.length}`);
```

## Common Cron Schedules

```typescript
// Every 5 minutes (default)
cronSchedule: '*/5 * * * *'

// Every 10 minutes
cronSchedule: '*/10 * * * *'

// Every 30 minutes
cronSchedule: '*/30 * * * *'

// Every hour
cronSchedule: '0 * * * *'

// Every day at midnight
cronSchedule: '0 0 * * *'
```

## Session Config Requirements

Your PreviewSession.config JSON should include a container ID in one of these formats:

```typescript
// Option 1: Direct field
{ containerId: "abc123" }

// Option 2: Nested docker config
{ docker: { containerId: "abc123" } }

// Option 3: Alternative field names (any of these work)
{ container_id: "abc123" }
{ dockerContainerId: "abc123" }
{ docker_container_id: "abc123" }
{ containerName: "abc123" }
{ container_name: "abc123" }
```

## Integration with Server

```typescript
import { CleanupService } from '@friendly-aiaep/preview-runtime';
import express from 'express';

const app = express();
const cleanupService = new CleanupService({
  sessionTimeoutMinutes: 30,
});

// Start with server
app.listen(3000, () => {
  console.log('Server started');
  cleanupService.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  cleanupService.stop();
  await cleanupService.disconnect();
  process.exit(0);
});
```

## How It Works

1. **Query**: Finds sessions where:
   - `expiresAt < now` OR
   - `isActive = true AND updatedAt < (now - timeout)`

2. **Extract**: Parses session.config for container ID

3. **Stop Docker**: Stops the container (10s timeout)

4. **Remove Docker**: Removes the container (forced)

5. **Update DB**: Sets `isActive = false`, updates `updatedAt`

6. **Error Handling**: Logs errors but continues processing other sessions

## API Reference

### Methods

- `start()` - Start the cron job
- `stop()` - Stop the cron job
- `getStatus()` - Returns boolean if running
- `runCleanup()` - Manual cleanup trigger
- `cleanupExpiredSessions()` - Core cleanup logic
- `disconnect()` - Stop and cleanup

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| cronSchedule | string | '*/5 * * * *' | Cron expression |
| sessionTimeoutMinutes | number | 30 | Timeout in minutes |
| enabled | boolean | true | Enable/disable |
| prismaClient | PrismaClient | auto | Custom Prisma instance |
| logger | Logger | console | Custom logger |
| dockerCleanup | Function | auto | Custom Docker cleanup |

## Testing

Run tests:
```bash
pnpm nx test preview-runtime
```

All tests passed: 15/15 ✓

## Documentation

See [CLEANUP_SERVICE.md](./CLEANUP_SERVICE.md) for comprehensive documentation.

See [examples/cleanup-service-example.ts](./examples/cleanup-service-example.ts) for more examples.
