# Friendly AI AEP Tool — Phase 1 Development Prompt Playbook

**13 Ordered Prompts for Claude Code / Theia IDE**

Version 1.0 | April 2026 | Classification: Internal Engineering — Confidential

---

## 1. How to use this playbook

This document contains 13 ordered development prompts designed to be used with Claude Code in your Theia IDE, or pasted into Claude.ai for planning-mode sessions. Execute them in sequence — each prompt builds on the output of the previous ones.

> Before starting, ensure these reference documents are available in your Claude Code project context: (1) System Specification v2.2 and (2) Module Reference v2.2. Add them to your project's `/docs` folder or upload them as context in Claude.ai.

### 1.1 Environment prerequisites

- Node.js 20 LTS installed
- npm / pnpm available
- Docker Desktop running (for preview runtime)
- GitHub repository created: `github.com/friendly-technologies/friendly-ai-aep-tool`
- Anthropic API key available (for agent runtime testing)
- Friendly One-IoT DM demo credentials available (UID/PW for three APIs)

### 1.2 Execution order

| # | Prompt | Sprint | Dependencies | Est. Time |
|---|--------|--------|-------------|-----------|
| P01 | Nx monorepo scaffold | Week 1 | None (foundational) | 2–3 hours |
| P02 | Prisma schema + database | Week 1 | P01 | 1–2 hours |
| P03 | LLM providers module | Week 2 | P01 | 2–3 hours |
| P04 | Auth adapter | Week 2 | P01, P02 | 2–3 hours |
| P05 | Swagger ingestion (3 APIs) | Week 2–3 | P01, P04 | 3–4 hours |
| P06 | SDK generator (3 services) | Week 3 | P05 | 2–3 hours |
| P07 | IoT tool functions (5 core) | Week 3–4 | P06, P04 | 3–4 hours |
| P08 | API gateway | Week 4 | P02, P03, P04 | 3–4 hours |
| P09 | Agent runtime (LangGraph) | Week 5–6 | P03, P07, P08 | 5–8 hours |
| P10 | Angular builder shell | Week 6–8 | P08 | 6–8 hours |
| P11 | License service MVP | Week 8–9 | P02 | 3–4 hours |
| P12 | Docker stack generator | Week 9–10 | P11 | 3–4 hours |
| P13 | Preview runtime MVP | Week 10–12 | P10, P07, P12 | 4–6 hours |

---

## P01 — Nx monorepo scaffold

**Goal:** Create the full 35-module Nx workspace with TypeScript strict, path aliases, ESLint, Vitest, and CI workflow.
**Tool:** Claude Code (terminal)
**Output:** Buildable Nx workspace with all library and app stubs, ready for git init + first push.

### Prompt

```
You are building the Nx monorepo scaffold for the Friendly AI AEP Tool.
Reference: System Specification v2.2, Section 3.2 (monorepo structure).

Create an Nx workspace with the following configuration:
- Nx 19+ with @nx/node and @nx/angular plugins
- TypeScript 5.4+ strict mode across all projects
- pnpm as package manager

Create these APPLICATIONS (apps/):
  apps/aep-api-gateway    - Node.js Fastify app
  apps/aep-builder        - Angular 17+ app (standalone components)
  apps/aep-preview-host   - Node.js app

Create these LIBRARIES (libs/) as empty stubs with index.ts exports:
  libs/core/agent-runtime
  libs/core/llm-providers
  libs/core/builder-orchestrator
  libs/core/project-registry
  libs/core/policy-service
  libs/core/license-service
  libs/core/billing-service
  libs/core/audit-service
  libs/iot/swagger-ingestion
  libs/iot/auth-adapter
  libs/iot/sdk-generator
  libs/iot/iot-tool-functions
  libs/iot/mock-api-server
  libs/builder/page-composer
  libs/builder/widget-registry
  libs/builder/codegen
  libs/builder/preview-runtime
  libs/builder/publish-service
  libs/builder/git-service
  libs/builder/environment-service
  libs/builder/template-marketplace
  libs/ui/iot-ui                    - publishable Angular library
  libs/grafana/provisioning
  libs/grafana/dashboard-templates
  libs/grafana/theme
  libs/data/prisma-schema
  libs/data/influx-schemas
  libs/data/telegraf-ingest-config
  libs/deploy/docker-generator
  libs/deploy/helm-generator

Configure tsconfig.base.json path aliases:
  @friendly-tech/core/*  -> libs/core/*/src/index.ts
  @friendly-tech/iot/*   -> libs/iot/*/src/index.ts
  @friendly-tech/builder/* -> libs/builder/*/src/index.ts
  @friendly-tech/ui/*    -> libs/ui/*/src/index.ts
  @friendly-tech/grafana/* -> libs/grafana/*/src/index.ts
  @friendly-tech/data/*  -> libs/data/*/src/index.ts
  @friendly-tech/deploy/* -> libs/deploy/*/src/index.ts

Add Vitest as default test runner for all Node.js libs.
Add ESLint with @typescript-eslint for all projects.
Create .github/workflows/ci.yml: lint -> type-check -> test (affected).
Create a root docker/ folder with docker-compose.dev.yml stub.
Create a docs/ folder with placeholder Docusaurus config.
Create .env.example with placeholder vars for three Friendly API
  URLs, credentials, Anthropic API key, and deployment mode flag.

Do NOT implement any business logic. Just the scaffold with proper
types, exports, and build targets. Each lib should export a
placeholder: export const MODULE_NAME = 'module-name';
```

---

## P02 — Prisma schema and database setup

**Goal:** Implement the full Prisma schema for PostgreSQL with all core models, enums, and relations.
**Tool:** Claude Code
**Output:** Working Prisma schema with migration, seed script, and typed client generation.

### Prompt

```
Implement the Prisma schema in libs/data/prisma-schema/.
Reference: System Specification v2.2, Section 8 and Module Reference
v2.2, Section 10.1 (prisma-schema).

Create schema.prisma with these models and enums:

Enums: Tier (STARTER/PROFESSIONAL/ENTERPRISE),
  DeploymentMode (SAAS/DEDICATED), ProjectStatus, UserRole,
  DataSourceType (NORTHBOUND/EVENTS/QOE/INFLUXDB/EXTERNAL),
  PublishStatus, EnvironmentType (DEV/STAGING/PRODUCTION)

Models: Tenant (id, name, friendlyDmUrl, friendlyEventsUrl,
  friendlyQoEUrl, deploymentMode, tier, licenseKey, llmProviderConfig
  as Json, encryptedCredentials as Json, createdAt, updatedAt)

  User (id, tenantId, email, name, role, lastLoginAt)
  Project (id, tenantId, name, description, status, deploymentMode,
    createdAt, updatedAt)
  Page (id, projectId, route, title, layoutSchema as Json, order)
  Widget (id, pageId, type, position as Json, bindings as Json,
    properties as Json)
  DataSource (id, projectId, name, apiTarget, config as Json)
  AppVersion (id, projectId, semver, gitCommitSha, publishedAt,
    status)
  DeploymentTarget (id, projectId, environment, config as Json)
  GitIntegration (id, projectId, remoteUrl, branch, authMethod,
    encryptedCredentials as Json)
  BillingEvent (id, tenantId, appId, eventType, quantity, unit,
    timestamp, metadata as Json)
  BillingPlan (id, name, tier, monthlyPrice, includedDevices,
    includedApiCalls, includedStorage, overageRates as Json)
  BillingSubscription (id, tenantId, planId, startDate, endDate,
    status)
  BillingInvoice (id, tenantId, periodStart, periodEnd, lineItems
    as Json, total, status, paidAt)
  AuditEvent (id, tenantId, projectId, userId, eventType, llmProvider,
    llmModel, details as Json, timestamp)
  PreviewSession (id, projectId, containerId, mode, startedAt,
    expiresAt, status)

Add all relations (Tenant hasMany Users, Projects, etc.).
Add @@index annotations for frequently queried fields.
Seed 3 BillingPlans: Starter ($499), Professional ($2499),
  Enterprise ($7999) with included units per spec.

Create seed.ts script that seeds billing plans.
Create a docker-compose.db.yml with postgres:15-alpine for local dev.
Run prisma generate to produce the typed client.
Add a helper module that exports a tenant-scoped Prisma client
  middleware filtering all queries by tenantId.
```

---

## P03 — LLM providers module

**Goal:** Implement the LLMProvider abstraction with Anthropic (Claude Opus 4.6) adapter and Ollama stub.
**Tool:** Claude Code
**Output:** Working LLM abstraction with streaming, tool-calling, token tracking, and configurable per-agent model map.

### Prompt

```
Implement libs/core/llm-providers/ per Module Reference v2.2 Section 5.3.

Create these TypeScript interfaces and implementations:

1. LLMProvider interface:
   - id: string ('anthropic' | 'ollama')
   - chat(messages: Message[], tools?: ToolDef[]):
       AsyncIterable<StreamChunk>
   - Optional: embed(text: string): Promise<number[]>

2. LLMConfig interface:
   - provider: string, model: string, baseUrl?: string,
     apiKey?: string, temperature?: number, maxTokens?: number

3. AgentRole enum: SUPERVISOR, PLANNING, IOT_DOMAIN, SWAGGER_API,
   ANGULAR_COMPOSER, GRAFANA, DATABASE, DEPLOYMENT, BILLING,
   SECURITY, QA_TEST

4. AGENT_LLM_MAP: Record<AgentRole, LLMConfig> - default all to
   { provider: 'anthropic', model: 'claude-opus-4-6' }
   Support override via environment variables and per-tenant config.

5. AnthropicProvider class implementing LLMProvider:
   - Use @anthropic-ai/sdk
   - Streaming via client.messages.stream()
   - Tool-calling with native Claude tool_use format
   - Token usage tracking: emit usage events {inputTokens,
     outputTokens, model, provider} for billing-service

6. OllamaProvider class implementing LLMProvider:
   - HTTP client to Ollama API (OpenAI-compatible: /v1/chat/completions)
   - Streaming via SSE parsing
   - Tool-calling translation: Claude tools -> OpenAI function format
   - Configurable baseUrl (default http://localhost:11434)

7. LLMProviderFactory:
   - getProvider(agentRole, tenantConfig?): LLMProvider
   - Resolves model from AGENT_LLM_MAP, applies tenant overrides
   - Implements fallback chain: if primary fails, try secondary

8. Token usage event emitter for billing integration.

Write Vitest tests for: provider factory resolution, Anthropic
streaming mock, Ollama streaming mock, fallback chain behaviour.
Install: @anthropic-ai/sdk
```

---

## P04 — Auth adapter

**Goal:** Implement unified authentication for all three Friendly One-IoT DM APIs.
**Tool:** Claude Code

### Prompt

```
Implement libs/iot/auth-adapter/ per Module Reference v2.2 Section 6.2.

Create FriendlyAuthAdapter class with these capabilities:

1. FriendlyApiConfig interface:
   { id: 'northbound'|'events'|'qoe', baseUrl: string,
     authMethods: AuthMethod[], primaryAuth: AuthMethod,
     credentials: { username?, password?, apiKey?, oauth2Config? } }

2. AuthMethod type: 'basic' | 'apikey' | 'jwt' | 'oauth2'

3. For each method, implement header injection:
   - basic: Authorization: Basic base64(uid:pw)
   - apikey: X-API-Key: {key}
   - jwt: POST {eventsUrl}/rest/v2/auth/login with uid/pw,
     cache JWT in Redis with TTL, auto-refresh 60s before expiry,
     inject Authorization: Bearer {token}
   - oauth2: stub with client_credentials grant flow (not active)

4. getAuthHeaders(apiId: string): Promise<Record<string, string>>
   - Selects correct method per API config
   - Handles token lifecycle (cache, refresh, retry on 401)

5. Per-tenant credential storage interface (reads from Prisma
   Tenant.encryptedCredentials, decrypted via a simple AES-256
   wrapper for now, Vault integration in Phase 3).

6. Event emission for audit-service: auth_success, auth_failure,
   token_refresh, token_expired events.

Write Vitest tests with mock HTTP server simulating:
- Successful basic auth, API key injection
- JWT login -> token -> cache hit -> auto-refresh flow
- 401 retry with token refresh
Install: ioredis
```

---

## P05 — Swagger ingestion (3 API specs)

**Goal:** Ingest and normalise three Friendly API specifications into a unified internal model.
**Tool:** Claude Code

### Prompt

```
Implement libs/iot/swagger-ingestion/ per Module Ref v2.2 Section 6.1.

1. Create SwaggerIngestionService with:
   - ingestSpec(apiId, specUrl, auth): fetch, validate, normalise
   - ingestAll(configs[]): ingest all 3 specs in parallel
   - diffSpecs(oldModel, newModel): detect breaking changes

2. Support 3 API spec sources:
   - northbound: GET {baseUrl}/FTACSWS_REST/swagger/docs/v1
     (Swagger 2.0 / OpenAPI 3.0 JSON)
   - events: GET {baseUrl}:8443/rest/v2/api-docs?group=ws%20iot
     (OpenAPI 3.0 JSON)
   - qoe: load from local file libs/iot/swagger-ingestion/specs/
     qoe-api.yaml (manually maintained OpenAPI 3.1 YAML)

3. Parse with @apidevtools/swagger-parser.
   Resolve all $ref references. Validate against OpenAPI schema.

4. Normalise into UnifiedApiModel:
   { apis: { northbound: ApiSpec, events: ApiSpec, qoe: ApiSpec },
     sharedEntities: { Device, Alert, Telemetry, ... },
     operations: Operation[] }
   - Merge overlapping entity definitions (e.g., Device appears in
     all 3 APIs with different shapes -> create superset type)

5. SHA-256 hash per spec for change detection.
   Store hashes in a local .spec-hashes.json file.
   Emit 'spec-changed' event when hash differs.

6. Create a placeholder qoe-api.yaml in specs/ with realistic
   OpenAPI 3.1 definition for endpoints: GET /qoe/devices/{id}/
   telemetry, GET /qoe/fleet/kpis, GET /qoe/devices/{id}/connectivity

Write Vitest tests with sample Swagger JSON fixtures.
Install: @apidevtools/swagger-parser, yaml
```

---

## P06 — SDK generator (3 service classes)

**Goal:** Generate typed TypeScript SDK with NorthboundService, EventsService, and QoEService.
**Tool:** Claude Code

### Prompt

```
Implement libs/iot/sdk-generator/ per Module Ref v2.2 Section 6.3.

1. Create SdkGenerator class that takes UnifiedApiModel and produces:
   - NorthboundService.ts: typed methods for all northbound operations
   - EventsService.ts: typed methods for webhook registration/mgmt
   - QoEService.ts: typed methods for telemetry/KPI queries
   - types.ts: all request/response TypeScript interfaces
   - index.ts: barrel export as @friendly-tech/dm-sdk

2. Each service method should:
   - Accept typed parameters
   - Return Promise<TypedResponse>
   - Use auth-adapter.getAuthHeaders(apiId) for auth
   - Route all calls through configurable baseProxyUrl
     (the iot-api-proxy, not direct to DM)
   - Wrap errors in FriendlyApiError { statusCode, message,
     requestId, apiSource }

3. Use Handlebars templates for code generation:
   - templates/service.ts.hbs
   - templates/types.ts.hbs
   - templates/index.ts.hbs

4. Generate from the UnifiedApiModel output of swagger-ingestion.
   For Phase 1, also create a hardcoded fallback SDK with the
   13 IoT tool functions from the spec (getDeviceList, etc.)
   in case swagger-ingestion is not yet connected to live APIs.

Write Vitest tests verifying generated TypeScript compiles cleanly.
Install: handlebars, typescript (for programmatic compilation check)
```

---

## P07 — IoT tool functions (5 core)

**Goal:** Implement 5 core LangGraph-callable tool functions wrapping the SDK.
**Tool:** Claude Code

### Prompt

```
Implement libs/iot/iot-tool-functions/ per Module Ref v2.2 Sec 6.4.

Create 5 core tool functions as LangGraph StructuredTool classes:

1. getDeviceListTool:
   Input: { tenantId, filters?: { deviceType?, status?, fwVersion?,
     search?, page?, pageSize? } }
   Uses: NorthboundService.getDeviceList()
   Returns: { devices: Device[], total: number, page: number }

2. getDeviceDetailsTool:
   Input: { deviceId: string }
   Uses: NorthboundService.getDeviceDetails()
   Returns: { device: DeviceDetail (full record + LwM2M objects) }

3. getDeviceTelemetryTool:
   Input: { deviceId, metric, timeRange: { from, to },
     aggregation?: '1m'|'5m'|'1h'|'1d' }
   Uses: QoEService.getDeviceTelemetry()
   Returns: { dataPoints: { timestamp, value }[], metric, unit }

4. registerWebhookTool:
   Input: { eventType: string, callbackUrl: string,
     filters?: { deviceType?, severity? } }
   Uses: EventsService.registerWebhook()
   Returns: { subscriptionId, status, eventType }

5. getKPIMetricsTool:
   Input: { tenantId, kpiType: 'connectivity'|'firmware'|'alerts',
     period: '24h'|'7d'|'30d' }
   Uses: QoEService.getKPIMetrics()
   Returns: { kpis: { name, value, unit, trend }[] }

Each tool must:
- Use Zod schema for input validation
- Include a description string for LLM context
- Handle errors gracefully with user-friendly messages
- Support Redis fallback cache for disconnected mode:
  on API failure, check Redis for cached response,
  return it with { cached: true, staleSeconds: N }

Write Vitest tests with mock SDK responses.
Install: zod, @langchain/core (for StructuredTool base class), ioredis
```

---

## P08 — API gateway

**Goal:** Implement the Fastify API gateway with auth, routing, WebSocket, and rate limiting.
**Tool:** Claude Code

### Prompt

```
Implement apps/aep-api-gateway/ per Module Ref v2.2 Section 5.1.

1. Create Fastify 4.x server with these plugins:
   - @fastify/cors, @fastify/helmet, @fastify/rate-limit
   - @fastify/websocket (for agent chat + preview streaming)
   - @fastify/swagger + @fastify/swagger-ui (auto-generated docs)

2. Authentication middleware:
   - POST /api/v1/auth/login: accept uid/pw, call auth-adapter
     to authenticate against Friendly Northbound API, issue
     local JWT (RS256) containing { tenantId, userId, role, tier }
   - JWT verification on all /api/v1/* routes (except /auth/login)
   - Extract tenantId from JWT and attach to request context

3. Route stubs (handlers call through to lib modules):
   POST   /api/v1/auth/login
   POST   /api/v1/auth/token/refresh
   GET    /api/v1/projects
   POST   /api/v1/projects
   GET    /api/v1/projects/:id
   POST   /api/v1/projects/:id/agent  (send prompt to agent)
   WS     /api/v1/agent/stream         (WebSocket for streaming)
   GET    /api/v1/projects/:id/pages
   POST   /api/v1/projects/:id/preview
   POST   /api/v1/projects/:id/publish
   GET    /api/v1/license/validate
   GET    /api/v1/billing/usage

4. Rate limiting: configure per-tier limits from policy-service
   (Starter: 100 req/min, Pro: 500, Enterprise: 2000)

5. Tenant-scoped middleware: in multi-tenant mode, all DB queries
   filtered by tenantId. In dedicated mode (from env var
   DEPLOYMENT_MODE=dedicated), skip tenant filter.

6. Health check: GET /health returning { status, version, uptime }

Write Supertest integration tests for auth flow and route stubs.
Install: fastify, @fastify/cors, @fastify/helmet, @fastify/rate-limit,
  @fastify/websocket, @fastify/swagger, @fastify/jwt, supertest
```

---

## P09 — Agent runtime (LangGraph)

**Goal:** Implement the LangGraph StateGraph with Supervisor, Product Planning, and IoT Domain agents.
**Tool:** Claude Code

> This is the most complex module. Allow 5–8 hours. Test with real Claude API key.

### Prompt

```
Implement libs/core/agent-runtime/ per Module Ref v2.2 Section 5.2.

1. Install @langchain/langgraph, @langchain/core, @langchain/anthropic

2. Define AEPAgentState interface:
   { messages: BaseMessage[], currentAgent: AgentRole,
     projectId: string, tenantId: string, buildPlan: BuildTask[],
     completedTasks: BuildTask[], generatedAssets: GeneratedAsset[],
     errors: AgentError[], approvals: ApprovalRequest[] }

3. Create StateGraph with these nodes (Phase 1 = 3 agents):
   - supervisor: examines message, routes to specialist
   - planning: captures requirements, produces build plan
   - iot_domain: answers IoT questions, suggests APIs/widgets

4. Supervisor agent:
   - System prompt: 'You are the supervisor of the Friendly AI AEP
     Tool. Route user requests to the appropriate specialist agent.
     Available agents: planning (for new app requirements),
     iot_domain (for device/telemetry/protocol questions).'
   - Uses llm-providers to get Claude Opus 4.6
   - Output: { next: 'planning' | 'iot_domain' | 'FINISH' }

5. Product Planning agent:
   - System prompt with IoT context: device types, protocols,
     widget catalogue, template names, three API capabilities
   - Tools: project-registry CRUD (via tool functions)
   - Produces structured BuildPlan: list of BuildTask objects
     { id, type, description, agent, dependencies, status }

6. IoT Domain agent:
   - System prompt with Friendly One-IoT DM knowledge:
     LwM2M objects (/3/0, /4/0, /5/0, /6/0), three API
     capabilities, device lifecycle, telemetry patterns
   - Tools: all 5 IoT tool functions from P07
   - Can query live device data via tools

7. Graph edges:
   START -> supervisor
   supervisor -> planning (conditional)
   supervisor -> iot_domain (conditional)
   supervisor -> END (when FINISH)
   planning -> supervisor (return after plan generated)
   iot_domain -> supervisor (return after answer)

8. State persistence: PostgreSQL checkpointer (use
   @langchain/langgraph-checkpoint-postgres)

9. Streaming: expose an async generator that yields
   agent response chunks for WebSocket forwarding.

Write integration test that sends a prompt like
  'I want to build a fleet operations dashboard for 10,000
   smart water meters using LwM2M'
and verifies the supervisor routes to planning, which produces
a structured build plan.
```

---

## P10 — Angular builder shell

**Goal:** Implement the four-panel builder workspace with Friendly Material 3 theme and agent chat integration.
**Tool:** Claude Code

### Prompt

```
Implement apps/aep-builder/ per Module Ref v2.2 Section 7.1.

1. Angular 17+ standalone components throughout. No NgModules.
   OnPush change detection. Angular Signals for state.

2. Custom Angular Material 3 theme with Friendly brand tokens:
   --primary: #12174C (navy), --accent: #FF5900 (orange),
   --secondary: #59585A (charcoal), --body: #343433,
   --surface: #FFFFFF (light) / #12174C (dark mode)
   Font: Calibri, fallback Roboto, sans-serif

3. Four-panel layout using CSS Grid:
   Left: AgentChatPanel (300px, collapsible)
   Centre: MainCanvas (fluid - tabbed: Visual | Code | Preview)
   Right: PropertiesPanel (320px, collapsible)
   Bottom: StatusBar (200px, collapsible)

4. AgentChatPanel component:
   - Message list (user + assistant bubbles)
   - Text input with send button
   - WebSocket connection to /api/v1/agent/stream
   - Streaming response rendering (token by token)
   - Build plan display when agent returns BuildPlan

5. Navigation header:
   - Friendly logo (left)
   - Project name + breadcrumb
   - Mode selector pills: Prompt | Plan | Visual | Dev | Preview
   - Connectivity status indicator (green dot = Connected)
   - Dark mode toggle (ft-theme-toggle)
   - User avatar + dropdown

6. StatusBar component:
   - Tabs: Logs | Tests | Build | Deploy
   - Log stream display with severity colours

7. Empty placeholder components for:
   - VisualCanvas (will be page-composer in Phase 2)
   - CodeEditor (will embed Monaco in Phase 2)
   - PreviewFrame (will embed preview iframe in Phase 2)
   - PropertiesPanel (will show widget props in Phase 2)

8. Routing: /login, /projects, /projects/:id/build
   AuthGuard checking JWT in localStorage.

9. Login page: UID/PW form, calls POST /api/v1/auth/login,
   stores JWT, redirects to /projects.

Make it look professional from day 1 - this is the product face.
Use the Friendly design patterns: navy sidebar/header, data-dense
layouts, orange accent highlights, clean typography.
```

---

## P11 — License service MVP

**Goal:** Implement license key generation, validation, and tier feature gating.
**Tool:** Claude Code

### Prompt

```
Implement libs/core/license-service/ per Module Ref v2.2 Sec 12.1.

1. License key format:
   FTECH-AEP-{TIER}-{DEPLOY}-{TENANT_HASH}-{EXPIRY}-{FLAGS}-{HMAC}
   - TIER: STR | PRO | ENT
   - DEPLOY: S (SaaS) | D (Dedicated)
   - TENANT_HASH: first 8 chars of SHA-256(tenantId)
   - EXPIRY: Unix epoch timestamp
   - FLAGS: hex-encoded feature bitfield
   - HMAC: first 12 chars of HMAC-SHA256(all preceding, secret)

2. Feature flags bitfield:
   Bit 0: Helm output
   Bit 1: Git push
   Bit 2: Ollama LLM
   Bit 3: Air-gap disconnected mode
   Bit 4: Third-party data ingestion
   Bit 5: Custom widgets
   Bit 6: Multi-environment promotion

3. LicenseService class:
   - generateKey(tenantId, tier, deployMode, features, expiryDate)
   - validateKey(key): { valid, tier, deployMode, features,
     expiresAt, tenantHash }
   - isFeatureEnabled(key, feature): boolean
   - revokeKey(key): void (add to revocation list in Redis)

4. Signing secret loaded from environment variable
   FRIENDLY_LICENSE_SECRET.

5. Tier presets:
   Starter:  flags=0b0000000 (no optional features)
   Pro:      flags=0b0010011 (Git + 3rd-party + multi-env)
   Enterprise: flags=0b1111111 (all features)

Write comprehensive Vitest tests for key generation, validation,
  tamper detection (modified key fails HMAC), expiry checking,
  feature flag extraction, and revocation.
```

---

## P12 — Docker stack generator

**Goal:** Generate Docker Compose files for generated customer applications.
**Tool:** Claude Code

### Prompt

```
Implement libs/deploy/docker-generator/ per Module Ref v2.2 Sec 11.1.

1. DockerStackGenerator class:
   - generate(projectConfig, envConfig, licenseConfig):
       DockerStack { composeYml, composeProYml, envTemplate,
       nginxConf, dockerfiles }

2. Generated docker-compose.yml includes 9 services:
   frontend:    nginx:alpine + Angular build
   grafana:     grafana/grafana-oss:10.4 + provisioning mount
   influxdb:    influxdb:2.7 + init scripts
   postgres:    postgres:15-alpine + migrations
   telegraf:    telegraf:1.29 + config mount
   iot-api-proxy: node:20-alpine + Fastify proxy
   license-agent: friendly/license-agent:latest (placeholder)
   redis:       redis:7-alpine
   nginx-proxy: nginx:alpine + default.conf

3. docker-compose.prod.yml overrides:
   - restart: always on all services
   - resource limits (memory, CPU)
   - log driver configuration
   - healthcheck definitions

4. .env.template with all configurable variables:
   FRIENDLY_NORTHBOUND_URL, FRIENDLY_EVENTS_URL, FRIENDLY_QOE_URL,
   FRIENDLY_USERNAME, FRIENDLY_PASSWORD, FRIENDLY_API_KEY,
   FRIENDLY_LICENSE_KEY, DEPLOYMENT_MODE, LLM_PROVIDER,
   LLM_MODEL, OLLAMA_BASE_URL (Enterprise only),
   POSTGRES_*, INFLUXDB_*, GRAFANA_*, REDIS_URL

5. Use Handlebars templates for each file.
   Support conditional sections based on deployment mode.

6. Generate nginx/default.conf with reverse proxy rules:
   /api/* -> iot-api-proxy:3001
   /grafana/* -> grafana:3000
   /* -> frontend:80

Write Vitest tests verifying generated YAML is valid.
Install: handlebars, yaml (for validation)
```

---

## P13 — Preview runtime MVP

**Goal:** Implement Docker-based preview sandbox with mock API mode.
**Tool:** Claude Code

### Prompt

```
Implement libs/builder/preview-runtime/ per Module Ref v2.2 Sec 7.5.

1. PreviewRuntimeService class:
   - launchPreview(projectId, mode: 'mock'|'live'): PreviewSession
   - stopPreview(sessionId): void
   - getPreviewStatus(sessionId): PreviewStatus
   - listActiveSessions(tenantId): PreviewSession[]

2. Container lifecycle using Dockerode:
   - Pull/create container from preview base image
   - Mount generated Angular source as volume
   - Expose random port, map to preview URL
   - In mock mode: start mock-api-server as sidecar container
   - In live mode: configure iot-api-proxy endpoint
   - Health check: poll container HTTP until 200

3. Session management:
   - Store session in PreviewSession table (Prisma)
   - Auto-expire after 30 minutes of inactivity
   - Cleanup cron: every 5 minutes, destroy expired containers
   - Max concurrent: check against tier limit (1/3/10)

4. Preview URL pattern:
   http://localhost:{port} for local dev
   (https://preview-{projectId}.aep.friendly-tech.com for prod)

5. Hot-reload stub: file-watch on generated source directory,
   trigger container restart on change (Phase 2 will add
   incremental Angular rebuild).

6. For Phase 1 MVP: the preview can serve a static placeholder
   Angular app with the project name and a 'Preview coming soon'
   message. Full codegen integration happens in Phase 2.

Write Vitest tests with Docker mock (dockerode-mock).
Install: dockerode, @types/dockerode
```

---

## Phase 1 completion checklist

| # | Deliverable | Verification |
|---|------------|-------------|
| P01 | Nx monorepo | `nx graph` renders 35 modules, `nx build` succeeds |
| P02 | Prisma schema | `prisma migrate dev` runs, `seed.ts` populates plans |
| P03 | LLM providers | Unit tests pass, streaming works with real API key |
| P04 | Auth adapter | JWT lifecycle test passes with mock Friendly server |
| P05 | Swagger ingestion | 3 specs parsed, unified model generated |
| P06 | SDK generator | 3 service classes compile cleanly |
| P07 | IoT tool functions | 5 tools callable, Zod validation works, cache fallback |
| P08 | API gateway | Supertest: login → JWT → protected route → 200 |
| P09 | Agent runtime | Prompt → supervisor → planning → build plan returned |
| P10 | Builder shell | Angular serves, 4 panels render, chat sends to WS |
| P11 | License service | Key gen → validate → tamper detect → revoke all pass |
| P12 | Docker generator | Valid docker-compose.yml generated with all 9 services |
| P13 | Preview runtime | Container launches, health check passes, auto-destroy works |

> After completing all 13 prompts, run `nx affected:test --all` to verify the full workspace. Then `git push` to `github.com/friendly-technologies/friendly-ai-aep-tool` and begin Phase 2 planning.

---

*Friendly AI AEP Tool — Proprietary Product of Friendly Technologies*
*Classification: Internal Engineering — Confidential*
