# AEP API Gateway - Test Coverage

This document provides an overview of the comprehensive integration test suite for the AEP API Gateway.

## Test File Location

- **Test File**: `apps/aep-api-gateway/src/app/app.spec.ts`
- **Test Framework**: Vitest
- **HTTP Testing**: Fastify's inject method (built-in supertest alternative)

## Running Tests

```bash
# Run tests for the API gateway
pnpm nx test aep-api-gateway

# Run tests with coverage
pnpm nx test aep-api-gateway --coverage

# Run tests in watch mode (for development)
pnpm nx test aep-api-gateway --watch

# Run all tests in the workspace
pnpm nx run-many --target=test --all
```

## Test Coverage Areas

### 1. Basic Routes
- **Root endpoint** (`/`): Verifies the basic "Hello API" response
- **404 handling**: Ensures non-existent routes return proper error responses
- **Content-Type headers**: Validates JSON responses are properly formatted

### 2. Health Check Endpoint
- **Health status** (`/health`): Returns service health information
- **Timestamp validation**: Ensures ISO 8601 formatted timestamps
- **Uptime tracking**: Verifies numeric uptime values
- **Service metadata**: Checks service name and version information

### 3. JWT Authentication Flow
- **Login endpoint** (`/auth/login`):
  - Successful login with valid credentials
  - Rejection of invalid credentials
  - JWT token issuance
  - Token expiration settings

- **Token refresh** (`/auth/refresh`):
  - Refresh with valid JWT
  - Rejection of invalid/expired tokens
  - New token generation

- **JWT validation**:
  - Token structure verification
  - Payload extraction (tenantId, sub, username)
  - Expiration handling

### 4. Protected Routes
- **Route protection** (`/api/v1/*`):
  - Access allowed with valid JWT
  - Access denied without JWT
  - Access denied with invalid JWT
  - Access denied with expired JWT

- **CRUD operations**:
  - GET endpoints with authentication
  - POST endpoints with authentication
  - PUT endpoints with authentication
  - DELETE endpoints with authentication

- **Tenant isolation**:
  - TenantId extraction from JWT
  - Multi-tenant request handling
  - Tenant context in responses

### 5. CORS (Cross-Origin Resource Sharing)
- **CORS headers**:
  - Access-Control-Allow-Origin header
  - Access-Control-Allow-Credentials header
  - Access-Control-Allow-Methods header

- **Preflight requests**:
  - OPTIONS request handling
  - Proper response codes (204)

### 6. Rate Limiting
- **Rate limit enforcement**:
  - Requests within limit allowed
  - Requests exceeding limit rejected (429 status)
  - Rate limit headers included (X-RateLimit-*)
  - Retry-After header on limit exceeded

- **Rate limit configuration**:
  - Configurable max requests
  - Configurable time window
  - Per-IP rate limiting

### 7. Tenant Context Extraction
- **JWT payload parsing**:
  - TenantId extraction from token
  - User context extraction
  - Request decoration with tenant info

- **Multi-tenant support**:
  - Different tenants handled independently
  - Tenant isolation verified
  - Tenant context in all responses

### 8. Route Stubs (Smoke Tests)
- **Agent endpoints**:
  - `GET /api/v1/agents` - List agents
  - `POST /api/v1/agents` - Create agent
  - `GET /api/v1/agents/:id` - Get agent
  - `PUT /api/v1/agents/:id` - Update agent
  - `DELETE /api/v1/agents/:id` - Delete agent

- **Workflow endpoints**:
  - `GET /api/v1/workflows` - List workflows
  - `POST /api/v1/workflows` - Create workflow

- **Deployment endpoints**:
  - `GET /api/v1/deployments` - List deployments
  - `POST /api/v1/deployments` - Create deployment

### 9. Error Handling
- **Internal server errors** (500):
  - Proper error format
  - Error message included

- **Validation errors** (400):
  - Proper error format
  - Malformed JSON handling

- **Authentication errors** (401):
  - Missing token handling
  - Invalid token handling
  - Expired token handling

### 10. Full Integration Flow
- **Complete authentication flow**:
  1. Login with credentials
  2. Receive JWT token
  3. Access protected routes with token
  4. Verify tenant context maintained

## Test Organization

Tests are organized into logical describe blocks:

```typescript
describe('AEP API Gateway - Integration Tests', () => {
  describe('Basic Routes', () => { ... })
  describe('Health Check Endpoint', () => { ... })
  describe('CORS Headers', () => { ... })
  describe('JWT Authentication', () => { ... })
  describe('Protected Routes', () => { ... })
  describe('Rate Limiting', () => { ... })
  describe('Tenant Context Extraction', () => { ... })
  describe('Route Stubs - Smoke Tests', () => { ... })
  describe('Error Handling', () => { ... })
  describe('Full Integration Flow', () => { ... })
})
```

## Mock Strategy

### Auth Adapter Mocking
The `@friendly-tech/iot/auth-adapter` module is mocked to isolate API Gateway logic:

```typescript
vi.mock('@friendly-tech/iot/auth-adapter', () => ({
  FriendlyAuthAdapter: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getAuthHeaders: vi.fn().mockResolvedValue({
      Authorization: 'Bearer mock-jwt-token',
    }),
    getTenantId: vi.fn().mockReturnValue('test-tenant-123'),
    isInitialized: vi.fn().mockReturnValue(true),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  // ... other exports
}))
```

### Test JWT Generation
Helper function creates valid test JWT tokens:

```typescript
function createTestJWT(payload: Record<string, any> = {}): string {
  const defaultPayload = {
    tenantId: 'test-tenant-123',
    sub: 'user-123',
    username: 'testuser',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };
  // Returns base64url encoded JWT
}
```

## Test Utilities

### Response Parsing
Helper function to parse JSON responses:

```typescript
async function parseResponse<T = any>(response: any): Promise<T> {
  return JSON.parse(response.body);
}
```

### Fastify Injection
Uses Fastify's built-in `inject` method for HTTP testing:

```typescript
const response = await server.inject({
  method: 'GET',
  url: '/api/v1/projects',
  headers: {
    authorization: `Bearer ${token}`,
  },
  payload: { ... } // For POST/PUT requests
});
```

## Best Practices

1. **Test Isolation**: Each test creates a fresh Fastify instance
2. **Cleanup**: `afterEach` hooks ensure proper server closure
3. **Independent Tests**: Tests can run in any order
4. **Descriptive Names**: Test names clearly describe what is being tested
5. **Arrange-Act-Assert**: Tests follow AAA pattern
6. **Mock Management**: Mocks are reset between tests
7. **Type Safety**: TypeScript types used throughout

## Coverage Goals

- **Statement Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 80%
- **Line Coverage**: > 80%

## Future Enhancements

Potential areas for additional test coverage:

1. **WebSocket connections** - Real-time communication testing
2. **API versioning** - Multiple API version handling
3. **Request validation** - Input validation with Zod schemas
4. **Response transformation** - Output formatting
5. **Logging** - Request/response logging verification
6. **Metrics** - Prometheus metrics endpoint
7. **Swagger/OpenAPI** - API documentation endpoint
8. **Security headers** - Helmet middleware verification
9. **Request ID tracking** - Correlation ID propagation
10. **Performance testing** - Load and stress testing

## Dependencies

The test suite uses:

- **vitest**: Test framework
- **@nx/vite**: Nx Vite plugin for test execution
- **fastify**: Web framework (inject method for HTTP testing)
- **@fastify/jwt**: JWT authentication
- **@fastify/cors**: CORS support
- **@fastify/rate-limit**: Rate limiting
- **@types/node**: Node.js type definitions

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# .github/workflows/ci.yml
- name: Run API Gateway Tests
  run: pnpm nx test aep-api-gateway --coverage
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Tests use Fastify's inject method, which doesn't bind to actual ports
   - No port conflicts should occur

2. **Mock Not Working**
   - Ensure mock is defined before imports
   - Check mock path matches actual import path

3. **JWT Verification Fails**
   - Verify JWT secret is consistent
   - Check token expiration times

4. **Test Timeout**
   - Increase timeout in vitest config if needed
   - Check for unclosed resources (servers, connections)

## Additional Resources

- [Fastify Testing Documentation](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Vitest Documentation](https://vitest.dev/)
- [JWT.io](https://jwt.io/) - JWT token debugger
- [Nx Testing Documentation](https://nx.dev/recipes/testing)
