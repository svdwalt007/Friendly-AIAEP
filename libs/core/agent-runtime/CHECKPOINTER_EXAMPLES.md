# PostgreSQL Checkpointer - Usage Examples

This document provides practical examples of using the PostgreSQL checkpointer with the AEP multi-agent system.

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Complete Agent Graph Integration](#complete-agent-graph-integration)
3. [Multi-Tenant Scenarios](#multi-tenant-scenarios)
4. [Error Recovery](#error-recovery)
5. [Production Deployment](#production-deployment)

## Basic Setup

### Example 1: Minimal Configuration

```typescript
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

async function setupBasicCheckpointer() {
  const checkpointer = await createCheckpointer({
    host: 'localhost',
    database: 'aep_dev',
    user: 'postgres',
    password: 'postgres',
  });

  console.log('Checkpointer ready!');

  // Cleanup
  await checkpointer.close();
}

setupBasicCheckpointer();
```

### Example 2: Environment-Based Configuration

```typescript
// .env file
// POSTGRES_HOST=localhost
// POSTGRES_PORT=5432
// POSTGRES_DB=aep_dev
// POSTGRES_USER=postgres
// POSTGRES_PASSWORD=postgres

import { createCheckpointerFromEnv } from '@friendly-aiaep/agent-runtime';

async function setupFromEnv() {
  try {
    const checkpointer = await createCheckpointerFromEnv();
    console.log('Checkpointer initialized from environment');

    // Use checkpointer...

    await checkpointer.close();
  } catch (error) {
    console.error('Failed to create checkpointer:', error);
  }
}
```

## Complete Agent Graph Integration

### Example 3: Full AEP Multi-Agent System with Persistence

```typescript
import {
  createCheckpointer,
  createAgentGraph,
  type AEPAgentState,
  AgentRole,
} from '@friendly-aiaep/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function createPersistentAgentSystem() {
  // 1. Create checkpointer
  const checkpointer = await createCheckpointer({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'aep_dev',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    maxConnections: 20,
  });

  // 2. Create agent graph with checkpointer
  const graph = await createAgentGraph({
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    temperature: 0.7,
    checkpointer: checkpointer.checkpointer,
  });

  // 3. Process user request with persistence
  const tenantId = 'tenant-123';
  const userId = 'user-456';
  const sessionId = `session-${Date.now()}`;
  const threadId = `${tenantId}:${userId}:${sessionId}`;

  const initialState: Partial<AEPAgentState> = {
    messages: [
      new HumanMessage(
        'Create an IoT dashboard for monitoring temperature sensors'
      ),
    ],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'proj-001',
    tenantId: tenantId,
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  const result = await graph.invoke(initialState, {
    configurable: { thread_id: threadId },
  });

  console.log('Agent response:', result.messages[result.messages.length - 1]);
  console.log('Build plan:', result.buildPlan);

  // 4. Continue conversation (state is automatically resumed)
  const followUp = await graph.invoke(
    {
      ...result,
      messages: [
        ...result.messages,
        new HumanMessage('Add a humidity sensor widget as well'),
      ],
    },
    { configurable: { thread_id: threadId } }
  );

  console.log('Follow-up response:', followUp.messages[followUp.messages.length - 1]);

  // 5. Cleanup
  await checkpointer.close();
}

createPersistentAgentSystem().catch(console.error);
```

### Example 4: Streaming with Checkpointing

```typescript
import {
  createCheckpointer,
  createAgentGraph,
  streamAgentResponse,
  type StreamChunk,
} from '@friendly-aiaep/agent-runtime';

async function streamWithPersistence() {
  const checkpointer = await createCheckpointer({
    host: 'localhost',
    database: 'aep_dev',
    user: 'postgres',
    password: 'postgres',
  });

  const graph = await createAgentGraph({
    llmProvider: 'openai',
    llmModel: 'gpt-4-turbo',
    temperature: 0.7,
    checkpointer: checkpointer.checkpointer,
  });

  const threadId = 'tenant-123:user-456:session-789';

  // Stream agent responses with automatic state persistence
  for await (const chunk of streamAgentResponse(
    graph,
    {
      prompt: 'Build an IoT application for smart home monitoring',
      tenantId: 'tenant-123',
      projectId: 'proj-002',
    },
    {
      threadId,
      streamMode: 'messages',
    }
  )) {
    console.log('Chunk type:', chunk.type);
    console.log('Chunk data:', chunk.data);

    // Each chunk is automatically checkpointed
  }

  await checkpointer.close();
}
```

## Multi-Tenant Scenarios

### Example 5: Tenant-Specific Thread Management

```typescript
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

class TenantCheckpointerManager {
  private checkpointer: CheckpointerInstance;

  async initialize() {
    this.checkpointer = await createCheckpointer({
      host: 'localhost',
      database: 'aep_multi_tenant',
      user: 'postgres',
      password: 'postgres',
      maxConnections: 50, // Support multiple tenants
    });
  }

  /**
   * Generate tenant-scoped thread ID
   */
  generateThreadId(tenantId: string, userId: string, sessionId?: string): string {
    const session = sessionId || `session-${Date.now()}`;
    return `${tenantId}:${userId}:${session}`;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(tenantId: string, userId: string) {
    const pattern = `${tenantId}:${userId}:%`;

    const result = await this.checkpointer.pool.query(
      `SELECT DISTINCT thread_id, created_at
       FROM checkpoints
       WHERE thread_id LIKE $1
       ORDER BY created_at DESC`,
      [pattern]
    );

    return result.rows;
  }

  /**
   * Delete tenant data (for GDPR compliance)
   */
  async deleteTenantData(tenantId: string) {
    const pattern = `${tenantId}:%`;

    await this.checkpointer.pool.query(
      `DELETE FROM checkpoints WHERE thread_id LIKE $1`,
      [pattern]
    );

    console.log(`Deleted all data for tenant: ${tenantId}`);
  }

  /**
   * Archive old sessions
   */
  async archiveOldSessions(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.checkpointer.pool.query(
      `DELETE FROM checkpoints
       WHERE created_at < $1
       RETURNING thread_id`,
      [cutoffDate]
    );

    console.log(`Archived ${result.rowCount} old sessions`);
    return result.rows;
  }

  async close() {
    await this.checkpointer.close();
  }
}

// Usage
async function manageTenantCheckpoints() {
  const manager = new TenantCheckpointerManager();
  await manager.initialize();

  // Create thread for user
  const threadId = manager.generateThreadId('tenant-abc', 'user-123');
  console.log('Thread ID:', threadId);

  // Get user's sessions
  const sessions = await manager.getUserSessions('tenant-abc', 'user-123');
  console.log('User sessions:', sessions);

  // Archive old data
  await manager.archiveOldSessions(30);

  // GDPR: Delete all tenant data
  // await manager.deleteTenantData('tenant-abc');

  await manager.close();
}
```

### Example 6: Multi-Region Deployment

```typescript
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

interface RegionConfig {
  name: string;
  host: string;
  database: string;
}

class MultiRegionCheckpointer {
  private checkpointers = new Map<string, CheckpointerInstance>();

  async initialize(regions: RegionConfig[]) {
    for (const region of regions) {
      const checkpointer = await createCheckpointer({
        host: region.host,
        database: region.database,
        user: process.env.POSTGRES_USER!,
        password: process.env.POSTGRES_PASSWORD!,
        maxConnections: 20,
        ssl: true,
      });

      this.checkpointers.set(region.name, checkpointer);
    }
  }

  getCheckpointer(region: string): CheckpointerInstance {
    const checkpointer = this.checkpointers.get(region);
    if (!checkpointer) {
      throw new Error(`No checkpointer for region: ${region}`);
    }
    return checkpointer;
  }

  async closeAll() {
    for (const checkpointer of this.checkpointers.values()) {
      await checkpointer.close();
    }
  }
}

// Usage
async function setupMultiRegion() {
  const manager = new MultiRegionCheckpointer();

  await manager.initialize([
    { name: 'us-east', host: 'db-us-east.example.com', database: 'aep_us' },
    { name: 'eu-west', host: 'db-eu-west.example.com', database: 'aep_eu' },
    { name: 'ap-south', host: 'db-ap-south.example.com', database: 'aep_ap' },
  ]);

  // Use region-specific checkpointer
  const usCheckpointer = manager.getCheckpointer('us-east');

  // Cleanup
  await manager.closeAll();
}
```

## Error Recovery

### Example 7: Automatic Retry with Exponential Backoff

```typescript
import { createCheckpointer, type CheckpointerConfig } from '@friendly-aiaep/agent-runtime';

async function createCheckpointerWithRetry(
  config: CheckpointerConfig,
  maxRetries: number = 5
): Promise<CheckpointerInstance> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1}/${maxRetries} to create checkpointer...`);

      const checkpointer = await createCheckpointer(config);

      console.log('Checkpointer created successfully');
      return checkpointer;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
        console.log(`Retry in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to create checkpointer after ${maxRetries} attempts: ${lastError!.message}`
  );
}

// Usage
async function robustSetup() {
  try {
    const checkpointer = await createCheckpointerWithRetry({
      host: 'localhost',
      database: 'aep_dev',
      user: 'postgres',
      password: 'postgres',
    });

    console.log('Connected!');
    await checkpointer.close();
  } catch (error) {
    console.error('All retry attempts failed:', error);
    process.exit(1);
  }
}
```

### Example 8: Graceful Degradation (Fallback to In-Memory)

```typescript
import {
  createCheckpointer,
  createAgentGraph,
  type CheckpointerInstance,
} from '@friendly-aiaep/agent-runtime';
import { MemorySaver } from '@langchain/langgraph';

async function createCheckpointerWithFallback(): Promise<{
  checkpointer: PostgresSaver | MemorySaver;
  isPersistent: boolean;
  close?: () => Promise<void>;
}> {
  try {
    const instance = await createCheckpointer({
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB || 'aep_dev',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    });

    console.log('✓ PostgreSQL checkpointer active (persistent)');

    return {
      checkpointer: instance.checkpointer,
      isPersistent: true,
      close: instance.close,
    };
  } catch (error) {
    console.warn('⚠ PostgreSQL unavailable, using in-memory checkpointer');
    console.warn('  State will not persist across restarts!');

    return {
      checkpointer: new MemorySaver(),
      isPersistent: false,
    };
  }
}

// Usage
async function setupWithFallback() {
  const { checkpointer, isPersistent, close } = await createCheckpointerWithFallback();

  const graph = await createAgentGraph({
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    temperature: 0.7,
    checkpointer,
  });

  // Use graph...

  if (close) {
    await close();
  }
}
```

## Production Deployment

### Example 9: Complete Production Setup

```typescript
import {
  createCheckpointer,
  createAgentGraph,
  type CheckpointerInstance,
} from '@friendly-aiaep/agent-runtime';
import { createLogger } from 'winston';

class ProductionCheckpointerService {
  private checkpointer?: CheckpointerInstance;
  private logger = createLogger({
    level: 'info',
    format: winston.format.json(),
  });

  async initialize() {
    const config = {
      host: process.env.POSTGRES_HOST!,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB!,
      user: process.env.POSTGRES_USER!,
      password: process.env.POSTGRES_PASSWORD!,
      maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '50'),
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      ssl: {
        rejectUnauthorized: true,
        ca: process.env.POSTGRES_CA_CERT,
      },
    };

    // Retry logic
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        this.checkpointer = await createCheckpointer(config);

        this.logger.info('Checkpointer initialized successfully');
        this.setupMonitoring();
        this.setupGracefulShutdown();

        return;
      } catch (error) {
        attempts++;
        this.logger.error(`Checkpointer init failed (attempt ${attempts}/${maxAttempts})`, {
          error: error.message,
        });

        if (attempts >= maxAttempts) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private setupMonitoring() {
    if (!this.checkpointer) return;

    // Pool event monitoring
    this.checkpointer.pool.on('connect', () => {
      this.logger.debug('Database client connected');
    });

    this.checkpointer.pool.on('error', (err) => {
      this.logger.error('Unexpected pool error', { error: err.message });
    });

    // Periodic health check
    setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        this.logger.error('Health check failed', { error: error.message });
      }
    }, 60000); // Every minute
  }

  async healthCheck() {
    if (!this.checkpointer) {
      throw new Error('Checkpointer not initialized');
    }

    const result = await this.checkpointer.pool.query('SELECT NOW()');

    this.logger.debug('Health check passed', {
      poolSize: this.checkpointer.pool.totalCount,
      idleConnections: this.checkpointer.pool.idleCount,
      waitingRequests: this.checkpointer.pool.waitingCount,
    });

    return {
      status: 'healthy',
      timestamp: result.rows[0].now,
    };
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      this.logger.info(`${signal} received, shutting down gracefully...`);

      if (this.checkpointer) {
        await this.checkpointer.close();
        this.logger.info('Checkpointer closed successfully');
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  getCheckpointer() {
    if (!this.checkpointer) {
      throw new Error('Checkpointer not initialized');
    }
    return this.checkpointer;
  }

  async cleanup() {
    if (this.checkpointer) {
      await this.checkpointer.close();
    }
  }
}

// Usage
const checkpointerService = new ProductionCheckpointerService();

async function startApplication() {
  try {
    await checkpointerService.initialize();

    const checkpointer = checkpointerService.getCheckpointer();

    const graph = await createAgentGraph({
      llmProvider: process.env.LLM_PROVIDER || 'openai',
      llmModel: process.env.LLM_MODEL || 'gpt-4',
      temperature: 0.7,
      checkpointer: checkpointer.checkpointer,
    });

    // Start your application server here...
    console.log('Application ready');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

startApplication();
```

### Example 10: Kubernetes Health Checks

```typescript
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';
import express from 'express';

const app = express();
let checkpointer: CheckpointerInstance;

// Liveness probe
app.get('/healthz', async (req, res) => {
  try {
    if (!checkpointer) {
      return res.status(503).json({ status: 'unavailable' });
    }

    await checkpointer.pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Readiness probe
app.get('/readyz', async (req, res) => {
  try {
    if (!checkpointer) {
      return res.status(503).json({ status: 'not ready' });
    }

    // Check if checkpointer can actually process requests
    await checkpointer.pool.query('SELECT COUNT(*) FROM checkpoints LIMIT 1');

    res.json({
      status: 'ready',
      poolSize: checkpointer.pool.totalCount,
      idleConnections: checkpointer.pool.idleCount,
    });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

async function startServer() {
  checkpointer = await createCheckpointer({
    host: process.env.POSTGRES_HOST!,
    database: process.env.POSTGRES_DB!,
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
  });

  app.listen(3000, () => {
    console.log('Server ready on port 3000');
  });
}

startServer();
```

## Testing Examples

### Example 11: Unit Test with Mocked Checkpointer

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

vi.mock('@friendly-aiaep/agent-runtime', () => ({
  createCheckpointer: vi.fn().mockResolvedValue({
    checkpointer: {
      put: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
    pool: {
      query: vi.fn(),
      end: vi.fn(),
    },
    close: vi.fn(),
  }),
}));

describe('Agent with Checkpointer', () => {
  it('should persist agent state', async () => {
    const checkpointer = await createCheckpointer({
      host: 'localhost',
      database: 'test',
      user: 'test',
      password: 'test',
    });

    // Test your agent logic...

    expect(checkpointer.checkpointer.put).toHaveBeenCalled();
  });
});
```

### Example 12: Integration Test with Real Database

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('Checkpointer Integration Tests', () => {
  let container: StartedTestContainer;
  let checkpointer: CheckpointerInstance;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new GenericContainer('postgres:15')
      .withEnvironment({
        POSTGRES_DB: 'test',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
      })
      .withExposedPorts(5432)
      .start();

    const port = container.getMappedPort(5432);

    checkpointer = await createCheckpointer({
      host: 'localhost',
      port,
      database: 'test',
      user: 'test',
      password: 'test',
    });
  }, 60000);

  afterAll(async () => {
    await checkpointer.close();
    await container.stop();
  });

  it('should create and retrieve checkpoints', async () => {
    // Your integration test here
  });
});
```

## Additional Resources

- [Checkpointer API Reference](./CHECKPOINTER_README.md)
- [Agent Runtime Documentation](./README.md)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
