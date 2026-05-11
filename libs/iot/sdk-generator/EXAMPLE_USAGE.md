# Fallback SDK - Example Usage

## Complete Working Example

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';

async function main() {
  // ============================================================================
  // 1. Initialize Authentication Adapter
  // ============================================================================

  const authAdapter = new FriendlyAuthAdapter({
    tenantId: 'acme-corp',
    apis: {
      northbound: {
        id: 'northbound',
        baseUrl: 'https://northbound.friendly.example.com',
        authMethods: ['jwt', 'basic'],
        primaryAuth: 'jwt',
        credentials: {
          username: 'admin@acme.com',
          password: 'encrypted:...',
        },
      },
      events: {
        id: 'events',
        baseUrl: 'https://events.friendly.example.com',
        authMethods: ['jwt', 'basic'],
        primaryAuth: 'jwt',
        credentials: {
          username: 'admin@acme.com',
          password: 'encrypted:...',
        },
      },
      qoe: {
        id: 'qoe',
        baseUrl: 'https://qoe.friendly.example.com',
        authMethods: ['apikey', 'basic'],
        primaryAuth: 'apikey',
        credentials: {
          apiKey: 'encrypted:...',
        },
      },
    },
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
    },
    encryptionKey: process.env.ENCRYPTION_KEY,
  });

  await authAdapter.initialize();
  console.log('Auth adapter initialized');

  // ============================================================================
  // 2. Create SDK Instance
  // ============================================================================

  const sdk = new FallbackSdk({
    authAdapter,
    baseProxyUrl: 'https://api.acme.com/proxy',
    timeout: 30000,
  });

  console.log(`SDK initialized for tenant: ${sdk.getTenantId()}`);

  // ============================================================================
  // 3. Device Management Examples
  // ============================================================================

  console.log('\n=== Device Management ===');

  // Get device list with pagination
  const deviceList = await sdk.getDeviceList({
    limit: 10,
    offset: 0,
    filter: { status: 'online' },
  });

  console.log(`Total devices: ${deviceList.total}`);
  deviceList.devices.forEach((device) => {
    console.log(`  - ${device.name} [${device.deviceId}]: ${device.status}`);
  });

  // Get specific device
  if (deviceList.devices.length > 0) {
    const deviceId = deviceList.devices[0].deviceId;
    const device = await sdk.getDeviceById(deviceId);
    console.log(`\nDevice details for ${device.name}:`);
    console.log(`  Type: ${device.type}`);
    console.log(`  Firmware: ${device.firmwareVersion || 'N/A'}`);
    console.log(`  Last seen: ${device.lastSeen || 'N/A'}`);

    // Update device
    const updated = await sdk.updateDevice(deviceId, {
      metadata: {
        lastChecked: new Date().toISOString(),
        checkedBy: 'example-script',
      },
    });
    console.log(`Device updated: ${updated.name}`);
  }

  // ============================================================================
  // 4. Alert Management Examples
  // ============================================================================

  console.log('\n=== Alert Management ===');

  // Get critical alerts
  const alerts = await sdk.getAlerts({
    severity: 'critical',
    status: 'active',
    limit: 5,
  });

  console.log(`Critical alerts: ${alerts.total}`);
  alerts.alerts.forEach((alert) => {
    console.log(`  [${alert.severity}] ${alert.title}`);
    console.log(`    Device: ${alert.deviceId}`);
    console.log(`    ${alert.description}`);
  });

  // Acknowledge first alert if exists
  if (alerts.alerts.length > 0) {
    const alertId = alerts.alerts[0].alertId;
    const acknowledged = await sdk.acknowledgeAlert(alertId);
    console.log(`\nAcknowledged alert ${alertId} at ${acknowledged.acknowledgedAt}`);

    // Resolve the alert
    const resolved = await sdk.resolveAlert(
      alertId,
      'Issue investigated and resolved. Device was offline due to network maintenance.'
    );
    console.log(`Resolved alert ${alertId} at ${resolved.resolvedAt}`);
    console.log(`Resolution: ${resolved.resolution}`);
  }

  // ============================================================================
  // 5. Event Management Examples
  // ============================================================================

  console.log('\n=== Event Management ===');

  // Subscribe to events
  const subscription = await sdk.subscribeToEvents({
    eventTypes: [
      'device.status.changed',
      'device.offline',
      'alert.created',
      'alert.critical',
    ],
    filters: {
      severity: 'critical',
    },
    webhookUrl: 'https://api.acme.com/webhooks/events',
  });

  console.log(`Created subscription: ${subscription.subscriptionId}`);
  console.log(`  Event types: ${subscription.eventTypes.join(', ')}`);
  console.log(`  Webhook: ${subscription.webhookUrl}`);

  // Get event history
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eventHistory = await sdk.getEventHistory({
    startTime: oneWeekAgo,
    endTime: new Date(),
    eventTypes: ['device.status.changed'],
    limit: 20,
  });

  console.log(`\nEvent history (last 7 days): ${eventHistory.total} events`);
  eventHistory.events.slice(0, 5).forEach((event) => {
    console.log(`  [${event.timestamp}] ${event.eventType}`);
    console.log(`    Device: ${event.deviceId || 'N/A'}`);
  });

  // Unsubscribe (cleanup)
  await sdk.unsubscribeFromEvents(subscription.subscriptionId);
  console.log(`Unsubscribed from ${subscription.subscriptionId}`);

  // ============================================================================
  // 6. Telemetry/QoE Examples
  // ============================================================================

  console.log('\n=== Telemetry & QoE ===');

  // Get fleet KPIs
  const fleetKpis = await sdk.getFleetKpis({
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    endTime: new Date(),
  });

  console.log('Fleet KPIs (last 24 hours):');
  console.log(`  Total devices: ${fleetKpis.totalDevices}`);
  console.log(`  Online: ${fleetKpis.onlineDevices}`);
  console.log(`  Offline: ${fleetKpis.offlineDevices}`);
  console.log(`  Degraded: ${fleetKpis.degradedDevices}`);
  console.log(`  Average uptime: ${fleetKpis.averageUptime.toFixed(2)}%`);
  console.log('  Alerts:');
  console.log(`    Critical: ${fleetKpis.alertCounts.critical}`);
  console.log(`    High: ${fleetKpis.alertCounts.high}`);
  console.log(`    Medium: ${fleetKpis.alertCounts.medium}`);
  console.log(`    Low: ${fleetKpis.alertCounts.low}`);

  // Get device telemetry
  if (deviceList.devices.length > 0) {
    const deviceId = deviceList.devices[0].deviceId;
    const telemetry = await sdk.getDeviceTelemetry(deviceId, {
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      endTime: new Date(),
      metrics: ['cpu', 'memory', 'temperature', 'bandwidth'],
      interval: '5m',
    });

    console.log(`\nTelemetry for ${deviceId}:`);
    console.log(`  Data points: ${telemetry.dataPoints.length}`);

    // Group by metric
    const byMetric = telemetry.dataPoints.reduce((acc, point) => {
      if (!acc[point.metric]) acc[point.metric] = [];
      acc[point.metric].push(point);
      return acc;
    }, {} as Record<string, typeof telemetry.dataPoints>);

    Object.entries(byMetric).forEach(([metric, points]) => {
      const latest = points[points.length - 1];
      const avg = points.reduce((sum, p) => sum + p.value, 0) / points.length;
      console.log(
        `  ${metric}: ${latest.value}${latest.unit || ''} (avg: ${avg.toFixed(2)}${latest.unit || ''})`
      );
    });

    // Get connectivity status
    const connectivity = await sdk.getDeviceConnectivity(deviceId);
    console.log(`\nConnectivity for ${deviceId}:`);
    console.log(`  Connected: ${connectivity.isConnected}`);
    console.log(`  Type: ${connectivity.connectionType || 'N/A'}`);
    console.log(`  Signal strength: ${connectivity.signalStrength || 'N/A'}%`);
    if (connectivity.bandwidth) {
      console.log(`  Bandwidth: ${connectivity.bandwidth.download}/${connectivity.bandwidth.upload} Mbps`);
    }
    console.log(`  Latency: ${connectivity.latency || 'N/A'}ms`);
  }

  // ============================================================================
  // 7. Configuration Examples
  // ============================================================================

  console.log('\n=== Device Configuration ===');

  if (deviceList.devices.length > 0) {
    const deviceId = deviceList.devices[0].deviceId;
    const config = await sdk.getDeviceConfiguration(deviceId);

    console.log(`Configuration for ${deviceId}:`);
    console.log(`  Version: ${config.version}`);
    console.log(`  Last updated: ${config.lastUpdated}`);
    console.log(`  Applied at: ${config.appliedAt || 'Not yet applied'}`);
    console.log(`  Settings:`, JSON.stringify(config.configuration, null, 2));
  }

  // ============================================================================
  // 8. Error Handling Example
  // ============================================================================

  console.log('\n=== Error Handling ===');

  try {
    await sdk.getDeviceById('non-existent-device-id');
  } catch (error) {
    if (error instanceof Error) {
      console.log(`Caught expected error: ${error.message}`);
    }
  }

  // Cleanup
  await authAdapter.close();
  console.log('\n=== Complete ===');
}

// Run the example
main().catch(console.error);
```

## Compact Example

For a minimal working example:

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';

// Setup
const authAdapter = new FriendlyAuthAdapter({ /* config */ });
await authAdapter.initialize();

const sdk = new FallbackSdk({
  authAdapter,
  baseProxyUrl: 'https://api.example.com/proxy',
});

// Use any of the 13 functions
const devices = await sdk.getDeviceList({ limit: 10 });
const alerts = await sdk.getAlerts({ severity: 'critical' });
const kpis = await sdk.getFleetKpis();

console.log(`Found ${devices.total} devices and ${alerts.total} critical alerts`);
```

## Error Handling Pattern

```typescript
import { FriendlyApiError, isFriendlyApiError } from '@friendly-tech/iot/sdk-generator';

async function safeApiCall() {
  try {
    return await sdk.getDeviceById('device-123');
  } catch (error) {
    if (isFriendlyApiError(error)) {
      console.error(`API Error [${error.statusCode}]: ${error.message}`);
      console.error(`Source: ${error.apiSource}`);

      if (error.isRetryable()) {
        console.log('Retrying after delay...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await sdk.getDeviceById('device-123');
      }

      if (error.statusCode === 404) {
        console.log('Device not found, returning null');
        return null;
      }
    }

    throw error; // Re-throw unexpected errors
  }
}
```

## Integration with Agent Runtime

```typescript
import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';

class IoTToolProvider {
  private sdk: FallbackSdk;

  constructor(authAdapter: FriendlyAuthAdapter, baseProxyUrl: string) {
    this.sdk = new FallbackSdk({ authAdapter, baseProxyUrl });
  }

  // Expose all 13 functions as tool functions
  getTools() {
    return {
      // Device Management
      getDeviceList: this.sdk.getDeviceList.bind(this.sdk),
      getDeviceById: this.sdk.getDeviceById.bind(this.sdk),
      updateDevice: this.sdk.updateDevice.bind(this.sdk),

      // Alert Management
      getAlerts: this.sdk.getAlerts.bind(this.sdk),
      acknowledgeAlert: this.sdk.acknowledgeAlert.bind(this.sdk),
      resolveAlert: this.sdk.resolveAlert.bind(this.sdk),

      // Event Management
      subscribeToEvents: this.sdk.subscribeToEvents.bind(this.sdk),
      unsubscribeFromEvents: this.sdk.unsubscribeFromEvents.bind(this.sdk),
      getEventHistory: this.sdk.getEventHistory.bind(this.sdk),

      // Telemetry/QoE
      getDeviceTelemetry: this.sdk.getDeviceTelemetry.bind(this.sdk),
      getFleetKpis: this.sdk.getFleetKpis.bind(this.sdk),
      getDeviceConnectivity: this.sdk.getDeviceConnectivity.bind(this.sdk),

      // Configuration
      getDeviceConfiguration: this.sdk.getDeviceConfiguration.bind(this.sdk),
    };
  }
}
```
