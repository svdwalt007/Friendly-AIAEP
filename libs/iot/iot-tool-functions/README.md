# IoT Tool Functions

LangGraph StructuredTool implementations for IoT operations in the Friendly AI AEP system.

## Overview

This library provides 5 core LangGraph StructuredTool classes that enable LLM agents to interact with IoT devices through the Friendly API. Each tool includes:

- **Zod Schema Validation**: Complete input validation with descriptive schemas
- **Redis Caching**: Optional caching with 5-minute TTL and stale data fallback
- **Error Handling**: User-friendly error messages with automatic retries
- **LLM-Friendly**: Clear descriptions optimized for LLM understanding

## Tools

### 1. GetDeviceListTool

Retrieves a paginated list of IoT devices with optional filtering.

**Input Schema:**
```typescript
{
  tenantId: string;
  filters?: {
    deviceType?: string;        // e.g., "sensor", "gateway"
    status?: string;             // e.g., "online", "offline"
    fwVersion?: string;          // e.g., "1.2.3"
    search?: string;             // Search query
    page?: number;               // Default: 1
    pageSize?: number;           // Default: 20, max: 100
  }
}
```

**Returns:**
```typescript
{
  devices: Array<{
    deviceId: string;
    name: string;
    type: string;
    status: string;
    firmwareVersion?: string;
    lastSeen?: string;
  }>;
  total: number;
  page: number;
}
```

### 2. GetDeviceDetailsTool

Retrieves detailed information about a specific device including LwM2M objects.

**Input Schema:**
```typescript
{
  deviceId: string;              // Unique device identifier
}
```

**Returns:**
```typescript
{
  device: {
    deviceId: string;
    name: string;
    type: string;
    status: string;
    firmwareVersion?: string;
    lastSeen?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      address?: string;
    };
    metadata?: Record<string, any>;
    lwm2mObjects?: Array<{
      objectId: number;
      instanceId: number;
      resources: Record<string, any>;
    }>;
  }
}
```

### 3. GetDeviceTelemetryTool

Retrieves time-series telemetry data for a device metric over a time range.

**Input Schema:**
```typescript
{
  deviceId: string;
  metric: string;                // e.g., "cpu", "memory", "temperature"
  timeRange: {
    from: string;                // ISO 8601 timestamp
    to: string;                  // ISO 8601 timestamp
  };
  aggregation?: '1m' | '5m' | '1h' | '1d';
}
```

**Returns:**
```typescript
{
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  metric: string;
  unit: string;
}
```

**Common Metrics:**
- `cpu`: CPU utilization percentage
- `memory`: Memory usage in MB or percentage
- `temperature`: Device temperature in Celsius
- `battery`: Battery level percentage
- `signal`: Signal strength in dBm
- `bandwidth`: Network bandwidth usage

### 4. RegisterWebhookTool

Registers a webhook to receive real-time IoT event notifications.

**Input Schema:**
```typescript
{
  eventType: string;             // e.g., "device.status.changed"
  callbackUrl: string;           // HTTPS webhook URL
  filters?: {
    deviceType?: string;         // Filter by device type
    severity?: string;           // Filter by severity level
  }
}
```

**Returns:**
```typescript
{
  subscriptionId: string;
  status: string;
  eventType: string;
}
```

**Common Event Types:**
- `device.status.changed`: Device goes online/offline
- `alert.created`: New alert generated
- `alert.resolved`: Alert resolved
- `device.telemetry`: Telemetry threshold crossed
- `device.config.updated`: Configuration changed
- `device.firmware.updated`: Firmware updated

### 5. GetKPIMetricsTool

Retrieves fleet-wide KPI metrics for connectivity, firmware, or alerts.

**Input Schema:**
```typescript
{
  tenantId: string;
  kpiType: 'connectivity' | 'firmware' | 'alerts';
  period: '24h' | '7d' | '30d';
}
```

**Returns:**
```typescript
{
  kpis: Array<{
    name: string;
    value: number;
    unit: string;
    trend: number;               // Positive = increase, negative = decrease
  }>
}
```

**KPI Types:**
- `connectivity`: Uptime, online/offline device counts
- `firmware`: Compliance percentage, version distribution
- `alerts`: Alert counts by severity level

## Installation

```bash
pnpm add @friendly-tech/iot/iot-tool-functions
```

## Usage

### Basic Example

```typescript
import { createAllTools } from '@friendly-tech/iot/iot-tool-functions';
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import Redis from 'ioredis';

// Initialize dependencies
const authAdapter = new FriendlyAuthAdapter({
  jwtSecret: process.env.JWT_SECRET!,
  redisClient: new Redis(),
});

await authAdapter.initialize({
  northbound: { clientId: 'xxx', clientSecret: 'yyy' },
  events: { clientId: 'xxx', clientSecret: 'yyy' },
  qoe: { clientId: 'xxx', clientSecret: 'yyy' },
});

const sdk = new FallbackSdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
});

const redis = new Redis();

// Create all tools
const tools = createAllTools({ sdk, redis });

// Use individual tools
const deviceListResult = await tools.getDeviceList._call({
  tenantId: 'tenant-123',
  filters: {
    status: 'online',
    page: 1,
    pageSize: 20,
  },
});

console.log(deviceListResult);
```

### Individual Tool Creation

```typescript
import {
  createGetDeviceListTool,
  createGetDeviceDetailsTool,
} from '@friendly-tech/iot/iot-tool-functions';

const deviceListTool = createGetDeviceListTool({ sdk, redis });
const deviceDetailsTool = createGetDeviceDetailsTool({ sdk, redis });

// Use in LangGraph
const result = await deviceListTool._call({
  tenantId: 'tenant-123',
  filters: { status: 'online' },
});
```

### Without Redis Caching

```typescript
const tools = createAllTools({ sdk }); // No redis parameter

// Tools will work but without caching/fallback
```

### Custom Cache TTL

```typescript
const tools = createAllTools({
  sdk,
  redis,
  cacheTtl: 600, // 10 minutes instead of default 5
});
```

## Caching Behavior

All tools (except RegisterWebhookTool) implement Redis caching with the following behavior:

1. **Cache Hit**: Returns cached data immediately (sub-millisecond)
2. **Cache Miss**: Calls API, caches result, returns fresh data
3. **API Failure**: Returns stale cached data with metadata:
   ```typescript
   {
     success: true,
     data: { /* cached data */ },
     cached: true,
     staleSeconds: 180  // How old the cache is
   }
   ```

**Cache Keys Format**: `iot:tool:{toolName}:{hash(params)}`

**Default TTL**: 300 seconds (5 minutes)

## Error Handling

All tools implement comprehensive error handling:

```typescript
// Success response
{
  "success": true,
  "data": { /* tool-specific data */ }
}

// Error response
{
  "success": false,
  "error": "Error: Device not found"
}

// Cached fallback response
{
  "success": true,
  "data": { /* stale cached data */ },
  "cached": true,
  "staleSeconds": 180
}
```

## Zod Schema Documentation

Each tool uses Zod for input validation. Schemas include:

- Type validation (string, number, enum, etc.)
- Format validation (datetime, URL, etc.)
- Range validation (min, max, positive, etc.)
- Description metadata for LLM context

Example validation error:
```typescript
// Invalid input
{
  deviceId: '',  // Too short
  metric: 123,   // Wrong type
}

// Throws ZodError with detailed messages
```

## Advanced Usage

### Custom Tool Extension

```typescript
import { IoTTool } from '@friendly-tech/iot/iot-tool-functions';
import { z } from 'zod';

class CustomTool extends IoTTool {
  name = 'customTool';
  description = 'My custom tool';
  schema = z.object({
    param: z.string(),
  });

  protected async _call(input: { param: string }): Promise<string> {
    const result = await this.callWithCache(
      this.name,
      input,
      async () => {
        // Custom logic here
        return { success: true, data: {} };
      }
    );
    return this.formatResult(result);
  }
}
```

### Direct Cache Access

```typescript
const tool = createGetDeviceListTool({ sdk, redis });
const cache = tool.getCacheHelper();

if (cache) {
  // Manual cache operations
  await cache.set('my-key', { foo: 'bar' }, 300);
  const cached = await cache.get('my-key');
  await cache.delete('my-key');
  await cache.clearToolCache('getDeviceList');
}
```

## Testing

```bash
# Run unit tests
pnpm nx test iot-tool-functions

# Run with coverage
pnpm nx test iot-tool-functions --coverage
```

## Building

```bash
# Build the library
pnpm nx build iot-tool-functions
```

## Architecture

```
libs/iot/iot-tool-functions/
├── src/
│   ├── lib/
│   │   ├── base-tool.ts              # Base IoTTool class
│   │   ├── cache.ts                  # CacheHelper for Redis
│   │   ├── types.ts                  # Shared type definitions
│   │   └── tools/
│   │       ├── get-device-list.tool.ts
│   │       ├── get-device-details.tool.ts
│   │       ├── get-device-telemetry.tool.ts
│   │       ├── register-webhook.tool.ts
│   │       └── get-kpi-metrics.tool.ts
│   └── index.ts                      # Public API exports
├── package.json
├── project.json
└── README.md
```

## Dependencies

- `@langchain/core`: LangGraph StructuredTool base
- `zod`: Schema validation
- `ioredis`: Redis client for caching
- `@friendly-tech/iot/sdk-generator`: FallbackSdk
- `@friendly-tech/iot/auth-adapter`: Authentication

## License

Private - Friendly AI AEP System

## Related Documentation

- [Module Reference v2.2 Section 6.4](../../docs/Module_Reference_v2.2.md)
- [SDK Generator](../sdk-generator/README.md)
- [Auth Adapter](../auth-adapter/README.md)
