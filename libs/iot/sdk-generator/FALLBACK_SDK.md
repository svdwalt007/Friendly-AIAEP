# Fallback SDK - IoT Tool Functions

The Fallback SDK provides hardcoded implementations of the 13 IoT tool functions specified in Module Reference v2.2. These functions route through the AEP API Gateway to the appropriate Friendly API endpoints.

## Overview

The Fallback SDK is used when dynamic SDK generation from OpenAPI specs is not available or has failed. It provides a reliable, type-safe interface to all essential IoT operations.

## Installation

The Fallback SDK is part of the `@friendly-tech/iot/sdk-generator` package:

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
```

## Usage

### Basic Setup

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';

// Initialize auth adapter
const authAdapter = new FriendlyAuthAdapter({
  tenantId: 'tenant-123',
  apis: {
    northbound: {
      id: 'northbound',
      baseUrl: 'https://northbound.friendly.example.com',
      authMethods: ['jwt', 'basic'],
      primaryAuth: 'jwt',
      credentials: { username: 'user', password: 'pass' },
    },
    events: {
      id: 'events',
      baseUrl: 'https://events.friendly.example.com',
      authMethods: ['jwt', 'basic'],
      primaryAuth: 'jwt',
      credentials: { username: 'user', password: 'pass' },
    },
    qoe: {
      id: 'qoe',
      baseUrl: 'https://qoe.friendly.example.com',
      authMethods: ['apikey'],
      primaryAuth: 'apikey',
      credentials: { apiKey: 'your-api-key' },
    },
  },
  redis: { host: 'localhost', port: 6379 },
});

await authAdapter.initialize();

// Create SDK instance
const sdk = new FallbackSdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
  timeout: 30000, // optional, defaults to 30s
});
```

## API Reference

### Device Management (3 functions)

#### getDeviceList

Retrieves a paginated list of devices with optional filtering.

```typescript
const response = await sdk.getDeviceList({
  limit: 20,
  offset: 0,
  filter: {
    status: 'online',
    type: 'router',
    search: 'building-a',
  },
});

console.log(`Found ${response.total} devices`);
response.devices.forEach((device) => {
  console.log(`${device.name}: ${device.status}`);
});
```

**Parameters:**
- `limit` (optional): Number of results per page
- `offset` (optional): Pagination offset
- `filter` (optional): Filter criteria
  - `status`: Device status ('online' | 'offline' | 'degraded' | 'unknown')
  - `type`: Device type
  - `search`: Search term

**Returns:** `DeviceListResponse`

---

#### getDeviceById

Retrieves detailed information about a specific device.

```typescript
const device = await sdk.getDeviceById('device-123');

console.log(`Device: ${device.name}`);
console.log(`Status: ${device.status}`);
console.log(`Firmware: ${device.firmwareVersion}`);
console.log(`Last seen: ${device.lastSeen}`);
```

**Parameters:**
- `deviceId`: Unique device identifier

**Returns:** `Device`

---

#### updateDevice

Updates device properties such as name, location, or metadata.

```typescript
const updated = await sdk.updateDevice('device-123', {
  name: 'New Device Name',
  location: {
    latitude: 40.7128,
    longitude: -74.006,
    address: '123 Main St, New York, NY',
  },
  metadata: {
    building: 'Building A',
    floor: '3',
    room: '301',
  },
});

console.log(`Updated: ${updated.name}`);
```

**Parameters:**
- `deviceId`: Unique device identifier
- `update`: Properties to update
  - `name` (optional): New device name
  - `location` (optional): Location information
  - `metadata` (optional): Custom metadata

**Returns:** `Device`

---

### Alert Management (3 functions)

#### getAlerts

Retrieves a list of alerts with optional filtering.

```typescript
const response = await sdk.getAlerts({
  severity: 'critical',
  status: 'active',
  deviceId: 'device-123',
  limit: 10,
});

console.log(`Found ${response.total} alerts`);
response.alerts.forEach((alert) => {
  console.log(`[${alert.severity}] ${alert.title}: ${alert.description}`);
});
```

**Parameters:**
- `severity` (optional): Alert severity ('critical' | 'high' | 'medium' | 'low' | 'info')
- `status` (optional): Alert status ('active' | 'acknowledged' | 'resolved')
- `deviceId` (optional): Filter by device ID
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Returns:** `AlertListResponse`

---

#### acknowledgeAlert

Acknowledges an alert to indicate it has been reviewed.

```typescript
const alert = await sdk.acknowledgeAlert('alert-456');

console.log(`Alert acknowledged at ${alert.acknowledgedAt}`);
console.log(`Acknowledged by ${alert.acknowledgedBy}`);
```

**Parameters:**
- `alertId`: Unique alert identifier

**Returns:** `Alert` (with acknowledgment details)

---

#### resolveAlert

Resolves an alert with a resolution note.

```typescript
const alert = await sdk.resolveAlert(
  'alert-456',
  'Fixed by rebooting the device and updating firmware'
);

console.log(`Alert resolved at ${alert.resolvedAt}`);
console.log(`Resolution: ${alert.resolution}`);
```

**Parameters:**
- `alertId`: Unique alert identifier
- `resolution`: Resolution note or description

**Returns:** `Alert` (with resolution details)

---

### Event Management (3 functions)

#### subscribeToEvents

Subscribes to real-time event notifications.

```typescript
const subscription = await sdk.subscribeToEvents({
  eventTypes: ['device.status.changed', 'alert.created', 'device.offline'],
  filters: {
    deviceId: 'device-123',
    severity: 'critical',
  },
  webhookUrl: 'https://myapp.com/webhooks/events',
});

console.log(`Subscription ID: ${subscription.subscriptionId}`);
console.log(`Subscribed to: ${subscription.eventTypes.join(', ')}`);
```

**Parameters:**
- `eventTypes`: Array of event types to subscribe to
- `filters` (optional): Event filters
- `webhookUrl` (optional): Webhook URL for event delivery
- `callbackUrl` (optional): Alternative callback URL

**Returns:** `SubscriptionResponse`

---

#### unsubscribeFromEvents

Unsubscribes from event notifications.

```typescript
await sdk.unsubscribeFromEvents('sub-789');

console.log('Unsubscribed successfully');
```

**Parameters:**
- `subscriptionId`: Unique subscription identifier

**Returns:** `void`

---

#### getEventHistory

Retrieves historical events within a time range.

```typescript
const response = await sdk.getEventHistory({
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
  eventTypes: ['device.status.changed', 'alert.created'],
  deviceId: 'device-123',
  limit: 100,
  offset: 0,
});

console.log(`Found ${response.total} events`);
response.events.forEach((event) => {
  console.log(`[${event.timestamp}] ${event.eventType}`);
  console.log(`  Payload:`, event.payload);
});
```

**Parameters:**
- `startTime`: Start of time range
- `endTime`: End of time range
- `eventTypes` (optional): Filter by event types
- `deviceId` (optional): Filter by device ID
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Returns:** `EventListResponse`

---

### Telemetry/QoE (3 functions)

#### getDeviceTelemetry

Retrieves telemetry data for a specific device.

```typescript
const telemetry = await sdk.getDeviceTelemetry('device-123', {
  startTime: new Date(Date.now() - 3600000), // Last hour
  endTime: new Date(),
  metrics: ['cpu', 'memory', 'temperature', 'bandwidth'],
  interval: '5m',
});

console.log(`Device: ${telemetry.deviceId}`);
telemetry.dataPoints.forEach((point) => {
  console.log(`[${point.timestamp}] ${point.metric}: ${point.value}${point.unit || ''}`);
});
```

**Parameters:**
- `deviceId`: Unique device identifier
- `params`: Telemetry query parameters
  - `startTime`: Start of time range
  - `endTime`: End of time range
  - `metrics` (optional): Specific metrics to retrieve
  - `interval` (optional): Data aggregation interval ('1m' | '5m' | '15m' | '1h' | '1d')

**Returns:** `TelemetryData`

---

#### getFleetKpis

Retrieves fleet-wide KPIs and statistics.

```typescript
const kpis = await sdk.getFleetKpis({
  startTime: new Date(Date.now() - 86400000), // Last 24 hours
  endTime: new Date(),
  deviceType: 'router',
});

console.log(`Total Devices: ${kpis.totalDevices}`);
console.log(`Online: ${kpis.onlineDevices}`);
console.log(`Offline: ${kpis.offlineDevices}`);
console.log(`Degraded: ${kpis.degradedDevices}`);
console.log(`Average Uptime: ${kpis.averageUptime}%`);
console.log(`Alerts:`, kpis.alertCounts);
```

**Parameters:**
- `startTime` (optional): Start of time range
- `endTime` (optional): End of time range
- `deviceType` (optional): Filter by device type

**Returns:** `FleetKPIs`

---

#### getDeviceConnectivity

Retrieves connectivity status and metrics for a specific device.

```typescript
const connectivity = await sdk.getDeviceConnectivity('device-123');

console.log(`Connected: ${connectivity.isConnected}`);
console.log(`Type: ${connectivity.connectionType}`);
console.log(`Signal Strength: ${connectivity.signalStrength}%`);
console.log(`Bandwidth: ${connectivity.bandwidth?.download}/${connectivity.bandwidth?.upload} Mbps`);
console.log(`Latency: ${connectivity.latency}ms`);
```

**Parameters:**
- `deviceId`: Unique device identifier

**Returns:** `ConnectivityStatus`

---

### Configuration (1 function)

#### getDeviceConfiguration

Retrieves the current configuration for a device.

```typescript
const config = await sdk.getDeviceConfiguration('device-123');

console.log(`Device: ${config.deviceId}`);
console.log(`Version: ${config.version}`);
console.log(`Last Updated: ${config.lastUpdated}`);
console.log(`Configuration:`, config.configuration);
```

**Parameters:**
- `deviceId`: Unique device identifier

**Returns:** `DeviceConfig`

---

## Error Handling

The Fallback SDK uses the `FriendlyApiError` class for all API errors:

```typescript
import { FriendlyApiError, isFriendlyApiError } from '@friendly-tech/iot/sdk-generator';

try {
  const device = await sdk.getDeviceById('non-existent');
} catch (error) {
  if (isFriendlyApiError(error)) {
    console.error(`API Error [${error.statusCode}]: ${error.message}`);
    console.error(`API Source: ${error.apiSource}`);
    console.error(`Details:`, error.details);

    // Check if retryable
    if (error.isRetryable()) {
      console.log('This error can be retried');
    }

    // Check error type
    if (error.isClientError()) {
      console.log('Client error (4xx)');
    } else if (error.isServerError()) {
      console.log('Server error (5xx)');
    }
  }
}
```

### Error Properties

- `statusCode`: HTTP status code (or 0 for network errors)
- `message`: Human-readable error message
- `apiSource`: Which API the error originated from ('northbound', 'events', 'qoe')
- `requestId`: Optional request identifier for tracking
- `details`: Additional error details

### Error Methods

- `isClientError()`: Returns true for 4xx status codes
- `isServerError()`: Returns true for 5xx status codes
- `isRetryable()`: Returns true if the operation can be retried
- `toJSON()`: Converts error to JSON-serializable object
- `toString()`: Returns formatted error message

## Authentication

The SDK automatically handles authentication through the provided `FriendlyAuthAdapter`:

- Gets authentication headers for each request
- Automatically routes requests to the correct API (northbound/events/qoe)
- Handles 401 Unauthorized by refreshing tokens and retrying once
- Includes tenant ID in all requests

## Request Routing

Requests are routed through the AEP API Gateway based on the function type:

| Function Category | API Endpoint | Examples |
|------------------|--------------|----------|
| Device Management | `northbound` | getDeviceList, getDeviceById, updateDevice |
| Alert Management | `northbound` | getAlerts, acknowledgeAlert, resolveAlert |
| Event Management | `events` | subscribeToEvents, unsubscribeFromEvents, getEventHistory |
| Telemetry/QoE | `qoe` | getDeviceTelemetry, getFleetKpis, getDeviceConnectivity |
| Configuration | `northbound` | getDeviceConfiguration |

## Timeouts

Default timeout is 30 seconds per request. Configure custom timeout:

```typescript
const sdk = new FallbackSdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
  timeout: 60000, // 60 seconds
});
```

Timeout errors will have status code 408 and are retryable.

## Type Definitions

All request and response types are fully typed and exported:

```typescript
import type {
  Device,
  DeviceUpdate,
  DeviceListParams,
  DeviceListResponse,
  Alert,
  AlertListParams,
  AlertListResponse,
  EventSubscription,
  SubscriptionResponse,
  EventHistoryParams,
  Event,
  EventListResponse,
  TelemetryParams,
  TelemetryData,
  FleetKPIs,
  ConnectivityStatus,
  DeviceConfig,
} from '@friendly-tech/iot/sdk-generator';
```

## Best Practices

1. **Always initialize auth adapter first:**
   ```typescript
   await authAdapter.initialize();
   ```

2. **Handle errors appropriately:**
   ```typescript
   try {
     const device = await sdk.getDeviceById(id);
   } catch (error) {
     if (isFriendlyApiError(error) && error.isRetryable()) {
       // Retry logic
     }
   }
   ```

3. **Use pagination for large datasets:**
   ```typescript
   const page1 = await sdk.getDeviceList({ limit: 100, offset: 0 });
   const page2 = await sdk.getDeviceList({ limit: 100, offset: 100 });
   ```

4. **Filter at the API level when possible:**
   ```typescript
   // Good: Filter at API
   const critical = await sdk.getAlerts({ severity: 'critical' });

   // Avoid: Fetching all then filtering client-side
   const all = await sdk.getAlerts();
   const critical = all.alerts.filter(a => a.severity === 'critical');
   ```

5. **Use appropriate time ranges for historical data:**
   ```typescript
   const events = await sdk.getEventHistory({
     startTime: new Date(Date.now() - 86400000), // Last 24 hours
     endTime: new Date(),
     limit: 1000,
   });
   ```

## Testing

The SDK includes comprehensive unit tests. See `fallback-sdk.spec.ts` for examples of:

- Mocking authentication
- Testing all 13 functions
- Error handling scenarios
- Timeout handling
- 401 retry logic

## Summary

The Fallback SDK provides:

- **13 IoT tool functions** covering all essential operations
- **Type-safe interfaces** with full TypeScript support
- **Automatic authentication** through FriendlyAuthAdapter
- **Smart error handling** with retry logic
- **Request routing** through AEP API Gateway
- **Comprehensive testing** with full coverage

This SDK serves as both a reliable fallback mechanism and a reference implementation for the IoT tool functions specification.
