# PostgreSQL Checkpointer - Quick Start Guide

Get up and running with persistent agent state in 5 minutes.

## Prerequisites

- PostgreSQL 12+ running and accessible
- Node.js 18+ and pnpm installed

## Step 1: Database Setup (2 minutes)

### Option A: Use Docker

```bash
# Start PostgreSQL with Docker
docker run --name aep-postgres \
  -e POSTGRES_DB=aep_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:15

# Verify it's running
docker ps | grep aep-postgres
```

### Option B: Use Docker Compose

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

```bash
docker-compose up -d
```

## Step 2: Environment Variables (30 seconds)

Create a `.env` file:

```bash
# .env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=aep_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

## Step 3: Basic Usage (2 minutes)

### Simple Example

```typescript
import { createCheckpointer } from '@friendly-aiaep/agent-runtime';

async function main() {
  // Create checkpointer (automatically sets up table)
  const checkpointer = await createCheckpointer({
    host: 'localhost',
    database: 'aep_dev',
    user: 'postgres',
    password: 'postgres',
  });

  console.log('✓ Checkpointer ready!');

  // Use with your agent graph...

  // Cleanup
  await checkpointer.close();
}

main();
```

### With Environment Variables

```typescript
import { createCheckpointerFromEnv } from '@friendly-aiaep/agent-runtime';

async function main() {
  const checkpointer = await createCheckpointerFromEnv();
  console.log('✓ Checkpointer ready from environment!');

  // Use with your agent graph...

  await checkpointer.close();
}

main();
```

## Step 4: Integrate with Agent Graph (1 minute)

```typescript
import {
  createCheckpointer,
  createAgentGraph,
  type AEPAgentState,
} from '@friendly-aiaep/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function runPersistentAgent() {
  // 1. Create checkpointer
  const checkpointer = await createCheckpointer({
    host: 'localhost',
    database: 'aep_dev',
    user: 'postgres',
    password: 'postgres',
  });

  // 2. Create graph with checkpointer
  const graph = await createAgentGraph({
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    temperature: 0.7,
    checkpointer: checkpointer.checkpointer,
  });

  // 3. Run agent with thread_id for persistence
  const result = await graph.invoke(
    {
      messages: [new HumanMessage('Create an IoT dashboard')],
      currentAgent: 'supervisor',
      projectId: 'proj-001',
      tenantId: 'tenant-123',
    },
    {
      configurable: { thread_id: 'tenant-123:user-456:session-789' }
    }
  );

  console.log('Agent response:', result.messages[result.messages.length - 1]);

  // 4. Continue conversation (state is automatically resumed)
  const followUp = await graph.invoke(
    {
      ...result,
      messages: [
        ...result.messages,
        new HumanMessage('Add a temperature widget')
      ],
    },
    {
      configurable: { thread_id: 'tenant-123:user-456:session-789' }
    }
  );

  console.log('Follow-up:', followUp.messages[followUp.messages.length - 1]);

  // 5. Cleanup
  await checkpointer.close();
}

runPersistentAgent();
```

## Thread ID Format

Use a consistent format for thread IDs to enable multi-tenant isolation:

```typescript
const threadId = `${tenantId}:${userId}:${sessionId}`;

// Example: 'tenant-abc:user-123:session-456'
```

## Verification

Check that everything is working:

```bash
# Connect to PostgreSQL
docker exec -it aep-postgres psql -U postgres -d aep_dev

# Check if checkpoints table exists
\dt

# View checkpoints
SELECT thread_id, created_at FROM checkpoints;

# Exit
\q
```

## Common Issues

### Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker logs aep-postgres
```

### Permission Denied

Ensure your user has the necessary permissions:

```sql
GRANT ALL PRIVILEGES ON DATABASE aep_dev TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
```

### Table Not Created

The checkpointer automatically creates the table on first use. If you want to create it manually:

```bash
# Run migration script
docker exec -i aep-postgres psql -U postgres -d aep_dev < libs/core/agent-runtime/migrations/001_create_checkpoints_table.sql
```

## Production Checklist

Before deploying to production:

- [ ] Use strong passwords (not 'postgres')
- [ ] Enable SSL connections
- [ ] Configure appropriate connection pool size
- [ ] Set up automated backups
- [ ] Implement checkpoint cleanup strategy
- [ ] Monitor database performance
- [ ] Use environment variables for credentials

Example production configuration:

```typescript
const checkpointer = await createCheckpointer({
  host: process.env.POSTGRES_HOST!,
  port: 5432,
  database: process.env.POSTGRES_DB!,
  user: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
  maxConnections: 50,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem').toString(),
  },
});
```

## Next Steps

- [Full API Documentation](./CHECKPOINTER_README.md)
- [Advanced Examples](./CHECKPOINTER_EXAMPLES.md)
- [Agent Runtime Guide](./README.md)

## Need Help?

Check the comprehensive documentation:
- API Reference: [CHECKPOINTER_README.md](./CHECKPOINTER_README.md)
- Examples: [CHECKPOINTER_EXAMPLES.md](./CHECKPOINTER_EXAMPLES.md)
- Troubleshooting: See "Common Issues" in API Reference
