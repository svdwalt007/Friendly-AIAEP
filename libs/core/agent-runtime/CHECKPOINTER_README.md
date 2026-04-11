# PostgreSQL Checkpointer for Agent Runtime

This module provides PostgreSQL-based state persistence for LangGraph agent workflows using the `@langchain/langgraph-checkpoint-postgres` package.

## Overview

The checkpointer enables persistent state management for multi-agent conversations, allowing:
- Resuming conversations after server restarts
- Long-running agent workflows with state preservation
- Multi-tenant agent state isolation
- Automatic state versioning and rollback capabilities

## Installation

The required dependencies are already included in the `agent-runtime` package:

```json
{
  "@langchain/langgraph-checkpoint-postgres": "^0.0.9",
  "pg": "^8.11.0"
}
```

## Quick Start

### 1. Basic Usage

```typescript
import { createCheckpointer, closeCheckpointer } from '@friendly-aiaep/agent-runtime';

// Create checkpointer
const checkpointer = await createCheckpointer({
  host: 'localhost',
  port: 5432,
  database: 'aep_dev',
  user: 'postgres',
  password: 'postgres',
});

// Use with LangGraph
const graph = new StateGraph<AEPAgentState>({
  channels: stateChannels,
})
  .addNode('supervisor', supervisorNode)
  .addNode('planning', planningNode)
  .addNode('iot_domain', iotDomainNode)
  .compile({
    checkpointer: checkpointer.checkpointer,
  });

// Invoke graph with thread_id for persistence
const result = await graph.invoke(
  { messages: [userMessage] },
  {
    configurable: {
      thread_id: 'user-123-session-456'
    }
  }
);

// Cleanup on shutdown
await closeCheckpointer(checkpointer);
```

### 2. Environment-Based Configuration

```typescript
import { createCheckpointerFromEnv } from '@friendly-aiaep/agent-runtime';

// Set environment variables
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_DB = 'aep_dev';
process.env.POSTGRES_USER = 'postgres';
process.env.POSTGRES_PASSWORD = 'postgres';

// Create checkpointer from environment
const checkpointer = await createCheckpointerFromEnv();

// Cleanup
await checkpointer.close();
```

### 3. Production Configuration with Connection Pooling

```typescript
const checkpointer = await createCheckpointer({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pooling
  maxConnections: 20,
  idleTimeoutMillis: 60000,      // 60 seconds
  connectionTimeoutMillis: 10000, // 10 seconds

  // SSL configuration
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./ca-certificate.crt').toString(),
  },
});
```

## API Reference

### `createCheckpointer(config: CheckpointerConfig): Promise<CheckpointerInstance>`

Creates a PostgreSQL checkpointer with the specified configuration.

**Parameters:**

- `config.host` (string, required): PostgreSQL host
- `config.port` (number, optional): PostgreSQL port (default: 5432)
- `config.database` (string, required): Database name
- `config.user` (string, required): Database user
- `config.password` (string, required): Database password
- `config.maxConnections` (number, optional): Max pool size (default: 10)
- `config.idleTimeoutMillis` (number, optional): Idle timeout (default: 30000)
- `config.connectionTimeoutMillis` (number, optional): Connection timeout (default: 5000)
- `config.ssl` (boolean | object, optional): SSL configuration

**Returns:**

```typescript
interface CheckpointerInstance {
  checkpointer: PostgresSaver;  // LangGraph checkpointer
  pool: Pool;                   // PostgreSQL connection pool
  close: () => Promise<void>;   // Cleanup function
}
```

**Throws:**
- Error if connection fails
- Error if table setup fails

### `closeCheckpointer(instance: CheckpointerInstance): Promise<void>`

Gracefully closes the checkpointer and releases all database connections.

### `createCheckpointerFromEnv(): Promise<CheckpointerInstance>`

Creates a checkpointer from environment variables.

**Required Environment Variables:**
- `POSTGRES_DB`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password

**Optional Environment Variables:**
- `POSTGRES_HOST`: Host (default: 'localhost')
- `POSTGRES_PORT`: Port (default: '5432')
- `POSTGRES_MAX_CONNECTIONS`: Max connections (default: '10')
- `POSTGRES_SSL`: Enable SSL (default: 'false')

## Database Setup

### 1. Create Database

```sql
-- Create database
CREATE DATABASE aep_dev;

-- Connect to database
\c aep_dev

-- The checkpointer will automatically create the required tables
```

### 2. Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: aep_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 3. Table Schema

The checkpointer automatically creates the following table:

```sql
CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_id TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id
  ON checkpoints(thread_id);
```

## Advanced Usage

### Multi-Tenant Isolation

Use tenant-specific thread IDs to isolate agent state:

```typescript
const tenantId = 'tenant-abc';
const userId = 'user-123';
const sessionId = 'session-456';

const threadId = `${tenantId}:${userId}:${sessionId}`;

const result = await graph.invoke(
  { messages: [userMessage] },
  { configurable: { thread_id: threadId } }
);
```

### Resuming Conversations

```typescript
// First interaction
const result1 = await graph.invoke(
  { messages: [new HumanMessage('Create an IoT dashboard')] },
  { configurable: { thread_id: 'session-123' } }
);

// Later interaction (resumes from checkpoint)
const result2 = await graph.invoke(
  { messages: [new HumanMessage('Add a temperature widget')] },
  { configurable: { thread_id: 'session-123' } }
);
```

### State Versioning

Access checkpoint history:

```typescript
// Get all checkpoints for a thread
const checkpoints = await checkpointer.checkpointer.list({
  configurable: { thread_id: 'session-123' }
});

// Rollback to specific checkpoint
const result = await graph.invoke(
  input,
  {
    configurable: {
      thread_id: 'session-123',
      checkpoint_id: checkpoints[2].id
    }
  }
);
```

### Connection Pool Management

```typescript
// Monitor pool status
checkpointer.pool.on('connect', (client) => {
  console.log('New client connected');
});

checkpointer.pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Get pool stats
const poolStats = {
  totalCount: checkpointer.pool.totalCount,
  idleCount: checkpointer.pool.idleCount,
  waitingCount: checkpointer.pool.waitingCount,
};
```

### Graceful Shutdown

```typescript
// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing checkpointer...');
  await closeCheckpointer(checkpointer);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing checkpointer...');
  await closeCheckpointer(checkpointer);
  process.exit(0);
});
```

## Error Handling

### Connection Errors

```typescript
try {
  const checkpointer = await createCheckpointer(config);
} catch (error) {
  if (error.message.includes('Connection failed')) {
    console.error('Cannot connect to PostgreSQL:', error);
    // Fallback to in-memory checkpointer or fail gracefully
  }
}
```

### Retry Logic

```typescript
async function createCheckpointerWithRetry(
  config: CheckpointerConfig,
  maxRetries = 3
): Promise<CheckpointerInstance> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createCheckpointer(config);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to create checkpointer after retries');
}
```

## Testing

### Unit Tests

The checkpointer includes comprehensive unit tests:

```bash
nx test agent-runtime
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

describe('Checkpointer Integration', () => {
  let checkpointer: CheckpointerInstance;

  beforeAll(async () => {
    checkpointer = await createCheckpointer({
      host: 'localhost',
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    });
  });

  afterAll(async () => {
    await closeCheckpointer(checkpointer);
  });

  it('should persist and retrieve state', async () => {
    // Test implementation
  });
});
```

## Performance Considerations

1. **Connection Pooling**: Adjust `maxConnections` based on expected concurrent users
2. **Idle Timeout**: Set `idleTimeoutMillis` to balance resource usage and connection reuse
3. **Indexes**: The checkpointer creates indexes automatically for optimal query performance
4. **Cleanup**: Implement periodic cleanup of old checkpoints to prevent table bloat

```sql
-- Cleanup old checkpoints (run periodically)
DELETE FROM checkpoints
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Monitoring

### Database Metrics

```typescript
// Query checkpoint statistics
const stats = await checkpointer.pool.query(`
  SELECT
    COUNT(*) as total_checkpoints,
    COUNT(DISTINCT thread_id) as unique_threads,
    pg_size_pretty(pg_total_relation_size('checkpoints')) as table_size
  FROM checkpoints
`);
```

### Application Metrics

```typescript
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

const checkpointer = await createCheckpointer(config);

// Track checkpoint operations
let checkpointWrites = 0;
let checkpointReads = 0;

// Wrap checkpointer methods for metrics
const originalPut = checkpointer.checkpointer.put.bind(checkpointer.checkpointer);
checkpointer.checkpointer.put = async (...args) => {
  checkpointWrites++;
  return originalPut(...args);
};
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Verify PostgreSQL is running and accessible
2. **Permission denied**: Ensure database user has CREATE TABLE permissions
3. **Table already exists**: The checkpointer handles this automatically
4. **Connection pool exhausted**: Increase `maxConnections` or investigate connection leaks

### Debug Logging

```typescript
// Enable PostgreSQL client logging
const checkpointer = await createCheckpointer({
  ...config,
});

checkpointer.pool.on('connect', () => {
  console.log('Pool connected');
});

checkpointer.pool.on('acquire', () => {
  console.log('Client acquired from pool');
});

checkpointer.pool.on('remove', () => {
  console.log('Client removed from pool');
});
```

## Security Best Practices

1. **Never commit credentials**: Use environment variables
2. **Enable SSL in production**: Configure SSL for encrypted connections
3. **Use least privilege**: Grant only necessary database permissions
4. **Rotate credentials**: Regularly update database passwords
5. **Network isolation**: Use VPCs or private networks in production

## Migration Guide

### From In-Memory to PostgreSQL

```typescript
// Before (in-memory)
const graph = new StateGraph<AEPAgentState>({
  channels: stateChannels,
}).compile();

// After (PostgreSQL)
const checkpointer = await createCheckpointer(config);
const graph = new StateGraph<AEPAgentState>({
  channels: stateChannels,
}).compile({
  checkpointer: checkpointer.checkpointer,
});

// Remember to cleanup
await closeCheckpointer(checkpointer);
```

## Related Documentation

- [LangGraph Checkpointers](https://langchain-ai.github.io/langgraph/reference/checkpoints/)
- [PostgreSQL Connection Pooling](https://node-postgres.com/features/pooling)
- [Agent Runtime Types](./README.md)
- [Multi-Agent System Architecture](../../docs/System_Specification_v2.2.md)
