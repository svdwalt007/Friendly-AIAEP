# Quick Start Guide - Swagger Ingestion

## Installation

The library is already installed as part of the Friendly-AIAEP monorepo.

```bash
# If needed, install dependencies
pnpm install
```

## Basic Usage

### 1. Import the Service

```typescript
import { createSwaggerIngestionService } from '@friendly-tech/iot/swagger-ingestion';
```

### 2. Create Service Instance

```typescript
// Without authentication
const service = createSwaggerIngestionService();

// With authentication (for URL-based specs)
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import Redis from 'ioredis';

const authAdapter = new FriendlyAuthAdapter({
  apis: [/* ... */],
  redis: new Redis(),
  tenantId: 'tenant-123'
});

const service = createSwaggerIngestionService(authAdapter);
```

### 3. Ingest a Single Spec

```typescript
// From URL
const result = await service.ingestSpec({
  apiId: 'northbound',
  source: { type: 'url', location: 'https://dm.friendly.example.com/FTACSWS_REST/swagger/docs/v1' },
  auth: {
    type: 'basic',
    credentials: {
      username: 'admin',
      password: 'password'
    }
  }
});

console.log(`Ingested ${result.apiId} with ${result.spec.operations.length} operations`);
console.log(`Spec hash: ${result.hash}`);
```

```typescript
// From local file
const result = await service.ingestSpec({
  apiId: 'qoe',
  source: { type: 'file', location: './specs/qoe-api.yaml' }
});
```

### 4. Ingest All Three APIs

```typescript
const configs = [
  {
    apiId: 'northbound',
    source: { type: 'url', location: 'https://dm.friendly.example.com/FTACSWS_REST/swagger/docs/v1' },
    auth: { type: 'basic', credentials: { username: 'admin', password: 'pass' } }
  },
  {
    apiId: 'events',
    source: { type: 'url', location: 'https://events.friendly.example.com:8443/rest/v2/api-docs?group=ws%20iot' },
    auth: { type: 'jwt', credentials: { username: 'events-user', password: 'events-pass' } }
  },
  {
    apiId: 'qoe',
    source: { type: 'file', location: './libs/iot/swagger-ingestion/specs/qoe-api.yaml' }
  }
];

const model = await service.ingestAll(configs);

console.log(`Total APIs: ${model.metadata.totalApis}`);
console.log(`Total Operations: ${model.metadata.totalOperations}`);
console.log(`Shared Entities: ${Object.keys(model.sharedEntities).length}`);
```

### 5. Access the Unified Model

```typescript
// Access individual API specs
const northboundSpec = model.apis.northbound;
console.log(`Northbound has ${northboundSpec.operations.length} operations`);

// Access shared entities
const deviceEntity = model.sharedEntities.Device;
console.log(`Device entity is used by: ${deviceEntity.referencedBy.join(', ')}`);

// Access all operations
model.operations.forEach(op => {
  console.log(`${op.method} ${op.path} (${op.apiId})`);
});
```

### 6. Detect Breaking Changes

```typescript
// Ingest old version
const oldModel = await service.ingestAll(oldConfigs);

// Later, ingest new version
const newModel = await service.ingestAll(newConfigs);

// Compare
const breakingChanges = service.diffSpecs(oldModel, newModel);

if (breakingChanges.length > 0) {
  console.warn(`Found ${breakingChanges.length} breaking changes:`);
  breakingChanges.forEach(change => {
    console.log(`- ${change.type} (${change.severity}): ${change.description}`);
    if (change.migration) {
      console.log(`  Migration: ${change.migration}`);
    }
  });
}
```

### 7. Listen to Events

```typescript
// Spec changed event
service.on('spec-changed', (result) => {
  console.log(`✅ Spec ${result.apiId} ingested successfully`);
  console.log(`   Hash: ${result.hash}`);
  console.log(`   Operations: ${result.spec.operations.length}`);
});

// Ingestion error event
service.on('ingestion-error', (error, apiId) => {
  console.error(`❌ Failed to ingest ${apiId}:`, error.message);
});

// Breaking changes detected event
service.on('breaking-changes-detected', (changes) => {
  console.warn(`⚠️  ${changes.length} breaking changes detected`);
  changes.forEach(change => {
    console.log(`   - ${change.type}: ${change.path || change.operationId}`);
  });
});
```

### 8. Use Hash Storage

```typescript
import { SpecHashStorage } from '@friendly-tech/iot/swagger-ingestion';

const hashStorage = new SpecHashStorage();

// Check if spec changed before ingesting
const storedHashes = await hashStorage.loadHashes();

const result = await service.ingestSpec(config);

if (await hashStorage.hasChanged(result.apiId, result.hash)) {
  console.log('Spec has changed, processing...');

  // Process the spec (e.g., update SDK, regenerate code)
  await processSpec(result.spec);

  // Update stored hash
  await hashStorage.updateHash(result.apiId, result.hash);
} else {
  console.log('Spec unchanged, skipping processing');
}
```

## Complete Example

```typescript
import { createSwaggerIngestionService, SpecHashStorage } from '@friendly-tech/iot/swagger-ingestion';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import Redis from 'ioredis';

async function ingestAllSpecs() {
  // Setup
  const redis = new Redis({ host: 'localhost', port: 6379 });
  const authAdapter = new FriendlyAuthAdapter({
    apis: [
      {
        id: 'northbound',
        baseUrl: 'https://dm.friendly.example.com',
        authMethods: ['basic'],
        primaryAuth: 'basic',
        credentials: { username: 'admin', password: 'password' }
      },
      {
        id: 'events',
        baseUrl: 'https://events.friendly.example.com',
        authMethods: ['jwt'],
        primaryAuth: 'jwt',
        credentials: { username: 'events-user', password: 'events-pass' }
      }
    ],
    redis,
    tenantId: 'tenant-123'
  });

  const service = createSwaggerIngestionService(authAdapter);
  const hashStorage = new SpecHashStorage();

  // Listen to events
  service.on('spec-changed', (result) => {
    console.log(`✅ ${result.apiId} ingested (hash: ${result.hash.substring(0, 8)}...)`);
  });

  service.on('ingestion-error', (error, apiId) => {
    console.error(`❌ ${apiId} failed:`, error.message);
  });

  // Configure specs
  const configs = [
    {
      apiId: 'northbound' as const,
      source: { type: 'url' as const, location: 'https://dm.friendly.example.com/FTACSWS_REST/swagger/docs/v1' },
      auth: { type: 'basic' as const, credentials: { username: 'admin', password: 'password' } }
    },
    {
      apiId: 'events' as const,
      source: { type: 'url' as const, location: 'https://events.friendly.example.com:8443/rest/v2/api-docs?group=ws%20iot' },
      auth: { type: 'jwt' as const, credentials: { username: 'events-user', password: 'events-pass' } }
    },
    {
      apiId: 'qoe' as const,
      source: { type: 'file' as const, location: './libs/iot/swagger-ingestion/specs/qoe-api.yaml' }
    }
  ];

  // Ingest all specs
  console.log('Ingesting specs...');
  const model = await service.ingestAll(configs);

  // Display results
  console.log('\n📊 Unified API Model:');
  console.log(`   APIs: ${model.metadata.totalApis}`);
  console.log(`   Operations: ${model.metadata.totalOperations}`);
  console.log(`   Shared Entities: ${model.metadata.totalEntities}`);

  console.log('\n🔗 Shared Entities:');
  Object.entries(model.sharedEntities).forEach(([name, entity]) => {
    console.log(`   ${name}: referenced by ${entity.referencedBy.join(', ')}`);
  });

  console.log('\n📋 Operations by API:');
  Object.entries(model.apis).forEach(([apiId, spec]) => {
    console.log(`   ${apiId}: ${spec.operations.length} operations`);
  });

  // Cleanup
  await authAdapter.close();
  await redis.quit();
}

// Run
ingestAllSpecs().catch(console.error);
```

## Authentication Types

### Basic Auth

```typescript
const result = await service.ingestSpec({
  apiId: 'northbound',
  source: { type: 'url', location: 'https://api.example.com/swagger.json' },
  auth: {
    type: 'basic',
    credentials: {
      username: 'admin',
      password: 'password'
    }
  }
});
```

### Bearer Token

```typescript
const result = await service.ingestSpec({
  apiId: 'northbound',
  source: { type: 'url', location: 'https://api.example.com/swagger.json' },
  auth: {
    type: 'bearer',
    credentials: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
  }
});
```

### API Key

```typescript
const result = await service.ingestSpec({
  apiId: 'qoe',
  source: { type: 'url', location: 'https://qoe.friendly.example.com/api-docs' },
  auth: {
    type: 'apiKey',
    credentials: {
      apiKey: 'your-api-key-here'
    }
  }
});
```

### JWT (via FriendlyAuthAdapter)

```typescript
const result = await service.ingestSpec({
  apiId: 'events',
  source: { type: 'url', location: 'https://events.friendly.example.com/api-docs' },
  auth: {
    type: 'jwt',
    credentials: {
      username: 'events-user',
      password: 'events-pass'
    }
  }
});
```

## Breaking Change Types

### Removed Endpoint

```typescript
{
  type: 'REMOVED_ENDPOINT',
  severity: 'critical',
  apiId: 'northbound',
  path: '/devices/{id}',
  method: 'DELETE',
  description: 'Endpoint DELETE /devices/{id} was removed',
  migration: 'Use PATCH /devices/{id} with status=inactive instead'
}
```

### Parameter Type Changed

```typescript
{
  type: 'PARAMETER_TYPE_CHANGED',
  severity: 'major',
  apiId: 'events',
  path: '/events',
  operationId: 'listEvents',
  before: { name: 'limit', type: 'integer' },
  after: { name: 'limit', type: 'string' },
  description: 'Parameter limit type changed from integer to string',
  migration: 'Convert limit to string: limit.toString()'
}
```

### Parameter Required Added

```typescript
{
  type: 'PARAMETER_REQUIRED_ADDED',
  severity: 'major',
  apiId: 'qoe',
  path: '/qoe/devices/{id}/telemetry',
  operationId: 'getDeviceTelemetry',
  description: 'Parameter metrics is now required',
  migration: 'Always provide metrics parameter'
}
```

## Testing

```bash
# Run tests
pnpm nx test swagger-ingestion

# Run tests in watch mode
pnpm nx test swagger-ingestion --watch

# Run specific test file
pnpm nx test swagger-ingestion --testFile=swagger-ingestion.spec.ts
```

## Common Patterns

### Scheduled Spec Refresh

```typescript
import { createSwaggerIngestionService, SpecHashStorage } from '@friendly-tech/iot/swagger-ingestion';

const service = createSwaggerIngestionService(authAdapter);
const hashStorage = new SpecHashStorage();

// Check for spec changes every hour
setInterval(async () => {
  try {
    const model = await service.ingestAll(configs);

    // Check each API for changes
    for (const [apiId, spec] of Object.entries(model.apis)) {
      const hash = spec.hash; // Assuming hash is part of spec

      if (await hashStorage.hasChanged(apiId, hash)) {
        console.log(`Spec ${apiId} changed, regenerating SDK...`);
        await regenerateSDK(apiId, spec);
        await hashStorage.updateHash(apiId, hash);
      }
    }
  } catch (error) {
    console.error('Spec refresh failed:', error);
  }
}, 60 * 60 * 1000); // 1 hour
```

### Conditional Processing

```typescript
const result = await service.ingestSpec(config);

if (await hashStorage.hasChanged(result.apiId, result.hash)) {
  // Only process if changed
  await updateDatabase(result.spec);
  await regenerateTypes(result.spec);
  await notifyTeam(result.apiId, result.hash);
  await hashStorage.updateHash(result.apiId, result.hash);
}
```

### Error Recovery

```typescript
service.on('ingestion-error', async (error, apiId) => {
  console.error(`Failed to ingest ${apiId}:`, error.message);

  // Retry with exponential backoff
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));

    try {
      const config = configs.find(c => c.apiId === apiId);
      await service.ingestSpec(config);
      console.log(`Retry ${retries + 1} succeeded for ${apiId}`);
      break;
    } catch (retryError) {
      retries++;
      if (retries === maxRetries) {
        console.error(`All retries failed for ${apiId}`);
      }
    }
  }
});
```

## Next Steps

- Read [USAGE.md](./USAGE.md) for comprehensive examples
- Read [README.md](./README.md) for architecture details
- See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for technical details
- Check [@friendly-tech/iot/auth-adapter](../auth-adapter/README.md) for authentication setup
