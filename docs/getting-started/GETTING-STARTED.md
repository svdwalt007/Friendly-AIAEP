# Getting Started with Friendly AI AEP

Welcome to the Friendly AI-Powered Application Execution Platform (AEP)! This comprehensive guide will help you get up and running with the platform to build IoT applications in minutes instead of weeks.

## Table of Contents

1. [What is Friendly AI AEP?](#what-is-friendly-ai-aep)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Platform Architecture](#platform-architecture)
5. [Environment-Specific Setup](#environment-specific-setup)
6. [Building Your First IoT App](#building-your-first-iot-app)
7. [Preview System](#preview-system)
8. [Development and Debugging](#development-and-debugging)
9. [Monitoring During Development](#monitoring-during-development)
10. [Service Health Checks](#service-health-checks)
11. [Troubleshooting by Environment](#troubleshooting-by-environment)
12. [API Reference](#api-reference)
13. [Service Credentials](#service-credentials)
14. [Available Dashboard Widgets](#available-dashboard-widgets)
15. [Quick Reference](#quick-reference)

---

## What is Friendly AI AEP?

**Friendly-AIAEP** is an AI-driven platform that enables developers to rapidly build, deploy, and manage IoT applications through conversational interaction with Claude AI.

### Key Benefits

- **Speed**: Reduce development time from 2-3 weeks to ~15 minutes
- **AI-Powered**: Natural language interface for building applications
- **IoT Integration**: Connect 10,000+ devices via OpenAPI/Swagger
- **Real-Time Dashboards**: Auto-generated Angular applications
- **One-Click Deployment**: Docker + Kubernetes with Helm charts
- **Complete Monitoring**: Grafana dashboards + Telegraf metrics

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | Nx 22.6.4 |
| **Language** | TypeScript 5.9.3 |
| **Backend** | Node.js 20+ (Fastify 5.x, Express) |
| **Frontend** | Angular 21+ (standalone components) |
| **AI/LLM** | LangGraph 1.2.8 + Claude Opus (Anthropic SDK 0.87.0) |
| **Database** | PostgreSQL 16 (Prisma ORM) |
| **Time-Series** | InfluxDB 2.7 |
| **Cache** | Redis 7 |
| **Storage** | MinIO (S3-compatible) |
| **Monitoring** | Grafana 11.3 + Telegraf 1.31 |
| **Testing** | Vitest 4.1.4 |
| **Package Manager** | pnpm 10.33.0 |

---

## Prerequisites

### Required Software

1. **Node.js**: Version 20 or higher
2. **pnpm**: Version 10.33.0 (installed automatically via packageManager field)
3. **Docker Desktop**: For running infrastructure services
4. **Git**: For version control

### Optional Tools

- **wscat**: WebSocket testing (npm install -g wscat)
- **Postman** or **Insomnia**: API testing
- **VS Code**: Recommended IDE with debug configurations included

### API Keys

You'll need an **Anthropic API Key** for AI-powered features:
- Sign up at https://console.anthropic.com/
- Create an API key
- Add it to your .env file

---

## Quick Start

### Step 1: Install Dependencies

```bash
cd /path/to/Friendly-AIAEP
pnpm install
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Anthropic API key
nano .env
```

**Critical Configuration** (line 31 in .env):
```env
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
```

### Step 3: Build All Projects

```bash
pnpm nx run-many -t build
```

### Step 4: Start Infrastructure Services

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This starts:
- **PostgreSQL** (port 5432) - Application database
- **InfluxDB** (port 8086) - IoT time-series data
- **Telegraf** (ports 8125/8092/8094) - IoT data ingestion
- **Grafana** (port 3000) - Monitoring dashboards
- **Redis** (port 6379) - Caching & sessions
- **MinIO** (ports 9000/9001) - Object storage

**Verify all services are running:**
```bash
docker compose -f docker/docker-compose.dev.yml ps
```

All containers should show "Up" or "Up (healthy)" status.

### Step 5: Start the Applications

Open **3 separate terminal windows** and run:

**Terminal 1 - API Gateway:**
```bash
cd /path/to/Friendly-AIAEP
pnpm nx serve aep-api-gateway
```
✅ Expected: [ ready ] http://localhost:46000

**Terminal 2 - Builder UI:**
```bash
cd /path/to/Friendly-AIAEP
pnpm nx serve aep-builder
```
✅ Expected: Running on http://localhost:45000

**Terminal 3 - Preview Host:**
```bash
cd /path/to/Friendly-AIAEP
pnpm nx serve aep-preview-host
```
✅ Expected: [ ready ] http://localhost:46001

### Step 6: Access the Platform

| Service | URL | Purpose |
|---------|-----|---------|
| **Builder UI** | http://localhost:45000 | Main application interface |
| **API Gateway** | http://localhost:46000 | Backend API |
| **API Docs** | http://localhost:46000/docs | Swagger documentation |
| **Preview Host** | http://localhost:46001 | Live preview runtime |
| **Grafana** | http://localhost:45001 | Monitoring dashboards |
| **MinIO Console** | http://localhost:45003 | Object storage admin |

---

## Platform Architecture

### Core Applications

| Application | Port | Technology | Purpose |
|-------------|------|-----------|---------|
| **aep-api-gateway** | 3001 | Fastify 5.x | HTTP/WebSocket gateway, auth, rate limiting |
| **aep-builder** | 4200 | Angular 21+ | Interactive UI for building IoT apps |
| **aep-preview-host** | 3002 | Express | Runtime for live app previews |

### Core Service Libraries

**AI & Agent Runtime:**
- agent-runtime - LangGraph AI agents (Supervisor, Planning, IoT Domain)
- llm-providers - Anthropic Claude API integration
- builder-orchestrator - Coordinates building process

**IoT Integration:**
- swagger-ingestion - OpenAPI/Swagger parser for IoT APIs
- iot-tool-functions - LangGraph tools (GetDeviceList, GetTelemetry, RegisterWebhook)
- auth-adapter - Multi-method authentication (Basic, Bearer, OAuth2)
- sdk-generator - API client code generation
- mock-api-server - Testing mock server

**Builder Components:**
- codegen - TypeScript/Angular code generation
- page-composer - Drag-and-drop visual builder
- widget-registry - Component library (charts, tables, maps, alerts)
- preview-runtime - Docker-based live preview
- publish-service - Deployment pipeline
- environment-service - Environment variable management
- git-service - Git-based project publishing
- template-marketplace - Template discovery and reuse

**Business Services:**
- billing-service - Stripe billing & subscription management
- audit-service - Compliance logging
- license-service - License validation
- policy-service - RBAC and policy enforcement
- project-registry - Project CRUD operations

**Infrastructure:**
- prisma-schema - PostgreSQL ORM with multi-tenant RLS
- influx-schemas - Time-series database setup
- docker-generator - Dockerfile generation
- helm-generator - Kubernetes Helm chart generation

---

## Environment-Specific Setup

The platform supports multiple deployment environments, each with specific configurations and considerations.

### Development Environment

**Purpose**: Local development and testing with hot-reload and debug capabilities.

**Configuration File**: `docker/docker-compose.dev.yml`

**Environment Variables** (.env):
```env
DEPLOYMENT_MODE=development
NODE_ENV=development
LOG_LEVEL=debug
DEV_MODE=true
DEV_DEBUG_ENABLED=true
DEV_MOCK_SERVICES=true
WATCH_MODE=true
```

**Starting Development Environment:**
```bash
# Start infrastructure
docker compose -f docker/docker-compose.dev.yml up -d

# Start applications (3 terminals)
pnpm nx serve aep-api-gateway
pnpm nx serve aep-builder
pnpm nx serve aep-preview-host
```

**Key Features:**
- Hot reload enabled for instant code changes
- Debug ports exposed (9229, 9230)
- Verbose logging (debug level)
- Mock services enabled
- No SSL/TLS requirements
- Development credentials (see Service Credentials section)

**Resource Requirements:**
- RAM: 8GB minimum, 16GB recommended
- CPU: 4 cores minimum
- Disk: 10GB free space

### Test Environment

**Purpose**: Automated testing and CI/CD integration.

**Configuration**: Same as development but with stricter validation.

**Environment Variables** (.env):
```env
DEPLOYMENT_MODE=staging
NODE_ENV=test
LOG_LEVEL=info
DEV_MODE=false
DEV_MOCK_SERVICES=false
```

**Starting Test Environment:**
```bash
# Build all projects
pnpm nx run-many -t build --configuration=test

# Run tests
pnpm nx run-many -t test

# Run E2E tests
pnpm nx run-many -t e2e
```

**Key Features:**
- Real service integrations (no mocks)
- Moderate logging (info level)
- Automated cleanup after tests
- CI/CD optimized

### Pre-Production Environment

**Purpose**: Final validation before production deployment.

**Configuration File**: `docker/docker-compose.prod.yml` (with pre-prod overrides)

**Environment Variables** (.env):
```env
DEPLOYMENT_MODE=staging
NODE_ENV=production
LOG_LEVEL=warn
FEATURE_AI_AGENT_RUNTIME=true
FEATURE_BUILDER_ENABLED=true
```

**Starting Pre-Production:**
```bash
# Build production artifacts
pnpm nx run-many -t build --configuration=production

# Start with production compose
docker compose -f docker/docker-compose.prod.yml up -d
```

**Key Features:**
- Production-like configuration
- Performance testing enabled
- Load testing supported
- Security hardening enabled
- Production credentials required

**Differences from Production:**
- More verbose logging
- Debugging tools available
- Test data allowed
- Monitoring emphasis on performance metrics

### Production Environment

**Purpose**: Live production deployment serving real users.

**Configuration File**: `docker/docker-compose.prod.yml`

**Environment Variables** (.env):
```env
DEPLOYMENT_MODE=production
NODE_ENV=production
LOG_LEVEL=error
FEATURE_AI_AGENT_RUNTIME=true
FEATURE_BUILDER_ENABLED=true
LICENSE_SERVICE_ENABLED=true
BILLING_SERVICE_ENABLED=true
AUDIT_ENABLED=true
```

**Deployment:**
```bash
# Build production images
docker build -t ghcr.io/your-org/friendly-aiaep/aep-api-gateway:latest -f apps/aep-api-gateway/Dockerfile .
docker build -t ghcr.io/your-org/friendly-aiaep/aep-builder:latest -f apps/aep-builder/Dockerfile .
docker build -t ghcr.io/your-org/friendly-aiaep/aep-preview-host:latest -f apps/aep-preview-host/Dockerfile .

# Start production stack
docker compose -f docker/docker-compose.prod.yml up -d
```

**Key Features:**
- Minimal logging (error level only)
- Resource limits enforced
- Health checks enabled
- Auto-restart policies
- Production credentials required
- SSL/TLS enabled
- Rate limiting active
- Audit logging mandatory

**Resource Requirements:**
- RAM: 16GB minimum, 32GB recommended
- CPU: 8 cores minimum
- Disk: 100GB free space for data and logs

**Security Considerations:**
- Change all default passwords
- Use secrets management (e.g., Docker secrets, Vault)
- Enable firewall rules
- Regular security updates
- Audit log retention

### Environment Comparison

| Feature | Development | Test | Pre-Prod | Production |
|---------|-------------|------|----------|------------|
| Log Level | debug | info | warn | error |
| Hot Reload | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Debug Ports | ✅ Open | ❌ Closed | ⚠️ Internal Only | ❌ Closed |
| Mock Services | ✅ Enabled | ❌ Disabled | ❌ Disabled | ❌ Disabled |
| SSL/TLS | ❌ Optional | ✅ Required | ✅ Required | ✅ Required |
| Resource Limits | ❌ None | ⚠️ Moderate | ✅ Enforced | ✅ Strict |
| Monitoring | ⚠️ Basic | ⚠️ Basic | ✅ Full | ✅ Full + Alerts |
| Backup | ❌ No | ❌ No | ⚠️ Manual | ✅ Automated |

---

## Building Your First IoT App

The Builder UI is currently in early development. Use the **API Gateway** to interact with the platform.

### Method 1: Using Swagger UI (Recommended for Beginners)

1. **Open Swagger UI**: http://localhost:46000/docs

2. **Authenticate**:
   - Click the "Authorize" button at the top
   - Use the login endpoint or enter credentials:
     - Username: demo
     - Password: demo

3. **Create a Project**:
   - Find POST /api/v1/projects
   - Click "Try it out"
   - Enter project details:
     ```json
     {
       "name": "My First IoT Dashboard",
       "description": "Temperature and humidity monitoring",
       "deploymentMode": "saas"
     }
     ```
   - Click "Execute"
   - Save the projectId from the response

4. **Launch a Preview**:
   - Find POST /api/v1/projects/{id}/preview
   - Enter your projectId
   - Set preview mode:
     ```json
     {
       "mode": "mock",
       "hotReload": true
     }
     ```
   - Click "Execute"
   - Access the preview URL (e.g., http://localhost:4300)

### Method 2: Using cURL

#### 1. Authenticate

```bash
curl -X POST http://localhost:46000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user_001",
    "username": "demo",
    "tenantId": "tenant_001",
    "role": "admin"
  }
}
```

Save the accessToken for subsequent requests.

#### 2. Create a Project

```bash
curl -X POST http://localhost:46000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "name": "My First IoT Dashboard",
    "description": "A sample IoT monitoring dashboard",
    "deploymentMode": "saas"
  }'
```

**Response:**
```json
{
  "projectId": "proj_123456",
  "name": "My First IoT Dashboard",
  "status": "created",
  "createdAt": "2026-04-14T13:00:00Z"
}
```

#### 3. Use AI Agent to Build (WebSocket)

Install wscat if you haven't:
```bash
npm install -g wscat
```

Connect to the agent stream:
```bash
wscat -c "ws://localhost:46000/api/v1/agent/stream?sessionId=test-session-1&token=YOUR_ACCESS_TOKEN_HERE"
```

Send a prompt:
```json
{
  "type": "prompt",
  "content": "Create a dashboard showing temperature and humidity data from my IoT sensors with line charts and current value cards"
}
```

**The agent will:**
1. Query available devices
2. Generate appropriate widgets (charts, gauges, cards)
3. Stream back progress updates
4. Generate Angular code
5. Update the project

**Example streaming responses:**
```json
{"type": "agent_thinking", "content": "Analyzing your request..."}
{"type": "agent_tool_call", "tool": "getDeviceList", "args": {}}
{"type": "agent_response", "content": "Found 12 temperature sensors..."}
{"type": "build_progress", "percentage": 45, "step": "Generating chart components"}
{"type": "preview_update", "url": "http://localhost:4300"}
{"type": "complete", "projectId": "proj_123456"}
```

#### 4. Launch Live Preview

```bash
curl -X POST http://localhost:46000/api/v1/projects/proj_123456/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "mode": "mock",
    "hotReload": true
  }'
```

**Preview Modes:**
- mock - Simulated device data (no credentials needed)
- live - Real device data via IoT API
- disconnected-sim - Tests offline resilience

**Response:**
```json
{
  "previewId": "preview_789",
  "url": "http://localhost:4300",
  "status": "running",
  "container": "aep-preview-proj_123456",
  "hotReload": true
}
```

Access your app at the returned URL!

### Method 3: Using the IoT Tool Functions Directly

The AI agent has access to these IoT functions:

**1. Get Device List**
```json
{
  "type": "tool_call",
  "tool": "getDeviceList",
  "args": {
    "filter": "temperature"
  }
}
```

**2. Get Device Details**
```json
{
  "type": "tool_call",
  "tool": "getDeviceDetails",
  "args": {
    "deviceId": "sensor_001"
  }
}
```

**3. Get Device Telemetry**
```json
{
  "type": "tool_call",
  "tool": "getDeviceTelemetry",
  "args": {
    "deviceId": "sensor_001",
    "metric": "temperature",
    "timeRange": "1h"
  }
}
```

**4. Register Webhook**
```json
{
  "type": "tool_call",
  "tool": "registerWebhook",
  "args": {
    "deviceId": "sensor_001",
    "event": "threshold_exceeded",
    "url": "https://your-app.com/webhook"
  }
}
```

**5. Get KPI Metrics**
```json
{
  "type": "tool_call",
  "tool": "getKPIMetrics",
  "args": {
    "metric": "uptime",
    "period": "7d"
  }
}
```

---

## Preview System

The Preview System is now fully functional! Test your IoT applications in isolated Docker containers before deployment.

### What is the Preview System?

The Preview System allows you to:
- Launch your IoT app in an ephemeral Docker container
- Test with **mock APIs** (no real devices needed) or **live APIs** (real device data)
- Access your preview app on `http://localhost:4300+`
- Sessions automatically expire after 30 minutes (configurable)
- Hot-reload enabled for real-time updates

### Quick Preview Example

**1. Create a Preview Session**
```bash
curl -X POST http://localhost:46000/api/v1/projects/demo-project-001/preview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "mock",
    "duration": 30
  }'
```

**Response:**
```json
{
  "previewId": "clx1234567890",
  "previewUrl": "http://localhost:4300",
  "mode": "mock",
  "expiresAt": "2026-04-15T12:30:00Z",
  "status": "starting"
}
```

**2. Check Preview Status**
```bash
curl http://localhost:46000/api/v1/projects/demo-project-001/preview/clx1234567890 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**3. Access Your Preview**
Open your browser to: `http://localhost:4300`

**4. Stop Preview When Done**
```bash
curl -X DELETE http://localhost:46000/api/v1/projects/demo-project-001/preview/clx1234567890 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Preview Modes

1. **Mock Mode** (Recommended for Development)
   - Uses simulated device data
   - No real API credentials required
   - Perfect for UI testing and development

2. **Live Mode** (Production Testing)
   - Connects to real Friendly IoT APIs
   - Requires valid API credentials
   - Tests actual device integrations

3. **Disconnected Simulation Mode** (Resilience Testing)
   - Simulates network interruptions
   - Tests offline caching
   - Validates grace period handling

### Session Limits by Tier

| Tier         | Concurrent Sessions | Max Per Day | Max Duration |
|--------------|---------------------|-------------|--------------|
| FREE         | 1                   | 10          | 30 min       |
| STARTER      | 3                   | Unlimited   | 120 min      |
| PROFESSIONAL | 10                  | Unlimited   | 240 min      |
| ENTERPRISE   | 50                  | Unlimited   | 480 min      |

### Automatic Cleanup

The system automatically:
- Stops expired sessions every 5 minutes
- Removes Docker containers
- Updates session status in database
- Frees up allocated ports (4300-4399 range)

---

## Development and Debugging

### VS Code Debug Configurations

The repository includes pre-configured debug setups for VS Code located at `.vscode/launch.json`.

**Available Configurations:**

1. **Debug aep-api-gateway with Nx**
   - Debug port: 9229
   - Automatically starts the API Gateway with debugging enabled
   - Source maps enabled for TypeScript debugging

2. **Debug aep-preview-host with Nx**
   - Debug port: 9230
   - Automatically starts the Preview Host with debugging enabled
   - Source maps enabled for TypeScript debugging

**To use:**
1. Open VS Code
2. Press `F5` or go to Run and Debug panel
3. Select the configuration you want to debug
4. Press the green play button

### Attaching Debuggers to Running Services

If services are already running, you can attach a debugger:

**Step 1: Start service with inspect flag**
```bash
# API Gateway
NODE_OPTIONS='--inspect=9229' pnpm nx serve aep-api-gateway

# Preview Host
NODE_OPTIONS='--inspect=9230' pnpm nx serve aep-preview-host
```

**Step 2: Attach VS Code debugger**

Create a new launch configuration:
```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to API Gateway",
  "port": 9229,
  "skipFiles": ["<node_internals>/**"],
  "sourceMaps": true
}
```

**Step 3: Set breakpoints**
- Open the source file in VS Code
- Click in the gutter to the left of the line number
- Breakpoint will appear as a red dot

### Common Debugging Scenarios

#### Debugging API Endpoints

1. Set breakpoint in route handler (e.g., `apps/aep-api-gateway/src/app/routes/projects.routes.ts`)
2. Start debug session
3. Send API request via Swagger UI or cURL
4. Debugger will pause at breakpoint

**Example: Debug project creation**
```typescript
// apps/aep-api-gateway/src/app/routes/projects.routes.ts
fastify.post('/api/v1/projects', async (request, reply) => {
  // Set breakpoint here
  const { name, description } = request.body;
  // ... rest of code
});
```

#### Debugging AI Agent Interactions

1. Set breakpoint in agent runtime (e.g., `libs/agent-runtime/src/lib/supervisor-agent.ts`)
2. Connect via WebSocket and send a prompt
3. Step through agent decision-making process

#### Debugging Preview Container Issues

1. Check Docker logs:
```bash
docker logs aep-preview-proj_123456
```

2. Inspect container:
```bash
docker exec -it aep-preview-proj_123456 /bin/sh
```

3. Debug preview-runtime code:
```bash
# Set breakpoint in libs/builder/preview-runtime/src/lib/docker-manager.ts
```

#### Debugging Database Queries

1. Enable Prisma query logging in `.env`:
```env
DEBUG=prisma:query
```

2. Check PostgreSQL logs:
```bash
docker logs friendly-aep-postgres
```

3. Connect to database directly:
```bash
docker exec -it friendly-aep-postgres psql -U friendly -d friendly_aep
```

### Log Locations and Tailing

**Application Logs:**

API Gateway (development):
```bash
# Logs appear in the terminal where you ran:
pnpm nx serve aep-api-gateway
```

Builder UI (browser console):
```bash
# Open browser DevTools (F12)
# Check Console tab
```

Preview Host (development):
```bash
# Logs appear in the terminal where you ran:
pnpm nx serve aep-preview-host
```

**Docker Service Logs:**

View all service logs:
```bash
docker compose -f docker/docker-compose.dev.yml logs -f
```

View specific service logs:
```bash
# PostgreSQL
docker logs -f friendly-aep-postgres

# Redis
docker logs -f friendly-aep-redis

# InfluxDB
docker logs -f friendly-aep-influxdb

# Grafana
docker logs -f friendly-aep-grafana

# Telegraf
docker logs -f friendly-aep-telegraf

# MinIO
docker logs -f friendly-aep-minio
```

**Production Logs:**

In production, logs are written to JSON files:
```bash
# API Gateway (inside container)
docker exec friendly-aep-api-gateway cat /var/log/app/api-gateway.log

# View last 100 lines
docker logs --tail 100 friendly-aep-api-gateway

# Follow logs in real-time
docker logs -f friendly-aep-api-gateway
```

**Audit Logs:**

Development:
```bash
cat ./logs/audit.log
```

Production:
```bash
docker exec friendly-aep-api-gateway cat /var/log/audit/audit.log
```

### Debugging Tips

**Enable Verbose Logging:**
```env
# In .env
LOG_LEVEL=debug
DEV_DEBUG_ENABLED=true
```

**Debug Nx Build Issues:**
```bash
# Show detailed build output
pnpm nx build aep-api-gateway --verbose

# Reset Nx cache
pnpm nx reset

# View dependency graph
pnpm nx graph
```

**Debug WebSocket Connections:**
```bash
# Use wscat for manual testing
wscat -c "ws://localhost:46000/api/v1/agent/stream?sessionId=debug&token=YOUR_TOKEN"

# Enable WebSocket debugging in browser
# Chrome DevTools > Network > WS filter
```

**Debug TypeScript Compilation:**
```bash
# Check for type errors
pnpm nx run-many -t typecheck

# Build with source maps
pnpm nx build aep-api-gateway --sourceMap
```

---

## Monitoring During Development

### Accessing Grafana Dashboards

**1. Open Grafana:**
```
http://localhost:45001
```

**2. Login:**
- Username: `admin`
- Password: `friendly_grafana_dev`

**3. Navigate to Dashboards:**
- Click the "Dashboards" icon (four squares) in the left sidebar
- Browse available dashboards or create new ones

### Pre-configured Dashboards

The platform includes these dashboards (if provisioned):

**System Metrics Dashboard:**
- CPU usage across services
- Memory consumption
- Disk I/O
- Network traffic

**IoT Data Dashboard:**
- Device telemetry visualization
- Time-series data from InfluxDB
- Real-time sensor readings
- Alert thresholds

**Application Performance:**
- API response times
- Request rate (requests/sec)
- Error rates
- WebSocket connection stats

### Setting Up Telegraf for IoT Data Monitoring

Telegraf is pre-configured and running as part of the development stack.

**Configuration Location:**
```
docker/telegraf.conf
```

**Sending Test Data to Telegraf:**

**Via StatsD (UDP port 8125):**
```bash
# Send a gauge metric
echo "iot.temperature:23.5|g" | nc -u -w1 localhost 8125

# Send a counter
echo "iot.sensor.reading:1|c" | nc -u -w1 localhost 8125

# Send a timer
echo "iot.processing.time:150|ms" | nc -u -w1 localhost 8125
```

**Via HTTP Listener (port 8094):**
```bash
curl -X POST http://localhost:8094/telegraf \
  -H "Content-Type: application/json" \
  -d '{
    "measurement": "temperature",
    "tags": {
      "device": "sensor_001",
      "location": "warehouse_a"
    },
    "fields": {
      "value": 23.5,
      "unit": "celsius"
    },
    "timestamp": '$(date +%s)'
  }'
```

**Via UDP Listener (port 8092):**
```bash
echo '{"measurement":"humidity","tags":{"device":"sensor_002"},"fields":{"value":65.2}}' | nc -u localhost 8092
```

**Verify Data in InfluxDB:**
```bash
# Access InfluxDB CLI
docker exec -it friendly-aep-influxdb influx

# Query data
> use iot_data
> SELECT * FROM temperature ORDER BY time DESC LIMIT 10
```

### Using InfluxDB to Query Time-Series Data

**Access InfluxDB UI:**
```
http://localhost:46101
```

**Login Credentials:**
- Username: `admin`
- Password: `friendly_influx_dev`
- Organization: `friendly`
- Bucket: `iot_data`

**Query Data via CLI:**
```bash
# Enter InfluxDB container
docker exec -it friendly-aep-influxdb /bin/sh

# Run influx CLI
influx

# Authenticate
> auth
# Enter username and password

# Switch to organization
> use friendly

# Query using Flux
> from(bucket: "iot_data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> limit(n: 10)
```

**Query via HTTP API:**
```bash
curl -X POST http://localhost:46101/api/v2/query \
  -H "Authorization: Token friendly-dev-token-12345" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "iot_data")
    |> range(start: -1h)
    |> filter(fn: (r) => r._measurement == "temperature")
    |> limit(n: 10)'
```

**Common Flux Queries:**

**Last 24 hours of temperature data:**
```flux
from(bucket: "iot_data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> aggregateWindow(every: 1h, fn: mean)
```

**Device uptime percentage:**
```flux
from(bucket: "iot_data")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "device_status")
  |> filter(fn: (r) => r._field == "online")
  |> aggregateWindow(every: 1d, fn: mean)
  |> map(fn: (r) => ({r with _value: r._value * 100.0}))
```

**Alert when threshold exceeded:**
```flux
from(bucket: "iot_data")
  |> range(start: -15m)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r._value > 30.0)
```

### Viewing Logs in Real-Time

**Multi-service log aggregation:**
```bash
# All services
docker compose -f docker/docker-compose.dev.yml logs -f

# Specific services
docker compose -f docker/docker-compose.dev.yml logs -f postgres redis influxdb

# With timestamps
docker compose -f docker/docker-compose.dev.yml logs -f --timestamps

# Last 50 lines then follow
docker compose -f docker/docker-compose.dev.yml logs -f --tail=50
```

**Filter logs by pattern:**
```bash
# Only errors
docker logs friendly-aep-api-gateway 2>&1 | grep -i error

# Only warnings and errors
docker logs friendly-aep-api-gateway 2>&1 | grep -iE "warn|error"

# Specific request ID
docker logs friendly-aep-api-gateway 2>&1 | grep "req-12345"
```

**Monitor application logs:**
```bash
# API Gateway (in separate terminal)
pnpm nx serve aep-api-gateway | tee api-gateway.log

# Filter for specific log levels (if using pino/winston)
pnpm nx serve aep-api-gateway | grep '"level":"error"'
```

### Performance Monitoring

**Monitor Resource Usage:**

**Docker stats:**
```bash
# Real-time resource usage
docker stats

# Specific container
docker stats friendly-aep-postgres

# Format output
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

**PostgreSQL Performance:**
```bash
# Connect to database
docker exec -it friendly-aep-postgres psql -U friendly -d friendly_aep

# Active queries
SELECT pid, age(clock_timestamp(), query_start), usename, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

# Database size
SELECT pg_size_pretty(pg_database_size('friendly_aep'));

# Table sizes
SELECT
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

# Index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

**Redis Performance:**
```bash
# Connect to Redis CLI
docker exec -it friendly-aep-redis redis-cli

# Server stats
> INFO stats

# Memory usage
> INFO memory

# Slow queries
> SLOWLOG GET 10

# Monitor commands in real-time
> MONITOR
```

**API Gateway Performance Metrics:**

Check Swagger UI for `/metrics` endpoint (if configured):
```bash
curl http://localhost:46000/metrics
```

Or use Grafana dashboards to visualize:
- Request latency percentiles (p50, p95, p99)
- Requests per second
- Error rate
- Active connections

---

## Service Health Checks

### Health Check Endpoints

All services expose standardized health check endpoints for monitoring and orchestration.

**API Gateway Health Checks:**

**Basic Health Check:**
```bash
curl http://localhost:46000/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600.5,
  "timestamp": "2026-04-15T10:30:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "latencyMs": 15
    },
    "redis": {
      "status": "healthy",
      "latencyMs": 8
    },
    "influxdb": {
      "status": "healthy",
      "latencyMs": 12
    }
  }
}
```

**Readiness Probe:**
```bash
curl http://localhost:46000/health/ready
```

Response (ready):
```json
{
  "ready": true
}
```

Response (not ready):
```json
{
  "ready": false,
  "reason": "Redis is not available"
}
```

**Liveness Probe:**
```bash
curl http://localhost:46000/health/live
```

Response:
```json
{
  "alive": true
}
```

**Preview Host Health:**
```bash
curl http://localhost:46001/
```

**Infrastructure Service Health:**

PostgreSQL:
```bash
docker exec friendly-aep-postgres pg_isready -U friendly
# Output: friendly-aep-postgres:46100 - accepting connections
```

Redis:
```bash
docker exec friendly-aep-redis redis-cli ping
# Output: PONG
```

InfluxDB:
```bash
curl http://localhost:46101/ping
# HTTP 204 No Content = healthy
```

Grafana:
```bash
curl http://localhost:45001/api/health
# {"commit":"...","database":"ok","version":"..."}
```

MinIO:
```bash
curl http://localhost:46200/minio/health/live
# HTTP 200 = healthy
```

### Interpreting Health Check Responses

**Status Values:**

- **healthy**: All systems operational, no issues detected
- **degraded**: Service operational but some dependencies have issues
- **unhealthy**: Service not operational, critical failures detected
- **down**: Service completely unavailable

**HTTP Status Codes:**

- **200 OK**: Service is healthy
- **503 Service Unavailable**: Service is unhealthy or not ready

**Latency Interpretation:**

- **< 50ms**: Excellent - optimal performance
- **50-200ms**: Good - acceptable performance
- **200-500ms**: Degraded - investigate potential issues
- **> 500ms**: Poor - likely performance bottleneck

### Automated Health Monitoring Scripts

**Create a health check script:**

Save as `scripts/health-check.sh`:
```bash
#!/bin/bash

# Health Check Script for Friendly AI AEP

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Friendly AI AEP Health Check"
echo "========================================"
echo ""

# Function to check HTTP endpoint
check_http() {
  local name=$1
  local url=$2
  local expected_code=${3:-200}

  echo -n "Checking $name... "

  if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
    if [ "$response" -eq "$expected_code" ] || [ "$response" -eq 204 ]; then
      echo -e "${GREEN}✓ Healthy${NC} (HTTP $response)"
      return 0
    else
      echo -e "${YELLOW}⚠ Degraded${NC} (HTTP $response)"
      return 1
    fi
  else
    echo -e "${RED}✗ Down${NC}"
    return 2
  fi
}

# Function to check Docker container
check_docker() {
  local name=$1
  local container=$2

  echo -n "Checking $name... "

  if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
    health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
    if [ "$health" = "healthy" ] || [ "$health" = "no-healthcheck" ]; then
      echo -e "${GREEN}✓ Running${NC}"
      return 0
    else
      echo -e "${YELLOW}⚠ Unhealthy${NC} (Docker: $health)"
      return 1
    fi
  else
    echo -e "${RED}✗ Not Running${NC}"
    return 2
  fi
}

# Check Docker services
echo "--- Infrastructure Services ---"
check_docker "PostgreSQL" "friendly-aep-postgres"
check_docker "Redis" "friendly-aep-redis"
check_docker "InfluxDB" "friendly-aep-influxdb"
check_docker "Grafana" "friendly-aep-grafana"
check_docker "Telegraf" "friendly-aep-telegraf"
check_docker "MinIO" "friendly-aep-minio"

echo ""
echo "--- Application Services ---"
check_http "API Gateway" "http://localhost:46000/health"
check_http "API Gateway Ready" "http://localhost:46000/health/ready"
check_http "Preview Host" "http://localhost:46001/"
check_http "Builder UI" "http://localhost:45000/" 200

echo ""
echo "--- Monitoring Services ---"
check_http "Grafana" "http://localhost:45001/api/health"
check_http "InfluxDB" "http://localhost:46101/ping" 204
check_http "MinIO Health" "http://localhost:46200/minio/health/live"

echo ""
echo "========================================"
echo "  Health Check Complete"
echo "========================================"
```

**Make it executable:**
```bash
chmod +x scripts/health-check.sh
```

**Run the health check:**
```bash
./scripts/health-check.sh
```

**Automated monitoring with watch:**
```bash
# Run health check every 10 seconds
watch -n 10 ./scripts/health-check.sh
```

**Continuous monitoring script:**

Save as `scripts/monitor.sh`:
```bash
#!/bin/bash

# Continuous Health Monitor with Alerts

WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"  # Set this for Slack/Discord alerts
CHECK_INTERVAL=30  # seconds

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  # Check API Gateway
  if ! curl -s http://localhost:46000/health > /dev/null; then
    alert="[$timestamp] ALERT: API Gateway is down!"
    echo "$alert"
    [ -n "$WEBHOOK_URL" ] && curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$alert\"}" "$WEBHOOK_URL"
  fi

  # Check critical services
  for service in postgres redis influxdb; do
    if ! docker ps | grep -q "friendly-aep-$service"; then
      alert="[$timestamp] ALERT: $service container is not running!"
      echo "$alert"
      [ -n "$WEBHOOK_URL" ] && curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$alert\"}" "$WEBHOOK_URL"
    fi
  done

  sleep $CHECK_INTERVAL
done
```

**Run in background:**
```bash
chmod +x scripts/monitor.sh
nohup ./scripts/monitor.sh > monitoring.log 2>&1 &
```

---

## Troubleshooting by Environment

### Development Environment Issues

#### Issue: Port Already in Use

**Symptoms:**
```
Error: EADDRINUSE: address already in use 127.0.0.1:46000
```

**Solutions:**

Check what's using the port:
```bash
# Linux/WSL
lsof -i :46000

# Windows
netstat -ano | findstr :46000

# macOS
lsof -i :46000
```

Kill the process:
```bash
# Linux/WSL/macOS
kill -9 $(lsof -t -i:46000)

# Windows (get PID from netstat)
taskkill /PID <PID> /F
```

Or change the port in `.env`:
```env
AEP_API_GATEWAY_PORT=3011
```

#### Issue: Docker Services Won't Start

**Symptoms:**
```
Error: unable to get image: failed to connect to docker API
```

**Solutions:**

1. Check Docker Desktop is running:
```bash
docker ps
```

2. Restart Docker Desktop completely

3. Check disk space:
```bash
docker system df
```

4. Clean up if needed:
```bash
# Remove unused containers, images, networks
docker system prune -a

# Remove volumes (WARNING: deletes data)
docker volume prune
```

5. Reset Docker environment:
```bash
docker compose -f docker/docker-compose.dev.yml down -v
docker compose -f docker/docker-compose.dev.yml up -d
```

#### Issue: Build Failures

**Symptoms:**
```
Error: (0, native_1.isAiAgent) is not a function
```

**Solutions:**

1. Clear Nx cache:
```bash
pnpm nx reset
```

2. Clean install dependencies:
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

3. Rebuild all projects:
```bash
pnpm nx run-many -t build --skip-nx-cache
```

4. Check Node.js version:
```bash
node --version  # Should be 20.x or higher
```

#### Issue: Hot Reload Not Working

**Symptoms:**
- Changes to code don't reflect in browser
- Need to restart server to see changes

**Solutions:**

1. Check watch mode is enabled in `.env`:
```env
WATCH_MODE=true
```

2. Verify file watcher limits (Linux):
```bash
# Check current limit
cat /proc/sys/fs/inotify/max_user_watches

# Increase if needed
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

3. Restart with explicit watch flag:
```bash
pnpm nx serve aep-api-gateway --watch
```

#### Issue: WebSocket Connection Fails

**Symptoms:**
```
Error: fastify-plugin: Plugin did not start in time
WebSocket connection to 'ws://localhost:46000/api/v1/agent/stream' failed
```

**Solutions:**

1. Check Redis is running:
```bash
docker ps | grep redis
docker logs friendly-aep-redis
```

2. Verify Redis connection in `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:46102
```

3. Test Redis connectivity:
```bash
docker exec -it friendly-aep-redis redis-cli ping
```

4. Increase plugin timeout (if needed):
Edit `apps/aep-api-gateway/src/main.ts` and increase timeout value.

### Test Environment Issues

#### Issue: Tests Timing Out

**Symptoms:**
```
Error: Test exceeded timeout of 5000ms
```

**Solutions:**

1. Increase test timeout:
```javascript
// In test file
test('my test', { timeout: 10000 }, async () => {
  // test code
});
```

2. Use `--testTimeout` flag:
```bash
pnpm nx test aep-api-gateway --testTimeout=10000
```

3. Check for hanging promises or missing `await`:
```javascript
// Bad
test('bad test', () => {
  someAsyncFunction();  // Missing await!
});

// Good
test('good test', async () => {
  await someAsyncFunction();
});
```

#### Issue: Database Connection Errors in Tests

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:46100
```

**Solutions:**

1. Ensure test database is running:
```bash
docker compose -f docker/docker-compose.dev.yml up -d postgres
```

2. Use test database URL:
```env
# In .env.test
DATABASE_URL=postgresql://friendly:friendly_dev_password@localhost:46100/friendly_aep_test
```

3. Run database migrations before tests:
```bash
pnpm nx run prisma-schema:migrate-dev
```

4. Reset database between test runs:
```bash
pnpm nx run prisma-schema:reset
```

#### Issue: Flaky Tests

**Symptoms:**
- Tests pass sometimes, fail others
- Different results on different runs

**Solutions:**

1. Ensure proper test isolation:
```javascript
beforeEach(async () => {
  // Clean up state
  await cleanupDatabase();
});

afterEach(async () => {
  // Reset state
  await resetMocks();
});
```

2. Avoid time-dependent tests:
```javascript
// Bad
expect(createdAt).toBe(new Date());  // May fail due to timing

// Good
expect(createdAt).toBeInstanceOf(Date);
expect(Date.now() - createdAt.getTime()).toBeLessThan(1000);
```

3. Use deterministic data:
```javascript
// Bad
const id = Math.random().toString();  // Non-deterministic

// Good
const id = 'test-id-123';  // Deterministic
```

### Pre-Production Environment Issues

#### Issue: SSL/TLS Certificate Errors

**Symptoms:**
```
Error: self signed certificate in certificate chain
```

**Solutions:**

1. Use valid SSL certificates (Let's Encrypt):
```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d api.yourdomain.com
```

2. Configure SSL in docker-compose:
```yaml
environment:
  SSL_CERT_PATH: /certs/cert.pem
  SSL_KEY_PATH: /certs/key.pem
volumes:
  - /etc/letsencrypt/live/yourdomain.com:/certs:ro
```

3. For testing, temporarily disable SSL verification (NOT for production):
```env
NODE_TLS_REJECT_UNAUTHORIZED=0  # Only for testing!
```

#### Issue: Performance Degradation

**Symptoms:**
- Slow response times
- High latency
- Timeouts

**Solutions:**

1. Check resource usage:
```bash
docker stats
```

2. Review database query performance:
```bash
# Enable slow query log in PostgreSQL
docker exec -it friendly-aep-postgres psql -U friendly -d friendly_aep -c "
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();
"
```

3. Analyze slow queries:
```bash
docker logs friendly-aep-postgres | grep "duration:"
```

4. Optimize database indexes:
```sql
-- Check missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE n_distinct > 100 AND correlation < 0.5;
```

5. Enable Redis caching:
```env
REDIS_CACHE_ENABLED=true
CACHE_TTL=3600
```

6. Increase container resources:
```yaml
# In docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
```

#### Issue: Authentication Failures

**Symptoms:**
```
Error: Invalid or expired token
401 Unauthorized
```

**Solutions:**

1. Check JWT secret consistency:
```bash
# Ensure JWT_SECRET is set and same across all services
echo $JWT_SECRET
```

2. Verify token expiration:
```env
JWT_EXPIRATION=24h  # Increase if needed
```

3. Check system clock synchronization:
```bash
# Sync time (Linux)
sudo ntpdate -s time.nist.gov

# Or use systemd-timesyncd
sudo systemctl enable systemd-timesyncd
sudo systemctl start systemd-timesyncd
```

4. Debug token validation:
```javascript
// Add logging to auth middleware
console.log('Token:', token);
console.log('Decoded:', jwt.decode(token));
```

### Production Environment Issues

#### Issue: Service Crashes

**Symptoms:**
- Container repeatedly restarting
- Exit code 1 or 137

**Solutions:**

1. Check container logs:
```bash
docker logs --tail 100 friendly-aep-api-gateway
```

2. Inspect exit reason:
```bash
docker inspect friendly-aep-api-gateway | grep -A 10 "State"
```

3. Common exit codes:
   - **Exit 0**: Clean exit (normal)
   - **Exit 1**: Application error (check logs)
   - **Exit 137**: OOM killed (increase memory)
   - **Exit 143**: SIGTERM received (graceful shutdown)

4. Increase memory if OOM:
```yaml
# In docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 2G  # Increase from 1G
```

5. Enable automatic restart:
```yaml
restart: always
```

6. Implement graceful shutdown:
```javascript
// In main.ts
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully');
  await app.close();
  process.exit(0);
});
```

#### Issue: Database Connection Pool Exhausted

**Symptoms:**
```
Error: Timeout acquiring connection from pool
```

**Solutions:**

1. Increase connection pool size:
```env
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
```

2. Reduce connection timeout:
```env
DATABASE_CONNECT_TIMEOUT=10000
```

3. Check for connection leaks:
```javascript
// Ensure connections are released
try {
  const result = await prisma.query();
  return result;
} finally {
  await prisma.$disconnect();
}
```

4. Monitor active connections:
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'friendly_aep';
```

5. Kill idle connections:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'friendly_aep'
  AND state = 'idle'
  AND state_change < now() - interval '10 minutes';
```

#### Issue: High Memory Usage

**Symptoms:**
- Container using >80% of allocated memory
- Slow performance
- OOM kills

**Solutions:**

1. Monitor memory usage:
```bash
docker stats --no-stream | sort -k 4 -h
```

2. Check for memory leaks:
```bash
# Enable Node.js heap snapshots
NODE_OPTIONS="--max-old-space-size=2048 --heapsnapshot-signal=SIGUSR2"

# Trigger snapshot
kill -USR2 <PID>

# Analyze with Chrome DevTools
```

3. Optimize Node.js memory:
```env
NODE_OPTIONS="--max-old-space-size=1536 --max-semi-space-size=64"
```

4. Review cache strategy:
```env
# Limit cache size
REDIS_MAX_MEMORY=512mb
REDIS_MAX_MEMORY_POLICY=allkeys-lru
```

5. Check for large payloads:
```javascript
// Add size limits
app.use(express.json({ limit: '10mb' }));
```

#### Issue: Monitoring/Alerting Not Working

**Symptoms:**
- No alerts received
- Grafana dashboards empty
- Missing metrics

**Solutions:**

1. Verify Telegraf is sending data:
```bash
docker logs friendly-aep-telegraf | grep -i error
```

2. Check InfluxDB data ingestion:
```bash
curl http://localhost:46101/api/v2/query \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/vnd.flux" \
  -d 'from(bucket: "iot_data") |> range(start: -1h) |> limit(n: 10)'
```

3. Verify Grafana data sources:
```bash
# Log into Grafana UI
# Configuration > Data Sources > Test
```

4. Check alert notification channels:
```bash
# Grafana > Alerting > Notification Channels > Test
```

5. Review Telegraf configuration:
```bash
docker exec friendly-aep-telegraf telegraf config
```

### Monitoring for Issues in Each Environment

**Development:**
```bash
# Watch logs continuously
docker compose -f docker/docker-compose.dev.yml logs -f

# Monitor resource usage
watch docker stats

# Check health every 30s
watch -n 30 'curl -s http://localhost:46000/health | jq'
```

**Test:**
```bash
# Run health checks before tests
./scripts/health-check.sh && pnpm nx run-many -t test

# Monitor test execution
pnpm nx run-many -t test --verbose
```

**Pre-Production:**
```bash
# Continuous health monitoring
./scripts/monitor.sh &

# Performance testing
wrk -t12 -c400 -d30s http://localhost:46000/health

# Load testing
k6 run load-test.js
```

**Production:**
```bash
# Set up log aggregation (ELK, Datadog, etc.)
# Configure Grafana alerts
# Enable APM (Application Performance Monitoring)
# Set up uptime monitoring (UptimeRobot, Pingdom)
```

---

## API Reference

### Authentication Endpoints

**POST /api/v1/auth/login**
```bash
curl -X POST http://localhost:46000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo"}'
```

### Project Management

**GET /api/v1/projects** - List all projects
```bash
curl http://localhost:46000/api/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**POST /api/v1/projects** - Create a new project
```bash
curl -X POST http://localhost:46000/api/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "description": "Project description"}'
```

**GET /api/v1/projects/:id** - Get project details
```bash
curl http://localhost:46000/api/v1/projects/proj_123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Preview Management

**POST /api/v1/projects/:id/preview** - Launch preview
```bash
curl -X POST http://localhost:46000/api/v1/projects/proj_123/preview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "mock", "hotReload": true}'
```

**GET /api/v1/projects/:id/preview/status** - Check preview status
```bash
curl http://localhost:46000/api/v1/projects/proj_123/preview/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### WebSocket Agent Stream

**WS /api/v1/agent/stream**
```bash
wscat -c "ws://localhost:46000/api/v1/agent/stream?sessionId=SESSION_ID&token=YOUR_TOKEN"
```

**Message Types:**
- prompt - Send user prompt to agent
- agent_thinking - Agent is processing
- agent_tool_call - Agent is calling a tool
- agent_response - Agent response chunk
- build_progress - Build progress update
- preview_update - Preview URL updated
- error - Error occurred
- complete - Operation complete

### Health & Status

**GET /health** - Service health check
```bash
curl http://localhost:46000/health
```

**GET /health/ready** - Readiness probe
```bash
curl http://localhost:46000/health/ready
```

**GET /health/live** - Liveness probe
```bash
curl http://localhost:46000/health/live
```

### Billing & Usage

**GET /api/v1/billing/usage** - Get current billing usage
```bash
curl http://localhost:46000/api/v1/billing/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### License Validation

**GET /api/v1/license/validate** - Validate license
```bash
curl http://localhost:46000/api/v1/license/validate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Service Credentials

### Development Environment

#### Grafana (http://localhost:45001)
- **Username**: admin
- **Password**: friendly_grafana_dev

#### MinIO Console (http://localhost:45003)
- **Access Key**: friendly
- **Secret Key**: friendly_minio_dev

#### InfluxDB (http://localhost:46101)
- **Username**: admin
- **Password**: friendly_influx_dev
- **Organization**: friendly
- **Bucket**: iot_data
- **Token**: friendly-dev-token-12345

#### PostgreSQL (localhost:46100)
- **Host**: localhost
- **Port**: 5432
- **User**: friendly
- **Password**: friendly_dev_password
- **Database**: friendly_aep
- **Connection String**: `postgresql://friendly:friendly_dev_password@localhost:46100/friendly_aep`

#### Redis (localhost:46102)
- **Host**: localhost
- **Port**: 6379
- **Password**: (none)
- **Database**: 0
- **Connection String**: `redis://localhost:46102`

#### API Gateway Demo User
- **Username**: demo
- **Password**: demo
- **Tenant**: tenant_001
- **Role**: admin

### Production Environment

> **Security Warning**: Never use development credentials in production! All production credentials should be:
> - Randomly generated with high entropy
> - Stored in a secure secrets management system (HashiCorp Vault, AWS Secrets Manager, etc.)
> - Rotated regularly
> - Never committed to version control

**Production Credential Requirements:**
- Minimum 32 characters for secrets
- Mix of uppercase, lowercase, numbers, and special characters
- Unique for each environment
- Encrypted at rest
- Access logged and audited

---

## Available Dashboard Widgets

The Widget Registry provides these components for building dashboards:

### Charts
- **Line Chart** - Time-series data visualization
- **Bar Chart** - Categorical comparisons
- **Pie Chart** - Distribution percentages
- **Donut Chart** - Distribution with center content
- **Area Chart** - Cumulative trends
- **Scatter Plot** - Correlation analysis

### Data Display
- **Data Table** - Sortable, filterable tables
- **KPI Card** - Key metric displays
- **Gauge** - Real-time value indicators
- **Progress Bar** - Completion status
- **Stat Panel** - Single value with trend

### Geo & Maps
- **Map** - Geographic visualization
- **Heatmap** - Density visualization

### Alerts & Status
- **Alert Panel** - Status notifications
- **Status Indicator** - Health status
- **Timeline** - Event chronology

### Controls
- **Filter Panel** - Data filtering
- **Date Range Picker** - Time selection
- **Refresh Button** - Data reload

---

## Quick Reference

### One-Liner Commands

**Start Everything:**
```bash
docker compose -f docker/docker-compose.dev.yml up -d && pnpm nx serve aep-api-gateway & pnpm nx serve aep-builder & pnpm nx serve aep-preview-host
```

**Stop Everything:**
```bash
docker compose -f docker/docker-compose.dev.yml down && pkill -f "nx serve"
```

**Health Check All Services:**
```bash
./scripts/health-check.sh
```

**View All Logs:**
```bash
docker compose -f docker/docker-compose.dev.yml logs -f
```

**Rebuild Everything:**
```bash
pnpm nx reset && pnpm install && pnpm nx run-many -t build
```

**Database Reset:**
```bash
docker compose -f docker/docker-compose.dev.yml restart postgres && pnpm nx run prisma-schema:reset
```

**Clear All Docker Data (CAUTION):**
```bash
docker compose -f docker/docker-compose.dev.yml down -v && docker system prune -af
```

**Run Tests:**
```bash
pnpm nx run-many -t test
```

**Production Build:**
```bash
pnpm nx run-many -t build --configuration=production
```

**View Dependency Graph:**
```bash
pnpm nx graph
```

### Port Reference Table

| Service | Port(s) | Protocol | Purpose |
|---------|---------|----------|---------|
| **API Gateway** | 3001 | HTTP/WS | Main API endpoint |
| **Builder UI** | 4200 | HTTP | Angular frontend |
| **Preview Host** | 3002 | HTTP | Preview runtime |
| **Grafana** | 3000 | HTTP | Monitoring UI |
| **PostgreSQL** | 5432 | TCP | Database |
| **Redis** | 6379 | TCP | Cache/Sessions |
| **InfluxDB** | 8086 | HTTP | Time-series DB |
| **Telegraf StatsD** | 8125 | UDP | Metrics ingestion |
| **Telegraf UDP** | 8092 | UDP | IoT telemetry |
| **Telegraf HTTP** | 8094 | HTTP | Webhooks |
| **MinIO API** | 9000 | HTTP | S3-compatible storage |
| **MinIO Console** | 9001 | HTTP | Storage admin UI |
| **Debug (API)** | 9229 | TCP | Node.js debugger |
| **Debug (Preview)** | 9230 | TCP | Node.js debugger |
| **Preview Apps** | 4300-4399 | HTTP | Dynamic preview instances |

### Credentials Quick Reference

```bash
# Grafana
Username: admin
Password: friendly_grafana_dev
URL: http://localhost:45001

# InfluxDB
Username: admin
Password: friendly_influx_dev
Token: friendly-dev-token-12345
URL: http://localhost:46101

# MinIO
Access Key: friendly
Secret Key: friendly_minio_dev
URL: http://localhost:45003

# PostgreSQL
Connection: postgresql://friendly:friendly_dev_password@localhost:46100/friendly_aep

# Redis
Connection: redis://localhost:46102

# API Demo User
Username: demo
Password: demo
```

### Important URLs

**Development:**
```
Builder UI:        http://localhost:45000
API Gateway:       http://localhost:46000
API Docs:          http://localhost:46000/docs
Preview Host:      http://localhost:46001
Grafana:           http://localhost:45001
InfluxDB:          http://localhost:46101
MinIO Console:     http://localhost:45003
```

**Docker Management:**
```bash
# Start all services
docker compose -f docker/docker-compose.dev.yml up -d

# Stop all services
docker compose -f docker/docker-compose.dev.yml down

# View status
docker compose -f docker/docker-compose.dev.yml ps

# View logs
docker compose -f docker/docker-compose.dev.yml logs -f [service_name]

# Restart service
docker compose -f docker/docker-compose.dev.yml restart [service_name]
```

**Nx Commands:**
```bash
# Serve
pnpm nx serve [app-name]

# Build
pnpm nx build [app-name]

# Test
pnpm nx test [app-name]

# Lint
pnpm nx lint [app-name]

# Run target for all projects
pnpm nx run-many -t [target]

# Run target for affected projects
pnpm nx affected -t [target]

# View dependency graph
pnpm nx graph

# Reset cache
pnpm nx reset
```

**Debugging:**
```bash
# Enable debug logging
LOG_LEVEL=debug pnpm nx serve aep-api-gateway

# Start with debugger
NODE_OPTIONS='--inspect=9229' pnpm nx serve aep-api-gateway

# View logs
docker logs -f [container-name]

# Shell into container
docker exec -it [container-name] /bin/sh

# Database CLI
docker exec -it friendly-aep-postgres psql -U friendly -d friendly_aep

# Redis CLI
docker exec -it friendly-aep-redis redis-cli

# InfluxDB CLI
docker exec -it friendly-aep-influxdb influx
```

---

## Next Steps

1. **Configure Anthropic API Key** in .env to enable AI features
2. **Explore the API** via Swagger UI at http://localhost:46000/docs
3. **Create your first project** using the API
4. **Set up monitoring** via Grafana at http://localhost:45001
5. **Configure alerting** for critical services
6. **Review security settings** before deploying to production
7. **Read the architecture docs** in the codebase for deeper understanding

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Builder UI      │  │  Preview Host    │  │  Grafana      │ │
│  │  (Angular 21)    │  │  (Express)       │  │  (Monitoring) │ │
│  │  Port: 4200      │  │  Port: 3002      │  │  Port: 3000   │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Gateway (Fastify 5.x) - Port 3001                   │   │
│  │  • JWT Authentication  • Rate Limiting  • WebSocket      │   │
│  │  • Multi-Tenant Support  • Swagger Docs                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Agent        │  │ Builder      │  │ IoT Integration    │   │
│  │ Runtime      │  │ Orchestrator │  │ Services           │   │
│  │ (LangGraph)  │  │              │  │                    │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Project      │  │ Billing      │  │ License            │   │
│  │ Registry     │  │ Service      │  │ Service            │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ PostgreSQL   │  │ InfluxDB     │  │ Redis              │   │
│  │ (Port 5432)  │  │ (Port 8086)  │  │ (Port 6379)        │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ MinIO        │  │ Telegraf     │                            │
│  │ (Port 9000)  │  │ (8125/8094)  │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Support & Resources

- **Swagger API Docs**: http://localhost:46000/docs
- **Project Repository**: Check your Git remote
- **Claude AI Documentation**: https://docs.anthropic.com/
- **Nx Documentation**: https://nx.dev/
- **Angular Documentation**: https://angular.dev/
- **Fastify Documentation**: https://fastify.dev/
- **Docker Documentation**: https://docs.docker.com/

---

**Happy Building!**

Built with ❤️ by Friendly Technology
