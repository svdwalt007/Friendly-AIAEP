# Shared Observability Library

Comprehensive observability solution for the Friendly-AIAEP monorepo with OpenTelemetry integration.

## Features

- **Distributed Tracing** - Track requests across microservices with Jaeger
- **Metrics Collection** - Gather and analyze performance metrics with Prometheus
- **Structured Logging** - Enhanced logging with Pino and trace correlation
- **Auto-instrumentation** - Automatic instrumentation for HTTP, Fastify, and Prisma
- **Log Aggregation** - Centralized log management with Loki

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  API Gateway │  │   Builder    │  │ Preview Host │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          └────────┬────────┴────────┬─────────┘
                   │                 │
          ┌────────▼─────────────────▼────────┐
          │   Observability Library (This)    │
          │                                    │
          │  ┌──────────────────────────────┐ │
          │  │  TelemetryService            │ │
          │  │  - OpenTelemetry SDK         │ │
          │  │  - Trace management          │ │
          │  └──────────────────────────────┘ │
          │                                    │
          │  ┌──────────────────────────────┐ │
          │  │  LoggerService               │ │
          │  │  - Pino logger               │ │
          │  │  - Trace correlation         │ │
          │  └──────────────────────────────┘ │
          │                                    │
          │  ┌──────────────────────────────┐ │
          │  │  MetricsService              │ │
          │  │  - Custom metrics            │ │
          │  │  - Business metrics          │ │
          │  └──────────────────────────────┘ │
          └────────┬────────────────┬─────────┘
                   │                │
          ┌────────▼────────┐  ┌───▼──────────┐
          │     Jaeger      │  │  Prometheus  │
          │   (Tracing)     │  │  (Metrics)   │
          └─────────────────┘  └──────────────┘
                   │
          ┌────────▼────────┐
          │      Loki       │
          │     (Logs)      │
          └─────────────────┘
```

## Installation

The library is already installed as part of the monorepo. Import it using:

```typescript
import {
  initializeTelemetry,
  getTelemetry,
  getLogger,
  getMetrics,
} from '@friendly-aep/shared-observability';
```

## Usage

### 1. Initialize Telemetry (Application Startup)

```typescript
import { initializeTelemetry } from '@friendly-aep/shared-observability';

async function bootstrap() {
  // Initialize OpenTelemetry first, before any other imports
  await initializeTelemetry({
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    enableJaeger: true,
    enablePrometheus: true,
  });

  // ... rest of application setup
}
```

### 2. Structured Logging

```typescript
import { getLogger } from '@friendly-aep/shared-observability';

const logger = getLogger({ name: 'my-service' });

// Basic logging
logger.info('Server started');
logger.warn('Connection slow', { latency: 500 });
logger.error('Database error', error, { query: 'SELECT ...' });

// HTTP request logging
logger.logRequest({
  method: 'GET',
  url: '/api/users',
  query: { page: 1 },
});

logger.logResponse(
  { method: 'GET', url: '/api/users' },
  { statusCode: 200 },
  125 // duration in ms
);

// Performance logging
logger.logPerformance('database-query', 250, { table: 'users' });

// Security event logging
logger.logSecurity('unauthorized-access', 'high', {
  ip: '192.168.1.1',
  path: '/admin',
});
```

### 3. Custom Metrics

```typescript
import { getMetrics } from '@friendly-aep/shared-observability';

const metrics = getMetrics('my-service');

// Counter metrics
metrics.incrementCounter('api.requests.total', 1, {
  method: 'GET',
  endpoint: '/users',
});

// HTTP metrics (automatic tracking)
metrics.recordHttpRequest('GET', '/api/users', 200);
metrics.recordHttpDuration('GET', '/api/users', 125, 200);

// Database metrics
metrics.recordDatabaseQuery('SELECT', 'users');
metrics.recordDatabaseDuration('SELECT', 50, 'users');

// Cache metrics
metrics.recordCacheHit('user:123');
metrics.recordCacheMiss('user:456');

// Business metrics
metrics.recordBusinessEvent('user.signup', { plan: 'premium' });

// Timer utility
const stopTimer = metrics.startTimer('operation.duration');
// ... perform operation
stopTimer(); // Automatically records duration

// Async timing
await metrics.timeAsync('async-operation', async () => {
  await someAsyncOperation();
});
```

### 4. Distributed Tracing

```typescript
import { getTelemetry } from '@friendly-aep/shared-observability';

const telemetry = getTelemetry();

// Manual span creation
await telemetry.withSpan('process-order', async (span) => {
  span.setAttributes({
    'order.id': orderId,
    'customer.id': customerId,
  });

  // Your business logic here
  const result = await processOrder(orderId);

  return result;
});

// Get current span for adding context
const span = telemetry.getCurrentSpan();
if (span) {
  span.setAttributes({
    'user.id': userId,
    'session.id': sessionId,
  });
}

// Record exceptions in current span
try {
  await riskyOperation();
} catch (error) {
  telemetry.recordException(error);
  throw error;
}

// Get trace context for log correlation
const traceContext = telemetry.getTraceContext();
console.log(`Trace ID: ${traceContext.traceId}`);
console.log(`Span ID: ${traceContext.spanId}`);
```

### 5. Fastify Middleware Integration

```typescript
import Fastify from 'fastify';
import telemetryMiddleware from './middleware/telemetry.middleware';

const server = Fastify({ logger: true });

// Register telemetry middleware
await server.register(telemetryMiddleware, {
  enableMetrics: true,
  enableLogging: true,
  enableTracing: true,
  ignoreRoutes: ['/health', '/metrics'],
});

// Access telemetry in route handlers
server.get('/api/users', async (request, reply) => {
  // Logger with trace correlation
  request.logger.info('Fetching users');

  // Metrics
  request.metrics.recordBusinessEvent('users.list');

  // Trace context
  const trace = request.getTraceContext();

  return { users: [], traceId: trace.traceId };
});
```

## Configuration

### Environment Variables

```bash
# Service information
SERVICE_VERSION=1.0.0

# Enable/disable exporters
ENABLE_JAEGER=true
ENABLE_OTLP=false
ENABLE_PROMETHEUS=true

# Jaeger endpoint (distributed tracing)
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# OTLP endpoint (OpenTelemetry Protocol)
OTLP_ENDPOINT=http://localhost:4318

# Prometheus port (metrics)
PROMETHEUS_PORT=9464

# Trace sampling rate (0.0 to 1.0)
TRACE_SAMPLE_RATE=1.0

# Log level
LOG_LEVEL=info
```

### TelemetryConfig Options

```typescript
interface TelemetryConfig {
  serviceName: string; // Required: Name of your service
  serviceVersion?: string; // Optional: Version (default: '1.0.0')
  environment?: string; // Optional: Environment (default: NODE_ENV)
  jaegerEndpoint?: string; // Optional: Jaeger endpoint
  otlpEndpoint?: string; // Optional: OTLP endpoint
  prometheusPort?: number; // Optional: Prometheus port (default: 9464)
  enableConsoleExport?: boolean; // Optional: Console export for dev
  enableJaeger?: boolean; // Optional: Enable Jaeger (default: true in dev)
  enableOTLP?: boolean; // Optional: Enable OTLP (default: false)
  enablePrometheus?: boolean; // Optional: Enable Prometheus (default: true)
  sampleRate?: number; // Optional: Trace sampling rate (default: 1.0)
}
```

## Observability Stack

### Jaeger (Distributed Tracing)

- **URL**: http://localhost:45002
- **Purpose**: Visualize distributed traces across services
- **Use Case**: Debug latency issues, understand request flow

### Prometheus (Metrics)

- **URL**: http://localhost:46300
- **Purpose**: Query and analyze metrics
- **Use Case**: Monitor performance, set up alerts

### Loki (Log Aggregation)

- **URL**: http://localhost:46350
- **Purpose**: Centralized log storage and querying
- **Use Case**: Search logs, correlate with traces

### Grafana (Visualization)

- **URL**: http://localhost:45001
- **Purpose**: Unified observability dashboard
- **Features**:
  - Pre-configured datasources (Prometheus, Loki, Jaeger)
  - Custom dashboards
  - Alerting

## Best Practices

### 1. Logging

```typescript
// ✅ DO: Use structured logging with context
logger.info('User login', {
  user_id: userId,
  ip: ipAddress,
  success: true,
});

// ❌ DON'T: Use string concatenation
logger.info('User ' + userId + ' logged in from ' + ipAddress);
```

### 2. Metrics

```typescript
// ✅ DO: Use consistent naming conventions
metrics.incrementCounter('http.requests.total', 1, {
  method: 'GET',
  endpoint: '/api/users',
  status_code: 200,
});

// ❌ DON'T: Use high-cardinality labels (like user IDs)
metrics.incrementCounter('http.requests', 1, {
  user_id: '12345', // BAD: Too many unique values
});
```

### 3. Tracing

```typescript
// ✅ DO: Add meaningful attributes to spans
await telemetry.withSpan('database-query', async (span) => {
  span.setAttributes({
    'db.operation': 'SELECT',
    'db.table': 'users',
    'db.query_type': 'read',
  });
  // ...
});

// ✅ DO: Record exceptions in spans
try {
  await riskyOperation();
} catch (error) {
  telemetry.recordException(error);
  throw error;
}
```

### 4. Performance

```typescript
// ✅ DO: Use timers for tracking durations
const stopTimer = metrics.startTimer('operation.duration');
try {
  await performOperation();
} finally {
  stopTimer(); // Always stop timer in finally block
}
```

## Docker Compose Setup

The observability stack is included in `docker/docker-compose.dev.yml`:

```bash
# Start the full stack
docker compose -f docker/docker-compose.dev.yml up -d

# View logs
docker compose -f docker/docker-compose.dev.yml logs -f jaeger
docker compose -f docker/docker-compose.dev.yml logs -f prometheus
docker compose -f docker/docker-compose.dev.yml logs -f loki

# Stop the stack
docker compose -f docker/docker-compose.dev.yml down
```

## Troubleshooting

### Telemetry Not Initialized

```typescript
// Error: Telemetry not initialized
const telemetry = getTelemetry(); // Throws error

// Solution: Initialize first
await initializeTelemetry({ serviceName: 'my-service' });
const telemetry = getTelemetry(); // Works now
```

### Traces Not Appearing in Jaeger

1. Check Jaeger is running: http://localhost:45002
2. Verify `ENABLE_JAEGER=true` in environment
3. Check Jaeger endpoint configuration
4. Ensure sampling rate is > 0

### Metrics Not Available

1. Check Prometheus is running: http://localhost:46300
2. Verify `ENABLE_PROMETHEUS=true` in environment
3. Check metrics endpoint: http://localhost:9464/metrics
4. Verify Prometheus scrape configuration

### Logs Not Showing Trace IDs

1. Ensure telemetry is initialized before logger
2. Verify `enableTraceCorrelation: true` in logger config
3. Check that requests are being traced

## Contributing

When adding new observability features:

1. Follow the existing naming conventions
2. Add documentation with examples
3. Include tests for new functionality
4. Update this README with new features

## License

UNLICENSED - Internal use only
