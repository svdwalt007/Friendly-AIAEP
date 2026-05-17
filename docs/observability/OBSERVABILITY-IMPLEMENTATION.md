# Observability Implementation Guide

This document describes the comprehensive observability implementation for the Friendly-AIAEP monorepo using OpenTelemetry, Prometheus, Jaeger, and Loki.

## Overview

A production-ready observability stack has been implemented with:

- **OpenTelemetry** - Industry-standard instrumentation and telemetry collection
- **Distributed Tracing** - Track requests across microservices with Jaeger
- **Metrics Collection** - Performance monitoring with Prometheus
- **Log Aggregation** - Centralized logging with Loki and Promtail
- **Visualization** - Unified dashboards with Grafana

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Application Services                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ API Gateway  │  │   Builder    │  │Preview Host  │        │
│  │  :46000       │  │   :45000      │  │  :46001       │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                  │                 │
│         └─────────────────┼──────────────────┘                 │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            │ OpenTelemetry SDK
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐   ┌────────▼───────┐   ┌──────▼────────┐
│   Jaeger     │   │  Prometheus    │   │     Loki      │
│  Tracing     │   │   Metrics      │   │     Logs      │
│  :45002      │   │   :46300        │   │   :46350       │
└──────────────┘   └────────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │    Grafana     │
                    │  Dashboards    │
                    │    :45001       │
                    └────────────────┘
```

## Components

### 1. Observability Library (`libs/shared/observability`)

A comprehensive TypeScript library providing:

#### TelemetryService
- OpenTelemetry SDK initialization and management
- Support for Jaeger (traces), Prometheus (metrics), and OTLP exporters
- Auto-instrumentation for HTTP, Fastify, and other frameworks
- Trace context management and span creation
- Graceful shutdown handling

**Key Files:**
- `libs/shared/observability/src/lib/telemetry.service.ts`

**Features:**
```typescript
// Initialize telemetry
await initializeTelemetry({
  serviceName: 'aep-api-gateway',
  serviceVersion: '1.0.0',
  enableJaeger: true,
  enablePrometheus: true,
});

// Create spans
await telemetry.withSpan('operation-name', async (span) => {
  span.setAttributes({ 'key': 'value' });
  // ... operation code
});

// Get trace context
const { traceId, spanId } = telemetry.getTraceContext();
```

#### LoggerService
- Enhanced Pino logger with structured logging
- Automatic trace correlation (logs include trace IDs)
- Environment-specific configuration
- Security-focused (automatic redaction of sensitive data)
- Specialized logging methods (HTTP, database, security events)

**Key Files:**
- `libs/shared/observability/src/lib/logger.service.ts`

**Features:**
```typescript
const logger = getLogger({ name: 'my-service' });

// Logs automatically include trace IDs
logger.info('Processing request', { userId: 123 });

// Specialized logging
logger.logRequest({ method: 'GET', url: '/api/users' });
logger.logResponse({ method: 'GET', url: '/api/users' }, { statusCode: 200 }, 125);
logger.logSecurity('unauthorized-access', 'high', { ip: '192.168.1.1' });
```

#### MetricsService
- Custom metrics collection (counters, gauges, histograms)
- Pre-built metrics for HTTP, database, cache operations
- Business metrics tracking
- Performance timing utilities
- System resource monitoring

**Key Files:**
- `libs/shared/observability/src/lib/metrics.service.ts`

**Features:**
```typescript
const metrics = getMetrics('my-service');

// HTTP metrics
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
await performOperation();
stopTimer();
```

### 2. Telemetry Middleware (`apps/aep-api-gateway/src/app/middleware/telemetry.middleware.ts`)

Fastify middleware providing:
- Automatic request/response tracing
- HTTP metrics collection
- Request/response logging with trace correlation
- Error tracking and recording
- Performance monitoring

**Features:**
- Automatic span creation for all requests
- HTTP status code based span status
- Request deduplication support
- Configurable route ignoring
- Request/response decorators

### 3. Updated API Gateway Main (`apps/aep-api-gateway/src/main-with-telemetry.ts`)

Enhanced server bootstrap with:
- OpenTelemetry initialization before any imports
- Integrated telemetry middleware
- Graceful shutdown with telemetry cleanup
- Environment-based configuration
- Comprehensive error handling

### 4. Observability Stack (Docker Compose)

Production-ready containerized services:

#### Jaeger (Distributed Tracing)
- **Port**: 16686 (UI), 14268 (collector), 4317/4318 (OTLP)
- **Purpose**: Visualize distributed traces, analyze latency
- **Configuration**: `docker/observability/jaeger-config.yml`

#### Prometheus (Metrics Collection)
- **Port**: 9090
- **Purpose**: Time-series metrics storage and querying
- **Configuration**: `docker/observability/prometheus.yml`
- **Scrape Targets**:
  - API Gateway (:9464)
  - Builder (:9465)
  - Preview Host (:9466)
  - PostgreSQL Exporter (:9187)
  - Redis Exporter (:9121)
  - Node Exporter (:9100)
  - Jaeger (:14269)

#### Loki (Log Aggregation)
- **Port**: 3100
- **Purpose**: Centralized log storage and querying
- **Configuration**: `docker/observability/loki-config.yml`
- **Features**: 31-day retention, automatic cleanup

#### Promtail (Log Shipping)
- **Port**: 9080
- **Purpose**: Ship logs to Loki
- **Configuration**: `docker/observability/promtail-config.yml`
- **Sources**: Docker containers, system logs, application logs

#### Exporters
- **PostgreSQL Exporter** (:9187) - Database metrics
- **Redis Exporter** (:9121) - Cache metrics
- **Node Exporter** (:9100) - System metrics

### 5. Grafana Integration

Already configured in the development stack:
- **Port**: 3000
- **Pre-configured datasources**:
  - Prometheus (metrics)
  - Loki (logs)
  - Jaeger (traces)
- **Unified observability dashboard**

## Setup Instructions

### 1. Environment Configuration

Add to your `.env` file (template in `.env.example`):

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

# Loki configuration (log aggregation)
LOKI_URL=http://localhost:46350

# Log level
LOG_LEVEL=info
```

### 2. Build Observability Library

```bash
# Build the observability library
pnpm nx build shared-observability
```

### 3. Start Observability Stack

```bash
# Start all services including observability
cd docker
docker compose -f docker-compose.dev.yml up -d

# Verify services are running
docker compose -f docker-compose.dev.yml ps

# View logs
docker compose -f docker-compose.dev.yml logs -f jaeger
docker compose -f docker-compose.dev.yml logs -f prometheus
docker compose -f docker-compose.dev.yml logs -f loki
```

### 4. Update Your Application

To use the enhanced observability in your service:

#### For New Services

```typescript
// main.ts
import { initializeTelemetry, getLogger } from '@friendly-aep/shared-observability';
import telemetryMiddleware from './middleware/telemetry.middleware';

async function bootstrap() {
  // 1. Initialize telemetry FIRST
  await initializeTelemetry({
    serviceName: 'my-service',
    serviceVersion: process.env.SERVICE_VERSION,
  });

  // 2. Create server with observability
  const server = Fastify({
    logger: getLogger({ name: 'my-service' }).getPinoLogger(),
  });

  // 3. Register telemetry middleware
  await server.register(telemetryMiddleware);

  // 4. Rest of setup...
}
```

#### For Existing Services (API Gateway)

The API Gateway has two main.ts files:
- `src/main.ts` - Original implementation
- `src/main-with-telemetry.ts` - Enhanced with observability

**To switch to observability version:**

```json
// In apps/aep-api-gateway/project.json
{
  "targets": {
    "serve": {
      "executor": "@nx/node:node",
      "options": {
        "buildTarget": "aep-api-gateway:build",
        "runBuildTargetDependencies": false
      },
      "configurations": {
        "development": {
          "buildTarget": "aep-api-gateway:build:development"
        },
        "production": {
          "buildTarget": "aep-api-gateway:build:production"
        }
      }
    },
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "options": {
        // Change this line:
        "main": "apps/aep-api-gateway/src/main-with-telemetry.ts"
      }
    }
  }
}
```

### 5. Access Observability UIs

Once everything is running:

- **Jaeger UI**: http://localhost:45002
  - View distributed traces
  - Analyze request latency
  - Identify bottlenecks

- **Prometheus UI**: http://localhost:46300
  - Query metrics
  - Create graphs
  - Set up alerts

- **Grafana**: http://localhost:45001
  - Login: admin / friendly_grafana_dev
  - Unified dashboards
  - Correlate metrics, logs, and traces

- **Loki Logs**: Access via Grafana > Explore > Loki

- **Application Metrics**: http://localhost:9464/metrics

## Usage Examples

### Example 1: Tracing a User Registration Flow

```typescript
import { getTelemetry, getLogger } from '@friendly-aep/shared-observability';

const telemetry = getTelemetry();
const logger = getLogger({ name: 'user-service' });

async function registerUser(userData) {
  return await telemetry.withSpan('user.register', async (span) => {
    span.setAttributes({
      'user.email': userData.email,
      'user.plan': userData.plan,
    });

    logger.info('Starting user registration', { email: userData.email });

    try {
      // Create user in database (auto-instrumented)
      const user = await db.user.create({ data: userData });

      // Send welcome email (traced sub-operation)
      await telemetry.withSpan('email.send', async (emailSpan) => {
        emailSpan.setAttributes({ 'email.type': 'welcome' });
        await sendWelcomeEmail(user.email);
      });

      logger.info('User registered successfully', { userId: user.id });
      return user;
    } catch (error) {
      logger.error('User registration failed', error);
      telemetry.recordException(error);
      throw error;
    }
  });
}
```

### Example 2: Collecting Business Metrics

```typescript
import { getMetrics } from '@friendly-aep/shared-observability';

const metrics = getMetrics('billing-service');

async function processPayment(amount, plan) {
  // Record business event
  metrics.recordBusinessEvent('payment.processed', {
    plan,
    amount,
  });

  // Track payment duration
  const stopTimer = metrics.startTimer('payment.processing.duration');

  try {
    const result = await stripeClient.charge({ amount });

    // Track successful payment
    metrics.incrementCounter('payment.success.total', 1, { plan });

    return result;
  } catch (error) {
    // Track failed payment
    metrics.incrementCounter('payment.failed.total', 1, {
      plan,
      error_type: error.type
    });
    throw error;
  } finally {
    stopTimer();
  }
}
```

### Example 3: Correlating Logs with Traces

```typescript
import { getLogger, getTelemetry } from '@friendly-aep/shared-observability';

const logger = getLogger({ name: 'order-service' });
const telemetry = getTelemetry();

async function processOrder(orderId) {
  // All logs within this span will include the trace ID
  return await telemetry.withSpan('order.process', async (span) => {
    span.setAttributes({ 'order.id': orderId });

    // This log will include trace_id and span_id
    logger.info('Processing order', { orderId });

    const order = await fetchOrder(orderId);

    // This log also includes trace context
    logger.info('Order fetched', {
      orderId,
      total: order.total,
      items: order.items.length
    });

    await validateOrder(order);
    await chargePayment(order);

    logger.info('Order completed', { orderId });

    return order;
  });
}

// In Grafana, you can:
// 1. View logs in Loki and see trace_id
// 2. Click trace_id to jump to Jaeger
// 3. See the full distributed trace
```

## Monitoring Best Practices

### 1. Golden Signals

Track these key metrics for each service:

```typescript
// Latency
metrics.recordHttpDuration(method, route, duration, statusCode);

// Traffic
metrics.recordHttpRequest(method, route, statusCode);

// Errors
metrics.recordHttpError(method, route, statusCode, errorType);

// Saturation (via system gauges)
metrics.createSystemGauges();
```

### 2. Logging Levels

- **ERROR**: Errors requiring immediate attention
- **WARN**: Potential issues or degraded performance
- **INFO**: Important business events
- **DEBUG**: Detailed troubleshooting information

### 3. Trace Sampling

- **Development**: 100% sampling (`TRACE_SAMPLE_RATE=1.0`)
- **Staging**: 50% sampling (`TRACE_SAMPLE_RATE=0.5`)
- **Production**: 10-20% sampling (`TRACE_SAMPLE_RATE=0.1`)

### 4. Metric Labels

Keep cardinality low:
```typescript
// ✅ GOOD: Low cardinality
metrics.incrementCounter('http.requests', 1, {
  method: 'GET',        // ~10 values
  status_code: 200,     // ~50 values
  route: '/api/users'   // ~100 values
});

// ❌ BAD: High cardinality
metrics.incrementCounter('http.requests', 1, {
  user_id: '12345',     // Millions of values!
  request_id: 'abc123'  // Unique every time!
});
```

## Troubleshooting

### Issue: Traces Not Appearing in Jaeger

**Solution:**
1. Verify Jaeger is running: `docker ps | grep jaeger`
2. Check Jaeger UI: http://localhost:45002
3. Verify environment variable: `ENABLE_JAEGER=true`
4. Check application logs for OpenTelemetry initialization
5. Verify sampling rate: `TRACE_SAMPLE_RATE=1.0`

### Issue: Metrics Not Available

**Solution:**
1. Check metrics endpoint: http://localhost:9464/metrics
2. Verify Prometheus is running: `docker ps | grep prometheus`
3. Check Prometheus targets: http://localhost:46300/targets
4. Verify `ENABLE_PROMETHEUS=true`

### Issue: Logs Missing Trace IDs

**Solution:**
1. Ensure telemetry is initialized before logger
2. Verify `enableTraceCorrelation: true` in logger config
3. Check that code is running within a traced span

### Issue: High Memory Usage

**Solution:**
1. Reduce trace sampling rate
2. Decrease log retention in Loki
3. Limit Prometheus metrics retention
4. Check for metric label cardinality issues

## Performance Impact

The observability stack has minimal performance impact:

- **Tracing**: ~1-5ms per request (with auto-instrumentation)
- **Logging**: ~0.5-2ms per log statement
- **Metrics**: ~0.1-0.5ms per metric recording
- **Memory**: ~50-100MB per service (SDK overhead)

## Next Steps

1. **Create Custom Dashboards** in Grafana
   - Service health dashboard
   - Business metrics dashboard
   - Error tracking dashboard

2. **Set Up Alerts** in Prometheus/Grafana
   - High error rate
   - Slow response times
   - Service downtime

3. **Implement SLIs/SLOs**
   - Define Service Level Indicators
   - Set Service Level Objectives
   - Create SLO dashboards

4. **Add More Instrumentation**
   - Database query tracing
   - External API call tracing
   - Background job monitoring

5. **Production Deployment**
   - Update docker-compose.prod.yml
   - Configure persistent storage
   - Set up alert notifications
   - Implement log retention policies

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Library README](./libs/shared/observability/README.md)

## Support

For questions or issues with the observability implementation, please refer to:
- This documentation
- Library README at `libs/shared/observability/README.md`
- Example implementations in `apps/aep-api-gateway/src/main-with-telemetry.ts`
