# Friendly-AIAEP System Architecture & Workflow Diagrams

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FRIENDLY-AIAEP PLATFORM                                   │
│                    AI-Powered IoT Application Builder                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENT LAYER                                        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌────────────────────────────────────┐      ┌──────────────────────────────────┐  │
│  │     aep-builder (Angular 17+)      │      │   Generated IoT Apps (Preview)   │  │
│  │  Visual Drag & Drop Builder UI     │      │   User-Created Applications      │  │
│  │  • Project Management              │      │   • Device Dashboards            │  │
│  │  • Page Composer                   │      │   • Fleet Management             │  │
│  │  • Widget Library                  │      │   • Real-time Telemetry          │  │
│  │  • AI Chat Interface               │      │   • Alert Management             │  │
│  │  • Live Preview                    │      │   • Custom IoT Workflows         │  │
│  │  Port: 4200                        │      │   Port: 3002                     │  │
│  └────────────┬───────────────────────┘      └──────────────┬───────────────────┘  │
│               │                                               │                      │
└───────────────┼───────────────────────────────────────────────┼──────────────────────┘
                │                                               │
                │ HTTP/REST + WebSocket                         │ HTTP
                │                                               │
┌───────────────▼───────────────────────────────────────────────▼──────────────────────┐
│                               API GATEWAY LAYER                                      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                    aep-api-gateway (Fastify)                                 │  │
│  │  Unified API Entry Point - Port: 3001                                       │  │
│  │                                                                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ Auth Layer   │  │ Rate Limiter │  │   CORS &     │  │  OpenAPI     │   │  │
│  │  │ • JWT        │  │ • Tier-based │  │   Security   │  │  /docs       │   │  │
│  │  │ • OAuth2     │  │ • Redis      │  │ • Helmet     │  │  Swagger UI  │   │  │
│  │  │ • API Keys   │  │ • 100-2000/m │  │              │  │              │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                                              │  │
│  │  Routes:                                                                     │  │
│  │  • /api/v1/auth/*          - Authentication & Token Management              │  │
│  │  • /api/v1/projects/*      - Project CRUD Operations                        │  │
│  │  • /api/v1/agent/stream    - AI Agent WebSocket Streaming                   │  │
│  │  • /api/v1/license/*       - License Validation                             │  │
│  │  • /api/v1/billing/*       - Usage & Billing                                │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
┌───────────────────▼──────┐  ┌───────────▼──────────┐  ┌────────▼──────────────────┐
│   CORE SERVICES LAYER    │  │  BUILDER SERVICES    │  │   IoT SERVICES LAYER      │
├──────────────────────────┤  ├──────────────────────┤  ├───────────────────────────┤
│                          │  │                      │  │                           │
│ ┌──────────────────────┐ │  │ ┌──────────────────┐ │  │ ┌───────────────────────┐ │
│ │  agent-runtime       │ │  │ │ page-composer    │ │  │ │ swagger-ingestion     │ │
│ │  LangGraph Agents    │ │  │ │ Layout Engine    │ │  │ │ OpenAPI Parser        │ │
│ │  • Supervisor        │ │  │ └──────────────────┘ │  │ │ • Multi-source        │ │
│ │  • Planning          │ │  │                      │  │ │ • Auth support        │ │
│ │  • IoT Domain        │ │  │ ┌──────────────────┐ │  │ │ • Change detection    │ │
│ │                      │ │  │ │ widget-registry  │ │  │ └───────────────────────┘ │
│ └──────────────────────┘ │  │ │ Component Lib    │ │  │                           │
│                          │  │ └──────────────────┘ │  │ ┌───────────────────────┐ │
│ ┌──────────────────────┐ │  │                      │  │ │ iot-tool-functions    │ │
│ │  llm-providers       │ │  │ ┌──────────────────┐ │  │ │ LangGraph IoT Tools   │ │
│ │  LLM Integration     │ │  │ │ codegen          │ │  │ │ • GetDeviceList       │ │
│ │  • Anthropic Claude  │ │  │ │ Code Generation  │ │  │ │ • GetDeviceDetails    │ │
│ │  • Ollama           │ │  │ │ • TypeScript     │ │  │ │ • GetTelemetry        │ │
│ │  • 13 Agent Roles    │ │  │ │ • Angular        │ │  │ │ • RegisterWebhook     │ │
│ │  • Token tracking    │ │  │ └──────────────────┘ │  │ │ • GetKPIMetrics       │ │
│ └──────────────────────┘ │  │                      │  │ └───────────────────────┘ │
│                          │  │ ┌──────────────────┐ │  │                           │
│ ┌──────────────────────┐ │  │ │ preview-runtime  │ │  │ ┌───────────────────────┐ │
│ │ project-registry     │ │  │ │ Live Preview     │ │  │ │ sdk-generator         │ │
│ │ Project Management   │ │  │ │ Docker Host      │ │  │ │ API Client Gen        │ │
│ └──────────────────────┘ │  │ └──────────────────┘ │  │ └───────────────────────┘ │
│                          │  │                      │  │                           │
│ ┌──────────────────────┐ │  │ ┌──────────────────┐ │  │ ┌───────────────────────┐ │
│ │ billing-service      │ │  │ │ publish-service  │ │  │ │ auth-adapter          │ │
│ │ Usage & Stripe       │ │  │ │ Deployment Prep  │ │  │ │ IoT Auth              │ │
│ └──────────────────────┘ │  │ └──────────────────┘ │  │ └───────────────────────┘ │
│                          │  │                      │  │                           │
│ ┌──────────────────────┐ │  │ ┌──────────────────┐ │  │ ┌───────────────────────┐ │
│ │ audit-service        │ │  │ │ git-service      │ │  │ │ mock-api-server       │ │
│ │ Compliance Logs      │ │  │ │ GitHub Integration│ │  │ │ Testing/Dev API       │ │
│ └──────────────────────┘ │  │ └──────────────────┘ │  │ └───────────────────────┘ │
│                          │  │                      │  │                           │
└──────────────────────────┘  └──────────────────────┘  └───────────────────────────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           │
┌──────────────────────────────────────────▼───────────────────────────────────────────┐
│                               DATA & STORAGE LAYER                                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │   PostgreSQL 16  │  │   InfluxDB 2.7   │  │     Redis 7      │  │   MinIO    │  │
│  │                  │  │                  │  │                  │  │            │  │
│  │ • 15 Core Models │  │ • Time-Series    │  │ • Sessions       │  │ • S3 API   │  │
│  │ • Prisma ORM     │  │ • IoT Telemetry  │  │ • Rate Limiting  │  │ • Artifacts│  │
│  │ • Multi-tenant   │  │ • Device Metrics │  │ • Token Cache    │  │ • Backups  │  │
│  │ • Audit Trail    │  │ • Telegraf       │  │ • Job Queue      │  │            │  │
│  │ • Billing Data   │  │   Ingestion      │  │                  │  │            │  │
│  │                  │  │                  │  │                  │  │            │  │
│  │ Models:          │  │ Measurements:    │  │ Keys:            │  │ Buckets:   │  │
│  │ • Tenant         │  │ • device_metrics │  │ • session:*      │  │ • projects │  │
│  │ • User           │  │ • telemetry      │  │ • ratelimit:*    │  │ • artifacts│  │
│  │ • Project        │  │ • events         │  │ • tokens:*       │  │ • backups  │  │
│  │ • Page           │  │ • kpi_metrics    │  │ • cache:iot:*    │  │            │  │
│  │ • Widget         │  │                  │  │                  │  │            │  │
│  │ • DataSource     │  │                  │  │                  │  │            │  │
│  │ • BillingSub     │  │                  │  │                  │  │            │  │
│  │ • AuditEvent     │  │                  │  │                  │  │            │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          MONITORING & VISUALIZATION LAYER                            │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                          Grafana 11.3 (Port: 3000)                           │  │
│  │                                                                              │  │
│  │  Data Sources:                      Dashboards:                             │  │
│  │  • PostgreSQL → App Metrics         • IoT Fleet Overview                    │  │
│  │  • InfluxDB → IoT Time-Series       • Device Telemetry                      │  │
│  │  • Prometheus → System Health       • LLM Usage & Costs                     │  │
│  │                                     • Billing & Usage                        │  │
│  │                                     • System Performance                     │  │
│  │                                     • API Gateway Metrics                    │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                        Telegraf 1.31 (IoT Ingest)                            │  │
│  │  • Collect device metrics from IoT APIs                                      │  │
│  │  • Write to InfluxDB time-series database                                    │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL INTEGRATIONS                                     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  UPSTREAM (AI/LLM):                    DOWNSTREAM (IoT):                            │
│  ┌─────────────────────────┐           ┌─────────────────────────────────┐         │
│  │ Anthropic API           │           │ Friendly One-IoT Platform       │         │
│  │ • Claude Opus 4.6       │           │ • Northbound API (devices)      │         │
│  │ • Claude Sonnet         │◄──────────┤ • Events API (streaming)        │         │
│  │ • Tool/Function calls   │  LLM      │ • QoE API (quality metrics)     │         │
│  └─────────────────────────┘  Requests │ • OpenAPI 3.0 specs             │         │
│                                        └─────────────────────────────────┘         │
│  ┌─────────────────────────┐                                                        │
│  │ Ollama (Self-hosted)    │           ┌─────────────────────────────────┐         │
│  │ • Local LLM fallback    │           │ Generic IoT APIs                │         │
│  │ • Cost optimization     │           │ • Swagger/OpenAPI 3.x           │         │
│  └─────────────────────────┘           │ • REST/WebSocket                │         │
│                                        │ • Multi-auth support            │         │
│  SERVICES:                             └─────────────────────────────────┘         │
│  ┌─────────────────────────┐                                                        │
│  │ GitHub                  │           STANDARDS:                                   │
│  │ • Git integration       │           • OpenAPI 3.x                                │
│  │ • Version control       │           • LwM2M (Lightweight M2M)                    │
│  │ • CI/CD triggers        │           • MQTT, CoAP                                 │
│  └─────────────────────────┘           • REST, WebSocket                            │
│                                                                                      │
│  ┌─────────────────────────┐                                                        │
│  │ Stripe                  │                                                        │
│  │ • Payment processing    │                                                        │
│  │ • Subscription mgmt     │                                                        │
│  └─────────────────────────┘                                                        │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              DEPLOYMENT LAYER                                        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                    Docker + Kubernetes Deployment                            │  │
│  │                                                                              │  │
│  │  docker-generator:              helm-generator:                             │  │
│  │  • Generate Dockerfiles         • Generate Helm charts                      │  │
│  │  • Multi-stage builds           • K8s manifests                             │  │
│  │  • Optimized images             • ConfigMaps, Secrets                       │  │
│  │                                 • Auto-scaling config                       │  │
│  │                                                                              │  │
│  │  Deployment Modes:                                                          │  │
│  │  1. Multi-Tenant SaaS    - Shared infrastructure, tenant isolation         │  │
│  │  2. Dedicated Instance   - On-premise/cloud, single customer               │  │
│  │  3. Hybrid               - Mixed deployment per tenant config              │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW DIAGRAM                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

USER REQUEST: "Build a dashboard showing real-time telemetry from 10,000 smart meters"
     │
     │ 1. HTTP POST /api/v1/projects/123/agent
     │    Authorization: Bearer <JWT>
     │    { "message": "Build a dashboard..." }
     ▼
┌─────────────────────────────────────┐
│    aep-api-gateway (Port: 3001)     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 1. Validate JWT               │  │──► Redis: Check token validity
│  │ 2. Check rate limit (tier)    │  │──► Redis: Increment request count
│  │ 3. Extract tenantId           │  │
│  └───────────────────────────────┘  │
│                                     │
│  Route to: agent-runtime service    │
└─────────────┬───────────────────────┘
              │
              │ 2. Forward request with context
              │    { tenantId, userId, message }
              ▼
┌─────────────────────────────────────┐
│     agent-runtime (LangGraph)       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Create StateGraph            │  │
│  │  Initial State:               │  │
│  │  {                            │  │
│  │    messages: [user_message],  │  │
│  │    next: "supervisor"         │  │
│  │  }                            │  │
│  └───────────────────────────────┘  │
│               │                     │
│               │ 3a. Load checkpoint │
│               ▼                     │
│  ┌───────────────────────────────┐  │
│  │  PostgreSQLSaver              │  │◄─── PostgreSQL: Load conversation state
│  │  Get previous conversation    │  │
│  └───────────────────────────────┘  │
│               │                     │
│               │ 3b. Initialize LLM  │
│               ▼                     │
│  ┌───────────────────────────────┐  │
│  │  llm-providers                │  │
│  │  Select: Claude Opus 4.6      │  │
│  │  Role: ORCHESTRATOR           │  │──► Anthropic API: Initialize session
│  └───────────────────────────────┘  │
│               │                     │
│               │ 4. Route to agents  │
│               ▼                     │
│  ┌───────────────────────────────┐  │
│  │  SUPERVISOR AGENT             │  │
│  │  Analyze: "IoT dashboard      │  │
│  │          + telemetry"         │  │
│  │  Decision: Route to           │  │
│  │    - Planning Agent           │  │──► Anthropic API: LLM call
│  │    - IoT Domain Agent         │  │     Track tokens, cost
│  └───────────┬───────────────────┘  │
│              │                      │
│              │ 5. Parallel execution│
│      ┌───────┴────────┐            │
│      ▼                ▼            │
│  ┌─────────┐    ┌──────────────┐   │
│  │PLANNING │    │ IOT DOMAIN   │   │
│  │ AGENT   │    │   AGENT      │   │
│  └────┬────┘    └──────┬───────┘   │
│       │                │            │
│       │                │ 6. Query IoT devices
│       │                ▼            │
│       │    ┌───────────────────────┐│
│       │    │ iot-tool-functions    ││
│       │    │ • GetDeviceListTool   ││
│       │    │   input: {            ││
│       │    │     filters: {        ││
│       │    │       type: "meter"   ││──► Check Redis cache (5min TTL)
│       │    │     },                ││     Cache miss? Call IoT API
│       │    │     limit: 10000      ││
│       │    │   }                   ││
│       │    │                       ││
│       │    │ • GetKPIMetricsTool   ││
│       │    │   input: {            ││
│       │    │     metrics: [        ││──► InfluxDB: Query time-series
│       │    │       "power",        ││     Last 24h aggregates
│       │    │       "voltage"       ││
│       │    │     ]                 ││
│       │    │   }                   ││
│       │    └───────┬───────────────┘│
│       │            │ Results:       │
│       │            │ devices: 10,234│
│       │            │ metrics: [...]  │
│       │            ▼                │
│       │    Return to IoT Agent      │
│       │            │                │
│       │            ▼                │
│       │    ┌──────────────────────┐ │
│       │    │ IOT DOMAIN AGENT     │ │
│       │    │ Analysis:            │ │
│       │    │ "Found 10,234 meters"│ │
│       │    │ "Key metrics: power, │ │──► Anthropic API: Analyze results
│       │    │  voltage, current"   │ │     Generate recommendations
│       │    │ "Recommend:          │ │
│       │    │  - Real-time chart   │ │
│       │    │  - Alert thresholds" │ │
│       │    └──────────────────────┘ │
│       │                             │
│       │ 7. Generate build plan      │
│       ▼                             │
│  ┌─────────────────────────────┐   │
│  │   PLANNING AGENT            │   │
│  │   Input: IoT analysis       │   │
│  │   Generate:                 │   │
│  │   {                         │   │──► Anthropic API: Generate structured plan
│  │     tasks: [                │   │     With dependencies
│  │       {                     │   │
│  │         id: "create-page",  │   │
│  │         type: "page",       │   │
│  │         dependencies: []    │   │
│  │       },                    │   │
│  │       {                     │   │
│  │         id: "add-chart",    │   │
│  │         type: "widget",     │   │
│  │         dependencies: [     │   │
│  │           "create-page"     │   │
│  │         ],                  │   │
│  │         config: {           │   │
│  │           type: "line",     │   │
│  │           metrics: ["power"]│   │
│  │         }                   │   │
│  │       }                     │   │
│  │     ]                       │   │
│  │   }                         │   │
│  └─────────────────────────────┘   │
│                │                   │
│                │ 8. Save state      │
│                ▼                   │
│  ┌─────────────────────────────┐   │
│  │  PostgreSQLSaver            │   │──► PostgreSQL: Save checkpoint
│  │  Checkpoint state           │   │     conversation_state table
│  └─────────────────────────────┘   │
│                │                   │
│                │ 9. Log usage       │
│                ▼                   │
│  ┌─────────────────────────────┐   │
│  │  billing-service            │   │──► PostgreSQL: BillingEvent
│  │  Track:                     │   │     {
│  │  • LLM tokens: 12,450       │   │       tenantId,
│  │  • Cost: $0.15              │   │       tokens: 12450,
│  │  • API calls: 3             │   │       cost: 0.15,
│  │  • Agent: supervisor        │   │       timestamp
│  └─────────────────────────────┘   │     }
│                │                   │
│                │ 10. Audit log      │
│                ▼                   │
│  ┌─────────────────────────────┐   │
│  │  audit-service              │   │──► PostgreSQL: AuditEvent
│  │  Log: AGENT_REQUEST         │   │     {
│  │       USER_ID_123           │   │       action: "AGENT_REQUEST",
│  │       SUCCESS               │   │       userId, tenantId,
│  └─────────────────────────────┘   │       metadata: {...}
│                                    │     }
└────────────┬───────────────────────┘
             │
             │ 11. Stream response via WebSocket
             │     ws://localhost:3001/api/v1/agent/stream
             ▼
┌─────────────────────────────────────┐
│  Client (aep-builder)               │
│                                     │
│  Receives stream events:            │
│  ┌───────────────────────────────┐  │
│  │ { type: "agent_thinking",     │  │  Display: "Analyzing requirements..."
│  │   agent: "supervisor" }       │  │
│  ├───────────────────────────────┤  │
│  │ { type: "agent_tool_call",    │  │  Display: "Querying 10,000 devices..."
│  │   tool: "GetDeviceListTool" } │  │
│  ├───────────────────────────────┤  │
│  │ { type: "tool_result",        │  │  Display: "Found 10,234 smart meters"
│  │   result: { devices: 10234 } }│  │
│  ├───────────────────────────────┤  │
│  │ { type: "build_plan",         │  │  Render build plan UI with:
│  │   plan: { tasks: [...] } }    │  │  • Task list (2 tasks)
│  │                               │  │  • Dependency graph
│  ├───────────────────────────────┤  │  • Execute buttons
│  │ { type: "completion",         │  │
│  │   message: "Plan ready" }     │  │  Display: "Build plan ready ✓"
│  └───────────────────────────────┘  │
│                                     │
│  User clicks: "Execute Build Plan"  │
└─────────────┬───────────────────────┘
              │
              │ 12. Execute build tasks
              │     POST /api/v1/projects/123/execute
              ▼
┌─────────────────────────────────────┐
│    Builder Services Orchestration   │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Task 1: create-page          │  │
│  │  Service: page-composer       │  │──► PostgreSQL: INSERT INTO Page
│  │  Create:                      │  │     { name: "Meter Dashboard",
│  │    Page "Meter Dashboard"     │  │       projectId: 123,
│  │                               │  │       layout: {...} }
│  └───────────┬───────────────────┘  │
│              │                      │
│              │ Dependencies met     │
│              ▼                      │
│  ┌───────────────────────────────┐  │
│  │  Task 2: add-chart            │  │
│  │  Service: widget-registry +   │  │
│  │           codegen             │  │
│  │                               │  │
│  │  1. Create widget instance    │  │──► PostgreSQL: INSERT INTO Widget
│  │     {                         │  │     { type: "line-chart",
│  │       type: "line-chart",     │  │       pageId: <page_id>,
│  │       dataSource: {           │  │       config: {...} }
│  │         query: "InfluxDB",    │  │
│  │         metrics: ["power"]    │  │
│  │       }                       │  │
│  │     }                         │  │
│  │                               │  │
│  │  2. Generate TypeScript code  │  │
│  │     - meter-dashboard.comp.ts │  │
│  │     - chart-widget.service.ts │  │──► codegen: LLM-based generation
│  │     - influx.datasource.ts    │  │     Store in project metadata
│  │                               │  │
│  │  3. Generate Angular template │  │
│  │     - meter-dashboard.html    │  │
│  │     - Bind to InfluxDB query  │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────┬───────────────────────┘
              │
              │ 13. User requests preview
              │     POST /api/v1/projects/123/preview
              ▼
┌─────────────────────────────────────┐
│     preview-runtime (Port: 3002)    │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  1. Fetch project from DB     │  │──► PostgreSQL: SELECT * FROM Project
│  │  2. Compile generated code    │  │     WHERE id = 123
│  │  3. Create Docker container   │  │
│  │     - Base: node:20-alpine    │  │
│  │     - Install Angular CLI     │  │──► Docker: docker run -d -p 3002:4200
│  │     - Build & serve           │  │
│  │  4. Proxy to :3002            │  │
│  └───────────────────────────────┘  │
│                                     │
│  Preview URL: http://localhost:3002 │
└─────────────┬───────────────────────┘
              │
              │ 14. User views preview
              ▼
┌─────────────────────────────────────┐
│   Generated IoT App (Browser)       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Meter Dashboard Page         │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Line Chart Widget       │  │  │
│  │  │ Query InfluxDB:         │  │  │──► InfluxDB: SELECT mean(power)
│  │  │   SELECT mean(power)    │  │  │     FROM telemetry
│  │  │   FROM telemetry        │  │  │     WHERE device_type='meter'
│  │  │   WHERE time > now()-24h│  │  │     GROUP BY time(1h)
│  │  │   GROUP BY time(1h)     │  │  │
│  │  │                         │  │  │
│  │  │ Result: Real-time chart │  │  │  Render: Chart.js / D3.js
│  │  │ 10,234 meters plotted   │  │  │  Updates every 5s (WebSocket)
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘

USER APPROVES → PUBLISH

              │ 15. Publish project
              │     POST /api/v1/projects/123/publish
              ▼
┌─────────────────────────────────────┐
│      publish-service                │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  1. git-service               │  │──► GitHub: git commit & push
│  │     Commit to repo            │  │     Repo: tenant-123/meter-dashboard
│  │                               │  │
│  │  2. docker-generator          │  │──► Generate Dockerfile
│  │     Create production Docker  │  │     Multi-stage build
│  │                               │  │
│  │  3. helm-generator            │  │──► Generate Helm charts
│  │     Create K8s manifests      │  │     ConfigMaps, Secrets, Deployments
│  │                               │  │
│  │  4. Store artifacts           │  │──► MinIO: Upload tar.gz
│  │     Upload to MinIO           │  │     Bucket: tenant-123-artifacts
│  │                               │  │
│  │  5. Trigger CI/CD             │  │──► GitHub Actions: Deploy pipeline
│  │     Deploy to production      │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘

DEPLOYED → MONITORING

              │ 16. Monitor in production
              ▼
┌─────────────────────────────────────┐
│        Grafana (Port: 3000)         │
│                                     │
│  Dashboards:                        │
│  • Meter Dashboard Performance      │──► InfluxDB: App metrics
│  • User Activity                    │──► PostgreSQL: User sessions
│  • LLM Usage & Costs                │──► PostgreSQL: BillingEvents
│  • IoT Device Health                │──► InfluxDB: Device telemetry
│  • System Resources                 │──► Prometheus: K8s metrics
│                                     │
└─────────────────────────────────────┘
```

