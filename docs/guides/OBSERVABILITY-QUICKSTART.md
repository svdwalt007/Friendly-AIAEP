# Observability Quick Start Guide

Get up and running with comprehensive observability in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and pnpm installed
- Friendly-AIAEP monorepo cloned

## Quick Start

### 1. Start the Observability Stack (2 minutes)

```bash
# Navigate to docker directory
cd docker

# Start all services (includes observability stack)
docker compose -f docker-compose.dev.yml up -d

# Verify services are running
docker compose -f docker-compose.dev.yml ps

# You should see:
# - jaeger (ports 16686, 14268, 4317, 4318)
# - prometheus (port 9090)
# - loki (port 3100)
# - promtail (port 9080)
# - grafana (port 3000)
# - node-exporter, postgres-exporter, redis-exporter
```

### 2. Configure Environment (30 seconds)

```bash
# Copy .env.example to .env
cp .env.example .env

# The observability settings are already configured with defaults:
# ENABLE_JAEGER=true
# ENABLE_PROMETHEUS=true
# JAEGER_ENDPOINT=http://localhost:14268/api/traces
# PROMETHEUS_PORT=9464
# LOKI_URL=http://localhost:46350
```

### 3. Build and Run API Gateway with Observability (2 minutes)

```bash
# Build the observability library
pnpm nx build shared-observability

# Start the API Gateway with observability
pnpm nx serve aep-api-gateway
```

The API Gateway now includes:
- Distributed tracing to Jaeger
- Metrics exposed on port 9464
- Structured logging with trace correlation
- Automatic HTTP instrumentation

### 4. Access Observability Dashboards (30 seconds)

Open these URLs in your browser:

1. **Jaeger (Distributed Tracing)**
   - URL: http://localhost:45002
   - View request traces
   - Analyze latency and bottlenecks

2. **Prometheus (Metrics)**
   - URL: http://localhost:46300
   - Query metrics
   - Create graphs

3. **Grafana (Unified Dashboard)**
   - URL: http://localhost:45001
   - Login: admin / friendly_grafana_dev
   - Pre-configured datasources (Prometheus, Loki, Jaeger)

4. **Application Metrics Endpoint**
   - URL: http://localhost:9464/metrics
   - Raw Prometheus metrics

### 5. Generate Some Traffic (1 minute)

```bash
# Make some API calls to generate traces and metrics
curl http://localhost:46000/api/health
curl http://localhost:46000/api/health
curl http://localhost:46000/api/health

# View traces in Jaeger
# 1. Open http://localhost:45002
# 2. Select "aep-api-gateway" from service dropdown
# 3. Click "Find Traces"
# 4. You should see traces for your requests!
```

## Verify Everything Works

### Check Traces in Jaeger

1. Go to http://localhost:45002
2. Service: Select "aep-api-gateway"
3. Click "Find Traces"
4. You should see traces with timing information

### Check Metrics in Prometheus

1. Go to http://localhost:46300
2. Click "Graph"
3. Enter: `http_requests_total`
4. Click "Execute"
5. You should see metrics from your requests

### Check Logs in Grafana

1. Go to http://localhost:45001
2. Login: admin / friendly_grafana_dev
3. Click "Explore" (compass icon)
4. Select "Loki" from datasource dropdown
5. Query: `{service="aep-api-gateway"}`
6. You should see structured logs with trace IDs

## What's Next?

### Integrate Observability in Your Service

Add to any Fastify service:

```typescript
// main.ts
import { initializeTelemetry, getLogger } from '@friendly-aep/shared-observability';
import telemetryMiddleware from './middleware/telemetry.middleware';

async function bootstrap() {
  // 1. Initialize telemetry FIRST
  await initializeTelemetry({
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
  });

  // 2. Create server with logger
  const logger = getLogger({ name: 'my-service' });
  const server = Fastify({
    logger: logger.getPinoLogger(),
  });

  // 3. Register telemetry middleware
  await server.register(telemetryMiddleware);

  // 4. Start server
  await server.listen({ port: 3000 });
}
```

### Use Structured Logging

```typescript
import { getLogger } from '@friendly-aep/shared-observability';

const logger = getLogger({ name: 'my-service' });

// Logs automatically include trace IDs
logger.info('Processing order', {
  orderId: '12345',
  customerId: '67890',
});

logger.error('Payment failed', error, {
  orderId: '12345',
  amount: 99.99,
});
```

### Collect Custom Metrics

```typescript
import { getMetrics } from '@friendly-aep/shared-observability';

const metrics = getMetrics('my-service');

// Track business events
metrics.recordBusinessEvent('order.placed', {
  plan: 'premium',
  amount: 99.99,
});

// Time operations
const stopTimer = metrics.startTimer('payment.processing');
await processPayment();
stopTimer(); // Automatically records duration
```

### Create Custom Spans

```typescript
import { getTelemetry } from '@friendly-aep/shared-observability';

const telemetry = getTelemetry();

await telemetry.withSpan('process-order', async (span) => {
  span.setAttributes({
    'order.id': orderId,
    'customer.id': customerId,
  });

  // Your business logic here
  await processOrder(orderId);
});
```

## Common Use Cases

### Debug a Slow Request

1. Open Jaeger: http://localhost:45002
2. Find the slow trace
3. Examine each span's duration
4. Identify the bottleneck

### Monitor Error Rate

1. Open Prometheus: http://localhost:46300
2. Query: `rate(http_errors_total[5m])`
3. See errors per second over 5 minutes

### Search Logs by Trace ID

1. Copy trace ID from Jaeger
2. Open Grafana Explore
3. Query Loki: `{trace_id="abc123..."}`
4. See all logs for that request

### View Service Health

1. Open Grafana: http://localhost:45001
2. Create dashboard with panels:
   - Request rate: `rate(http_requests_total[1m])`
   - Error rate: `rate(http_errors_total[1m])`
   - Response time: `http_request_duration_bucket`
   - Memory usage: `system_memory_usage`

## Troubleshooting

### No traces in Jaeger

```bash
# Check Jaeger is running
docker ps | grep jaeger

# Check API Gateway logs
pnpm nx serve aep-api-gateway

# Look for: "✅ OpenTelemetry initialized successfully"

# Verify Jaeger endpoint
curl http://localhost:14268/api/traces
```

### No metrics in Prometheus

```bash
# Check metrics endpoint
curl http://localhost:9464/metrics

# Should see metrics like:
# http_requests_total{method="GET"...}
# http_request_duration_bucket{...}

# Check Prometheus targets
# Open http://localhost:46300/targets
# All targets should be UP
```

### Logs missing trace IDs

```bash
# Ensure telemetry is initialized BEFORE logger
# In main.ts, order matters:

# ✅ Correct order:
await initializeTelemetry(...);
const logger = getLogger(...);

# ❌ Wrong order:
const logger = getLogger(...);  // No telemetry yet!
await initializeTelemetry(...);
```

## Stop Services

```bash
# Stop all services
cd docker
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (fresh start)
docker compose -f docker-compose.dev.yml down -v
```

## Resources

- **Full Implementation Guide**: [OBSERVABILITY-IMPLEMENTATION.md](./OBSERVABILITY-IMPLEMENTATION.md)
- **Library Documentation**: [libs/shared/observability/README.md](./libs/shared/observability/README.md)
- **Example Code**: [apps/aep-api-gateway/src/main-with-telemetry.ts](./apps/aep-api-gateway/src/main-with-telemetry.ts)

## Next Steps

1. **Create Grafana Dashboards**
   - Service health dashboard
   - Business metrics dashboard
   - Error tracking dashboard

2. **Set Up Alerts**
   - High error rate
   - Slow response times
   - Service downtime

3. **Implement in Other Services**
   - aep-builder
   - aep-preview-host
   - Custom services

4. **Production Deployment**
   - Configure persistent storage
   - Set up log retention
   - Enable authentication
   - Configure alerting

---

**Congratulations!** You now have enterprise-grade observability running in your development environment. 🎉

For questions or issues, refer to the full documentation or check the example implementations.
