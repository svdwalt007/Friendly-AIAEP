# Friendly AI AEP Tool — System Specification v2.2

**Complete Merged Architecture with Embedded Diagrams**

Version 2.2 | April 2026 | Classification: Internal Engineering — Confidential

Repository: `github.com/friendly-technologies/friendly-ai-aep-tool`

---

## 1. Executive summary

This document is the complete, merged System Specification for the Friendly AI AEP Tool — an Agentic AI-powered IoT Application Enablement Platform. It supersedes both the original System Specification v2.0 and the Spec Addendum v2.1, incorporating all six resolved design decisions inline throughout every section.

The AEP Tool is a proprietary, commercially licensed SaaS/PaaS product that enables Friendly Technologies customers to create, deploy, and maintain production-grade IoT applications through conversational AI and a visual low-code builder, tightly integrated with the Friendly One-IoT DM Platform.

> **Target Revenue Opportunity:** $130–150M by Year 5 based on AEP licensing, metering, and generated application runtime fees.

### 1.1 Product identity

| Attribute | Value |
|-----------|-------|
| Product Name | Friendly AI AEP Tool |
| Category | Agentic AI IoT Application Enablement Platform |
| Licensing | SaaS/PaaS add-on to Friendly One-IoT DM |
| LLM (Phase 1) | Claude Opus 4.6 (all agents) via LLMProvider abstraction |
| LLM (Future) | Ollama (Enterprise), OpenAI, Gemini via pluggable adapter |
| Backend | Node.js 20 LTS / TypeScript strict / Fastify 4.x |
| Frontend | Angular 17+ / Material 3 / Signals |
| Analytics | Grafana OSS 10+ with Friendly navy/orange theme |
| Data Tier | PostgreSQL 15 + InfluxDB v2 (or TimescaleDB) |
| Deployment | Docker Compose (SaaS + Dedicated) / Kubernetes / Helm |
| APIs Integrated | 3 Friendly APIs: Northbound REST, Events/Webhook REST, QoE/Monitoring REST |
| Auth Methods | UID/PW Basic Auth, API Key, JWT, future OAuth2 |
| Deployment Modes | Multi-tenant SaaS (Friendly-hosted) + Dedicated single-tenant |
| Pricing Tiers | Starter $499/mo · Professional $2,499/mo · Enterprise $7,999/mo |
| Monorepo | Nx workspace (35 modules) |
| CI/CD | GitHub Actions |
| Repository | `github.com/friendly-technologies/friendly-ai-aep-tool` |

### 1.2 Key differentiators

- Deep integration to three Friendly One-IoT DM APIs via Swagger/OpenAPI
- IoT-specific domain intelligence: device management, telemetry, OTA, alarms, fleet health, geofencing
- Angular-first output with real, customer-ownable source code and fresh Friendly-branded design
- Grafana-first analytics with custom navy/orange Friendly theme
- Friendly-exclusive runtime/license lock: generated apps only operate against licensed Friendly DM environments
- Built-in metering and billing with third-party IoT data ingestion support
- Docker-first portability with dual SaaS/dedicated deployment
- Multi-agent agentic UX — all 11 agents on Claude Opus 4.6 with Ollama option for Enterprise
- Disconnected operation support with tier-dependent grace periods

---

## 2. Competitive platform analysis

Consolidated recommendation matrix extracting the strongest patterns from Base44, Replit, and Appsmith, adapted for Friendly's IoT use case.

| Capability | Source | Adaptation for Friendly |
|-----------|--------|------------------------|
| Prompt-to-app generation UX | Base44 | Replace generic data model with IoT domain + three Friendly APIs |
| Template marketplace | Base44 | IoT-specific templates (fleet ops, metering, OTA, etc.) |
| Planning conversation mode | Base44 | IoT domain agent with three-API awareness |
| Agent task decomposition | Replit | Multi-agent (11 agents, all Opus 4.6) with supervisor routing |
| Workspace layout | Replit | Add Grafana panels, deployment mode selector, connectivity status |
| Live preview with hot-reload | Replit | Docker sandbox with mock/live/disconnected-sim modes |
| One-click publish workflow | Replit | Docker Compose/Helm + license inject + dual SaaS/dedicated target |
| Page/Widget/Binding schema | Appsmith | Schema drives real Angular codegen, not metadata runtime |
| Git-backed version control | Appsmith | Push to customer's own GitHub/GitLab/Bitbucket |
| Self-hosting deployment | Appsmith | Docker Compose + Helm + air-gapped license for Enterprise |
| IoT widget library | Friendly (unique) | Fresh designs inspired by Admin Portal + Support Portal |
| Grafana provisioning-as-code | Friendly (unique) | Dashboard JSON + datasource YAML + custom Friendly theme |
| Multi-agent IoT architecture | Friendly (unique) | 11 agents on Opus 4.6 with LLMProvider abstraction |
| License/runtime commercial lock | Friendly (unique) | Rust sidecar + Friendly-exclusive DM enforcement |
| Metering/billing engine | Friendly (unique) | Usage capture including third-party IoT data ingestion |

---

## 3. System architecture overview

The platform comprises 35 modules across 10 architectural layers within an Nx monorepo.

*See Figure 1 in the Module Reference v2.2 for the full architecture diagram.*

### 3.1 Architecture layer summary

| Layer | Name | Key Technologies |
|-------|------|-----------------|
| 1 | AEP Core Platform Engine | Fastify, LangGraph, llm-providers (Opus 4.6 + Ollama), Redis |
| 2 | Friendly API Integration (3 APIs) | auth-adapter (Basic/JWT/APIKey/OAuth2), openapi-generator-cli |
| 3 | Agentic Builder | Angular 17+, Material 3, Monaco, Docker preview (3 modes) |
| 4 | IoT UI Components | @friendly-tech/iot-ui (fresh designs), Signals, Storybook |
| 5 | Grafana Composition | Grafana OSS 10+, Friendly theme (navy/orange), provisioning-as-code |
| 6 | Data Architecture | PostgreSQL 15 + Prisma, InfluxDB v2, Redis 7, Telegraf (3rd-party ingest) |
| 7 | Deployment Engine | Docker Compose (SaaS+Dedicated), Helm (Enterprise), GitHub Actions |
| 8 | License & Protection | Rust binary (tier grace periods), iot-api-proxy (Friendly-exclusive DM lock) |
| 9 | Billing Engine | Redis Streams, rating engine ($499/$2.5k/$8k tiers), Stripe/SAP, 3rd-party metering |
| 10 | Git Governance | isomorphic-git, GitHub/GitLab/Bitbucket, customer source ownership |

### 3.2 Monorepo structure

```
friendly-ai-aep-tool/
├── apps/aep-builder/            # Angular 17+ builder UI
├── apps/aep-api-gateway/        # Fastify gateway
├── apps/aep-preview-host/       # Preview container manager
├── libs/core/agent-runtime/     # LangGraph multi-agent
├── libs/core/llm-providers/     # LLM abstraction (NEW)
├── libs/core/builder-orchestrator/
├── libs/core/project-registry/  # + tenant LLM config
├── libs/core/policy-service/    # tier enforcement
├── libs/core/license-service/   # Rust FFI
├── libs/core/billing-service/   # + 3rd-party metering
├── libs/core/audit-service/
├── libs/iot/swagger-ingestion/  # 3 API specs
├── libs/iot/auth-adapter/       # 3-API auth (NEW)
├── libs/iot/sdk-generator/      # 3 service classes
├── libs/iot/iot-tool-functions/ # 3-API tools
├── libs/iot/mock-api-server/    # simulates all 3 APIs
├── libs/builder/{page-composer,widget-registry,codegen,
│          preview-runtime,publish-service,git-service,
│          environment-service,template-marketplace}
├── libs/ui/iot-ui/              # @friendly-tech/iot-ui
├── libs/grafana/{provisioning,dashboard-templates,theme}
├── libs/data/{prisma-schema,influx-schemas,telegraf-ingest-config}
├── libs/deploy/{docker-generator,helm-generator}
├── tools/{license-agent,iot-api-proxy}
├── docs/  docker/  .github/
└── nx.json  tsconfig.base.json  package.json
```

---

## 4. Multi-agent architecture

All agents run Claude Opus 4.6 in Phase 1, configured through the llm-providers abstraction which allows per-agent model overrides and future provider swapping including Ollama for Enterprise customers.

*See Figure 2 in the Module Reference v2.2 for the multi-agent orchestration diagram.*

### 4.1 Agent model assignments

| Agent | LLM (Phase 1) | Tools | Future Candidates |
|-------|---------------|-------|-------------------|
| Supervisor | Claude Opus 4.6 | All agent dispatch tools | Opus (default), Ollama |
| Product Planning | Claude Opus 4.6 | project-registry, templates | Opus, Ollama Llama 3.1 |
| IoT Domain | Claude Opus 4.6 | iot-tool-functions (3 APIs) | Opus, Ollama Mistral |
| Swagger API | Claude Opus 4.6 | swagger-ingestion, sdk-gen | Haiku 4.5 (cost opt), Ollama |
| Angular UI Composer | Claude Opus 4.6 | codegen, widget-registry | Opus (quality-critical) |
| Grafana Dashboard | Claude Opus 4.6 | grafana-provisioning, influx | Sonnet 4.6, Ollama |
| Database | Claude Opus 4.6 | prisma-schema, influx-schemas | Haiku 4.5, Ollama |
| Deployment | Claude Opus 4.6 | docker-gen, helm-gen | Sonnet 4.6, Ollama |
| Billing & Metering | Claude Opus 4.6 | billing-service | Haiku 4.5 |
| Security & Policy | Claude Opus 4.6 | policy-svc, license-svc | Opus (security-critical) |
| QA/Test | Claude Opus 4.6 | preview-runtime, test-runner | Sonnet 4.6, Ollama |

### 4.2 LLM provider abstraction

```typescript
interface LLMProvider {
  id: string;         // 'anthropic' | 'ollama' | 'openai' | 'google'
  chat(msgs: Message[], tools?: ToolDef[]): AsyncIterable<StreamChunk>;
  embed?(text: string): Promise<number[]>;
}

// Per-agent config, overridable per-tenant via project-registry
const AGENT_LLM_MAP: Record<AgentRole, LLMConfig> = {
  supervisor: { provider: 'anthropic', model: 'claude-opus-4-6' },
  // Enterprise tenant override example:
  // supervisor: { provider: 'ollama', model: 'llama3.1:70b', baseUrl: 'http://...' }
};
```

- **Anthropic adapter:** `@anthropic-ai/sdk` with streaming + tool-calling
- **Ollama adapter:** OpenAI-compatible HTTP endpoint with tool-calling translation
- **Fallback chain:** configurable per-agent (e.g., Ollama → Claude on failure)
- **Token usage:** tracked per provider per agent for billing (Claude metered at cost; Ollama at $0 but tracked)

---

## 5. Friendly One-IoT DM API integration

The platform integrates with three separate Friendly RESTful APIs, each with its own authentication mechanism, unified through the auth-adapter module.

*See Figure 3 in the Module Reference v2.2 for the three-API authentication flow diagram.*

### 5.1 Three Friendly APIs

| API | Purpose | Auth Methods | Documentation |
|-----|---------|-------------|---------------|
| Northbound REST | Device mgmt, provisioning, FW, LwM2M, bulk ops | UID/PW Basic Auth + API Key | FT-IoT Northbound REST API specs.pdf |
| Events/Webhook REST | Real-time event subscriptions, webhook push | JWT (from UID/PW exchange) + API Key | FT-IoT Register for Event REST API specs.pdf |
| QoE/Monitoring REST | Time-series monitoring, KPIs, connectivity stats | UID/PW Basic Auth + API Key | FT-IoT QoE REST API guide.pdf |

### 5.2 IoT tool functions (all 3 APIs)

| Function | Source API | Description |
|----------|-----------|-------------|
| `getDeviceList(tenantId, filters)` | Northbound | Paginated device list |
| `getDeviceDetails(deviceId)` | Northbound | Full device record + data model |
| `triggerOTAUpdate(deviceId, fwVer)` | Northbound | Firmware update campaign |
| `executeLwM2MCommand(deviceId, path, payload)` | Northbound | Execute LwM2M operation |
| `readLwM2MResource(deviceId, path)` | Northbound | Read LwM2M resource value |
| `writeLwM2MResource(deviceId, path, value)` | Northbound | Write LwM2M resource |
| `registerWebhook(eventType, callbackUrl)` | Events | Subscribe to device events |
| `getEventSubscriptions(tenantId)` | Events | List active subscriptions |
| `unregisterWebhook(subscriptionId)` | Events | Remove subscription |
| `getDeviceTelemetry(deviceId, metric, range)` | QoE | Time-series monitoring data |
| `getFleetTelemetry(filters, metric, range)` | QoE | Aggregated fleet data |
| `getKPIMetrics(tenantId, kpiType, period)` | QoE | Performance KPIs |
| `getConnectivityStats(deviceId, period)` | QoE | Connection quality data |

---

## 6. Builder experience

*See Figure 4 in the Module Reference v2.2 for the prompt-to-deploy pipeline diagram.*

### 6.1 Workspace layout

| Panel | Position | Content |
|-------|----------|---------|
| Agent Chat | Left (300px, collapsible) | Conversational AI, task list, suggested actions |
| Canvas / Editor | Centre (fluid) | Visual canvas · Monaco editor · Live preview (tabbed) |
| Properties | Right (320px, collapsible) | Widget props, data bindings (3 API sources), theme |
| Status Bar | Bottom (200px, collapsible) | Build logs, tests, preview status, connectivity indicator |

### 6.2 Builder modes

| Mode | System Behaviour |
|------|-----------------|
| Prompt | Product Planning Agent captures requirements via all 3 APIs |
| Plan | Orchestrator decomposes into ordered build tasks |
| Visual | Drag-and-drop page composition with fresh Friendly-branded widgets |
| Developer | Monaco editor with IntelliSense for 3 SDK service classes |
| Preview | Docker sandbox: Mock (3 APIs) · Live (proxy) · Disconnected-sim |
| Publish | Build pipeline → SaaS deployment or Dedicated deployment package |

### 6.3 UI design system

> Fresh component designs from scratch, inspired by Friendly Admin Portal (data-dense tables, sidebar nav, form panels) and Support Portal (tabbed device detail, status badges, quick-action panels). Angular Material 3 with Friendly custom theme tokens.

- Navy (#12174C) as primary navigation and header colour
- Orange (#FF5900) as accent for CTAs, alerts, and interactive highlights
- Dark mode: navy as dark surface, white text, orange accents
- Responsive breakpoints: desktop (1440px+), tablet (768–1439px), mobile (<768px)
- `ft-device-table`: sortable columns, status badges, bulk select (Admin Portal pattern)
- `ft-device-card`: tabbed detail — Status/Config/Firmware/History (Support Portal pattern)
- `ft-gauge`: circular SVG, navy arc, orange indicator (fresh design)
- `ft-device-map`: Leaflet with navy/orange markers, cluster groups (fresh design)
- Grafana theme: navy panel headers, orange primary series, Calibri font, navy dark mode

---

## 7. Deployment model

> Both multi-tenant SaaS and dedicated single-tenant deployment supported from Phase 1.

| Aspect | Multi-Tenant SaaS | Dedicated Single-Tenant |
|--------|-------------------|------------------------|
| Hosting | Friendly-managed cloud (AWS/Azure) | Customer infra or Friendly-managed dedicated |
| Isolation | Logical (row-level security, namespace) | Physical (separate DB, separate containers) |
| Data Residency | Friendly-selected region | Customer-selected region / on-premises |
| LLM Provider | Claude only (Friendly-hosted) | Claude + Ollama (customer-hosted) |
| Update Cycle | Continuous deployment by Friendly | Customer-controlled schedule |
| Pricing | Lower per-seat/device | Higher base, lower marginal at scale |
| Target Tier | Starter, Professional | Professional, Enterprise |

### 7.1 Generated application stack

| Service | Image | Purpose |
|---------|-------|---------|
| frontend | nginx:alpine + Angular | Serves generated SPA |
| grafana | grafana-oss:10.x + Friendly theme | Analytics dashboards |
| influxdb | influxdb:2.7 | Time-series (Friendly + external buckets) |
| postgres | postgres:15-alpine | Relational data |
| telegraf | telegraf:1.29 | Ingestion bridge (Friendly MQTT + 3rd-party sources) |
| iot-api-proxy | Node.js Fastify | Friendly-exclusive DM proxy + license check |
| license-agent | Rust binary (signed) | Runtime license validation sidecar |
| redis | redis:7-alpine | Cache + pub/sub + disconnected queue |
| nginx-proxy | nginx:alpine | Reverse proxy / TLS termination |

---

## 8. Commercial tiers and pricing

> Market-benchmarked pricing based on IoT AEP platform norms (ThingsBoard, Losant, Kaa, Particle). Friendly to adapt based on competitive positioning.

| Dimension | Starter $499/mo | Professional $2,499/mo | Enterprise $7,999/mo |
|-----------|----------------|----------------------|---------------------|
| Included Devices | 1,000 | 25,000 | 100,000+ |
| AI Generation Sessions | 50/month | 500/month | Unlimited |
| Generated Applications | 3 | 10 | Unlimited |
| Active Users/Seats | 5 | 25 | Unlimited |
| API Calls | 100k/month | 2M/month | 20M/month |
| Time-Series Ingestion | 1GB/month | 25GB/month | 500GB/month |
| Grafana Dashboards | 3 | Unlimited | Unlimited + custom plugins |
| Deployment Output | Docker Compose | Docker Compose + Git | Docker + Helm + Git + K8s |
| Deployment Mode | SaaS only | SaaS or dedicated | SaaS or dedicated |
| LLM Provider | Claude (Friendly-hosted) | Claude (Friendly-hosted) | Claude + Ollama |
| Disconnected Mode | Not supported | 24h grace period | 7-day grace + air-gap |
| 3rd-Party Ingestion | Not included | Metered ($0.01/1k msgs) | Metered ($0.005/1k msgs) |
| Support | Community + docs | Business hours email | 24/7 + dedicated engineer |

### 8.1 License key format

```
FTECH-AEP-{TIER}-{DEPLOY_MODE}-{TENANT_HASH}-{EXPIRY_EPOCH}-{FEATURE_FLAGS}-{HMAC}
```

- **TIER:** STR / PRO / ENT
- **DEPLOY_MODE:** S (SaaS) or D (Dedicated)
- **FEATURE_FLAGS:** encoded bitfield (Helm, Git, Ollama, air-gap, 3rd-party ingest, custom widgets)
- **HMAC:** HMAC-SHA256 with Friendly private key

---

## 9. Disconnected operation and data policy

### 9.1 Offline behaviour

- License agent grace: Starter (none), Professional (24h), Enterprise (7d + air-gap offline license file)
- Redis cache: 4h rolling cache of recent device data for dashboard rendering during disconnection
- Command queue: device commands queued in Redis, flushed on reconnection
- Telegraf buffer: 1GB disk buffer for telemetry during InfluxDB/API connectivity loss
- UI indicator: connectivity status banner (Connected / Degraded / Offline) in Angular nav bar

### 9.2 Friendly-exclusive DM integration

- `iot-api-proxy` maintains domain whitelist of verified Friendly One-IoT DM endpoints
- Requests to non-Friendly API endpoints blocked with 403
- Competitor DM platforms explicitly blocked: AVSystem, Cumulocity, Axiros, Incognito
- Generated SDK only imports `@friendly-tech/dm-sdk`; no generic HTTP escape hatch
- License agent verifies DM endpoint URL matches licensed Friendly instance

### 9.3 Third-party IoT data ingestion

While DM integration is Friendly-exclusive, the platform supports ingesting IoT data from third-party sources for analytics and dashboards:

- Telegraf inputs: MQTT, HTTP listener, Kafka consumer, syslog, SNMP
- External data routed to InfluxDB buckets tagged `source=external`
- Separately metered in billing engine under "Third-Party Data Ingestion" dimension
- Grafana dashboards visualise Friendly DM data and third-party data side-by-side

| Dimension | Professional | Enterprise |
|-----------|-------------|-----------|
| Third-party MQTT messages | $0.01/1000 msgs | $0.005/1000 msgs |
| Third-party HTTP ingestion | $0.02/1000 requests | $0.01/1000 requests |
| External data storage | $0.10/GB/month | $0.05/GB/month |

---

## 10. Security, policy, and data privacy

### 10.1 Authentication and authorisation

- Three-method auth via auth-adapter: Basic Auth (Northbound/QoE), JWT exchange (Events), API Key (all), future OAuth2
- Role-based access: Admin, Developer, Viewer per project
- Tenant isolation: row-level security in PostgreSQL; dedicated mode uses physical isolation

### 10.2 Infrastructure security

- mTLS between internal services
- Secret management via HashiCorp Vault (credential encryption for three API credential sets)
- Container image scanning (Trivy) + dependency scanning (Snyk) in CI/CD
- Image signing with cosign/Sigstore

### 10.3 Application security

- OWASP Top 10 protections in builder UI and generated apps
- CSP headers, Fastify JSON schema validation on all endpoints
- No `eval()`, no dynamic `require()`, no unproxied external fetch in generated code
- Friendly-exclusive DM enforcement: codegen validation blocks competitor API references

### 10.4 GDPR / Privacy

- Tenant data isolation at every layer; dedicated mode keeps all data on customer infrastructure
- Data residency: customer chooses region (SaaS) or controls entirely (dedicated)
- Right to deletion: customer can purge all project data and generated assets

---

## 11. Implementation phases

### 11.1 Phase 1 — Foundation (Weeks 1–12)

> Goal: Nx monorepo, core infra, working prompt-to-preview pipeline with three-API awareness and Claude Opus 4.6.

| Deliverable | Layer | Key Detail |
|-------------|-------|-----------|
| Nx monorepo scaffold | All | 35-module workspace, tsconfig, CI |
| aep-api-gateway | 1 | Fastify + auth-adapter (3 methods) |
| llm-providers | 1 | Anthropic adapter (Opus 4.6) + Ollama stub |
| auth-adapter | 2 | Basic Auth + API Key + JWT for 3 APIs |
| swagger-ingestion (3 specs) | 2 | Ingest Northbound + Events + QoE specs |
| sdk-generator (3 services) | 2 | NorthboundService, EventsService, QoEService |
| 5 core IoT tool functions | 2 | getDeviceList, getDetails, getTelemetry, registerWebhook, getKPIs |
| Plan-mode agent | 1 | Supervisor + Planning + IoT Domain (Opus 4.6) |
| Angular builder shell | 3 | Four-panel layout, Friendly M3 theme, dark mode |
| Preview runtime MVP | 3 | Docker sandbox with mock (3 APIs) mode |
| Docker stack generator | 7 | docker-compose.yml (SaaS + dedicated stubs) |
| License service MVP | 8 | Key format with deploy mode, basic validation |
| PostgreSQL + Prisma schema | 6 | Core tables incl. 3-API creds, deployment mode |

### 11.2 Phase 2 — Core Builder (Weeks 13–26)

> Goal: Visual page builder, Angular codegen, Grafana provisioning, first publish pipeline.

| Deliverable | Layer | Key Detail |
|-------------|-------|-----------|
| Visual page builder | 3 | Drag-and-drop with fresh Friendly widget designs |
| 10 core widgets | 4 | ft-device-table, ft-gauge, ft-metric-card, ft-sparkline, ft-device-map, ft-alert-feed, ft-fleet-health, ft-ota-status, ft-command-button, ft-kpi-strip |
| Angular code generator | 3 | 8-stage pipeline incl. 3 SDK services and Friendly M3 theme |
| Grafana provisioning + theme | 5 | Dashboard JSON + navy/orange Friendly theme |
| 3 starter templates | 4 | Fleet Operations, Utility Metering, OTA Campaign |
| Git integration | 10 | Push to customer GitHub/GitLab/Bitbucket |
| Publish pipeline v1 | 3/7 | Build, Docker Compose (SaaS + dedicated), license inject |
| Billing event capture | 9 | Redis Streams for API calls, generation sessions, 3rd-party ingest |
| InfluxDB + Telegraf | 6 | Buckets setup + 3rd-party ingestion config |
| Disconnected-sim preview mode | 3 | Periodic connectivity drops testing grace periods |

### 11.3 Phase 3 — Commercial Launch (Weeks 27–40)

| Deliverable | Layer | Key Detail |
|-------------|-------|-----------|
| Full 11-agent orchestration | 1 | All agents operational on Opus 4.6 |
| Ollama integration | 1 | llm-providers Ollama adapter for Enterprise |
| Environment promotion | 3 | Dev → Staging → Production with approvals |
| Helm/Kubernetes output | 7 | Enterprise tier Helm charts |
| Full billing/rating/invoicing | 9 | $499/$2.5k/$8k tiers, Stripe, 3rd-party metering |
| Collaboration and approvals | 10 | Multi-user access, publish approval workflow |
| Security hardening | 10 | mTLS, Vault, scanning, signing, DM-lock enforcement |
| Automated test suite | 3 | Vitest + Playwright for generated apps |
| Docusaurus docs | All | Admin, Builder, Developer, API Reference guides |

### 11.4 Phase 4 — Ecosystem (Weeks 41–52+)

- Custom Widget SDK: customers build and register own Angular widgets
- Partner/reseller: white-label branding, sub-tenant management
- Template Marketplace expansion: community-contributed templates
- Advanced AI: anomaly detection, predictive maintenance (leveraging Ollama local models)
- Mobile-optimised runtime: responsive layouts, PWA support
- Multi-LLM cost optimisation: selective routing of low-complexity tasks to Haiku/Ollama

---

## 12. Architecture decision records

### ADR-001: LangGraph over custom orchestration
**Decision:** Use LangGraph (TypeScript) for multi-agent orchestration.
**Rationale:** StateGraph with checkpointing, conditional edges, native tool-calling. Saves 3–4 months vs custom framework.

### ADR-002: Angular codegen over metadata runtime
**Decision:** Generate real Angular source that customers own and maintain.
**Rationale:** Customer code ownership is key differentiator. No vendor lock-in on generated IP.

### ADR-003: InfluxDB v2 over TimescaleDB
**Decision:** Default InfluxDB v2; TimescaleDB documented as alternative.
**Rationale:** Native Grafana datasource, Flux queries, Telegraf ecosystem for IoT ingestion.

### ADR-004: Rust for license service binary
**Decision:** Compiled Rust binary for license-agent sidecar.
**Rationale:** Tamper-resistant, memory-safe, small footprint, napi-rs FFI to Node.js.

### ADR-005: Nx over Turborepo
**Decision:** Nx with Angular plugin for monorepo.
**Rationale:** First-class Angular support, computation caching, affected-based CI.

### ADR-006: Claude Opus 4.6 with LLMProvider abstraction
**Decision:** All agents use Claude Opus 4.6 in Phase 1. LLMProvider interface from Day 1 with Ollama adapter for Enterprise.
**Rationale:** Opus 4.6 is the most capable model for complex codegen and planning. Abstraction costs ~2 days and avoids hard-coding. Ollama essential for data sovereignty.

### ADR-007: Three-API unified auth-adapter
**Decision:** Single auth-adapter module handles credential lifecycle for all three Friendly APIs.
**Rationale:** Unified credential management, Redis token cache, auto-refresh. Avoids scattered auth logic. OAuth2 stub ready for future DM upgrade.

### ADR-008: Dual deployment mode from Phase 1
**Decision:** Support both multi-tenant SaaS and dedicated single-tenant from initial architecture.
**Rationale:** Telco/utility customers require data sovereignty (dedicated). SaaS lowers barrier for SME. License key encodes deployment mode.

---

## 13. Testing strategy

| Level | Framework | Scope | Trigger |
|-------|-----------|-------|---------|
| Unit | Vitest | Functions, services, agents, codegen transforms | Every PR |
| Integration | Supertest | API contracts, DB ops, 3-API tool calls | PR merge to develop |
| E2E (Platform) | Playwright | Builder UI: prompt → plan → build → preview → publish | Nightly + RC |
| E2E (Generated) | Playwright | Generated app navigation, data loading, Grafana embed | Every publish |
| Contract | Pact | Friendly 3-API contract vs Swagger specs | Weekly |
| Security | Trivy + Snyk | Container vulns, npm audit, SAST | Every PR + nightly |
| Performance | k6 | Gateway throughput, codegen latency, preview startup | Weekly + release |
| License | Rust tests | Key validation, grace period, tamper detection, DM-lock | License-service changes |
| LLM Integration | Custom | Ollama adapter, fallback chains, token metering | Nightly |

---

## 14. Risk register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| LLM output quality variance | High | Medium | Structured prompts, output validation, human review, fallback templates |
| Angular codegen unbuildable output | High | Medium | Strict TS compilation check, automated fix-up agent |
| License enforcement bypass | Critical | Low | Rust binary integrity, API proxy enforcement, periodic audit |
| Three-API spec changes break SDK | Medium | High | Versioned SDK, backwards-compatible proxy layer, contract tests |
| Preview environment exhaustion | Medium | Medium | Session timeouts, resource limits, queue-based provisioning |
| Multi-agent hallucination | High | Medium | Supervisor validation, structured tools, human approval gates |
| Tenant data leakage | Critical | Low | Row-level security, pen testing, dedicated mode for sensitive customers |
| Ollama model quality gap | Medium | Medium | Fallback to Claude on failure, quality benchmarks before enabling |
| Phase 1 timeline overrun | High | High | Strict MVP scope, defer visual builder to Phase 2 |

---

## 15. Assumptions (all resolved)

| # | Question | Resolution |
|---|----------|-----------|
| 1 | LLM providers for MVP? | Claude Opus 4.6 only, with LLMProvider abstraction for Ollama/future providers |
| 2 | Friendly DM API auth mechanism? | Three APIs: UID/PW + API Key + JWT. Future OAuth2 hooks via auth-adapter stub. |
| 3 | SaaS or dedicated deployment? | Both. Dual-mode architecture with license key encoding deployment mode. |
| 4 | Target tier pricing? | $499 / $2,499 / $7,999 monthly (market-benchmarked). Annual discounts 15–20%. |
| 5 | Offline/disconnected support? | Yes with tier-dependent grace periods. Friendly DM exclusive. 3rd-party ingestion metered. |
| 6 | Existing design system? | None. Fresh designs from scratch, inspired by Admin Portal + Support Portal. |

---

> This merged specification is the single authoritative architecture document for the Friendly AI AEP Tool. All design decisions are final and integrated. Use alongside the Module Reference v2.2 for the complete development blueprint.

*Friendly AI AEP Tool — Proprietary Product of Friendly Technologies*
*Classification: Internal Engineering — Confidential*
