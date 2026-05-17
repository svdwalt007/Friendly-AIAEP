# IoT Integration Guide

**IoT Device Integration with OpenAPI/Swagger**

Complete guide for integrating IoT platforms and devices with Friendly AI AEP.

---

## Table of Contents

1. [Overview](#overview)
2. [Swagger Ingestion](#swagger-ingestion)
3. [IoT Tool Functions](#iot-tool-functions)
4. [Authentication](#authentication)
5. [Device Management](#device-management)
6. [Telemetry Data](#telemetry-data)
7. [Webhooks & Events](#webhooks--events)
8. [Best Practices](#best-practices)

---

## Overview

### Supported IoT Platforms

- Friendly IoT Platform
- Generic REST APIs (OpenAPI 3.0)
- MQTT brokers
- Custom IoT platforms

### Integration Methods

```
┌─────────────────────────────────────┐
│    Friendly AI AEP                  │
│  ┌───────────────────────────────┐  │
│  │   Swagger Ingestion Service   │  │
│  └───────────┬───────────────────┘  │
│              │                       │
│  ┌───────────┴───────────────────┐  │
│  │     IoT Tool Functions        │  │
│  │  • GetDeviceList              │  │
│  │  • GetDeviceDetails           │  │
│  │  • GetDeviceTelemetry         │  │
│  │  • RegisterWebhook            │  │
│  │  • GetKPIMetrics              │  │
│  └───────────┬───────────────────┘  │
└──────────────┼──────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│IoT API │ │ MQTT   │ │Custom  │
│(REST)  │ │Broker  │ │ API    │
└────────┘ └────────┘ └────────┘
```

---

## Swagger Ingestion

### Ingest OpenAPI Specification

**Endpoint:**
```http
POST /api/v1/iot/swagger/ingest
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "source": "https://api.iot-platform.com/openapi.json",
  "name": "Production IoT Platform",
  "authentication": {
    "type": "bearer",
    "credentials": {
      "token": "api-key-here"
    }
  }
}
```

**Response:**
```json
{
  "specId": "spec_abc123",
  "name": "Production IoT Platform",
  "version": "1.0.0",
  "endpoints": 45,
  "models": 23,
  "status": "ingested",
  "capabilities": {
    "devices": true,
    "telemetry": true,
    "commands": true,
    "webhooks": true
  }
}
```

### Supported Authentication Methods

**1. Bearer Token:**
```json
{
  "type": "bearer",
  "credentials": {
    "token": "your-api-key"
  }
}
```

**2. Basic Auth:**
```json
{
  "type": "basic",
  "credentials": {
    "username": "admin",
    "password": "password"
  }
}
```

**3. OAuth 2.0:**
```json
{
  "type": "oauth2",
  "credentials": {
    "clientId": "client-id",
    "clientSecret": "client-secret",
    "tokenUrl": "https://auth.example.com/oauth/token"
  }
}
```

---

## IoT Tool Functions

### GetDeviceListTool

Retrieve list of IoT devices.

**Function Signature:**
```typescript
getDeviceList(args: {
  filter?: string;
  limit?: number;
  offset?: number;
  deviceType?: string;
  status?: 'online' | 'offline' | 'all';
}): Promise<Device[]>
```

**Example Usage:**
```json
{
  "tool": "getDeviceList",
  "args": {
    "filter": "temperature",
    "limit": 100,
    "status": "online"
  }
}
```

**Response:**
```json
{
  "devices": [
    {
      "id": "sensor_001",
      "name": "Warehouse A - Temp Sensor 1",
      "type": "temperature_sensor",
      "status": "online",
      "location": {
        "lat": 40.7128,
        "lon": -74.0060
      },
      "metadata": {
        "manufacturer": "SensorCorp",
        "model": "TC-2000",
        "firmware": "1.2.3"
      },
      "lastSeen": "2026-04-15T14:00:00Z"
    }
  ],
  "total": 10234,
  "page": 1,
  "limit": 100
}
```

### GetDeviceDetailsTool

Get detailed information about a device.

**Function Signature:**
```typescript
getDeviceDetails(args: {
  deviceId: string;
  includeMetadata?: boolean;
  includeTelemetry?: boolean;
}): Promise<DeviceDetails>
```

**Example:**
```json
{
  "tool": "getDeviceDetails",
  "args": {
    "deviceId": "sensor_001",
    "includeMetadata": true,
    "includeTelemetry": true
  }
}
```

**Response:**
```json
{
  "id": "sensor_001",
  "name": "Warehouse A - Temp Sensor 1",
  "type": "temperature_sensor",
  "status": "online",
  "capabilities": ["temperature", "humidity", "battery"],
  "lwm2m": {
    "objects": [
      {
        "objectId": 3303,
        "objectName": "Temperature",
        "instances": [
          {
            "instanceId": 0,
            "resources": {
              "5700": {"value": 23.5, "unit": "Cel"},
              "5701": {"value": "Celsius"}
            }
          }
        ]
      }
    ]
  },
  "telemetry": {
    "temperature": 23.5,
    "humidity": 65.2,
    "battery": 87,
    "timestamp": "2026-04-15T14:00:00Z"
  },
  "metadata": {
    "installDate": "2026-01-01",
    "location": "Warehouse A, Zone 3",
    "serialNumber": "SN-12345"
  }
}
```

### GetDeviceTelemetryTool

Retrieve time-series telemetry data.

**Function Signature:**
```typescript
getDeviceTelemetry(args: {
  deviceId: string;
  metric: string;
  timeRange: string; // e.g., "1h", "24h", "7d"
  aggregation?: 'raw' | 'mean' | 'max' | 'min';
  interval?: string; // e.g., "5m", "1h"
}): Promise<TelemetryData>
```

**Example:**
```json
{
  "tool": "getDeviceTelemetry",
  "args": {
    "deviceId": "sensor_001",
    "metric": "temperature",
    "timeRange": "24h",
    "aggregation": "mean",
    "interval": "1h"
  }
}
```

**Response:**
```json
{
  "deviceId": "sensor_001",
  "metric": "temperature",
  "unit": "Celsius",
  "dataPoints": [
    {
      "timestamp": "2026-04-14T14:00:00Z",
      "value": 23.2
    },
    {
      "timestamp": "2026-04-14T15:00:00Z",
      "value": 23.5
    },
    {
      "timestamp": "2026-04-14T16:00:00Z",
      "value": 24.1
    }
  ],
  "stats": {
    "min": 22.1,
    "max": 25.3,
    "mean": 23.7,
    "count": 24
  }
}
```

### RegisterWebhookTool

Register webhook for device events.

**Function Signature:**
```typescript
registerWebhook(args: {
  deviceId: string;
  event: string;
  url: string;
  secret?: string;
}): Promise<Webhook>
```

**Example:**
```json
{
  "tool": "registerWebhook",
  "args": {
    "deviceId": "sensor_001",
    "event": "threshold_exceeded",
    "url": "https://my-app.com/webhooks/device-alert",
    "secret": "webhook-secret-123"
  }
}
```

**Response:**
```json
{
  "webhookId": "webhook_xyz789",
  "deviceId": "sensor_001",
  "event": "threshold_exceeded",
  "url": "https://my-app.com/webhooks/device-alert",
  "status": "active",
  "createdAt": "2026-04-15T14:00:00Z"
}
```

### GetKPIMetricsTool

Get fleet-wide KPI metrics.

**Function Signature:**
```typescript
getKPIMetrics(args: {
  metric: string;
  period: string; // e.g., "1h", "24h", "7d", "30d"
  deviceType?: string;
  location?: string;
}): Promise<KPIMetrics>
```

**Example:**
```json
{
  "tool": "getKPIMetrics",
  "args": {
    "metric": "uptime",
    "period": "7d",
    "deviceType": "temperature_sensor"
  }
}
```

**Response:**
```json
{
  "metric": "uptime",
  "period": "7d",
  "deviceType": "temperature_sensor",
  "value": 99.87,
  "unit": "percent",
  "breakdown": {
    "totalDevices": 10234,
    "onlineDevices": 10221,
    "offlineDevices": 13
  },
  "trend": {
    "direction": "up",
    "change": 0.12
  }
}
```

---

## Authentication

### Configuring IoT API Credentials

**Environment Variables:**
```env
# Friendly IoT API
FRIENDLY_API_URL_PRIMARY=https://api.friendly.example.com
FRIENDLY_API_KEY_PRIMARY=your-primary-api-key

# Secondary IoT API
FRIENDLY_API_URL_SECONDARY=https://api-staging.friendly.example.com
FRIENDLY_API_KEY_SECONDARY=your-staging-api-key
```

### Runtime Authentication

```typescript
import { AuthAdapter } from '@friendly-tech/iot/auth-adapter';

const authAdapter = new AuthAdapter({
  type: 'bearer',
  credentials: {
    token: process.env.FRIENDLY_API_KEY_PRIMARY
  }
});

const response = await authAdapter.request({
  method: 'GET',
  url: '/devices'
});
```

---

## Device Management

### Device Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Pending │───▶│  Active  │───▶│ Inactive │───▶│ Deleted  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                      │
                      ▼
                ┌──────────┐
                │  Offline │
                └──────────┘
```

### Device Operations

**1. Provision Device:**
```http
POST /api/v1/iot/devices
Content-Type: application/json

{
  "name": "New Temperature Sensor",
  "type": "temperature_sensor",
  "location": {
    "lat": 40.7128,
    "lon": -74.0060
  },
  "metadata": {
    "serialNumber": "SN-67890"
  }
}
```

**2. Update Device:**
```http
PUT /api/v1/iot/devices/sensor_001
Content-Type: application/json

{
  "name": "Updated Sensor Name",
  "location": {
    "lat": 40.7500,
    "lon": -73.9800
  }
}
```

**3. Decommission Device:**
```http
DELETE /api/v1/iot/devices/sensor_001
```

---

## Telemetry Data

### Sending Telemetry

**Using Telegraf:**
```toml
[[inputs.mqtt_consumer]]
  servers = ["tcp://mqtt-broker:1883"]
  topics = ["devices/+/telemetry"]
  data_format = "json"

[[outputs.influxdb_v2]]
  urls = ["http://influxdb:46101"]
  token = "${INFLUXDB_TOKEN}"
  organization = "friendly"
  bucket = "iot_data"
```

**Direct API:**
```http
POST /api/v1/iot/telemetry
Content-Type: application/json

{
  "deviceId": "sensor_001",
  "timestamp": "2026-04-15T14:00:00Z",
  "metrics": {
    "temperature": 23.5,
    "humidity": 65.2,
    "battery": 87
  }
}
```

### Querying Telemetry

**InfluxDB Flux Query:**
```flux
from(bucket: "iot_data")
  |> range(start: -24h)
  |> filter(fn: (r) => r["deviceId"] == "sensor_001")
  |> filter(fn: (r) => r["_field"] == "temperature")
  |> aggregateWindow(every: 1h, fn: mean)
```

---

## Webhooks & Events

### Webhook Payload

```json
{
  "event": "threshold_exceeded",
  "deviceId": "sensor_001",
  "timestamp": "2026-04-15T14:00:00Z",
  "data": {
    "metric": "temperature",
    "value": 35.2,
    "threshold": 30.0
  },
  "signature": "sha256=..."
}
```

### Webhook Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

---

## Best Practices

### 1. Error Handling

```typescript
try {
  const devices = await getDeviceList({ limit: 100 });
} catch (error) {
  if (error.code === 'API_TIMEOUT') {
    // Retry with exponential backoff
  } else if (error.code === 'UNAUTHORIZED') {
    // Refresh credentials
  } else {
    // Log and notify
  }
}
```

### 2. Rate Limiting

```typescript
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute'
});

async function fetchDevices() {
  await limiter.removeTokens(1);
  return await getDeviceList();
}
```

### 3. Caching

```typescript
import { Cache } from '@nestjs/cache-manager';

async function getDevicesCached() {
  const cacheKey = 'devices:list';
  const cached = await this.cache.get(cacheKey);

  if (cached) return cached;

  const devices = await getDeviceList();
  await this.cache.set(cacheKey, devices, 300); // 5 minutes

  return devices;
}
```

### 4. Pagination

```typescript
async function getAllDevices() {
  const allDevices = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await getDeviceList({
      limit: 100,
      offset: (page - 1) * 100
    });

    allDevices.push(...response.devices);
    hasMore = response.total > page * 100;
    page++;
  }

  return allDevices;
}
```

---

## Related Documentation

- [REST API Reference](./REST-API.md)
- [WebSocket API Reference](./WEBSOCKET-API.md)
- [Development Guide](../guides/DEVELOPMENT-GUIDE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology IoT Team
