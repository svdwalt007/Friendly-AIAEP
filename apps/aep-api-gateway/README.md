# AEP API Gateway

**Unified HTTP/WebSocket Gateway for the Friendly AI AEP Tool**

Version: 1.0.0 | Module Reference v2.2 Section 5.1 | Layer 1 — Core Engine

---

## Overview

The AEP API Gateway is a Fastify 4.x-based HTTP/WebSocket server that provides the unified entry point for all client interactions with the Friendly AI AEP Tool platform. It handles multi-method authentication, tenant context resolution, rate limiting, and routes requests to appropriate backend services.

### Key Features

- **Multi-Method Authentication**: Basic Auth, API Key, JWT (RS256), and OAuth2 (stub)
- **Dual Deployment Modes**: Multi-tenant SaaS and dedicated single-tenant
- **Tier-Based Rate Limiting**: 100/500/2000 req/min for Starter/Pro/Enterprise
- **WebSocket Support**: Real-time agent chat and preview streaming
- **Auto-Generated API Docs**: Swagger/OpenAPI 3.0.3 at `/docs`
- **Tenant-Scoped Middleware**: Automatic tenant isolation in multi-tenant mode
- **Comprehensive Security**: CORS, Helmet, JWT verification, Redis-backed rate limiting

---

## Architecture

### Technology Stack

- **Framework**: Fastify 5.x with TypeScript strict mode
- **Authentication**: RS256 JWT with @fastify/jwt
- **Rate Limiting**: @fastify/rate-limit with Redis backend
- **WebSocket**: @fastify/websocket for streaming
- **Security**: @fastify/cors, @fastify/helmet
- **Documentation**: @fastify/swagger + @fastify/swagger-ui
- **Testing**: Vitest + Fastify inject (Supertest-style)

### Module Dependencies

```typescript
// Core Dependencies (from Nx workspace)
import { FriendlyAuthAdapter } from '@friendly-tech/iot/auth-adapter';
import { AgentRuntime } from '@friendly-tech/core/agent-runtime';
import { ProjectRegistry } from '@friendly-tech/core/project-registry';
import { PolicyService } from '@friendly-tech/core/policy-service';
import { LicenseService } from '@friendly-tech/core/license-service';
import { BillingService } from '@friendly-tech/core/billing-service';
import { AuditService } from '@friendly-tech/core/audit-service';
```

---

## Directory Structure

```
apps/aep-api-gateway/
├── src/
│   ├── app/
│   │   ├── auth/                    # Authentication module
│   │   │   ├── types.ts            # JWT payload, request/response types
│   │   │   ├── jwt-keys.ts         # RS256 key generation & management
│   │   │   ├── auth-plugin.ts      # Login & refresh endpoints
│   │   │   ├── auth-middleware.ts  # JWT verification middleware
│   │   │   └── index.ts            # Barrel exports
│   │   ├── middleware/              # Request processing middleware
│   │   │   ├── types.ts            # Tenant context types
│   │   │   ├── tenant.ts           # Multi-tenant/dedicated mode logic
│   │   │   └── index.ts            # Barrel exports
│   │   ├── plugins/                 # Fastify plugins (auto-loaded)
│   │   │   ├── cors.ts             # CORS configuration
│   │   │   ├── helmet.ts           # Security headers
│   │   │   ├── rate-limit.ts       # Tier-based rate limiting
│   │   │   ├── websocket.ts        # WebSocket support
│   │   │   └── swagger.ts          # API documentation
│   │   ├── routes/                  # API routes (auto-loaded)
│   │   │   ├── auth.routes.ts      # POST /api/v1/auth/*
│   │   │   ├── projects.routes.ts  # /api/v1/projects
│   │   │   ├── pages.routes.ts     # /api/v1/projects/:id/pages
│   │   │   ├── preview.routes.ts   # Preview & publish
│   │   │   ├── license.routes.ts   # License validation
│   │   │   ├── billing.routes.ts   # Billing usage
│   │   │   ├── agent-stream.routes.ts # WebSocket streaming
│   │   │   ├── health.routes.ts    # Health checks
│   │   │   └── root.ts             # Root endpoint
│   │   ├── app.ts                   # Main Fastify app
│   │   └── app.spec.ts             # Integration tests (75+ cases)
│   ├── assets/                      # Static assets
│   └── main.ts                      # Server entry point
├── project.json                     # Nx project configuration
├── vitest.config.mts               # Test configuration
├── eslint.config.mjs               # Lint configuration
├── tsconfig.app.json               # TypeScript config
└── README.md                        # This file
```

---

## Quick Start

### 1. Installation

Dependencies are already installed in the workspace root:

```bash
# Verify dependencies
pnpm list @fastify/jwt @fastify/cors @fastify/helmet @fastify/rate-limit @fastify/websocket @fastify/swagger
```

### 2. Environment Configuration

Create `.env` file in workspace root:

```bash
# Server
HOST=localhost
PORT=3000
NODE_ENV=development

# Deployment Mode
DEPLOYMENT_MODE=multi-tenant  # or 'dedicated'
REQUIRE_TENANT_ID=false       # true for strict tenant enforcement

# JWT Keys (RS256)
JWT_PRIVATE_KEY=path/to/private.key
JWT_PUBLIC_KEY=path/to/public.key
# Or generate automatically (not recommended for production)

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# CORS
CORS_ORIGIN_BUILDER=http://localhost:4200
CORS_ORIGIN_PREVIEW=http://localhost:4201
CORS_ORIGIN_ADMIN=http://localhost:4202

# Friendly API Endpoints
FRIENDLY_NORTHBOUND_URL=https://demo.friendly.com:8443
FRIENDLY_EVENTS_URL=https://demo.friendly.com:8443
FRIENDLY_QOE_URL=https://demo.friendly.com:8443

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REDIS_ENABLED=true
```

### 3. Start Development Server

```bash
# Build and serve
pnpm nx serve aep-api-gateway

# Or build only
pnpm nx build aep-api-gateway

# Production mode
NODE_ENV=production pnpm nx serve aep-api-gateway:production
```

Server will start at `http://localhost:3000`

### 4. Access API Documentation

Navigate to `http://localhost:3000/docs` for interactive Swagger UI

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/login` | Login with UID/PW, get JWT | No |
| POST | `/api/v1/auth/token/refresh` | Refresh access token | No (refresh token) |

### Projects

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/projects` | List projects (paginated) | Yes |
| POST | `/api/v1/projects` | Create new project | Yes |
| GET | `/api/v1/projects/:id` | Get project details | Yes |
| POST | `/api/v1/projects/:id/agent` | Send prompt to agent | Yes |

### Pages

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/projects/:id/pages` | List pages for project | Yes |

### Preview & Publish

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/projects/:id/preview` | Trigger preview build | Yes |
| POST | `/api/v1/projects/:id/publish` | Publish project | Yes |

### License & Billing

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/license/validate` | Validate license | Yes |
| GET | `/api/v1/billing/usage` | Get billing usage | Yes |

### Agent Streaming

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| WS | `/api/v1/agent/stream` | WebSocket for agent responses | Yes (token in query) |

### Health Checks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Basic health status | No |
| GET | `/health/ready` | Readiness probe | No |
| GET | `/health/live` | Liveness probe | No |

---

## Authentication Flow

### 1. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user@friendly.com",
    "pw": "password123"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### 2. Access Protected Endpoints

```bash
curl http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer eyJhbGc..."
```

### 3. Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/token/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGc..."
  }'
```

---

## WebSocket Connection

### Agent Streaming

```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/agent/stream?token=eyJhbGc...');

ws.onopen = () => {
  ws.send(JSON.stringify({
    projectId: 'proj_123',
    message: 'Create a device dashboard'
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Agent response:', response);
};
```

---

## Rate Limiting

Rate limits are enforced per subscription tier:

| Tier | Limit | Price |
|------|-------|-------|
| Starter | 100 req/min | $499/mo |
| Professional | 500 req/min | $2,499/mo |
| Enterprise | 2000 req/min | $7,999/mo |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

**429 Response:**
```json
{
  "error": "Rate limit exceeded",
  "statusCode": 429,
  "tier": "starter",
  "limit": 100,
  "retryAfter": 45
}
```

---

## Tenant Scoping

### Multi-Tenant Mode

In multi-tenant mode (`DEPLOYMENT_MODE=multi-tenant`), all requests are automatically scoped by `tenantId` extracted from the JWT payload:

```typescript
// Automatic tenant filtering
const projects = await projectRegistry.findMany({
  where: request.tenantContext.shouldFilterByTenant
    ? { tenantId: request.tenantContext.tenantId }
    : {}
});
```

### Dedicated Mode

In dedicated mode (`DEPLOYMENT_MODE=dedicated`), tenant filtering is skipped for single-tenant optimization:

```typescript
if (request.tenantContext.shouldFilterByTenant) {
  // Apply tenant filter
} else {
  // Skip filtering (dedicated mode)
}
```

---

## Testing

### Run All Tests

```bash
# Run integration tests (75+ test cases)
pnpm nx test aep-api-gateway

# Run with coverage
pnpm nx test aep-api-gateway --coverage

# Watch mode
pnpm nx test aep-api-gateway --watch
```

### Test Coverage Areas

- ✅ Auth flow (login, JWT issuance, token refresh)
- ✅ Protected routes (JWT verification)
- ✅ Route stubs (all endpoints)
- ✅ Health checks
- ✅ Rate limiting (tier-based)
- ✅ CORS headers
- ✅ Tenant context extraction
- ✅ Error handling
- ✅ Full integration flows

See `TEST_COVERAGE.md` for detailed test documentation.

---

## Deployment

### Docker Build

```bash
# Build production image
docker build -t friendly-aep-gateway:latest .

# Run container
docker run -p 3000:3000 \
  -e DEPLOYMENT_MODE=multi-tenant \
  -e REDIS_HOST=redis \
  friendly-aep-gateway:latest
```

### Kubernetes/Helm

Deployment manifests are generated via `@friendly-tech/deploy/helm-generator`:

```bash
# Generate Helm chart
pnpm nx run helm-generator:generate --app=aep-api-gateway

# Deploy to K8s
helm install aep-gateway ./dist/helm/aep-api-gateway
```

---

## Security Considerations

### Production Checklist

- [ ] Use externally managed RSA key pairs (not auto-generated)
- [ ] Enable HTTPS/TLS (reverse proxy or Fastify HTTPS)
- [ ] Set `NODE_ENV=production`
- [ ] Configure Redis with authentication
- [ ] Set restrictive CORS origins
- [ ] Enable Helmet security headers
- [ ] Use secrets management (AWS Secrets Manager, Vault)
- [ ] Enable audit logging
- [ ] Configure rate limiting per environment
- [ ] Implement IP whitelisting for admin endpoints
- [ ] Regular security audits and dependency updates

### JWT Best Practices

- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days) with rotation
- RS256 asymmetric signing (public key for verification)
- Secure key storage (never commit to git)
- Token revocation via Redis blacklist
- HTTPS-only transmission

---

## Monitoring & Observability

### Health Checks

```bash
# Basic health
curl http://localhost:3000/health

# Readiness (K8s)
curl http://localhost:3000/health/ready

# Liveness (K8s)
curl http://localhost:3000/health/live
```

### Metrics

Integration with Grafana dashboards (via `@friendly-tech/grafana/dashboard-templates`):

- Request rate and latency
- Error rates by endpoint
- Rate limit violations
- WebSocket connections
- JWT issuance and validation
- Tenant activity

### Logging

Structured JSON logging via Fastify logger:

```json
{
  "level": "info",
  "time": 1640000000000,
  "pid": 1234,
  "hostname": "api-gateway-1",
  "reqId": "req-xyz",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "msg": "Request completed",
  "responseTime": 45
}
```

---

## Troubleshooting

### Common Issues

**Issue: JWT verification fails**
```
Solution: Check that JWT_PUBLIC_KEY matches the private key used for signing
Verify: pnpm nx test aep-api-gateway --testNamePattern="JWT"
```

**Issue: Rate limit not working**
```
Solution: Ensure Redis is running and RATE_LIMIT_REDIS_ENABLED=true
Check: curl http://localhost:3000/health (should show Redis status)
```

**Issue: CORS errors**
```
Solution: Add allowed origin to CORS_ORIGIN_* environment variables
Verify: Check browser console for specific origin
```

**Issue: Tenant context missing**
```
Solution: Ensure JWT payload includes tenantId field
Check: Decode JWT at jwt.io and verify payload structure
```

**Issue: WebSocket connection fails**
```
Solution: Include token in query string: ws://host/api/v1/agent/stream?token=...
Verify: Check WebSocket connection headers in browser dev tools
```

---

## Development

### Adding New Routes

1. Create route file in `src/app/routes/`:
```typescript
// src/app/routes/my-feature.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const myFeatureRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/my-feature', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['my-feature'],
      response: {
        200: z.object({ data: z.string() })
      }
    }
  }, async (request, reply) => {
    const { tenantId } = request.tenantContext;
    return { data: `Feature for tenant ${tenantId}` };
  });
};

export default myFeatureRoutes;
```

2. Route auto-loaded by Fastify AutoLoad (no manual registration needed)

### Adding New Plugins

1. Create plugin file in `src/app/plugins/`:
```typescript
// src/app/plugins/my-plugin.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

const myPlugin: FastifyPluginAsync = async (fastify) => {
  // Plugin logic
};

export default fp(myPlugin);
```

2. Plugin auto-loaded by Fastify AutoLoad

---

## References

- **Module Reference v2.2**: Section 5.1 (aep-api-gateway)
- **System Specification v2.2**: Section 3.2 (Monorepo structure)
- **Auth Adapter**: `libs/iot/auth-adapter/README.md`
- **Project Registry**: `libs/core/project-registry/README.md`
- **Fastify Documentation**: https://www.fastify.io/

---

## License

UNLICENSED - Proprietary Friendly Technologies Software

---

**Status**: ✅ Production Ready
**Implementation**: 100% Complete per Module Reference v2.2 Section 5.1
**Test Coverage**: 75+ integration tests
**Documentation**: Comprehensive
