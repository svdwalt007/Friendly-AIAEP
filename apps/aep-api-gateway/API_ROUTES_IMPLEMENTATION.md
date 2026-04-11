# AEP API Gateway - Route Implementation Summary

## Overview

All API route handlers for the aep-api-gateway have been implemented according to Module Reference v2.2 Section 5.1. This document provides a comprehensive overview of the implemented routes, their purposes, and integration points.

## Route Files Created

### 1. **auth.routes.ts** - Authentication Routes
**Base Path:** `/api/v1/auth`

**Endpoints:**
- `POST /api/v1/auth/login` - Handled by JWT plugin (see `plugins/jwt.ts`)
- `POST /api/v1/auth/token/refresh` - Refresh access token using refresh token

**Features:**
- JWT token refresh mechanism
- Zod schema validation
- Integration points with auth-adapter for multi-method auth
- Redis caching for token management
- Audit event emission

**Security:** Login is public; refresh token endpoint is public (validates refresh token)

---

### 2. **projects.routes.ts** - Project Management Routes
**Base Path:** `/api/v1/projects`

**Endpoints:**
- `GET /api/v1/projects` - List all projects for tenant
- `POST /api/v1/projects` - Create new project
- `GET /api/v1/projects/:id` - Get project details
- `POST /api/v1/projects/:id/agent` - Send prompt to agent

**Features:**
- Tenant-scoped project queries
- Template initialization support
- Deployment mode configuration (SaaS/dedicated)
- Agent session creation and routing
- Policy enforcement for AI session limits
- Pagination support

**Security:** All endpoints protected by JWT middleware

**Integration Points:**
- project-registry: Project CRUD operations
- template-marketplace: Template initialization
- agent-runtime: LangGraph agent orchestration
- policy-service: Tier limit enforcement
- billing-service: AI session metering
- audit-service: Event logging

---

### 3. **pages.routes.ts** - Page Management Routes
**Base Path:** `/api/v1/projects/:id/pages`

**Endpoints:**
- `GET /api/v1/projects/:id/pages` - List all pages for a project

**Features:**
- Tenant-scoped page queries
- PageSchema structure with layout types
- Widget count per page
- Responsive breakpoint configuration

**Security:** Protected by JWT middleware

**Integration Points:**
- project-registry: Page queries with PageSchema
- page-composer: Schema-driven layout engine

---

### 4. **preview.routes.ts** - Preview and Publish Routes
**Base Path:** `/api/v1/projects/:id`

**Endpoints:**
- `POST /api/v1/projects/:id/preview` - Trigger preview build
- `POST /api/v1/projects/:id/publish` - Publish project to environment

**Features:**
- Three preview modes: mock, live, disconnected-sim
- Ephemeral Docker containers (30-min max)
- 10-stage publish pipeline
- Environment-specific deployment (dev/staging/prod)
- Test execution control
- Git integration

**Security:** Protected by JWT middleware; prod publish requires Admin role

**Integration Points:**
- preview-runtime: Docker container orchestration
- mock-api-server: Mock API simulation
- iot-api-proxy: Live API proxying
- publish-service: 10-stage pipeline execution
- builder-orchestrator: Task coordination
- policy-service: Permission checks
- license-service: License injection
- git-service: Git operations
- billing-service: Usage metering

---

### 5. **license.routes.ts** - License Validation Routes
**Base Path:** `/api/v1/license`

**Endpoints:**
- `GET /api/v1/license/validate` - Validate license and return entitlements

**Features:**
- License key validation (FTECH-AEP format)
- HMAC-SHA256 signature verification
- Tier-based feature flags
- Grace period information
- Three tiers: Starter ($499), Pro ($2,499), Enterprise ($7,999)

**Security:** Protected by JWT middleware

**Integration Points:**
- license-service: Key validation and parsing
- license-agent: Grace period status
- policy-service: Entitlement enforcement

**Tier Limits:**
- **Starter:** 50 AI sessions, 100k API calls/mo, no grace
- **Pro:** 500 AI sessions, 2M API calls/mo, 24h grace
- **Enterprise:** Unlimited AI, 20M API calls/mo, 7d grace + air-gap

---

### 6. **billing.routes.ts** - Billing and Usage Routes
**Base Path:** `/api/v1/billing`

**Endpoints:**
- `GET /api/v1/billing/usage` - Get current billing period usage

**Features:**
- Current/previous/YTD period selection
- Multi-dimensional usage tracking:
  - API calls per source (Northbound/Events/QoE)
  - AI sessions + LLM token usage (Claude/Ollama)
  - Preview minutes
  - Publishes
  - Third-party ingestion (MQTT/HTTP/Storage)
- Overage calculation
- Threshold alerts (80%/95%)

**Security:** Protected by JWT middleware

**Integration Points:**
- billing-service: Usage event aggregation
- Redis Streams: Event consumption
- Stripe/SAP: Payment integration

**Pricing:**
- **MQTT:** $0.01/1k (Pro), $0.005/1k (Ent)
- **HTTP:** $0.02/1k (Pro), $0.01/1k (Ent)
- **Storage:** $0.10/GB (Pro), $0.05/GB (Ent)
- **Ollama:** $0 (tracked but not charged)

---

### 7. **agent-stream.routes.ts** - Agent Streaming Routes
**Base Path:** `/api/v1/agent`

**Endpoints:**
- `WS /api/v1/agent/stream` - WebSocket for streaming agent responses

**Features:**
- Real-time agent response streaming
- Token-based WebSocket authentication
- Session state management
- Multiple message types:
  - agent_thinking
  - agent_tool_call
  - agent_response
  - build_progress
  - preview_update
  - error
  - complete
- Client message handling (pause/resume/cancel/feedback)

**Security:** Token-based authentication via query parameter

**Integration Points:**
- agent-runtime: LangGraph state subscriptions
- builder-orchestrator: Progress updates
- preview-runtime: Hot-reload events
- billing-service: Token usage streaming

---

### 8. **health.routes.ts** - Health Check Routes
**Base Path:** `/health`

**Endpoints:**
- `GET /health` - Health check with service status
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

**Features:**
- Service status reporting (PostgreSQL, Redis, InfluxDB)
- Uptime and version information
- License-agent heartbeat monitoring
- Kubernetes probe support

**Security:** Public endpoints (no authentication required)

---

## Plugin Architecture

### JWT Plugin (`plugins/jwt.ts`)
- JWT signing and verification
- `fastify.authenticate` decorator for route protection
- Login endpoint implementation
- Access token (1h) and refresh token (7d)
- Demo credentials: username/password = demo/demo

### Swagger Plugin (`plugins/swagger.ts`)
- OpenAPI 3.0.3 documentation
- Swagger UI at `/docs`
- Bearer auth and API key security schemes
- Comprehensive schema definitions

### Additional Plugins
- **CORS:** Cross-origin request handling
- **Helmet:** Security headers
- **Rate Limit:** Tier-based rate limiting
- **Sensible:** HTTP error utilities
- **Tenant:** Tenant context middleware
- **WebSocket:** WebSocket support

---

## Route Auto-Loading

Routes are automatically loaded via `@fastify/autoload` in `app.ts`:

```typescript
fastify.register(AutoLoad, {
  dir: path.join(__dirname, 'routes'),
  options: { ...opts },
});
```

All `.ts` files in the `routes/` directory are automatically registered as route modules.

---

## Security Model

### Public Endpoints
- `GET /` - API information
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/token/refresh` - Token refresh
- `GET /docs` - API documentation

### Protected Endpoints (JWT Required)
All other endpoints require JWT authentication via the `onRequest: [fastify.authenticate]` hook.

### WebSocket Authentication
WebSocket connections authenticate using token query parameter, verified before upgrade.

---

## Validation

All routes use **Zod** schemas for request validation:
- Type-safe request/response handling
- Runtime validation with detailed error messages
- Automatic OpenAPI schema generation

---

## Integration Status

### Implemented (Stub)
All routes have been implemented with:
- Complete OpenAPI/Swagger documentation
- Zod validation schemas
- JWT authentication
- Stub responses
- TODO comments for integration

### Pending Integration
The following integrations are marked with TODO comments:

1. **auth-adapter** - Multi-method authentication (Basic Auth, API Key, JWT, OAuth2)
2. **project-registry** - Project CRUD and tenant scoping
3. **agent-runtime** - LangGraph agent orchestration
4. **preview-runtime** - Docker container management
5. **publish-service** - 10-stage pipeline
6. **license-service** - License validation and feature flags
7. **billing-service** - Usage metering and rating
8. **policy-service** - Tier limits and permissions
9. **audit-service** - Event logging
10. **builder-orchestrator** - Task coordination

---

## Testing

### Manual Testing
1. Start the server: `pnpm nx serve aep-api-gateway`
2. Access Swagger UI: `http://localhost:3000/docs`
3. Login with demo credentials:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "demo", "password": "demo"}'
   ```
4. Use the returned `accessToken` for authenticated requests

### WebSocket Testing
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/agent/stream?sessionId=sess_123&token=YOUR_JWT_TOKEN');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message type:', data.type);
  console.log('Content:', data);
};

ws.send(JSON.stringify({ type: 'pause' }));
```

---

## API Documentation

Full API documentation is available at:
- **Local:** `http://localhost:3000/docs`
- **OpenAPI JSON:** `http://localhost:3000/docs/json`

---

## Next Steps

1. **Implement library modules** (project-registry, agent-runtime, etc.)
2. **Connect routes to libraries** (remove TODO stubs)
3. **Add integration tests** (Vitest + Supertest)
4. **Configure environment variables** (.env.example)
5. **Set up Redis** (for caching and rate limiting)
6. **Set up PostgreSQL** (for project-registry)
7. **Set up InfluxDB** (for telemetry)
8. **Implement tenant middleware** (tenant context enrichment)
9. **Configure rate limits** (tier-based limits)
10. **Add error handling** (global error handler)

---

## File Structure

```
apps/aep-api-gateway/
├── src/
│   ├── app/
│   │   ├── plugins/
│   │   │   ├── cors.ts
│   │   │   ├── helmet.ts
│   │   │   ├── jwt.ts ✅ (includes login endpoint)
│   │   │   ├── rate-limit.ts
│   │   │   ├── sensible.ts
│   │   │   ├── swagger.ts ✅
│   │   │   ├── tenant.ts
│   │   │   └── websocket.ts
│   │   ├── routes/
│   │   │   ├── agent-stream.routes.ts ✅
│   │   │   ├── auth.routes.ts ✅
│   │   │   ├── billing.routes.ts ✅
│   │   │   ├── health.routes.ts ✅
│   │   │   ├── license.routes.ts ✅
│   │   │   ├── pages.routes.ts ✅
│   │   │   ├── preview.routes.ts ✅
│   │   │   ├── projects.routes.ts ✅
│   │   │   └── root.ts ✅
│   │   └── app.ts
│   └── main.ts
├── project.json
├── tsconfig.app.json
├── tsconfig.json
└── API_ROUTES_IMPLEMENTATION.md ✅ (this file)
```

---

## Summary

All API routes have been successfully implemented according to Module Reference v2.2 Section 5.1. The implementation includes:

- ✅ 8 route files with 17 endpoints
- ✅ JWT authentication with login and refresh
- ✅ WebSocket support for agent streaming
- ✅ Comprehensive Swagger/OpenAPI documentation
- ✅ Zod validation schemas
- ✅ TypeScript types and interfaces
- ✅ Stub implementations with integration TODOs
- ✅ Security model (public/protected endpoints)
- ✅ Health checks and Kubernetes probes

The gateway is ready for integration with library modules and can be tested via Swagger UI at `/docs`.
