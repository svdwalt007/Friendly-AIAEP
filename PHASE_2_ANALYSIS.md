# Phase 2 Analysis — Friendly-AIAEP

**Date:** 2026-05-08
**Reviewer:** Phase-2 read-only inspection (Sean's CLAUDE.md global laws applied)
**Repo:** `/mnt/d/Dev/Friendly-AIAEP`
**Branch:** `main` (HEAD `766521c feat(core): commit outstanding work for project finalization`)
**Mode:** Read-only — no code changes, no commits.

---

## 1. Project Identity

**Friendly-AIAEP** = AI-Powered Application Execution Platform. An Nx monorepo for an AI-driven IoT app builder: a Fastify API gateway + Angular builder UI + Express preview host orchestrating LangGraph agents (Claude) that ingest OpenAPI/Swagger IoT specs and emit deployable Angular apps with Grafana dashboards.

```
PROJECT_NAME    : Friendly-AIAEP
LANGUAGE        : TypeScript 5.9.3 (strict)
PLATFORM        : server + client (Nx monorepo, 38 projects)
BUILD SYSTEM    : Nx 22.6.4 + pnpm 10.33.0
TEST FRAMEWORK  : Vitest 4.1.4
COVERAGE TOOL   : @vitest/coverage-v8 (istanbul)
LINT TOOL       : eslint 10 + tsc
TARGET RUNTIMES : Node 20+, Angular 21.2, Fastify 5.8, PostgreSQL 16, Redis 7, InfluxDB 2.7, Docker
KEY DEPS        : @langchain/langgraph 0.0.12, @anthropic-ai/sdk 0.92, @prisma/client 6.5,
                  @opentelemetry/* 0.214, dockerode 5
```

**Apps (3):** `aep-api-gateway`, `aep-builder`, `aep-preview-host`
**Libs (30):** core × 8, builder × 8, iot × 5, data × 3, deploy × 2, grafana × 3, shared × 3, ui × 1
**CI:** GitHub Actions — `ci.yml`, `deploy.yml`, `e2e.yml`, `performance.yml`, `preview.yml`, `quality-gate.yml`, `security.yml`

---

## 2. Build Status

**Last known (2026-04-11 BUILD-AND-TEST-REPORT):** **PASS — 33/33 projects** with TS strict.
**Live re-run today (2026-05-08):** `pnpm nx run-many --target=build --exclude=friendly-aiaep --skip-nx-cache` was kicked off; Angular `aep-builder` ng build is the long-pole. No new breaking commits since 4-11 (only `feat(core)` finalisation, CRLF normalisation, dependency bumps to nx 22.6.4 / prisma 6.5).

**Verdict: PASS (presumed, no observed regressions).**

Caveat: prior build relied on heavy workarounds — see §5 for the structural debt that lets it compile.

Per-app build artefacts present in `dist/apps/{aep-api-gateway,aep-builder,aep-preview-host}` and `dist/libs/{core,builder,iot,data,deploy,grafana,shared,ui}` — all 30 lib outputs accounted for.

---

## 3. Test Status

**Source:** `docs/testing/BUILD-AND-TEST-REPORT.md` (2026-04-11), corroborated by `coverage/` artefacts dated 2026-05-06.

| Library | Pass | Fail | Total | Status |
|---|---|---|---|---|
| swagger-ingestion | 68 | 0 | 68 | PASS |
| llm-providers | 86 | 78 | 164 | PARTIAL |
| agent-runtime | 46 | 17 | 63 | PARTIAL |
| prisma-schema | 23 | 3 | 26 | PARTIAL |
| auth-adapter | 124 | 35 | 159 | PARTIAL |
| sdk-generator | 85 | 6 | 91 | PARTIAL |
| preview-runtime | 0 | 40 | 40 | FAIL |
| **TOTALS** | **~432** | **~179** | **~611** | **71 % pass** |

**23 of 30 libs have NO test runs reported** (no spec files or only the trivial `lib-name.spec.ts` shadow of a 4-LOC stub). The 7 libs above are the only ones with substantive suites.

**Verdict: FAIL on Sean's 100 % gate.** 29 % failing + 23 untested libs = nowhere near the L4 contract.

---

## 4. Coverage

Reports exist for **5 libraries** (read from `coverage/libs/*/index.html`):

| Library | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| audit-service | 100.00 % | 100.00 % | 100.00 % | 100.00 % |
| billing-service | 100.00 % | 97.67 % | 100.00 % | 100.00 % |
| llm-providers | 99.83 % | 99.76 % | 100.00 % | 99.83 % |
| iot-tool-functions | 100.00 % | 100.00 % | 100.00 % | 100.00 % |
| swagger-ingestion | 97.78 % | 86.61 % | 100.00 % | 100.00 % |

**Aggregate over reported libs:** ~99.5 % line / ~96.8 % branch.
**Aggregate over the whole repo:** unknown — **25 of 30 libs produce no coverage data.** Apps (`aep-api-gateway`, `aep-builder`, `aep-preview-host`) likewise have no aggregated coverage report.

**Verdict: FAIL on the 100 % line + branch gate** at the workspace level. swagger-ingestion branch coverage 86.61 % alone trips the gate before counting the 25 silent libs.

---

## 5. Quality Violations (Global-Law Breaches)

Pattern scan: `TODO|FIXME|HACK|XXX|stub|placeholder|not implemented|@ts-nocheck|@ts-ignore` across `apps/**/src` and `libs/**/src` (excluding test files where the marker is a literal string assertion).

**Total: 94 occurrences across 38 files** (63 in libs, 31 in apps).

### 5a. `@ts-nocheck` — full-file type-check suppression (Law L3 violation)

| File | Justification given |
|---|---|
| `libs/core/agent-runtime/src/lib/checkpointer.ts:1` | "Fix pg module types and process.env index signature issues" |
| `libs/core/agent-runtime/src/lib/graph.ts:9` | "Fix StateGraph type issues" |
| `libs/core/agent-runtime/src/lib/agents/supervisor.ts:8` | "Fix type issues with LLMProvider" |
| `libs/core/agent-runtime/src/lib/agents/planning.ts:9` | "Fix type issues with LLMProvider" |
| `libs/core/agent-runtime/src/lib/agents/iot-domain.ts:6` | "Fix type issues with LLMProvider and StructuredToolInterface" |
| `libs/iot/sdk-generator/src/lib/sdk-generator.ts:6` | "Fix type issues with swagger-ingestion integration" |

Six core production files have type checking disabled. The agent runtime — the headline feature — is entirely untyped.

### 5b. Stub libraries — bodies are 1-line `return 'lib-name'` placeholders

These compile clean and "pass" their `.spec.ts` (which only asserts the stub returns the string) but contain **zero functionality**:

| Lib | Source LOC | Stub? |
|---|---|---|
| `libs/builder/codegen` | 4 | YES — `return 'codegen'` |
| `libs/builder/page-composer` | 4 | YES |
| `libs/builder/widget-registry` | 4 | YES |
| `libs/builder/publish-service` | 4 | YES |
| `libs/builder/git-service` | 4 | YES |
| `libs/builder/environment-service` | 4 | YES |
| `libs/builder/template-marketplace` | 4 | YES |
| `libs/core/builder-orchestrator` | 4 | YES |
| `libs/core/policy-service` | 4 | YES |
| `libs/core/project-registry` | 4 | YES |
| `libs/iot/mock-api-server` | 4 | YES |
| `libs/data/influx-schemas` | 4 | YES |
| `libs/data/telegraf-ingest-config` | 4 | YES |
| `libs/deploy/helm-generator` | 4 | YES |
| `libs/grafana/dashboard-templates` | 4 | YES |
| `libs/grafana/provisioning` | 4 | YES |
| `libs/grafana/theme` | 4 | YES |

**17 of 30 libraries are pure shells.** Each is named in the README as a delivered feature.

### 5c. API gateway — routes return mock data, integration TODOs everywhere

`apps/aep-api-gateway/src/app/routes/`:

| File | TODO count | Symptom |
|---|---|---|
| `agent-stream.routes.ts` | 6 | WebSocket auth + agent-runtime integration both stubbed |
| `projects.routes.ts` | 4 | "Integrate with project-registry" × 3, "Integrate with agent-runtime" × 1 |
| `auth.routes.ts` | 3 | "Integrate with auth-adapter" |
| `pages.routes.ts` | 2 | "Integrate with project-registry" |
| `billing.routes.ts` | 1 | "Integrate with billing-service" |
| `license.routes.ts` | 1 | "Integrate with license-service" |
| `preview.routes.ts` | 1 | "Integrate with publish-service" |
| `plugins/jwt.ts` | 2 | "Add login endpoint", "Integrate with auth-adapter" |

The gateway is a façade. The libs it would call into are mostly the 4-line stubs above.

### 5d. Phase-2 Redis stubs in OAuth2 handler

`libs/iot/auth-adapter/src/lib/auth/oauth2-handler.ts` — **19 `TODO: Phase 2`** markers covering token request, cache, refresh, revoke, health. This file's class methods exist but their bodies are all "Phase 2 — Implement". The companion spec (`oauth2-handler.spec.ts`) has 8 `TODO: Phase 2 — Implement … tests`.

### 5e. Cross-cutting circular-dep workarounds

`libs/iot/swagger-ingestion/src/lib/swagger-ingestion.ts:27`, `libs/iot/sdk-generator/src/lib/types.ts:6`, `libs/iot/sdk-generator/src/lib/sdk-generator.ts:12`, `libs/iot/sdk-generator/src/lib/fallback-sdk.ts:13` — all carry `// TODO: Fix circular dependency` notes with workaround `type X = any` instead of resolution.

### 5f. Other notables

- `libs/builder/preview-runtime/src/lib/preview-runtime.ts:198,250,531,540,547,640` — six placeholder-HTML / "Phase 1 MVP" references; `// TODO: Get from request context` for user identity.
- `libs/core/agent-runtime/src/lib/agents/iot-domain.ts:48` — `"For now, we'll use a placeholder configuration"`.
- `libs/core/agent-runtime/src/lib/streaming.ts:183` — `"placeholder for LangGraph CompiledGraph"`.
- `libs/iot/iot-tool-functions/src/lib/tools/get-kpi-metrics.tool.ts:154` — `"Calculate firmware compliance (placeholder logic)"`.

**Verdict: Massive L2 + L3 violation surface.** Per Sean's CLAUDE.md every one of these is a hard fail.

---

## 6. Functionality Gaps (README claim vs implementation)

| README Feature | Status | Evidence |
|---|---|---|
| AI Agent Orchestration (Supervisor + Planning + IoT-Domain) | PARTIAL — code exists under `@ts-nocheck`, 17/63 tests fail | `libs/core/agent-runtime/src/lib/agents/*` |
| Swagger/OpenAPI ingestion | DONE — 68/68 tests pass, 100 % line / 86.61 % branch | `libs/iot/swagger-ingestion` |
| LangGraph IoT Tools (5 tools) | DONE — 100 % coverage | `libs/iot/iot-tool-functions` |
| Drag-and-drop visual page composer | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/page-composer` |
| Widget library | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/widget-registry` |
| AI-powered code generation (TS + Angular) | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/codegen` |
| Live preview / Docker preview runtime | PARTIAL — code exists, 0/40 tests pass | `libs/builder/preview-runtime` |
| Multi-tenant SaaS / row-level security | PARTIAL — middleware in `apps/aep-api-gateway/src/app/middleware/tenant.ts`, but `project-registry` is a stub | |
| JWT auth + tenant claims | PARTIAL — middleware exists, login endpoint TODO | `apps/aep-api-gateway/src/app/plugins/jwt.ts` |
| OAuth2 token exchange | NOT IMPLEMENTED — 19 Phase-2 TODOs | `libs/iot/auth-adapter/src/lib/auth/oauth2-handler.ts` |
| Stripe billing tiers | PARTIAL — service has 689 LOC (100 % line cov) but gateway route doesn't call it | `libs/core/billing-service` |
| Audit logging | DONE — 100 % cov | `libs/core/audit-service` |
| License validation | PARTIAL — 675 LOC | `libs/core/license-service` |
| LLM providers (Anthropic + Ollama) | DONE — 99.83 % cov | `libs/core/llm-providers` |
| Project registry | NOT IMPLEMENTED — 4-LOC stub | `libs/core/project-registry` |
| Builder orchestrator | NOT IMPLEMENTED — 4-LOC stub | `libs/core/builder-orchestrator` |
| Policy service | NOT IMPLEMENTED — 4-LOC stub | `libs/core/policy-service` |
| Publish service | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/publish-service` |
| Git service | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/git-service` |
| Environment service | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/environment-service` |
| Template marketplace | NOT IMPLEMENTED — 4-LOC stub | `libs/builder/template-marketplace` |
| Dockerfile generation (multi-stage) | DONE — 1 815 LOC | `libs/deploy/docker-generator` |
| Helm chart generation | NOT IMPLEMENTED — 4-LOC stub | `libs/deploy/helm-generator` |
| Grafana auto-provisioning | NOT IMPLEMENTED — 4-LOC stub | `libs/grafana/provisioning` |
| Pre-built Grafana dashboards | NOT IMPLEMENTED — 4-LOC stub | `libs/grafana/dashboard-templates` |
| Custom Grafana theme | NOT IMPLEMENTED — 4-LOC stub | `libs/grafana/theme` |
| InfluxDB time-series schemas | NOT IMPLEMENTED — 4-LOC stub | `libs/data/influx-schemas` |
| Telegraf ingest config | NOT IMPLEMENTED — 4-LOC stub | `libs/data/telegraf-ingest-config` |
| Mock IoT API server | NOT IMPLEMENTED — 4-LOC stub | `libs/iot/mock-api-server` |
| Prisma schema + client | DONE — 23/26 tests pass | `libs/data/prisma-schema` |
| Shared cache / observability / secrets | PARTIAL — 838 / 1 117 / 362 LOC, **zero tests** | `libs/shared/{cache,observability,secrets}` |

**Implementation reality: ~10 of 30 libs are "real". 17 are stubs. 3 have substantial code but no tests at all.**

---

## 7. Friendly Branding Alignment

Audited against Sean's brand rules: navy `#12174C`, orange `#FF5900`, slogan "The IoT and Device Management Company".

| Check | Result |
|---|---|
| `#12174c` navy used as `--ft-primary` | PASS — `apps/aep-builder/src/styles/variables.scss:14` |
| `#ff5900` orange used as `--ft-accent` | PASS — `apps/aep-builder/src/styles/variables.scss:15` |
| Slogan present anywhere in repo | **FAIL** — zero matches for "The IoT and Device Management Company" / "IoT and Device Management" / "IoT Device Management Company" across markup, copy, docs |
| Brand tokens consistent | **FAIL** — `apps/aep-builder/src/styles/design-tokens.scss:13–22` declares `--ft-primary-50…900` as Material **blue** (`#1976d2` family), then `:root` redefines `--ft-primary: var(--ft-primary-600)` = `#1e88e5`. This *overrides* the navy in `variables.scss` depending on import order. Two competing palettes ship in one app. |
| Logo SVG | Present at `apps/aep-builder/public/assets/logo-icon.svg` — not audited for compliance, but referenced in `index.html` |
| Dark-mode tokens | Present in both palettes — same conflict carries through |

**Verdict: PARTIAL — colours declared but palette war between `variables.scss` (navy) and `design-tokens.scss` (Material blue); slogan completely missing.**

---

## 8. Open Questions / Uncertainties

1. **Which palette wins at runtime?** `variables.scss` and `design-tokens.scss` both define `--ft-primary` with different colours — load order in `apps/aep-builder/src/styles.scss` decides. Visually verifying which is rendered would need a live build. Phase 3 must consolidate to one palette.
2. **Are the 17 stub libs scaffolded by an Nx generator and never finished, or were bodies stripped for the v1.0 commit?** Git history (`feat(core): commit outstanding work for project finalization`, `tested fir first pass compile`) suggests the latter — placeholder bodies were committed to satisfy the build gate.
3. **Does `agent-runtime` actually run end-to-end?** All five agent files are `@ts-nocheck`; integration spec has 17 failures. Untested whether a real Claude API call routes Supervisor → Planning → IoT-Domain successfully.
4. **`preview-runtime` has 0/40 tests passing.** Is Docker daemon required for the unit suite, or are the mocks broken? `BUILD-AND-TEST-REPORT.md` claims the latter.
5. **Multi-tenant isolation depth.** `tenant.middleware.ts` is implemented (199 LOC, 335 LOC of tests) — but the routes it guards point at stubs. Is row-level security wired in Prisma at all?
6. **No coverage reports for apps.** `aep-api-gateway` has substantive routes + middleware (~3 700 LOC) and a `vitest.config.mts` — but no `coverage/apps/` directory exists. Was app coverage ever run?
7. **`MEMORY.md` and `BUILD_PROMPTS.md` are unfilled templates** — every variable still says `<fill>` / `[date]`. Session-init protocol from `CLAUDE.md` has never been executed against this repo.
8. **CI status.** Nine workflows under `.github/workflows/`; current pass/fail unknown without `gh` access.

---

## 9. Recommended Phase 3 Punch List

### P0 — Block release until fixed

| # | Task | Owner hint | Est |
|---|---|---|---|
| P0-1 | Resolve all 6 `@ts-nocheck` files in `agent-runtime` + `sdk-generator`. Replace `any` shims with real `LLMProvider` / `StructuredToolInterface` / `StateGraph` types. | Core | 3–5 d |
| P0-2 | Implement `libs/core/project-registry` — Prisma-backed CRUD with tenant scoping. Wire 4 TODOs in `projects.routes.ts`. | Core | 4 d |
| P0-3 | Implement `libs/core/builder-orchestrator` — pipeline that chains Planning → codegen → preview → publish. | Core | 5 d |
| P0-4 | Implement `libs/builder/codegen` — Angular component + page generation from build plan. Headline feature. | Builder | 8 d |
| P0-5 | Implement `libs/builder/page-composer` + `widget-registry` — drag-and-drop schema, widget catalog. | Builder | 10 d |
| P0-6 | Fix `preview-runtime` test suite (0/40 passing). Mock Dockerode + fs cleanly. | Builder | 3 d |
| P0-7 | Resolve `auth-adapter` 35 test failures + complete OAuth2 Phase-2 (19 TODOs). | IoT | 5 d |
| P0-8 | Resolve `llm-providers` 78 test failures (mock issues per BUILD-AND-TEST-REPORT). | Core | 3 d |
| P0-9 | Resolve `agent-runtime` 17 test failures + integration spec timeouts. | Core | 4 d |
| P0-10 | Reconcile `variables.scss` vs `design-tokens.scss` brand palette. Single source of truth on `#12174c` / `#ff5900`. Add slogan to `aep-builder` chrome (footer + login splash + `<title>` tagline). | UI | 1 d |

### P1 — Required for advertised feature parity

| # | Task | Est |
|---|---|---|
| P1-1 | Implement `libs/builder/publish-service` — git push + tag + CD trigger. | 4 d |
| P1-2 | Implement `libs/builder/git-service` — clone/commit/branch helpers used by publish. | 2 d |
| P1-3 | Implement `libs/builder/environment-service` — env-var resolution per tenant/tier. | 2 d |
| P1-4 | Implement `libs/core/policy-service` — RBAC + tenant policy evaluator. | 3 d |
| P1-5 | Wire `aep-api-gateway` routes to real services (drop the 31 TODO mock returns). | 3 d |
| P1-6 | Implement `libs/grafana/{provisioning,dashboard-templates,theme}` — dashboards advertised in README §Monitoring. | 4 d |
| P1-7 | Implement `libs/data/{influx-schemas,telegraf-ingest-config}` — telemetry pipeline. | 3 d |
| P1-8 | Implement `libs/deploy/helm-generator` — K8s manifests / ConfigMap / Secret. | 3 d |
| P1-9 | Add unit tests for `libs/shared/{cache,observability,secrets}` (currently 0 spec / ~2 300 LOC). | 3 d |
| P1-10 | Run + publish coverage for the 3 apps. Aggregate workspace coverage to a single dashboard, gate at 100 %. | 2 d |

### P2 — Polish, marketplace, MVP+1

| # | Task | Est |
|---|---|---|
| P2-1 | Implement `libs/builder/template-marketplace`. | 5 d |
| P2-2 | Implement `libs/iot/mock-api-server` — local fixture for agent E2E without live IoT. | 2 d |
| P2-3 | Resolve circular deps `swagger-ingestion ↔ sdk-generator ↔ auth-adapter` properly (drop `type X = any` shims). | 2 d |
| P2-4 | Populate `MEMORY.md` and `BUILD_PROMPTS.md` from the real state. | 0.5 d |
| P2-5 | Tighten `swagger-ingestion` branch coverage 86.61 % → 100 %. | 1 d |

---

## 10. Estimated Effort to "Phase 3 = Done"

| Tier | Days | Notes |
|---|---|---|
| P0 (10 items) | **46 days** | One senior + one mid engineer in parallel ≈ 5 weeks |
| P1 (10 items) | **29 days** | ≈ 3 weeks |
| P2 (5 items) | **10.5 days** | ≈ 1.5 weeks |
| **TOTAL** | **~85.5 engineer-days** | ≈ **8.5 weeks** for two engineers, or 4 weeks for a four-engineer squad |

Estimates assume Sean's coverage gate (100 % line + branch) is enforced as work lands — drop the gate and the P0 line crashes by ~30 %.

---

## 11. Headline Verdict

- **Build:** PASS (33/33), but rests on 6 `@ts-nocheck` files and `type X = any` shims.
- **Tests:** 432 / 611 pass (71 %). 23 of 30 libs run no tests.
- **Coverage:** 99.5 % line / 96.8 % branch on the 5 reporting libs; **unknown across the other 25 libs and all 3 apps**.
- **Quality violations:** **94 hits** across 38 files (TODO/FIXME/placeholder/`@ts-nocheck`). Every one is a global-law breach.
- **Functionality:** **17 of 30 libs are 4-LOC stubs**; only ~10 libs are real. The advertised "AI-powered code generation", "drag-and-drop page composer", "widget library", "publish service", "Helm/Grafana/InfluxDB pipelines" are all unimplemented.
- **Brand:** Colours present but palette conflict between `variables.scss` (navy `#12174c`) and `design-tokens.scss` (Material blue). Slogan absent everywhere.

**Status:** **Phase 1 is a structurally honest scaffold + 5 production-grade libs (swagger-ingestion, llm-providers, audit-service, billing-service, iot-tool-functions). Everything else needs Phase 3 build-out.**

---

*— End of report —*
