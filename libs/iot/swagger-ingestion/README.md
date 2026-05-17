# @friendly-aiaep/swagger-ingestion

OpenAPI/Swagger specification ingestion, validation, and diff detection service for the Friendly AI AEP system.

## Features

- **Multi-source Ingestion**: Load specs from URLs (with authentication) or local files
- **Format Support**: Parse JSON and YAML OpenAPI specifications
- **Validation**: Full OpenAPI 3.x validation using `@apidevtools/swagger-parser`
- **Authentication**: Support for Basic, API Key, Bearer Token, and OAuth2
- **Spec Normalization**: Convert OpenAPI specs into standardized format
- **Shared Entity Merging**: Automatically merge common entities (Device, Alert, Telemetry, etc.) across APIs
- **Breaking Change Detection**: Compare spec versions and identify breaking changes
- **Event-driven**: EventEmitter-based notifications for spec changes and errors
- **Hash Tracking**: SHA-256 hashing for change detection

## Installation

This library is part of the Friendly-AIAEP monorepo and uses the auth-adapter library.

```bash
npm install @friendly-aiaep/swagger-ingestion
```

## Quick Start

```typescript
import {
  createSwaggerIngestionService,
  type SpecConfig,
} from '@friendly-aiaep/swagger-ingestion';

const service = createSwaggerIngestionService();

const configs: SpecConfig[] = [
  {
    apiId: 'northbound',
    source: { type: 'url', location: 'https://api.example.com/swagger.json' },
  },
  {
    apiId: 'qoe',
    source: { type: 'file', location: './specs/qoe-api.yaml' },
  },
];

const model = await service.ingestAll(configs);
console.log(`Ingested ${model.specs.length} APIs`);
```

## Core Concepts

### Spec Ingestion

The service fetches and validates OpenAPI specs from multiple sources:

- **URL-based**: HTTP/HTTPS endpoints with optional authentication
- **File-based**: Local YAML or JSON files

### Normalization

Raw OpenAPI specs are normalized into a consistent `ApiSpec` format:

- Extracts all operations (endpoints) with full metadata
- Resolves `$ref` references
- Standardizes parameter and response schemas
- Maintains original spec for reference

### Shared Entity Merging

Automatically identifies and merges common entities across APIs:

- Device, Alert, Telemetry, Event, Notification
- Detects schema conflicts
- Creates unified entity definitions

### Breaking Change Detection

Compares spec versions to identify breaking changes:

- Removed endpoints
- Removed or changed parameters
- Changed parameter types
- Made parameters required
- Removed required response fields
- Changed response schemas

## API Types

### Supported API Identifiers

```typescript
type ApiId = 'northbound' | 'events' | 'qoe';
```

### Authentication Configuration

```typescript
interface AuthConfig {
  type: 'basic' | 'bearer' | 'apiKey' | 'oauth2' | 'none';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    oauth2?: OAuth2Config;
  };
}
```

### Spec Configuration

```typescript
interface SpecConfig {
  apiId: ApiId;
  source: {
    type: 'url' | 'file';
    location: string;
  };
  auth?: AuthConfig;
  metadata?: {
    version?: string;
    lastUpdated?: string;
    description?: string;
  };
}
```

## Usage Examples

See [USAGE.md](./USAGE.md) for comprehensive examples.

### Basic Ingestion

```typescript
const result = await service.ingestSpec({
  apiId: 'northbound',
  source: { type: 'url', location: 'https://api.example.com/swagger.json' },
});
```

### With Authentication

```typescript
const result = await service.ingestSpec({
  apiId: 'northbound',
  source: { type: 'url', location: 'https://api.example.com/swagger.json' },
  auth: {
    type: 'basic',
    credentials: {
      username: 'admin',
      password: 'password',
    },
  },
});
```

### Detecting Changes

```typescript
const oldModel = await service.ingestAll(oldConfigs);
const newModel = await service.ingestAll(newConfigs);
const changes = service.diffSpecs(oldModel, newModel);
```

## Events

```typescript
service.on('spec-changed', (result) => {
  console.log(`Spec ${result.apiId} changed: ${result.hash}`);
});

service.on('ingestion-error', (error, apiId) => {
  console.error(`Failed to ingest ${apiId}:`, error.message);
});

service.on('breaking-changes-detected', (changes) => {
  console.warn(`${changes.length} breaking changes detected`);
});
```

## Breaking Change Types

```typescript
enum BreakingChangeType {
  REMOVED_ENDPOINT = 'REMOVED_ENDPOINT',
  REMOVED_PARAMETER = 'REMOVED_PARAMETER',
  PARAMETER_TYPE_CHANGED = 'PARAMETER_TYPE_CHANGED',
  PARAMETER_REQUIRED_ADDED = 'PARAMETER_REQUIRED_ADDED',
  RESPONSE_SCHEMA_CHANGED = 'RESPONSE_SCHEMA_CHANGED',
  REMOVED_REQUIRED_FIELD = 'REMOVED_REQUIRED_FIELD',
}
```

## Architecture

The service consists of several key components:

1. **SwaggerIngestionService**: Main service class
2. **Type Definitions**: Comprehensive TypeScript types
3. **Parser Integration**: Uses `@apidevtools/swagger-parser`
4. **Auth Integration**: Uses `@friendly-aiaep/auth-adapter`
5. **Event System**: Node.js EventEmitter for notifications

## Dependencies

- `@apidevtools/swagger-parser`: OpenAPI parsing and validation
- `@friendly-aiaep/auth-adapter`: Authentication handling
- `yaml`: YAML parsing support
- `crypto`: SHA-256 hashing (Node.js built-in)

## Building

```bash
nx build swagger-ingestion
```

## Testing

```bash
nx test swagger-ingestion
```

## Related Documentation

- [USAGE.md](./USAGE.md) - Detailed usage examples
- [@friendly-aiaep/auth-adapter](../auth-adapter/README.md) - Authentication library

## License

Private - Friendly AI AEP System
