# Monitoring Guide

**Complete Monitoring Setup with Grafana, Telegraf, InfluxDB, Prometheus, and Jaeger**

This guide provides comprehensive monitoring and observability setup for Friendly AI AEP.

---

## Table of Contents

1. [Monitoring Overview](#monitoring-overview)
2. [Grafana Setup](#grafana-setup)
3. [InfluxDB Configuration](#influxdb-configuration)
4. [Telegraf Setup](#telegraf-setup)
5. [Prometheus Integration](#prometheus-integration)
6. [Jaeger Tracing](#jaeger-tracing)
7. [Custom Dashboards](#custom-dashboards)
8. [Alerting](#alerting)
9. [Log Aggregation](#log-aggregation)
10. [Performance Monitoring](#performance-monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Monitoring Overview

### Monitoring Stack

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ API Gateway  │  │   Builder    │  │ Preview Host │  │
│  │  (Metrics)   │  │  (Metrics)   │  │  (Metrics)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│               Metrics Collection Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Telegraf    │  │  Prometheus  │  │    Jaeger    │  │
│  │ (IoT Data)   │  │  (Metrics)   │  │   (Traces)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Storage Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  InfluxDB    │  │  Prometheus  │  │    Jaeger    │  │
│  │ (Time-Series)│  │  (Storage)   │  │  (Storage)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
                   ┌──────────────────┐
                   │     Grafana      │
                   │  (Visualization) │
                   └──────────────────┘
```

### Components

| Component | Purpose | Port | Data Source |
|-----------|---------|------|-------------|
| **Grafana** | Visualization & dashboards | 3000 | All sources |
| **InfluxDB** | Time-series database | 8086 | IoT telemetry |
| **Telegraf** | Metrics collector | 8125, 8094 | IoT devices |
| **Prometheus** | Metrics storage | 9090 | Application metrics |
| **Jaeger** | Distributed tracing | 16686 | Request traces |

---

## Grafana Setup

### Installation

**Docker Compose (Development):**
```yaml
# docker/docker-compose.dev.yml
services:
  grafana:
    image: grafana/grafana:11.3.0
    container_name: friendly-grafana
    ports:
      - "3000:45001"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: friendly_grafana_dev
      GF_SERVER_ROOT_URL: http://localhost:45001
      GF_AUTH_ANONYMOUS_ENABLED: false
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning
      - ./docker/grafana/dashboards:/var/lib/grafana/dashboards
    restart: unless-stopped
    networks:
      - friendly-network

volumes:
  grafana-data:
```

**Start Grafana:**
```bash
docker compose -f docker/docker-compose.dev.yml up -d grafana

# Access Grafana
open http://localhost:45001

# Default credentials:
# Username: admin
# Password: friendly_grafana_dev
```

### Data Source Configuration

**1. InfluxDB Data Source:**

Create `docker/grafana/provisioning/datasources/influxdb.yml`:
```yaml
apiVersion: 1

datasources:
  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:46101
    jsonData:
      version: Flux
      organization: friendly
      defaultBucket: iot_data
      tlsSkipVerify: true
    secureJsonData:
      token: ${INFLUXDB_TOKEN}
    editable: true
    isDefault: true
```

**2. Prometheus Data Source:**

Create `docker/grafana/provisioning/datasources/prometheus.yml`:
```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:46300
    jsonData:
      timeInterval: 5s
      queryTimeout: 60s
    editable: true
```

**3. Jaeger Data Source:**

Create `docker/grafana/provisioning/datasources/jaeger.yml`:
```yaml
apiVersion: 1

datasources:
  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:45002
    editable: true
```

### Auto-Provisioning

**Dashboard Provisioning:**

Create `docker/grafana/provisioning/dashboards/dashboards.yml`:
```yaml
apiVersion: 1

providers:
  - name: 'Friendly AEP Dashboards'
    orgId: 1
    folder: 'Friendly AEP'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

---

## InfluxDB Configuration

### Setup

**Docker Compose:**
```yaml
services:
  influxdb:
    image: influxdb:2.7-alpine
    container_name: friendly-influxdb
    ports:
      - "8086:46101"
    environment:
      DOCKER_INFLUXDB_INIT_MODE: setup
      DOCKER_INFLUXDB_INIT_USERNAME: admin
      DOCKER_INFLUXDB_INIT_PASSWORD: friendly_influx_dev
      DOCKER_INFLUXDB_INIT_ORG: friendly
      DOCKER_INFLUXDB_INIT_BUCKET: iot_data
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: friendly-dev-token-12345
    volumes:
      - influxdb-data:/var/lib/influxdb2
      - influxdb-config:/etc/influxdb2
    restart: unless-stopped
    networks:
      - friendly-network

volumes:
  influxdb-data:
  influxdb-config:
```

### Initialize InfluxDB

**1. Access InfluxDB UI:**
```bash
open http://localhost:46101

# Login with:
# Username: admin
# Password: friendly_influx_dev
```

**2. Create API Token:**
```bash
# Using InfluxDB CLI
docker exec -it friendly-influxdb influx auth create \
  --org friendly \
  --all-access \
  --description "Friendly AEP Token"
```

**3. Create Buckets:**
```bash
# Device telemetry bucket
docker exec -it friendly-influxdb influx bucket create \
  --name iot_data \
  --org friendly \
  --retention 30d

# Application metrics bucket
docker exec -it friendly-influxdb influx bucket create \
  --name app_metrics \
  --org friendly \
  --retention 7d

# System metrics bucket
docker exec -it friendly-influxdb influx bucket create \
  --name system_metrics \
  --org friendly \
  --retention 90d
```

### Writing Data to InfluxDB

**Using InfluxDB Client:**
```typescript
import { InfluxDB, Point } from '@influxdata/influxdb-client';

const influxDB = new InfluxDB({
  url: process.env.INFLUXDB_URL,
  token: process.env.INFLUXDB_TOKEN,
});

const writeApi = influxDB.getWriteApi(
  process.env.INFLUXDB_ORG,
  process.env.INFLUXDB_BUCKET
);

// Write device telemetry
const point = new Point('device_telemetry')
  .tag('device_id', 'sensor_001')
  .tag('location', 'warehouse_a')
  .floatField('temperature', 23.5)
  .floatField('humidity', 65.2)
  .timestamp(new Date());

writeApi.writePoint(point);
await writeApi.close();
```

### Querying Data

**Flux Query Example:**
```flux
from(bucket: "iot_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "device_telemetry")
  |> filter(fn: (r) => r._field == "temperature")
  |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
  |> yield(name: "mean")
```

---

## Telegraf Setup

### Configuration

**Telegraf Configuration File (docker/telegraf.conf):**
```toml
[global_tags]
  environment = "development"
  datacenter = "local"

[agent]
  interval = "10s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000
  collection_jitter = "0s"
  flush_interval = "10s"
  flush_jitter = "0s"
  precision = "0s"
  hostname = "friendly-telegraf"
  omit_hostname = false

# ============================================================================
# OUTPUTS
# ============================================================================

[[outputs.influxdb_v2]]
  urls = ["http://influxdb:46101"]
  token = "${INFLUXDB_TOKEN}"
  organization = "friendly"
  bucket = "iot_data"
  timeout = "5s"

# ============================================================================
# INPUTS - IoT Device Data
# ============================================================================

[[inputs.mqtt_consumer]]
  servers = ["tcp://mqtt-broker:1883"]
  topics = [
    "devices/+/telemetry",
    "devices/+/status"
  ]
  data_format = "json"
  json_time_key = "timestamp"
  json_time_format = "unix_ms"
  tag_keys = ["device_id", "device_type"]

[[inputs.http]]
  urls = [
    "http://aep-api-gateway:46000/api/v1/metrics"
  ]
  method = "GET"
  timeout = "5s"
  data_format = "json"
  interval = "30s"

# ============================================================================
# INPUTS - System Metrics
# ============================================================================

[[inputs.cpu]]
  percpu = true
  totalcpu = true
  collect_cpu_time = false
  report_active = false

[[inputs.mem]]

[[inputs.disk]]
  ignore_fs = ["tmpfs", "devtmpfs", "devfs", "iso9660", "overlay", "aufs", "squashfs"]

[[inputs.diskio]]

[[inputs.net]]
  interfaces = ["eth*", "en*"]

[[inputs.netstat]]

[[inputs.processes]]

[[inputs.system]]

# ============================================================================
# INPUTS - Docker Metrics
# ============================================================================

[[inputs.docker]]
  endpoint = "unix:///var/run/docker.sock"
  gather_services = false
  container_name_include = []
  container_name_exclude = []
  timeout = "5s"
  perdevice = true
  total = false
  docker_label_include = []
  docker_label_exclude = []

# ============================================================================
# INPUTS - PostgreSQL Metrics
# ============================================================================

[[inputs.postgresql]]
  address = "postgres://friendly:friendly_dev_password@postgres:46100/friendly_aep?sslmode=disable"
  databases = ["friendly_aep"]

[[inputs.postgresql_extensible]]
  address = "postgres://friendly:friendly_dev_password@postgres:46100/friendly_aep?sslmode=disable"
  [[inputs.postgresql_extensible.query]]
    sqlquery = "SELECT count(*) as total FROM users"
    version = 901
    withdbname = false
    tagvalue = ""

# ============================================================================
# INPUTS - Redis Metrics
# ============================================================================

[[inputs.redis]]
  servers = ["tcp://redis:46102"]
  password = ""

# ============================================================================
# PROCESSORS
# ============================================================================

[[processors.rename]]
  [[processors.rename.replace]]
    tag = "host"
    dest = "hostname"

[[processors.converter]]
  [processors.converter.fields]
    integer = ["status_code"]
    float = ["response_time"]
```

**Docker Compose Entry:**
```yaml
services:
  telegraf:
    image: telegraf:1.31-alpine
    container_name: friendly-telegraf
    ports:
      - "8125:8125/udp"  # StatsD
      - "8092:8092/udp"  # UDP
      - "8094:8094"      # HTTP
    environment:
      INFLUXDB_TOKEN: ${INFLUXDB_TOKEN}
    volumes:
      - ./docker/telegraf.conf:/etc/telegraf/telegraf.conf:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
    networks:
      - friendly-network
```

### Custom Metrics

**Send metrics from application:**
```typescript
import { StatsD } from 'node-statsd';

const statsd = new StatsD({
  host: process.env.TELEGRAF_HOST || 'localhost',
  port: 8125,
  prefix: 'friendly.aep.'
});

// Increment counter
statsd.increment('api.requests');

// Timing
statsd.timing('api.response_time', 125);

// Gauge
statsd.gauge('active_sessions', 45);

// Set
statsd.set('unique_visitors', userId);
```

---

## Prometheus Integration

### Prometheus Setup

**Docker Compose:**
```yaml
services:
  prometheus:
    image: prom/prometheus:v2.53.0
    container_name: friendly-prometheus
    ports:
      - "9090:46300"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--storage.tsdb.retention.time=15d'
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    restart: unless-stopped
    networks:
      - friendly-network

volumes:
  prometheus-data:
```

**Prometheus Configuration (docker/prometheus/prometheus.yml):**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'friendly-aep'
    environment: 'development'

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:46300']

  - job_name: 'api-gateway'
    static_configs:
      - targets: ['aep-api-gateway:46000']
    metrics_path: '/metrics'

  - job_name: 'builder'
    static_configs:
      - targets: ['aep-builder:45000']
    metrics_path: '/metrics'

  - job_name: 'preview-host'
    static_configs:
      - targets: ['aep-preview-host:46001']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Expose Metrics from Application

**Fastify Prometheus Plugin:**
```typescript
import fastifyMetrics from 'fastify-metrics';

// Register plugin
app.register(fastifyMetrics, {
  endpoint: '/metrics',
  defaultMetrics: { enabled: true },
  prefix: 'friendly_aep_',
  routeMetrics: { enabled: true },
});

// Custom metrics
const requestCounter = new app.metrics.Counter({
  name: 'friendly_aep_requests_total',
  help: 'Total number of requests',
  labelNames: ['method', 'route', 'status_code']
});

app.addHook('onResponse', (request, reply, done) => {
  requestCounter.inc({
    method: request.method,
    route: request.routerPath,
    status_code: reply.statusCode
  });
  done();
});
```

---

## Jaeger Tracing

### Setup

**Docker Compose:**
```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:1.57
    container_name: friendly-jaeger
    ports:
      - "5775:5775/udp"   # Zipkin
      - "6831:6831/udp"   # Jaeger compact
      - "6832:6832/udp"   # Jaeger binary
      - "5778:5778"       # Config
      - "16686:45002"     # UI
      - "14268:14268"     # Collector
      - "14250:14250"     # gRPC
      - "9411:9411"       # Zipkin
    environment:
      COLLECTOR_ZIPKIN_HOST_PORT: ":9411"
      COLLECTOR_OTLP_ENABLED: true
    restart: unless-stopped
    networks:
      - friendly-network
```

### Instrument Application

**OpenTelemetry Setup:**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
  serviceName: 'aep-api-gateway',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Custom spans
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('aep-api-gateway');

async function processRequest(data: any) {
  const span = tracer.startSpan('processRequest');

  try {
    span.setAttribute('data.id', data.id);
    span.setAttribute('data.size', data.length);

    const result = await doProcessing(data);

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## Custom Dashboards

### Platform Performance Dashboard

**Dashboard JSON** (partial example):
```json
{
  "dashboard": {
    "title": "Friendly AEP - Platform Performance",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(friendly_aep_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "id": 2,
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(friendly_aep_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ],
        "type": "graph"
      },
      {
        "id": 3,
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(friendly_aep_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

### IoT Device Dashboard

**Create dashboard for device monitoring:**
```flux
// Device telemetry over time
from(bucket: "iot_data")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r._measurement == "device_telemetry")
  |> filter(fn: (r) => r.device_id == "${device_id}")
  |> aggregateWindow(every: v.windowPeriod, fn: mean)

// Device status
from(bucket: "iot_data")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "device_status")
  |> filter(fn: (r) => r._field == "online")
  |> last()
```

---

## Alerting

### Alert Rules

**Prometheus Alert Rules (docker/prometheus/alerts.yml):**
```yaml
groups:
  - name: friendly_aep_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(friendly_aep_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} for {{ $labels.route }}"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(friendly_aep_request_duration_seconds_bucket[5m])) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "P95 response time is {{ $value }}s"

      - alert: DatabaseConnectionFailed
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "PostgreSQL exporter is down"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"
```

### Grafana Alerts

**Configure alert channels:**

1. **Email Notifications:**
```yaml
# docker/grafana/provisioning/notifiers/email.yml
notifiers:
  - name: email
    type: email
    uid: email_notifier
    org_id: 1
    is_default: true
    settings:
      addresses: ops@friendly-tech.com
```

2. **Slack Notifications:**
```yaml
# docker/grafana/provisioning/notifiers/slack.yml
notifiers:
  - name: slack
    type: slack
    uid: slack_notifier
    org_id: 1
    settings:
      url: ${SLACK_WEBHOOK_URL}
      recipient: '#platform-alerts'
      username: Grafana
```

---

## Log Aggregation

### Loki Setup

**Docker Compose:**
```yaml
services:
  loki:
    image: grafana/loki:2.9.0
    container_name: friendly-loki
    ports:
      - "3100:46350"
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - loki-data:/loki
    restart: unless-stopped
    networks:
      - friendly-network

  promtail:
    image: grafana/promtail:2.9.0
    container_name: friendly-promtail
    volumes:
      - /var/log:/var/log
      - ./docker/promtail/config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped
    networks:
      - friendly-network
```

**Loki Data Source in Grafana:**
```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:46350
    editable: true
```

---

## Performance Monitoring

### Key Metrics to Monitor

**Application Metrics:**
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (%)
- Active sessions
- Database connection pool usage
- Cache hit rate

**Infrastructure Metrics:**
- CPU usage (%)
- Memory usage (%)
- Disk I/O
- Network throughput
- Container resource usage

**Business Metrics:**
- Active projects
- Preview sessions
- API token usage
- Billing tier distribution

### SLA Monitoring

**Service Level Objectives:**
```
Availability: 99.9% uptime
Response Time: p95 < 500ms
Error Rate: < 0.1%
```

**Create SLO dashboard:**
```flux
// Availability
from(bucket: "app_metrics")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "health_check")
  |> filter(fn: (r) => r._field == "status")
  |> map(fn: (r) => ({ r with _value: if r._value == "ok" then 1.0 else 0.0 }))
  |> mean()
  |> yield(name: "availability")
```

---

## Troubleshooting

### Common Monitoring Issues

**1. Grafana Can't Connect to Data Source:**
```bash
# Check InfluxDB is running
docker ps | grep influxdb

# Test connection
curl http://localhost:46101/health

# Check token
docker exec -it friendly-influxdb influx auth list --org friendly
```

**2. No Metrics Appearing:**
```bash
# Check Telegraf is collecting
docker logs friendly-telegraf

# Test Telegraf endpoint
curl http://localhost:8094/metrics

# Verify InfluxDB has data
docker exec -it friendly-influxdb influx query \
  'from(bucket: "iot_data") |> range(start: -1h) |> limit(n: 10)'
```

**3. Jaeger Not Receiving Traces:**
```bash
# Check Jaeger health
curl http://localhost:14269/health

# View Jaeger logs
docker logs friendly-jaeger

# Test trace submission
curl -X POST http://localhost:14268/api/traces \
  -H "Content-Type: application/json" \
  -d '{"data": [...]}'
```

---

## Related Documentation

- [Deployment Guide](./DEPLOYMENT-GUIDE.md) - Deployment procedures
- [Docker Guide](../deployment/DOCKER-GUIDE.md) - Container configuration
- [Kubernetes Guide](../deployment/KUBERNETES-GUIDE.md) - K8s monitoring
- [Development Guide](./DEVELOPMENT-GUIDE.md) - Development workflows

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
