# @friendly-tech/iot/sdk-generator

TypeScript SDK generator for Friendly IoT APIs. Generates type-safe client SDKs from OpenAPI specifications with authentication, error handling, and proxy routing.

## Features

- **Automatic SDK Generation**: Generate TypeScript SDKs from UnifiedApiModel (OpenAPI specs)
- **Type Safety**: Full TypeScript support with request/response types
- **Authentication Integration**: Uses FriendlyAuthAdapter for secure API calls
- **Error Handling**: Structured FriendlyApiError with status codes, request IDs, and API source tracking
- **Proxy Routing**: All requests route through configurable baseProxyUrl
- **Template-Based**: Handlebars templates for flexible code generation
- **Fallback SDK**: Hardcoded SDK with 13 IoT tool functions for Phase 1
- **Compilation Verification**: TypeScript programmatic API validates generated code

## Installation

This library is part of the Friendly-AIAEP monorepo.

```bash
pnpm add @friendly-tech/iot/sdk-generator
```

## Quick Start

### Generate SDK from OpenAPI Specs

```typescript
import { createSdkGenerator } from '@friendly-tech/iot/sdk-generator';
import { createSwaggerIngestionService } from '@friendly-tech/iot/swagger-ingestion';

// 1. Ingest OpenAPI specs
const ingestion = createSwaggerIngestionService(authAdapter);
const model = await ingestion.ingestAll([
  { apiId: 'northbound', source: { type: 'url', location: 'https://...' } },
  { apiId: 'events', source: { type: 'url', location: 'https://...' } },
  { apiId: 'qoe', source: { type: 'file', location: './specs/qoe-api.yaml' } },
]);

// 2. Generate SDK
const generator = createSdkGenerator({
  model,
  outputDir: './generated-sdk',
});

const result = await generator.generateAll();
console.log(`Generated SDK at: ${result.outputDir}`);
console.log(`Files: ${Object.keys(result.files).join(', ')}`);
```

### Use Fallback SDK (Hardcoded)

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';

const authAdapter = new FriendlyAuthAdapter({
  apis: [/* ... */],
  redis,
  tenantId: 'tenant-123',
});

const sdk = new FallbackSdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
});

// Use any of the 13 IoT tool functions
const devices = await sdk.getDeviceList({ limit: 10 });
const alerts = await sdk.getAlerts({ severity: 'critical' });
const telemetry = await sdk.getDeviceTelemetry('device-123', {
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-01-31T23:59:59Z',
});
```

## Generated SDK Structure

The generator creates the following files:

```
generated-sdk/
├── NorthboundService.ts   # Device management operations
├── EventsService.ts        # Event subscription/management
├── QoEService.ts           # Telemetry and KPI queries
├── types.ts                # TypeScript interfaces
├── errors.ts               # FriendlyApiError class
└── index.ts                # Barrel exports + FriendlySdk class
```

### Using Generated SDK

```typescript
import { FriendlySdk } from './generated-sdk';

const sdk = new FriendlySdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
});

// Access services
await sdk.northbound.getDevices({ limit: 10 });
await sdk.events.subscribeToEvents({ /* ... */ });
await sdk.qoe.getFleetKpis({ period: 'day' });
```

## SdkGenerator API

### createSdkGenerator(options)

Creates a new SDK generator instance.

```typescript
interface SdkGeneratorOptions {
  model: UnifiedApiModel;           // From swagger-ingestion
  outputDir: string;                // Output directory path
  packageName?: string;             // Package name (default: '@friendly-tech/iot-sdk')
  packageVersion?: string;          // Version (default: '1.0.0')
  includeExamples?: boolean;        // Include usage examples (default: true)
  includeJsDoc?: boolean;           // Include JSDoc comments (default: true)
  formatCode?: boolean;             // Format generated code (default: true)
}
```

### generateAll()

Generates all services, types, and index files.

```typescript
const result = await generator.generateAll();

interface GeneratedSdk {
  outputDir: string;
  files: {
    northboundService: string;
    eventsService: string;
    qoeService: string;
    types: string;
    index: string;
    errors: string;
  };
}
```

### generateService(apiId, outputDir)

Generates a single service file.

```typescript
const path = await generator.generateService('northbound', './output');
```

### generateTypes(outputDir)

Generates types.ts with all TypeScript interfaces.

```typescript
const path = await generator.generateTypes('./output');
```

### generateIndex(outputDir)

Generates index.ts barrel export.

```typescript
const path = await generator.generateIndex('./output');
```

## FriendlyApiError

All generated SDK methods throw `FriendlyApiError` on failure.

```typescript
interface FriendlyApiErrorOptions {
  statusCode: number;
  message: string;
  requestId?: string;
  apiSource: 'northbound' | 'events' | 'qoe';
  details?: any;
}

class FriendlyApiError extends Error {
  statusCode: number;
  requestId?: string;
  apiSource: string;
  details?: any;

  isClientError(): boolean;      // 4xx errors
  isServerError(): boolean;      // 5xx errors
  isRetryable(): boolean;        // Retryable errors
  toJSON(): object;
  toString(): string;
}
```

### Error Handling Example

```typescript
try {
  const device = await sdk.northbound.getDevice({ deviceId: '123' });
} catch (error) {
  if (error instanceof FriendlyApiError) {
    console.error(`API Error (${error.statusCode}): ${error.message}`);
    console.error(`Request ID: ${error.requestId}`);
    console.error(`API Source: ${error.apiSource}`);

    if (error.isRetryable()) {
      // Retry the request
    }
  }
}
```

## Fallback SDK - 13 IoT Tool Functions

The hardcoded fallback SDK includes these functions:

### Device Management
1. **getDeviceList**(params?) - Paginated device list
2. **getDeviceById**(deviceId) - Device details
3. **updateDevice**(deviceId, update) - Update device

### Alert Management
4. **getAlerts**(params?) - Filtered alerts
5. **acknowledgeAlert**(alertId) - Acknowledge alert
6. **resolveAlert**(alertId, resolution) - Resolve alert

### Event Management
7. **subscribeToEvents**(subscription) - Create subscription
8. **unsubscribeFromEvents**(subscriptionId) - Cancel subscription
9. **getEventHistory**(params) - Historical events

### Telemetry/QoE
10. **getDeviceTelemetry**(deviceId, params) - Device metrics
11. **getFleetKpis**(params?) - Fleet-wide KPIs
12. **getDeviceConnectivity**(deviceId) - Connectivity status

### Configuration
13. **getDeviceConfiguration**(deviceId) - Device config

See [FALLBACK_SDK.md](./FALLBACK_SDK.md) for complete documentation.

## Handlebars Templates

The generator uses Handlebars templates for code generation:

### Available Templates

1. **service.ts.hbs** - Service class template
   - Generates methods for each API operation
   - Includes authentication, error handling, parameter handling
   - Uses FriendlyAuthAdapter for auth headers

2. **types.ts.hbs** - TypeScript interface template
   - Generates entity types
   - Generates request parameter types
   - Generates response types

3. **index.ts.hbs** - Barrel export template
   - Exports all services
   - Exports FriendlySdk aggregator class
   - Exports error classes and types

4. **errors.ts.hbs** - Error handling template
   - FriendlyApiError class
   - Error factory functions
   - Type guards

### Custom Templates

You can provide custom templates:

```typescript
const generator = createSdkGenerator({
  model,
  outputDir: './output',
  customTemplatesPath: './my-templates',
});
```

### Handlebars Helpers

The generator registers these helpers:

- **camelCase** - Convert to camelCase
- **pascalCase** - Convert to PascalCase
- **httpMethod** - Lowercase HTTP method
- **pathParams** - Extract path parameters
- **queryParams** - Extract query parameters

## Testing

### Run Tests

```bash
# Run all tests
pnpm nx test sdk-generator

# Run in watch mode
pnpm nx test sdk-generator --watch

# Run specific test file
pnpm nx test sdk-generator --testFile=sdk-generator.spec.ts
```

### Test Coverage

The test suite includes 61+ test cases covering:
- SDK generation from UnifiedApiModel
- Method name generation (GET /devices → getDevices)
- Type extraction and deduplication
- Service generation for all 3 APIs
- TypeScript compilation verification
- Error handling scenarios
- Edge cases (complex parameters, nested schemas, etc.)

### TypeScript Compilation Check

Tests use TypeScript's programmatic API to verify generated code compiles:

```typescript
import ts from 'typescript';

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  strict: true,
});

const diagnostics = ts.getPreEmitDiagnostics(program);
// diagnostics.length === 0 means compilation succeeded
```

## Generated Service Method Example

```typescript
/**
 * Get device by ID
 * Retrieves detailed information about a specific device
 * @param params - Request parameters
 * @returns Promise<Types.DeviceResponse>
 */
async getDevice(params: Types.GetDeviceRequest): Promise<Types.DeviceResponse> {
  const headers = await this.authAdapter.getAuthHeaders('northbound');

  let path = '/devices/{deviceId}';
  path = path.replace('{deviceId}', encodeURIComponent(String(params.deviceId)));

  const url = `${this.baseProxyUrl}${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...headers,
    },
  });

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id') || undefined;
    throw new FriendlyApiError({
      statusCode: response.status,
      message: await response.text(),
      requestId,
      apiSource: 'northbound',
    });
  }

  return response.json() as Promise<Types.DeviceResponse>;
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SDK Generator                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  UnifiedApiModel (from swagger-ingestion)            │  │
│  │  - northbound API spec                               │  │
│  │  - events API spec                                   │  │
│  │  - qoe API spec                                      │  │
│  │  - shared entities                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SdkGenerator                                        │  │
│  │  - Load Handlebars templates                         │  │
│  │  - Extract types from schemas                        │  │
│  │  - Generate method names                             │  │
│  │  - Build template context                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Generated SDK Files                                 │  │
│  │  ├── NorthboundService.ts                            │  │
│  │  ├── EventsService.ts                                │  │
│  │  ├── QoEService.ts                                   │  │
│  │  ├── types.ts                                        │  │
│  │  ├── errors.ts                                       │  │
│  │  └── index.ts                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Integration Example

```typescript
import { createSwaggerIngestionService } from '@friendly-tech/iot/swagger-ingestion';
import { createSdkGenerator, FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import Redis from 'ioredis';

async function generateAndUseSdk() {
  // 1. Setup authentication
  const redis = new Redis();
  const authAdapter = new FriendlyAuthAdapter({
    apis: [
      {
        id: 'northbound',
        baseUrl: 'https://dm.friendly.example.com',
        authMethods: ['basic'],
        primaryAuth: 'basic',
        credentials: { username: 'admin', password: 'pass' },
      },
    ],
    redis,
    tenantId: 'tenant-123',
  });

  try {
    // 2. Ingest OpenAPI specs
    const ingestion = createSwaggerIngestionService(authAdapter);
    const model = await ingestion.ingestAll([
      {
        apiId: 'northbound',
        source: { type: 'url', location: 'https://dm.friendly.example.com/swagger.json' },
        auth: { type: 'basic', credentials: { username: 'admin', password: 'pass' } },
      },
    ]);

    // 3. Generate SDK
    const generator = createSdkGenerator({
      model,
      outputDir: './generated-sdk',
    });

    const result = await generator.generateAll();
    console.log('SDK generated at:', result.outputDir);

    // 4. Use generated SDK
    const { FriendlySdk } = await import('./generated-sdk');
    const sdk = new FriendlySdk({
      authAdapter,
      baseProxyUrl: 'https://api.example.com/proxy',
    });

    const devices = await sdk.northbound.getDevices({ limit: 10 });
    console.log(`Found ${devices.items.length} devices`);
  } catch (error) {
    // 5. Fallback to hardcoded SDK if generation fails
    console.warn('Using fallback SDK:', error);
    const fallbackSdk = new FallbackSdk({
      authAdapter,
      baseProxyUrl: 'https://api.example.com/proxy',
    });

    const devices = await fallbackSdk.getDeviceList({ limit: 10 });
    console.log(`Found ${devices.items.length} devices`);
  } finally {
    await authAdapter.close();
    await redis.quit();
  }
}
```

## Dependencies

- **handlebars**: Template engine for code generation
- **typescript**: TypeScript compiler for validation
- **@friendly-tech/iot/swagger-ingestion**: OpenAPI spec ingestion
- **@friendly-tech/iot/auth-adapter**: Authentication handling

## Building

```bash
nx build sdk-generator
```

## Running unit tests

```bash
nx test sdk-generator
```

## Related Documentation

- [FALLBACK_SDK.md](./FALLBACK_SDK.md) - Fallback SDK documentation
- [EXAMPLE_USAGE.md](./EXAMPLE_USAGE.md) - Usage examples
- [@friendly-tech/iot/swagger-ingestion](../swagger-ingestion/README.md) - OpenAPI ingestion
- [@friendly-tech/iot/auth-adapter](../auth-adapter/README.md) - Authentication

## License

Private - Friendly AI AEP System
