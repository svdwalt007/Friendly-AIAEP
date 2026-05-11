# AEP API Gateway - Testing Guide

Quick reference for running and understanding the API Gateway integration tests.

## Quick Start

```bash
# Run all tests
pnpm nx test aep-api-gateway

# Run with coverage report
pnpm nx test aep-api-gateway --coverage

# Watch mode (development)
pnpm nx test aep-api-gateway --watch

# Run specific test file
pnpm nx test aep-api-gateway --testFile=app.spec.ts
```

## Test Structure

### File Organization
```
apps/aep-api-gateway/
├── src/
│   ├── app/
│   │   ├── app.ts              # Main app registration
│   │   ├── app.spec.ts         # Integration tests
│   │   ├── plugins/            # Fastify plugins
│   │   └── routes/             # Route handlers
│   └── main.ts                 # Server entry point
├── vitest.config.mts           # Vitest configuration
└── project.json                # Nx project configuration
```

### Test Suites

The test file `app.spec.ts` contains 10 major test suites:

1. **Basic Routes** - Root endpoint and error handling
2. **Health Check** - Service health monitoring
3. **CORS** - Cross-origin resource sharing
4. **JWT Authentication** - Login and token management
5. **Protected Routes** - Authorization enforcement
6. **Rate Limiting** - Request throttling
7. **Tenant Context** - Multi-tenant isolation
8. **Route Stubs** - API endpoint smoke tests
9. **Error Handling** - Error response formatting
10. **Full Integration** - End-to-end flows

## Running Specific Tests

### Run Single Suite
```bash
# Run only JWT authentication tests
pnpm nx test aep-api-gateway --testNamePattern="JWT Authentication"

# Run only protected route tests
pnpm nx test aep-api-gateway --testNamePattern="Protected Routes"

# Run only health check tests
pnpm nx test aep-api-gateway --testNamePattern="Health Check"
```

### Run Single Test
```bash
# Run a specific test by its full name
pnpm nx test aep-api-gateway --testNamePattern="should successfully login with valid credentials"
```

## Test Output

### Success Output
```
✓ apps/aep-api-gateway/src/app/app.spec.ts (75)
  ✓ AEP API Gateway - Integration Tests (75)
    ✓ Basic Routes (3)
      ✓ should return Hello API on root endpoint
      ✓ should handle 404 for non-existent routes
      ✓ should return JSON content-type for API responses
    ✓ Health Check Endpoint (3)
      ✓ should return health status
      ✓ should return valid ISO timestamp
      ✓ should return numeric uptime
    ...
```

### Coverage Output
```
--------------------------------|---------|----------|---------|---------|
File                            | % Stmts | % Branch | % Funcs | % Lines |
--------------------------------|---------|----------|---------|---------|
All files                       |   85.71 |    78.26 |   88.89 |   85.71 |
 app.ts                         |   95.00 |    85.71 |  100.00 |   95.00 |
 routes/root.ts                 |  100.00 |   100.00 |  100.00 |  100.00 |
--------------------------------|---------|----------|---------|---------|
```

## Debugging Tests

### Enable Verbose Output
```bash
pnpm nx test aep-api-gateway --reporter=verbose
```

### Debug in VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Gateway Tests",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": [
        "nx",
        "test",
        "aep-api-gateway",
        "--watch",
        "--testTimeout",
        "999999"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debug Single Test

Add `only` to focus on one test:

```typescript
it.only('should successfully login with valid credentials', async () => {
  // This test will run exclusively
});
```

## Understanding Test Results

### Test Lifecycle

Each test follows this lifecycle:

```typescript
beforeEach(async () => {
  // 1. Create fresh Fastify instance
  server = Fastify({ logger: false });

  // 2. Register app with plugins and routes
  await server.register(app);

  // 3. Ready the server
  await server.ready();
});

// 4. Run test
it('test name', async () => { ... });

afterEach(async () => {
  // 5. Close server
  await server.close();
});
```

### HTTP Request Testing

Tests use Fastify's `inject` method:

```typescript
const response = await server.inject({
  method: 'POST',
  url: '/auth/login',
  payload: {
    username: 'testuser',
    password: 'testpass',
  },
  headers: {
    authorization: 'Bearer token',
  },
});

// Assert response
expect(response.statusCode).toBe(200);
const body = JSON.parse(response.body);
expect(body).toHaveProperty('token');
```

## Common Test Patterns

### Testing Protected Routes

```typescript
it('should allow access with valid JWT', async () => {
  // 1. Create JWT token
  const token = createTestJWT({ tenantId: 'tenant-123' });

  // 2. Make request with token
  const response = await server.inject({
    method: 'GET',
    url: '/api/v1/protected',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  // 3. Assert success
  expect(response.statusCode).toBe(200);
});
```

### Testing Authentication Flow

```typescript
it('should complete full auth flow', async () => {
  // 1. Login
  const loginResponse = await server.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username: 'user', password: 'pass' },
  });

  const { token } = JSON.parse(loginResponse.body);

  // 2. Use token
  const protectedResponse = await server.inject({
    method: 'GET',
    url: '/api/v1/resource',
    headers: { authorization: `Bearer ${token}` },
  });

  expect(protectedResponse.statusCode).toBe(200);
});
```

### Testing Error Handling

```typescript
it('should return 401 for invalid token', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/api/v1/protected',
    headers: {
      authorization: 'Bearer invalid-token',
    },
  });

  expect(response.statusCode).toBe(401);
  const body = JSON.parse(response.body);
  expect(body).toMatchObject({
    error: 'Unauthorized',
  });
});
```

## Mocking Strategy

### Auth Adapter Mock

The auth adapter is mocked to isolate gateway logic:

```typescript
vi.mock('@friendly-tech/iot/auth-adapter', () => ({
  FriendlyAuthAdapter: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getAuthHeaders: vi.fn().mockResolvedValue({
      Authorization: 'Bearer mock-jwt-token',
    }),
    getTenantId: vi.fn().mockReturnValue('test-tenant-123'),
  })),
}));
```

### Why Mock?

1. **Isolation** - Test gateway logic independently
2. **Speed** - No real auth API calls
3. **Reliability** - No external dependencies
4. **Control** - Simulate various auth scenarios

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test API Gateway

on:
  pull_request:
    paths:
      - 'apps/aep-api-gateway/**'
      - 'libs/iot/auth-adapter/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 10.33.0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm nx test aep-api-gateway --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/apps/aep-api-gateway/coverage-final.json
```

## Troubleshooting

### Tests Failing After Changes

1. **Check imports** - Ensure all imports are correct
2. **Check mocks** - Verify mocks match new signatures
3. **Update snapshots** - Run with `--updateSnapshot` if needed
4. **Clear cache** - Delete `node_modules/.vite` cache

### Slow Tests

1. **Reduce parallelism** - Use `--maxWorkers=1`
2. **Profile tests** - Use `--reporter=verbose`
3. **Check timeouts** - Look for hanging promises
4. **Isolate slow tests** - Use `--testNamePattern`

### Flaky Tests

1. **Check timing** - Add proper `await` statements
2. **Check cleanup** - Ensure `afterEach` runs
3. **Check mocks** - Reset mocks between tests
4. **Check state** - Avoid shared state between tests

## Best Practices

1. **Test Names** - Use descriptive names: "should [expected behavior]"
2. **AAA Pattern** - Arrange, Act, Assert structure
3. **One Assertion** - Test one thing per test when possible
4. **Independent** - Tests should run in any order
5. **Fast** - Keep tests fast (< 100ms each)
6. **Cleanup** - Always close resources in `afterEach`
7. **Readable** - Prefer clarity over cleverness

## Next Steps

After the tests pass:

1. Review coverage report
2. Add tests for edge cases
3. Update documentation
4. Run integration tests
5. Deploy with confidence

## Additional Resources

- [Test Coverage Details](./TEST_COVERAGE.md)
- [Fastify Testing Guide](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Vitest API Reference](https://vitest.dev/api/)
- [JWT Testing Best Practices](https://jwt.io/introduction)
