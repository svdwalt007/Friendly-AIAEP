# AEP API Gateway - Quick Start Guide

## Prerequisites

- Node.js 20+
- pnpm package manager
- Docker (for dependencies: PostgreSQL, Redis, InfluxDB)

## Installation

```bash
# Install dependencies
pnpm install

# Start dependencies (optional - for full integration)
docker-compose -f docker/docker-compose.dev.yml up -d
```

## Running the Gateway

### Development Mode

```bash
# From workspace root
pnpm nx serve aep-api-gateway

# Or directly
cd apps/aep-api-gateway
pnpm nx serve
```

The server will start at `http://localhost:45001`

### API Documentation

Once running, access Swagger UI at:
- http://localhost:45001/docs

## Authentication

### Login (Demo Credentials)

```bash
curl -X POST http://localhost:45001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo"
  }'
```

Response:
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

### Using the Access Token

Include the token in the Authorization header:

```bash
export TOKEN="your_access_token_here"

curl -X GET http://localhost:45001/api/v1/projects \
  -H "Authorization: Bearer $TOKEN"
```

## Available Endpoints

### Public Endpoints (No Auth Required)

- `GET /` - API information
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /docs` - Swagger UI
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/token/refresh` - Refresh token

### Protected Endpoints (Auth Required)

**Projects**
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/:id` - Get project details
- `POST /api/v1/projects/:id/agent` - Send prompt to agent

**Pages**
- `GET /api/v1/projects/:id/pages` - List pages

**Preview & Publish**
- `POST /api/v1/projects/:id/preview` - Trigger preview
- `POST /api/v1/projects/:id/publish` - Publish project

**License**
- `GET /api/v1/license/validate` - Validate license

**Billing**
- `GET /api/v1/billing/usage` - Get usage data

**WebSocket**
- `WS /api/v1/agent/stream?sessionId={id}&token={jwt}` - Agent streaming

## Example API Calls

### Create a Project

```bash
curl -X POST http://localhost:45001/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My IoT Dashboard",
    "description": "Fleet management dashboard",
    "deploymentMode": "saas"
  }'
```

### List Pages for Project

```bash
curl -X GET http://localhost:45001/api/v1/projects/proj_001/pages \
  -H "Authorization: Bearer $TOKEN"
```

### Trigger Preview

```bash
curl -X POST http://localhost:45001/api/v1/projects/proj_001/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "mock",
    "duration": 30
  }'
```

### Send Prompt to Agent

```bash
curl -X POST http://localhost:45001/api/v1/projects/proj_001/agent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a dashboard showing device fleet health with telemetry charts",
    "context": {}
  }'
```

Response includes `sessionId` for WebSocket connection.

### Check Billing Usage

```bash
curl -X GET "http://localhost:45001/api/v1/billing/usage?period=current" \
  -H "Authorization: Bearer $TOKEN"
```

### Validate License

```bash
curl -X GET http://localhost:45001/api/v1/license/validate \
  -H "Authorization: Bearer $TOKEN"
```

## WebSocket Connection (Agent Streaming)

```javascript
// Browser or Node.js with ws package
const token = 'your_jwt_token';
const sessionId = 'sess_123456';

const ws = new WebSocket(
  `ws://localhost:45001/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
);

ws.onopen = () => {
  console.log('Connected to agent stream');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message type:', data.type);
  console.log('Content:', data);
};

// Send client messages
ws.send(JSON.stringify({ type: 'pause' }));
ws.send(JSON.stringify({ type: 'resume' }));
ws.send(JSON.stringify({ type: 'cancel' }));
```

## Environment Variables

Create a `.env` file in the app root:

```bash
# Server
HOST=localhost
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key-change-in-production

# API
API_VERSION=1.0.0
API_BASE_URL=http://localhost:45001

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:46100/aep_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# InfluxDB
INFLUX_URL=http://localhost:46101
INFLUX_TOKEN=your-influx-token
INFLUX_ORG=friendly-ai
INFLUX_BUCKET=telemetry_raw

# License
LICENSE_VALIDATION_URL=https://license.friendly-tech.com/validate

# Friendly APIs (for integration)
NORTHBOUND_API_URL=https://dm.friendly-tech.com/FTACSWS_REST
EVENTS_API_URL=https://events.friendly-tech.com:8443/rest/v2
QOE_API_URL=https://qoe.friendly-tech.com/api
```

## Testing

### Run Tests

```bash
# Unit tests
pnpm nx test aep-api-gateway

# E2E tests (once implemented)
pnpm nx e2e aep-api-gateway-e2e
```

### Lint

```bash
pnpm nx lint aep-api-gateway
```

## Development Workflow

1. **Start the server**
   ```bash
   pnpm nx serve aep-api-gateway
   ```

2. **Access Swagger UI**
   - Open http://localhost:45001/docs
   - Click "Authorize" button
   - Login via `/api/v1/auth/login`
   - Copy the `accessToken` from response
   - Enter `Bearer <token>` in authorization dialog
   - Try endpoints interactively

3. **Watch logs**
   - Server logs are printed to console
   - Check for errors and request traces

4. **Hot reload**
   - Changes to route files trigger automatic rebuild
   - Refresh Swagger UI to see updated schemas

## Integration with Libraries

The routes currently have TODO comments for integration with:

- `libs/iot/auth-adapter` - Multi-method authentication
- `libs/core/project-registry` - Project CRUD
- `libs/core/agent-runtime` - LangGraph agents
- `libs/builder/preview-runtime` - Docker previews
- `libs/builder/publish-service` - Publishing pipeline
- `libs/core/license-service` - License validation
- `libs/core/billing-service` - Usage metering
- `libs/core/policy-service` - Policy enforcement
- `libs/core/audit-service` - Audit logging

See `API_ROUTES_IMPLEMENTATION.md` for detailed integration points.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000
```

### JWT Token Expired

Login again to get a new token. Access tokens expire after 1 hour.

### WebSocket Connection Failed

Ensure you're passing both `sessionId` and `token` as query parameters.

### CORS Issues

CORS is configured via `plugins/cors.ts`. Update allowed origins if needed.

## Next Steps

1. Implement library modules (auth-adapter, project-registry, etc.)
2. Connect routes to libraries (remove TODO stubs)
3. Set up Docker Compose for dependencies
4. Add integration tests
5. Configure production environment variables
6. Set up CI/CD pipeline

## Resources

- **API Documentation**: http://localhost:45001/docs
- **Implementation Guide**: `API_ROUTES_IMPLEMENTATION.md`
- **Module Reference**: `docs/Module_Reference_v2.2.md`
- **System Specification**: `docs/System_Specification_v2.2.md`
