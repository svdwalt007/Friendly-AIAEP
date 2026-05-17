# Fallback SDK - Quick Reference

## Import

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
```

## Setup

```typescript
const authAdapter = new FriendlyAuthAdapter({ /* config */ });
await authAdapter.initialize();

const sdk = new FallbackSdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
  timeout: 30000, // optional, default 30s
});
```

## Device Management

```typescript
// List devices
const { devices, total } = await sdk.getDeviceList({
  limit: 10,
  offset: 0,
  filter: { status: 'online', type: 'router', search: 'building-a' }
});

// Get device by ID
const device = await sdk.getDeviceById('device-123');

// Update device
const updated = await sdk.updateDevice('device-123', {
  name: 'New Name',
  location: { latitude: 40.7, longitude: -74.0 },
  metadata: { building: 'A', floor: '3' }
});
```

## Alert Management

```typescript
// Get alerts
const { alerts, total } = await sdk.getAlerts({
  severity: 'critical',
  status: 'active',
  deviceId: 'device-123',
  limit: 10
});

// Acknowledge alert
const acked = await sdk.acknowledgeAlert('alert-456');

// Resolve alert
const resolved = await sdk.resolveAlert('alert-456', 'Fixed by rebooting device');
```

## Event Management

```typescript
// Subscribe to events
const sub = await sdk.subscribeToEvents({
  eventTypes: ['device.status.changed', 'alert.created'],
  filters: { deviceId: 'device-123' },
  webhookUrl: 'https://myapp.com/webhook'
});

// Get event history
const { events } = await sdk.getEventHistory({
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
  eventTypes: ['device.status.changed'],
  limit: 100
});

// Unsubscribe
await sdk.unsubscribeFromEvents('sub-789');
```

## Telemetry & QoE

```typescript
// Get device telemetry
const telemetry = await sdk.getDeviceTelemetry('device-123', {
  startTime: new Date(Date.now() - 3600000),
  endTime: new Date(),
  metrics: ['cpu', 'memory', 'temperature'],
  interval: '5m'
});

// Get fleet KPIs
const kpis = await sdk.getFleetKpis({
  startTime: new Date(Date.now() - 86400000),
  endTime: new Date(),
  deviceType: 'router'
});
// Returns: totalDevices, onlineDevices, offlineDevices, degradedDevices, averageUptime, alertCounts

// Get connectivity status
const conn = await sdk.getDeviceConnectivity('device-123');
// Returns: isConnected, connectionType, signalStrength, bandwidth, latency
```

## Configuration

```typescript
// Get device configuration
const config = await sdk.getDeviceConfiguration('device-123');
// Returns: deviceId, configuration, version, lastUpdated, appliedAt
```

## Error Handling

```typescript
import { isFriendlyApiError } from '@friendly-tech/iot/sdk-generator';

try {
  const device = await sdk.getDeviceById('non-existent');
} catch (error) {
  if (isFriendlyApiError(error)) {
    console.error(`[${error.statusCode}] ${error.message}`);
    console.error(`API: ${error.apiSource}`);

    if (error.isRetryable()) {
      // Retry logic
    }
    if (error.isClientError()) {
      // 4xx error
    }
    if (error.isServerError()) {
      // 5xx error
    }
  }
}
```

## All 13 Functions at a Glance

| Category | Function | API | Description |
|----------|----------|-----|-------------|
| Device Mgmt | `getDeviceList(params?)` | northbound | List devices with pagination/filtering |
| Device Mgmt | `getDeviceById(deviceId)` | northbound | Get device details |
| Device Mgmt | `updateDevice(deviceId, update)` | northbound | Update device properties |
| Alert Mgmt | `getAlerts(params?)` | northbound | List alerts with filtering |
| Alert Mgmt | `acknowledgeAlert(alertId)` | northbound | Acknowledge an alert |
| Alert Mgmt | `resolveAlert(alertId, resolution)` | northbound | Resolve an alert |
| Event Mgmt | `subscribeToEvents(subscription)` | events | Create event subscription |
| Event Mgmt | `unsubscribeFromEvents(subscriptionId)` | events | Cancel event subscription |
| Event Mgmt | `getEventHistory(params)` | events | Get historical events |
| Telemetry | `getDeviceTelemetry(deviceId, params)` | qoe | Get device metrics |
| Telemetry | `getFleetKpis(params?)` | qoe | Get fleet-wide statistics |
| Telemetry | `getDeviceConnectivity(deviceId)` | qoe | Get connectivity status |
| Config | `getDeviceConfiguration(deviceId)` | northbound | Get device configuration |

## Type Exports

```typescript
import type {
  // Requests
  DeviceListParams, DeviceUpdate, AlertListParams,
  EventSubscription, EventHistoryParams, TelemetryParams, FleetKpiParams,

  // Responses
  Device, DeviceListResponse, Alert, AlertListResponse,
  SubscriptionResponse, Event, EventListResponse,
  TelemetryData, TelemetryDataPoint, FleetKPIs,
  ConnectivityStatus, DeviceConfig,

  // Config
  FallbackSdkConfig
} from '@friendly-tech/iot/sdk-generator';
```

## Utility Methods

```typescript
sdk.getTenantId();       // Get tenant ID
sdk.getBaseProxyUrl();   // Get proxy URL
sdk.getTimeout();        // Get timeout in ms
```

## Common Patterns

### Pagination
```typescript
let offset = 0;
const limit = 100;
let hasMore = true;

while (hasMore) {
  const response = await sdk.getDeviceList({ limit, offset });
  // Process response.devices
  offset += limit;
  hasMore = response.devices.length === limit;
}
```

### Filtering Active Critical Alerts
```typescript
const critical = await sdk.getAlerts({
  severity: 'critical',
  status: 'active'
});
```

### Recent Events
```typescript
const recent = await sdk.getEventHistory({
  startTime: new Date(Date.now() - 86400000), // Last 24h
  endTime: new Date(),
  limit: 50
});
```

### Monitoring Device Health
```typescript
const device = await sdk.getDeviceById('device-123');
const connectivity = await sdk.getDeviceConnectivity('device-123');
const telemetry = await sdk.getDeviceTelemetry('device-123', {
  startTime: new Date(Date.now() - 3600000),
  endTime: new Date(),
  interval: '5m'
});

const health = {
  status: device.status,
  connected: connectivity.isConnected,
  signalStrength: connectivity.signalStrength,
  latency: connectivity.latency,
  recentMetrics: telemetry.dataPoints
};
```

## Documentation

- **Full API Reference**: `FALLBACK_SDK.md`
- **Examples**: `EXAMPLE_USAGE.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
