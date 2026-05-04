# Friendly AI AEP Tool — Module & Building Block Reference v2.2

**With Embedded Architecture Diagrams**

Version 2.2 | April 2026 | Classification: Internal Engineering — Confidential

---

## 1. About this document

Module & Building Block Reference v2.2 for the Friendly AI AEP Tool. Incorporates all six resolved design decisions and references system architecture diagrams for each major layer. This is the authoritative module catalogue for the Nx monorepo scaffold and development planning.

> 35 modules across 10 layers. All agents use Claude Opus 4.6 via LLMProvider abstraction. Three Friendly One-IoT DM APIs integrated. Dual deployment mode (SaaS + Dedicated). Market-benchmarked pricing ($499/$2,499/$7,999). Disconnected operation with Friendly-exclusive DM lock. Fresh UI designs.

---

## 2. System architecture overview

The following diagram shows all 10 architectural layers, 35 modules, three Friendly APIs, the LLM provider abstraction, and the dual deployment model (SaaS vs Dedicated).

*Figure 1 — Friendly AI AEP Tool v2.1 system architecture (10 layers, 35 modules)*

---

## 3. Module inventory

| # | Module | Layer | Nx Path | Type |
|---|--------|-------|---------|------|
| 1 | aep-api-gateway | 1 | apps/aep-api-gateway | App |
| 2 | aep-agent-runtime | 1 | libs/core/agent-runtime | Lib |
| 3 | llm-providers (NEW) | 1 | libs/core/llm-providers | Lib |
| 4 | builder-orchestrator | 1 | libs/core/builder-orchestrator | Lib |
| 5 | project-registry | 1 | libs/core/project-registry | Lib |
| 6 | policy-service | 1 | libs/core/policy-service | Lib |
| 7 | license-service | 8 | libs/core/license-service | Lib+Rust |
| 8 | billing-service | 9 | libs/core/billing-service | Lib |
| 9 | audit-service | 1 | libs/core/audit-service | Lib |
| 10 | swagger-ingestion | 2 | libs/iot/swagger-ingestion | Lib |
| 11 | auth-adapter (NEW) | 2 | libs/iot/auth-adapter | Lib |
| 12 | sdk-generator | 2 | libs/iot/sdk-generator | Lib |
| 13 | iot-tool-functions | 2 | libs/iot/iot-tool-functions | Lib |
| 14 | mock-api-server | 2 | libs/iot/mock-api-server | Lib |
| 15 | aep-builder UI | 3 | apps/aep-builder | App |
| 16 | page-composer | 3 | libs/builder/page-composer | Lib |
| 17 | widget-registry | 3 | libs/builder/widget-registry | Lib |
| 18 | codegen | 3 | libs/builder/codegen | Lib |
| 19 | preview-runtime | 3 | libs/builder/preview-runtime | Lib |
| 20 | publish-service | 3 | libs/builder/publish-service | Lib |
| 21 | git-service | 10 | libs/builder/git-service | Lib |
| 22 | environment-service | 3 | libs/builder/environment-service | Lib |
| 23 | template-marketplace | 3 | libs/builder/template-marketplace | Lib |
| 24 | @friendly-tech/iot-ui | 4 | libs/ui/iot-ui | Publishable |
| 25 | grafana-provisioning | 5 | libs/grafana/provisioning | Lib |
| 26 | dashboard-templates | 5 | libs/grafana/dashboard-templates | Lib |
| 27 | grafana-theme (NEW) | 5 | libs/grafana/theme | Lib |
| 28 | prisma-schema | 6 | libs/data/prisma-schema | Lib |
| 29 | influx-schemas | 6 | libs/data/influx-schemas | Lib |
| 30 | telegraf-ingest-config (NEW) | 6 | libs/data/telegraf-ingest-config | Lib |
| 31 | docker-generator | 7 | libs/deploy/docker-generator | Lib |
| 32 | helm-generator | 7 | libs/deploy/helm-generator | Lib |
| 33 | license-agent | 8 | tools/license-agent | Rust bin |
| 34 | iot-api-proxy | 8 | tools/iot-api-proxy | App |
| 35 | docs | All | docs/ | Docusaurus |

---

## 4. End-to-end flow: prompt to deployment

*Figure 2 — Prompt-to-deploy pipeline with three-API auth, disconnected preview, and dual deployment*

From natural language prompt through authentication against three Friendly APIs, multi-agent planning and generation (all on Claude Opus 4.6), preview with disconnected-simulation mode, to dual deployment targeting SaaS or dedicated infrastructure.

---

## 5. Layer 1 — AEP core platform engine

Platform backbone: gateway, authentication, multi-agent orchestration via LangGraph (all agents on Claude Opus 4.6), LLM provider abstraction with Ollama support, build orchestration, project management, policy enforcement, and audit.

*Figure 3 — Multi-agent orchestration with Claude Opus 4.6 and LLM provider abstraction*

### 5.1 aep-api-gateway

- **Nx Path:** `apps/aep-api-gateway/`
- **Layer:** 1 — Core Engine
- **Description:** Unified HTTP/WS gateway on Fastify 4.x. Handles multi-method auth via auth-adapter against all three Friendly APIs (Basic Auth UID/PW, JWT exchange, API Key). Resolves tenant context, enriches downstream requests. Supports dual deployment: multi-tenant SaaS routing via tenant-scoped middleware; dedicated single-tenant mode bypasses tenant filter. WebSocket for agent chat streaming and preview hot-reload. Rate limiting via Redis sliding window.
- **Key Technologies:** Fastify 4.x, @fastify/jwt, @fastify/websocket, @fastify/rate-limit, Redis 7
- **Dependencies:** agent-runtime, project-registry, policy-service, license-service, billing-service, audit-service, auth-adapter

### 5.2 aep-agent-runtime

- **Nx Path:** `libs/core/agent-runtime/`
- **Layer:** 1 — Core Engine
- **Description:** LLM orchestration via LangGraph StateGraph. All 11 agents run Claude Opus 4.6 in Phase 1 via the llm-providers abstraction (swappable to Ollama for Enterprise data sovereignty). Supervisor agent routes tasks to specialists. State persisted to PostgreSQL for session recovery. Parallel execution for independent tasks (e.g., Angular codegen + Grafana provisioning simultaneously). In disconnected mode, cached agent state in Redis allows limited offline operation.
- **Key Technologies:** LangGraph (TS), llm-providers module, PostgreSQL (checkpoints), Redis (context cache)
- **Dependencies:** llm-providers, iot-tool-functions, codegen, widget-registry, grafana-provisioning, docker-generator, prisma-schema, builder-orchestrator

### 5.3 llm-providers (NEW v2.1)

- **Nx Path:** `libs/core/llm-providers/`
- **Layer:** 1 — Core Engine
- **Description:** Provider-agnostic LLM abstraction enabling hot-swappable models per agent. Concrete adapters: Anthropic (Claude Opus 4.6, Sonnet 4.6, Haiku 4.5), Ollama (any local model via OpenAI-compatible API), stubs for OpenAI and Gemini. AGENT_LLM_MAP config maps each agent role to provider+model, overridable per-tenant. Streaming response handling, tool-calling protocol translation (Claude → Ollama), token usage tracking for billing, automatic fallback chains (Ollama → Claude on failure). Enterprise tenants configure their own Ollama endpoint.
- **Key Technologies:** TypeScript, @anthropic-ai/sdk, node-fetch (Ollama HTTP), AsyncIterable streaming
- **Dependencies:** billing-service, audit-service, project-registry

### 5.4 builder-orchestrator

- **Nx Path:** `libs/core/builder-orchestrator/`
- **Layer:** 1 — Core Engine
- **Description:** Coordinates generation from build plan to published output. Receives plans from Product Planning Agent, schedules tasks respecting dependency graphs, tracks completion with retries (max 3, exponential backoff), sends real-time progress via WebSocket. Approval gates: preview before publish, production requires Admin. Emits billing events per generation session.
- **Key Technologies:** TypeScript, BullMQ (Redis-backed), WebSocket
- **Dependencies:** agent-runtime, billing-service, audit-service, project-registry

### 5.5 project-registry

- **Nx Path:** `libs/core/project-registry/`
- **Layer:** 1 — Core Engine
- **Description:** System-of-record for application metadata. Stores projects, pages (PageSchema), widgets, bindings, data source configs for all three Friendly APIs, versions with Git SHA, deployment targets (SaaS/dedicated mode), and per-tenant LLM config overrides. All queries tenant-scoped via Prisma middleware; dedicated mode optimises away tenant filter.
- **Key Technologies:** Prisma ORM, PostgreSQL 15, TypeScript
- **Dependencies:** prisma-schema, policy-service, llm-providers

### 5.6 policy-service

- **Nx Path:** `libs/core/policy-service/`
- **Layer:** 1 — Core Engine
- **Description:** Enforces guardrails and tier entitlements ($499 Starter / $2,499 Pro / $7,999 Enterprise). Helm requires Enterprise, Git push requires Pro+, Ollama requires Enterprise, air-gap requires Enterprise. Rate-limits AI sessions (50/500/Unlimited). Blocks insecure codegen patterns. Enforces Friendly-exclusive DM integration: blocks competitor DM endpoint references.
- **Key Technologies:** TypeScript, OPA, Redis (cache)
- **Dependencies:** license-service, audit-service

### 5.7 audit-service

- **Nx Path:** `libs/core/audit-service/`
- **Layer:** 1 — Core Engine
- **Description:** Comprehensive audit trail: agent decisions (including LLM model/provider used), user actions, approvals, publishes, Git commits, LLM fallback events, three-API auth events, security events. PostgreSQL with 90-day hot retention, S3 archive. SIEM export via webhook. In dedicated deployment, audit data stays on customer infrastructure.
- **Key Technologies:** TypeScript, PostgreSQL, S3 SDK, webhook dispatcher
- **Dependencies:** prisma-schema

---

## 6. Layer 2 — Friendly One-IoT DM API integration

> Three distinct Friendly APIs integrated via unified auth-adapter supporting UID/PW, API Key, JWT, and future OAuth2.

*Figure 4 — Three-API authentication flow via auth-adapter*

### 6.1 swagger-ingestion

- **Nx Path:** `libs/iot/swagger-ingestion/`
- **Layer:** 2 — API Integration
- **Description:** Ingests three separate Friendly API specs: (1) Northbound REST from `/FTACSWS_REST/swagger` for device management, provisioning, firmware, LwM2M; (2) Events/Webhook REST from `:8443/rest/v2/api-docs` for real-time subscriptions; (3) QoE/Monitoring REST (manually maintained YAML from API guide PDF) for time-series KPIs. Validates, normalises overlapping entities, resolves $ref, produces unified API model. SHA-256 change detection triggers SDK regeneration.
- **Key Technologies:** openapi-parser, TypeScript, node-fetch, JSON Schema merge
- **Dependencies:** auth-adapter, sdk-generator, iot-tool-functions

### 6.2 auth-adapter (NEW v2.1)

- **Nx Path:** `libs/iot/auth-adapter/`
- **Layer:** 2 — API Integration
- **Description:** Unified authentication for all three Friendly APIs. Four methods: (1) Basic Auth (UID/PW) for Northbound and QoE; (2) API Key (X-API-Key header) for all three; (3) JWT for Events API (POST `/rest/v2/auth/login` exchanges UID/PW for token, cached in Redis, auto-refreshes before expiry); (4) OAuth2 stub (client_credentials + authorization_code) ready for future activation. Per-tenant encrypted credential storage via Vault. Automatic method selection based on API target.
- **Key Technologies:** TypeScript, node-fetch, jsonwebtoken, Redis (token cache), Vault SDK
- **Dependencies:** project-registry, audit-service

### 6.3 sdk-generator

- **Nx Path:** `libs/iot/sdk-generator/`
- **Layer:** 2 — API Integration
- **Description:** Generates typed TypeScript SDK with three service classes: NorthboundService, EventsService, QoEService. Each includes typed request/response interfaces, FriendlyApiError handling, and automatic routing through iot-api-proxy. Published as `@friendly-tech/dm-sdk` within Nx workspace.
- **Key Technologies:** openapi-generator-cli (typescript-fetch), Handlebars
- **Dependencies:** swagger-ingestion, auth-adapter, codegen

### 6.4 iot-tool-functions

- **Nx Path:** `libs/iot/iot-tool-functions/`
- **Layer:** 2 — API Integration
- **Description:** Higher-level IoT domain functions for LangGraph agents. Covers all three APIs: Northbound (getDeviceList, getDeviceDetails, triggerOTAUpdate, executeLwM2MCommand, readLwM2MResource, writeLwM2MResource), Events (registerWebhook, getEventSubscriptions, unregisterWebhook), QoE (getDeviceTelemetry, getFleetTelemetry, getKPIMetrics, getConnectivityStats). LwM2M object helpers for /3/0, /4/0, /5/0, /6/0, /3303/0. Disconnected fallback to Redis cache with staleness indicator.
- **Key Technologies:** TypeScript, @friendly-tech/dm-sdk, Zod, InfluxDB client, Redis
- **Dependencies:** sdk-generator, auth-adapter, influx-schemas

### 6.5 mock-api-server

- **Nx Path:** `libs/iot/mock-api-server/`
- **Layer:** 2 — API Integration
- **Description:** Simulates all three Friendly APIs for preview/testing. Realistic synthetic data: 1–100k device fleets, diurnal telemetry, webhook event streams, QoE monitoring data. Configurable latency/error injection. Auth simulation (Basic, JWT, API Key).
- **Key Technologies:** Fastify, Faker.js, WebSocket
- **Dependencies:** swagger-ingestion, auth-adapter

---

## 7. Layer 3 — Agentic development & application builder

### 7.1 aep-builder UI

- **Nx Path:** `apps/aep-builder/`
- **Layer:** 3 — Builder
- **Description:** Angular 17+ SPA with fresh Friendly-branded design (inspired by Admin Portal data-dense tables, Support Portal tabbed detail views). Four-panel workspace: left agent chat (300px), centre canvas/Monaco/preview, right properties (320px), bottom status (200px). Material 3 with Friendly tokens: navy primary, orange accent. Dark mode with navy surface. Six builder modes. Signals + OnPush. Connectivity status bar (Connected/Degraded/Offline).
- **Key Technologies:** Angular 17+, Material 3, CDK, Monaco, Socket.IO, Signals
- **Dependencies:** page-composer, widget-registry, codegen, preview-runtime, publish-service, git-service

### 7.2 page-composer

- **Nx Path:** `libs/builder/page-composer/`
- **Layer:** 3 — Builder
- **Description:** Schema-driven layout engine. PageSchema per page: route, title, layout type, responsive breakpoints (1440px/768px). Drag-and-drop → schema mutations → incremental codegen events.
- **Key Technologies:** TypeScript, Ajv, events
- **Dependencies:** widget-registry, codegen

### 7.3 widget-registry

- **Nx Path:** `libs/builder/widget-registry/`
- **Layer:** 3 — Builder
- **Description:** Widget catalogue with fresh designs inspired by Friendly portals. Each registration: component type, import path, property schema, binding schema, defaults, size constraints, supported data sources (Northbound/Events/QoE/InfluxDB/external). Storybook previews. Extensible for Phase 4 custom SDK.
- **Key Technologies:** TypeScript, JSON Schema, CDK
- **Dependencies:** @friendly-tech/iot-ui

### 7.4 codegen

- **Nx Path:** `libs/builder/codegen/`
- **Layer:** 3 — Builder
- **Description:** Angular code generation in 8 stages: app shell, routing, page components (standalone/OnPush/Signals), widget wiring, three API service classes (NorthboundService/EventsService/QoEService), state management, Friendly theme (navy/orange/M3/dark mode), build config. Includes disconnected-mode caching layer. Strict TS compilation.
- **Key Technologies:** TypeScript, Handlebars, Angular CLI, ts-morph
- **Dependencies:** page-composer, widget-registry, sdk-generator, project-registry

### 7.5 preview-runtime

- **Nx Path:** `libs/builder/preview-runtime/`
- **Layer:** 3 — Builder
- **Description:** Ephemeral Docker containers. Three modes: Mock (all 3 APIs), Live (iot-api-proxy), Disconnected-sim (periodic connectivity drops testing grace periods). Hot-reload. 30-min auto-destroy. URL: `preview-{projectId}.aep.friendly-tech.com`.
- **Key Technologies:** Docker SDK, nginx:alpine, Angular CLI, WebSocket
- **Dependencies:** codegen, mock-api-server, iot-api-proxy

### 7.6 publish-service

- **Nx Path:** `libs/builder/publish-service/`
- **Layer:** 3 — Builder
- **Description:** Ten-stage pipeline: Vitest → Playwright → lint+TS → AOT build → Docker/Helm → license inject → semver tag → Git push → Docker registry push → audit+billing. SaaS publish → Friendly infra; dedicated publish → self-contained package.
- **Key Technologies:** TypeScript, Docker SDK, Vitest, Playwright
- **Dependencies:** codegen, docker-generator, helm-generator, git-service, license-service, billing-service, audit-service

### 7.7 git-service

- **Nx Path:** `libs/builder/git-service/`
- **Layer:** 10 — Git Governance
- **Description:** GitHub/GitLab/Bitbucket via PAT/SSH. Init, commit, branch, PR, diff, rollback. ZIP export for non-Git. Friendly proprietary components (license-agent, iot-api-proxy, SDK, iot-ui) referenced as dependencies, never committed as source.
- **Key Technologies:** isomorphic-git, node-fetch
- **Dependencies:** publish-service, project-registry, audit-service

### 7.8 environment-service

- **Nx Path:** `libs/builder/environment-service/`
- **Layer:** 3 — Builder
- **Description:** Dev/staging/prod lifecycle. Per-env config: three API URLs, DB creds, Grafana URL, license key, deployment mode, LLM provider (Claude/Ollama). Promotion: Dev → Staging (auto) → Prod (Admin approval).
- **Key Technologies:** TypeScript, dotenv
- **Dependencies:** project-registry, policy-service

### 7.9 template-marketplace

- **Nx Path:** `libs/builder/template-marketplace/`
- **Layer:** 3 — Builder
- **Description:** 9 IoT starter templates: Fleet Ops, Smart City, Utility Metering, Industrial Asset, FWA/CPE, OTA Campaign, Alarm Console, Support Console, Partner Portal. Each defines pages, widgets, required APIs (across all three), DB schema, Grafana dashboards, billing.
- **Key Technologies:** TypeScript, JSON
- **Dependencies:** project-registry, page-composer, widget-registry

---

## 8. Layer 4 — IoT UI component library

> All 25+ components are fresh designs from scratch. Inspired by Admin Portal (data-dense tables, sidebar nav) and Support Portal (tabbed device detail, status badges, quick-action panels).

### 8.1 @friendly-tech/iot-ui

- **Nx Path:** `libs/ui/iot-ui/`
- **Layer:** 4 — UI Components
- **Description:** 25+ standalone Angular components: **Telemetry** (ft-gauge, ft-sparkline, ft-metric-card, ft-multi-axis-chart, ft-heatmap), **Device Mgmt** (ft-device-table with sortable columns/status badges/bulk select, ft-device-card with tabbed detail, ft-fleet-health, ft-ota-status, ft-alert-feed), **Geospatial** (ft-device-map with Leaflet navy/orange markers, ft-geofence-editor), **Control** (ft-command-button, ft-parameter-editor, ft-schedule-panel), **Analytics** (ft-anomaly-chart, ft-correlation-matrix, ft-forecast-panel), **Layout** (ft-dashboard-grid, ft-sidebar-nav, ft-breadcrumb, ft-theme-toggle, ft-page-shell, ft-kpi-strip). All OnPush + Signals. M3 theme. WCAG 2.1 AA. Dark mode: navy surface. Storybook docs. Published as private npm package.
- **Key Technologies:** Angular 17+, Material 3, CDK, Leaflet, ECharts, Storybook
- **Dependencies:** sdk-generator, widget-registry

---

## 9. Layer 5 — Grafana + Angular composition

### 9.1 grafana-provisioning

- **Nx Path:** `libs/grafana/provisioning/`
- **Layer:** 5 — Grafana
- **Description:** Generates datasource YAML (InfluxDB + PostgreSQL + external buckets), dashboard provider YAML, dashboard JSON, `grafana.ini` with SSO + Friendly theme reference. Supports both Friendly DM and third-party data sources side-by-side.
- **Key Technologies:** TypeScript, Handlebars, Grafana JSON schema
- **Dependencies:** influx-schemas, environment-service, dashboard-templates, grafana-theme

### 9.2 dashboard-templates

- **Nx Path:** `libs/grafana/dashboard-templates/`
- **Layer:** 5 — Grafana
- **Description:** 6 pre-built dashboards: fleet-overview, device-detail, alert-management, ota-management, billing-usage, connectivity-performance. Include third-party data panels. All use Friendly theme and Grafana variables.
- **Key Technologies:** JSON, Grafana model
- **Dependencies:** grafana-provisioning, influx-schemas, grafana-theme

### 9.3 grafana-theme (NEW)

- **Nx Path:** `libs/grafana/theme/`
- **Layer:** 5 — Grafana
- **Description:** Custom Grafana theme: navy (#12174C) panel headers, orange (#FF5900) primary series, charcoal secondary, Calibri font, navy dark mode surface. Chart sequence: navy → orange → charcoal → light-navy → lighter orange. Bundled into provisioning assets.
- **Key Technologies:** JSON, Grafana theme API, CSS
- **Dependencies:** grafana-provisioning

---

## 10. Layer 6 — Data architecture

### 10.1 prisma-schema

- **Nx Path:** `libs/data/prisma-schema/`
- **Layer:** 6 — Data
- **Description:** PostgreSQL schema via Prisma. Models: Tenant (deploymentMode, llmProviderConfig, three API credential sets via Vault), User, Project, Page, Widget, DataSource (apiTarget: NORTHBOUND|EVENTS|QOE|INFLUXDB|EXTERNAL), AppVersion, DeploymentTarget, GitIntegration, Billing tables (plans with $499/$2,499/$7,999 tiers), AuditEvent (with llmProvider/llmModel fields). Row-level security; dedicated mode optimises away tenant filter.
- **Key Technologies:** Prisma ORM, PostgreSQL 15
- **Dependencies:** All DB-accessing services

### 10.2 influx-schemas

- **Nx Path:** `libs/data/influx-schemas/`
- **Layer:** 6 — Data
- **Description:** 9 buckets: telemetry_raw (30d), telemetry_downsampled (365d), events (90d), firmware_rollout (180d), billing_metrics (730d), anomaly_markers (365d), external_mqtt (30d), external_http (30d), external_custom (configurable). External buckets tagged `source=external` for billing. Flux query templates.
- **Key Technologies:** TypeScript, InfluxDB v2 client, Flux
- **Dependencies:** grafana-provisioning, iot-tool-functions, telegraf-ingest-config

### 10.3 telegraf-ingest-config (NEW)

- **Nx Path:** `libs/data/telegraf-ingest-config/`
- **Layer:** 6 — Data
- **Description:** Generates Telegraf config: MQTT consumer (Friendly DM + third-party brokers), HTTP listener, syslog, SNMP. Routes: Friendly data → telemetry_raw; third-party → external_* buckets (tagged for billing). 1GB disk buffer for disconnected operation. Metering output to Redis Streams.
- **Key Technologies:** TypeScript, Handlebars, Telegraf syntax
- **Dependencies:** influx-schemas, docker-generator, billing-service

---

## 11. Layer 7 — Deployment engine

### 11.1 docker-generator

- **Nx Path:** `libs/deploy/docker-generator/`
- **Layer:** 7 — Deployment
- **Description:** Dual-mode Docker Compose: SaaS (shared, tenant-scoped) and Dedicated (self-contained). 9 services: frontend, grafana (with Friendly theme), influxdb (Friendly + external buckets), postgres, telegraf (third-party ingestion), iot-api-proxy (DM-exclusive enforcement), license-agent (tier grace periods), redis (disconnected cache), nginx-proxy. `.env.template` includes three API creds, LLM provider config, deployment mode.
- **Key Technologies:** TypeScript, Handlebars, Docker Compose schema
- **Dependencies:** environment-service, license-service, grafana-provisioning, telegraf-ingest-config

### 11.2 helm-generator

- **Nx Path:** `libs/deploy/helm-generator/`
- **Layer:** 7 — Deployment
- **Description:** Enterprise tier only ($7,999/mo). Helm charts with namespace-per-tenant (multi-tenant K8s) or dedicated-release (single-tenant). `values.yaml` includes Ollama config for customer LLM and third-party broker configs.
- **Key Technologies:** TypeScript, Handlebars, Helm schema
- **Dependencies:** docker-generator, environment-service, license-service

---

## 12. Layer 8 — License & commercial protection

### 12.1 license-service

- **Nx Path:** `libs/core/license-service/`
- **Layer:** 8 — License
- **Description:** Key format: `FTECH-AEP-{TIER}-{DEPLOY_MODE}-{TENANT_HASH}-{EXPIRY}-{FLAGS}-{HMAC}`. Deploy mode: S(aaS) or D(edicated). Feature flags: Helm, Git, Ollama, air-gap, third-party ingestion, custom widgets. Tiers: Starter $499/mo, Pro $2,499/mo, Enterprise $7,999/mo.
- **Key Technologies:** TypeScript, HMAC-SHA256, napi-rs (Rust FFI)
- **Dependencies:** policy-service

### 12.2 license-agent (Rust)

- **Nx Path:** `tools/license-agent/`
- **Layer:** 8 — License
- **Description:** Rust sidecar. Grace periods: Starter (none), Pro (24h), Enterprise (7d + air-gap offline license file). Validates key signature, expiry, tenant binding, deployment mode, Friendly DM endpoint URL. Heartbeat default 1h. After grace: read-only + warning banner. Signed binary, integrity-checked at start.
- **Key Technologies:** Rust (tokio, ring, reqwest, serde)
- **Dependencies:** license-service

### 12.3 iot-api-proxy

- **Nx Path:** `tools/iot-api-proxy/`
- **Layer:** 8 — License
- **Description:** Fastify proxy to all three Friendly APIs via auth-adapter. Friendly-exclusive DM enforcement: domain whitelist blocks competitor endpoints (AVSystem, Cumulocity, Axiros, Incognito). License validation before proxying. Rate limits per tier (100k/2M/20M calls/mo). API metrics to Redis Streams for billing. Disconnected mode: cached responses with `X-Cache-Stale` header, queued writes for replay.
- **Key Technologies:** Fastify, http-proxy-middleware, Redis
- **Dependencies:** license-agent, auth-adapter, billing-service, policy-service

---

## 13. Layer 9 — Metering, rating & billing

### 13.1 billing-service

- **Nx Path:** `libs/core/billing-service/`
- **Layer:** 9 — Billing
- **Description:** Captures events from all services: API calls (per source API), AI sessions + LLM token usage (per provider), preview minutes, publishes, premium widgets, third-party ingestion (MQTT $0.01/1k Pro, $0.005/1k Ent; HTTP $0.02/1k Pro, $0.01/1k Ent; storage $0.10/GB Pro, $0.05/GB Ent). Rating engine: $499/$2,499/$7,999 tiers with included units + overage. Hourly rollups, monthly invoices, threshold alerts at 80%/95%. Stripe + SAP + CSV. Ollama tokens metered at $0 but tracked.
- **Key Technologies:** TypeScript, Redis Streams, Prisma, Stripe, cron
- **Dependencies:** prisma-schema, iot-api-proxy, agent-runtime, llm-providers, telegraf-ingest-config

---

## 14. Layer 10 — Customer ownership & Git

Implemented via git-service (Section 7.7) and audit-service (Section 5.7).

### 14.1 Ownership boundary

| Asset | Owner | Notes |
|-------|-------|-------|
| Angular source | Customer | Fresh Friendly-branded design |
| Grafana JSON | Customer | Includes Friendly theme |
| Prisma schema | Customer | |
| Docker/Helm configs | Customer | Deployment mode config |
| Telegraf configs | Customer | 3rd-party ingestion setup |
| .env.template | Customer | 3 API creds + LLM config |
| license-agent | Friendly | Rust binary, signed |
| iot-api-proxy | Friendly | DM-exclusive enforcement |
| @friendly-tech/dm-sdk | Friendly | 3 API service classes |
| @friendly-tech/iot-ui | Friendly | Fresh widget designs |
| Grafana theme | Friendly | Navy/orange brand |

---

## 15. Module dependency matrix

| Module | Depends On |
|--------|-----------|
| aep-api-gateway | agent-runtime, project-registry, policy-service, license-service, billing-service, audit-service, auth-adapter |
| agent-runtime | llm-providers, iot-tool-functions, codegen, widget-registry, grafana-provisioning, docker-generator, prisma-schema, builder-orchestrator |
| llm-providers (NEW) | billing-service, audit-service, project-registry (tenant LLM config) |
| swagger-ingestion | auth-adapter, sdk-generator, iot-tool-functions |
| auth-adapter (NEW) | project-registry, audit-service, Redis |
| codegen | page-composer, widget-registry, sdk-generator, project-registry |
| preview-runtime | codegen, mock-api-server, iot-api-proxy |
| publish-service | codegen, docker-generator, helm-generator, git-service, license-service, billing-service, audit-service |
| grafana-provisioning | influx-schemas, environment-service, dashboard-templates, grafana-theme |
| telegraf-ingest-config (NEW) | influx-schemas, docker-generator, environment-service, billing-service |
| docker-generator | environment-service, license-service, grafana-provisioning, telegraf-ingest-config |
| billing-service | prisma-schema, iot-api-proxy, agent-runtime, llm-providers, telegraf-ingest-config |
| iot-api-proxy | license-agent, auth-adapter, billing-service, policy-service, Redis |

---

> This Module Reference v2.2 is the authoritative module catalogue. Use alongside the System Specification v2.2. All four architecture diagrams are referenced as Figures 1–4.

*Friendly AI AEP Tool — Proprietary Product of Friendly Technologies*
*Classification: Internal Engineering — Confidential*
