# Preview Runtime - Cleanup Service

## Overview

The `CleanupService` is a cron-based service that automatically manages the lifecycle of expired preview sessions. It runs periodically to identify inactive sessions, clean up associated Docker containers, and update the database accordingly.

## Features

- **Automated Cleanup**: Runs on a configurable cron schedule (default: every 5 minutes)
- **Flexible Timeout**: Configurable session timeout (default: 30 minutes)
- **Docker Integration**: Stops and removes Docker containers associated with expired sessions
- **Graceful Error Handling**: Continues cleanup even if individual containers fail
- **Comprehensive Logging**: Detailed logs for all cleanup operations
- **Database Updates**: Marks sessions as inactive after cleanup
- **Manual Triggers**: Can run cleanup operations on-demand

## Installation

The cleanup service is included in the `@friendly-aiaep/preview-runtime` package.

```bash
pnpm install
```

Required dependencies:
- `node-cron`: For scheduling periodic cleanups
- `dockerode`: For Docker container management
- `@prisma/client`: For database operations

## Usage

### Basic Setup

```typescript
import { CleanupService } from '@friendly-aiaep/preview-runtime';

// Create service with default configuration
const cleanupService = new CleanupService();

// Start the cron job
cleanupService.start();

// Later, when shutting down
cleanupService.stop();
await cleanupService.disconnect();
```

### Custom Configuration

```typescript
import { CleanupService } from '@friendly-aiaep/preview-runtime';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cleanupService = new CleanupService({
  // Run every 10 minutes
  cronSchedule: '*/10 * * * *',

  // 60 minute timeout
  sessionTimeoutMinutes: 60,

  // Enable/disable the service
  enabled: true,

  // Custom Prisma client
  prismaClient: prisma,

  // Custom logger
  logger: {
    info: (message, meta) => console.log(message, meta),
    error: (message, error, meta) => console.error(message, error, meta),
    warn: (message, meta) => console.warn(message, meta),
  },

  // Custom Docker cleanup function
  dockerCleanup: async (containerId) => {
    // Your custom Docker cleanup logic
    console.log(`Cleaning up container: ${containerId}`);
  },
});

cleanupService.start();
```

### Manual Cleanup

```typescript
// Trigger cleanup manually (outside of cron schedule)
const result = await cleanupService.runCleanup();

console.log(`Cleaned up ${result.sessionsCleanedUp} sessions`);
console.log(`Stopped ${result.containersStopped} containers`);
console.log(`Errors: ${result.errors.length}`);
```

## Configuration Options

### CleanupServiceConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cronSchedule` | `string` | `'*/5 * * * *'` | Cron expression for scheduling cleanup |
| `sessionTimeoutMinutes` | `number` | `30` | Session timeout in minutes |
| `enabled` | `boolean` | `true` | Whether to enable automatic cleanup |
| `prismaClient` | `PrismaClient` | `new PrismaClient()` | Custom Prisma client instance |
| `logger` | `Logger` | Console logger | Custom logger implementation |
| `dockerCleanup` | `Function` | Default Docker cleanup | Custom Docker cleanup function |

### Cron Schedule Examples

```typescript
// Every 5 minutes (default)
cronSchedule: '*/5 * * * *'

// Every 10 minutes
cronSchedule: '*/10 * * * *'

// Every hour
cronSchedule: '0 * * * *'

// Every day at midnight
cronSchedule: '0 0 * * *'

// Every 30 minutes
cronSchedule: '*/30 * * * *'
```

## How It Works

### Cleanup Process

1. **Query Database**: Finds sessions matching either condition:
   - `expiresAt < now` - Sessions that have explicitly expired
   - `isActive = true AND updatedAt < (now - timeout)` - Active sessions without recent activity

2. **Extract Container ID**: Parses the session config JSON to find the Docker container ID
   - Supports multiple field names: `containerId`, `container_id`, `dockerContainerId`, etc.
   - Handles nested config structures

3. **Stop Docker Container**:
   - Attempts to stop the container with 10 second timeout
   - Handles "already stopped" gracefully

4. **Remove Docker Container**:
   - Removes the container forcefully
   - Handles "already removed" gracefully

5. **Update Database**:
   - Sets `isActive = false`
   - Updates `updatedAt` timestamp

6. **Error Handling**:
   - Logs all errors but continues processing other sessions
   - Returns comprehensive cleanup result with error details

### Session Config Format

The cleanup service supports various session config formats:

```typescript
// Direct container ID
{
  "containerId": "abc123"
}

// Nested Docker config
{
  "docker": {
    "containerId": "abc123"
  }
}

// Alternative field names
{
  "container_id": "abc123"
  // or
  "dockerContainerId": "abc123"
  // or
  "docker_container_id": "abc123"
  // or
  "containerName": "abc123"
  // or
  "container_name": "abc123"
}
```

## API Reference

### CleanupService Class

#### Methods

##### `start(): void`

Starts the cron job for automatic cleanup.

```typescript
cleanupService.start();
```

**Throws**: Error if service is already running

##### `stop(): void`

Stops the cron job.

```typescript
cleanupService.stop();
```

##### `getStatus(): boolean`

Returns whether the service is currently running.

```typescript
const isRunning = cleanupService.getStatus();
```

##### `async runCleanup(): Promise<CleanupResult>`

Manually triggers a cleanup operation.

```typescript
const result = await cleanupService.runCleanup();
```

**Returns**: `CleanupResult` object with:
- `sessionsCleanedUp`: Number of sessions cleaned
- `containersStopped`: Number of containers stopped
- `errors`: Array of errors encountered
- `timestamp`: When cleanup was executed

##### `async cleanupExpiredSessions(): Promise<number>`

Internal method that performs the actual cleanup logic.

```typescript
const count = await cleanupService.cleanupExpiredSessions();
```

**Returns**: Number of sessions successfully cleaned up

##### `async disconnect(): Promise<void>`

Stops the cron job and disconnects the Prisma client.

```typescript
await cleanupService.disconnect();
```

### CleanupResult Interface

```typescript
interface CleanupResult {
  sessionsCleanedUp: number;
  containersStopped: number;
  errors: Array<{
    sessionId: string;
    error: string;
  }>;
  timestamp: Date;
}
```

## Integration Examples

### With Express/Fastify Server

```typescript
import { CleanupService } from '@friendly-aiaep/preview-runtime';
import express from 'express';

const app = express();
const cleanupService = new CleanupService({
  sessionTimeoutMinutes: 30,
});

// Start cleanup service with server
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

### With Health Check Endpoint

```typescript
app.get('/health/cleanup', (req, res) => {
  res.json({
    running: cleanupService.getStatus(),
    uptime: process.uptime(),
  });
});

// Manual cleanup endpoint (admin only)
app.post('/admin/cleanup', async (req, res) => {
  const result = await cleanupService.runCleanup();
  res.json(result);
});
```

### With Custom Docker Cleanup

```typescript
import Docker from 'dockerode';

const docker = new Docker();

const cleanupService = new CleanupService({
  dockerCleanup: async (containerId: string) => {
    const container = docker.getContainer(containerId);

    // Custom cleanup logic
    const info = await container.inspect();
    console.log(`Cleaning up container: ${info.Name}`);

    // Stop with custom timeout
    await container.stop({ t: 5 });

    // Optional: Save logs before removal
    const logs = await container.logs({ stdout: true, stderr: true });
    // ... save logs somewhere

    // Remove container
    await container.remove({ force: true, v: true });
  },
});
```

### With Monitoring/Metrics

```typescript
const cleanupService = new CleanupService({
  logger: {
    info: (message, meta) => {
      console.log(message, meta);
      // Send to monitoring service
      metrics.increment('cleanup.info');
    },
    error: (message, error, meta) => {
      console.error(message, error, meta);
      // Alert on errors
      metrics.increment('cleanup.error');
      alerting.sendAlert('cleanup_error', { message, error });
    },
    warn: (message, meta) => {
      console.warn(message, meta);
      metrics.increment('cleanup.warn');
    },
  },
});
```

## Error Handling

The cleanup service handles various error scenarios gracefully:

### Docker Container Errors

- **Container Already Stopped**: Logged as warning, continues to removal
- **Container Already Removed**: Logged as warning, continues to next session
- **Container Not Found**: Logged as warning, updates database anyway
- **Docker Daemon Unavailable**: Logged as error, session still marked inactive

### Database Errors

- **Connection Lost**: Entire cleanup operation fails, retries on next schedule
- **Individual Session Update Failed**: Logged as error, continues to next session
- **Transaction Timeout**: Logged as error, retries on next schedule

### Configuration Errors

- **Invalid Cron Schedule**: Throws error on start()
- **Missing Container ID**: Logged as warning, session still marked inactive
- **Invalid Session Config**: Logged as error, session still marked inactive

## Testing

Run tests for the cleanup service:

```bash
pnpm nx test preview-runtime
```

### Test Coverage

The test suite covers:
- Service initialization with default and custom config
- Starting and stopping the cron job
- Cleaning up expired sessions
- Docker container cleanup
- Error handling (Docker errors, database errors)
- Container ID extraction from various config formats
- Manual cleanup triggers
- Graceful shutdown

## Best Practices

1. **Choose Appropriate Cron Schedule**: Balance between resource usage and responsiveness
   - High-traffic: Every 5-10 minutes
   - Low-traffic: Every 30-60 minutes

2. **Set Reasonable Timeouts**: Consider user workflow patterns
   - Development: 30-60 minutes
   - Production: 15-30 minutes
   - Demo/Testing: 5-15 minutes

3. **Monitor Cleanup Operations**: Track metrics for:
   - Number of sessions cleaned per run
   - Cleanup duration
   - Error rates
   - Container cleanup failures

4. **Graceful Shutdown**: Always stop and disconnect when shutting down
   ```typescript
   process.on('SIGTERM', async () => {
     await cleanupService.disconnect();
   });
   ```

5. **Use Custom Docker Cleanup**: Implement custom logic if you need to:
   - Save container logs before removal
   - Perform health checks
   - Clean up associated resources (volumes, networks)
   - Send notifications

6. **Logging**: Provide a production-ready logger that integrates with your monitoring stack

## Troubleshooting

### Service Won't Start

- Check if already running: `cleanupService.getStatus()`
- Verify cron schedule is valid
- Check if `enabled: false` in config

### Containers Not Being Cleaned

- Verify Docker daemon is running and accessible
- Check container ID format in session config
- Review logs for Docker errors
- Ensure cleanup service has Docker socket access

### Database Updates Failing

- Verify Prisma client connection
- Check database connectivity
- Review session query conditions
- Ensure proper database permissions

### High Resource Usage

- Reduce cleanup frequency (longer cron interval)
- Increase session timeout
- Batch operations if handling many sessions
- Consider async Docker cleanup

## License

This module is part of the Friendly AI AEP platform and is licensed under UNLICENSED.
