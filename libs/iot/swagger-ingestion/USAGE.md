# SwaggerIngestionService Usage Guide

## Overview

The `SwaggerIngestionService` handles ingestion, validation, and diffing of OpenAPI/Swagger specifications for the Friendly AI AEP system. It supports fetching specs from URLs with authentication and loading from local files.

## Installation

The service is part of the `@friendly-aiaep/swagger-ingestion` library.

```typescript
import {
  SwaggerIngestionService,
  createSwaggerIngestionService,
  type SpecConfig,
  type UnifiedApiModel,
} from '@friendly-aiaep/swagger-ingestion';
import { FriendlyAuthAdapter } from '@friendly-aiaep/auth-adapter';
```

## Basic Usage

### Creating the Service

```typescript
// Create auth adapter (optional)
const authAdapter = new FriendlyAuthAdapter({
  defaultAuthMethod: 'basic',
});

// Create ingestion service
const ingestionService = createSwaggerIngestionService(authAdapter);
```

### Ingesting a Single Spec

```typescript
const config: SpecConfig = {
  apiId: 'northbound',
  source: {
    type: 'url',
    location: 'https://api.example.com/v1/swagger.json',
  },
  auth: {
    type: 'basic',
    credentials: {
      username: 'admin',
      password: 'password123',
    },
  },
};

const result = await ingestionService.ingestSpec(config);
console.log('API ID:', result.apiId);
console.log('Hash:', result.hash);
console.log('Operations:', result.spec.operations.length);
```

### Ingesting Multiple Specs

```typescript
const configs: SpecConfig[] = [
  {
    apiId: 'northbound',
    source: {
      type: 'url',
      location: 'https://api.example.com/northbound/swagger.json',
    },
    auth: {
      type: 'apiKey',
      credentials: {
        apiKey: 'your-api-key-here',
        apiKeyHeader: 'X-API-Key',
      },
    },
  },
  {
    apiId: 'events',
    source: {
      type: 'url',
      location: 'https://api.example.com/events/swagger.json',
    },
    auth: {
      type: 'bearer',
      credentials: {
        token: 'your-bearer-token',
      },
    },
  },
  {
    apiId: 'qoe',
    source: {
      type: 'file',
      location: '/path/to/qoe-api.yaml',
    },
  },
];

const model = await ingestionService.ingestAll(configs);
console.log('Ingested specs:', model.specs.length);
console.log('Shared entities:', model.sharedEntities.length);
console.log('Model hash:', model.modelHash);
```

## Detecting Breaking Changes

```typescript
// Ingest old version
const oldModel = await ingestionService.ingestAll(oldConfigs);

// Ingest new version
const newModel = await ingestionService.ingestAll(newConfigs);

// Compare and detect breaking changes
const breakingChanges = ingestionService.diffSpecs(oldModel, newModel);

if (breakingChanges.length > 0) {
  console.log('Breaking changes detected:');
  breakingChanges.forEach((change) => {
    console.log(`- [${change.type}] ${change.description}`);
    console.log(`  API: ${change.apiId}, Path: ${change.path}, Method: ${change.method}`);
  });
}
```

## Event Handling

The service emits events for spec changes and errors:

```typescript
// Listen for spec changes
ingestionService.on('spec-changed', (result) => {
  console.log(`Spec changed for ${result.apiId}: ${result.hash}`);
});

// Listen for ingestion errors
ingestionService.on('ingestion-error', (error, apiId) => {
  console.error(`Error ingesting ${apiId}:`, error.message);
});

// Listen for breaking changes
ingestionService.on('breaking-changes-detected', (changes) => {
  console.warn(`${changes.length} breaking changes detected`);
});
```

## Working with Shared Entities

The service automatically merges shared entities (Device, Alert, Telemetry, Event, Notification) across multiple APIs:

```typescript
const model = await ingestionService.ingestAll(configs);

model.sharedEntities.forEach((entity) => {
  console.log(`Entity: ${entity.name}`);
  console.log(`Sources: ${entity.sources.join(', ')}`);

  if (entity.conflicts && entity.conflicts.length > 0) {
    console.warn('Conflicts detected:');
    entity.conflicts.forEach((conflict) => {
      console.warn(`  - ${conflict}`);
    });
  }
});
```

## Authentication Types

The service supports multiple authentication methods:

### Basic Authentication

```typescript
auth: {
  type: 'basic',
  credentials: {
    username: 'user',
    password: 'pass',
  },
}
```

### API Key

```typescript
auth: {
  type: 'apiKey',
  credentials: {
    apiKey: 'your-api-key',
    apiKeyHeader: 'X-API-Key', // Optional, defaults to X-API-Key
  },
}
```

### Bearer Token

```typescript
auth: {
  type: 'bearer',
  credentials: {
    token: 'your-bearer-token',
  },
}
```

### OAuth2

```typescript
auth: {
  type: 'oauth2',
  credentials: {
    oauth2: {
      flow: 'clientCredentials',
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'your-client-id',
      clientSecret: 'your-client-secret',
      scopes: {
        'read:api': 'Read API access',
      },
    },
  },
}
```

## Example: Complete Workflow

```typescript
import {
  createSwaggerIngestionService,
  type SpecConfig,
} from '@friendly-aiaep/swagger-ingestion';
import { FriendlyAuthAdapter } from '@friendly-aiaep/auth-adapter';

async function main() {
  // Setup
  const authAdapter = new FriendlyAuthAdapter({
    defaultAuthMethod: 'basic',
  });

  const service = createSwaggerIngestionService(authAdapter);

  // Configure specs
  const configs: SpecConfig[] = [
    {
      apiId: 'northbound',
      source: {
        type: 'url',
        location: 'https://api.example.com/northbound/v1/swagger.json',
      },
      auth: {
        type: 'basic',
        credentials: {
          username: process.env.API_USERNAME,
          password: process.env.API_PASSWORD,
        },
      },
    },
    {
      apiId: 'events',
      source: {
        type: 'url',
        location: 'https://api.example.com/events/v1/swagger.json',
      },
      auth: {
        type: 'basic',
        credentials: {
          username: process.env.API_USERNAME,
          password: process.env.API_PASSWORD,
        },
      },
    },
    {
      apiId: 'qoe',
      source: {
        type: 'file',
        location: './specs/qoe-api.yaml',
      },
    },
  ];

  // Ingest all specs
  const model = await service.ingestAll(configs);

  // Display results
  console.log('\n=== Ingestion Results ===');
  console.log(`Total APIs: ${model.specs.length}`);
  console.log(`Model Hash: ${model.modelHash}`);
  console.log(`Ingested At: ${model.ingestedAt.toISOString()}`);

  console.log('\n=== Shared Entities ===');
  model.sharedEntities.forEach((entity) => {
    console.log(`${entity.name} (${entity.sources.join(', ')})`);
  });

  console.log('\n=== Operations by API ===');
  model.specs.forEach((spec) => {
    console.log(`${spec.id}: ${spec.operations.length} operations`);
  });
}

main().catch(console.error);
```

## API Reference

### SwaggerIngestionService

#### Methods

- `ingestSpec(config: SpecConfig): Promise<IngestResult>`
  - Ingests a single API specification
  - Returns normalized spec and hash

- `ingestAll(configs: SpecConfig[]): Promise<UnifiedApiModel>`
  - Ingests multiple specs in parallel
  - Merges shared entities
  - Returns unified model

- `diffSpecs(oldModel: UnifiedApiModel, newModel: UnifiedApiModel): BreakingChange[]`
  - Compares two models
  - Detects breaking changes
  - Returns array of changes

#### Events

- `spec-changed`: Emitted when a spec is successfully ingested
- `ingestion-error`: Emitted when spec ingestion fails
- `breaking-changes-detected`: Emitted when breaking changes are found

### Types

See the exported types in `./lib/types.ts` for detailed type definitions.

## Error Handling

```typescript
try {
  const result = await ingestionService.ingestSpec(config);
} catch (error) {
  if (error instanceof Error) {
    console.error('Ingestion failed:', error.message);
  }
}
```

## Best Practices

1. **Hash Comparison**: Always compare hashes to detect spec changes
2. **Event Listeners**: Use event listeners for async notifications
3. **Error Handling**: Wrap ingest calls in try-catch blocks
4. **Authentication**: Use environment variables for credentials
5. **File Paths**: Use absolute paths for file-based specs
6. **Breaking Changes**: Run diff checks before deploying spec updates
