# Testing Strategy

**Comprehensive Testing Strategy for Friendly AI AEP**

Complete testing approach covering unit, integration, E2E, and visual regression testing.

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Testing Pyramid](#testing-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Visual Regression Testing](#visual-regression-testing)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Coverage Goals](#coverage-goals)
10. [CI/CD Integration](#cicd-integration)

---

## Testing Overview

### Test Types

```
         ┌─────────────────────────┐
         │    Manual Testing       │
         │  (Exploratory, UAT)     │
         └─────────────────────────┘
                    ▲
         ┌──────────┴──────────┐
         │   E2E Tests (5%)    │
         │  (Playwright)       │
         └─────────────────────┘
                ▲
         ┌──────┴──────┐
         │ Integration │
         │ Tests (15%) │
         └─────────────┘
              ▲
         ┌────┴────┐
         │  Unit   │
         │Tests(80%│
         └─────────┘
```

### Testing Tools

| Type | Tool | Purpose |
|------|------|---------|
| **Unit** | Vitest | Component, function tests |
| **Integration** | Vitest | API, database tests |
| **E2E** | Playwright | User journey tests |
| **Visual** | Percy | Screenshot comparison |
| **Performance** | k6, Lighthouse | Load testing, metrics |
| **Security** | OWASP ZAP, Snyk | Vulnerability scanning |

---

## Testing Pyramid

### Distribution

- **Unit Tests**: 80% (Fast, isolated)
- **Integration Tests**: 15% (Medium speed)
- **E2E Tests**: 5% (Slow, expensive)

### Coverage Goals

- **Statements**: 80%
- **Branches**: 70%
- **Functions**: 85%
- **Lines**: 80%

---

## Unit Testing

### Vitest Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts'
      ],
      statements: 80,
      branches: 70,
      functions: 85,
      lines: 80
    }
  }
});
```

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service';
import { PrismaService } from '@friendly-tech/data/prisma-schema';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    } as any;
    service = new UserService(prisma);
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user_1',
        username: 'test',
        email: 'test@example.com'
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await service.getUserById('user_1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_1' }
      });
    });

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.getUserById('invalid')).rejects.toThrow('User not found');
    });
  });
});
```

### Run Unit Tests

```bash
# Run all unit tests
pnpm nx run-many -t test

# Run specific library
pnpm nx test swagger-ingestion

# Watch mode
pnpm nx test swagger-ingestion --watch

# With coverage
pnpm nx test swagger-ingestion --coverage

# Generate HTML report
pnpm nx test swagger-ingestion --coverage --coverageReporters=html
```

---

## Integration Testing

### API Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app';

describe('API Gateway Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'demo',
          password: 'demo'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          username: 'demo'
        }
      });
    });

    it('should reject invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'demo',
          password: 'wrong'
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
```

### Database Integration Tests

```typescript
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

describe('Database Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Apply migrations
    execSync('pnpm nx run prisma-schema:migrate deploy');

    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create user with tenant', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'test_user',
        email: 'test@example.com',
        tenantId: 'tenant_001'
      }
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe('test_user');
  });
});
```

---

## End-to-End Testing

### Playwright Configuration

**playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:45000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ]
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('Project Creation Flow', () => {
  test('should create project and launch preview', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="username"]', 'demo');
    await page.fill('[name="password"]', 'demo');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');

    // Create project
    await page.click('text=New Project');
    await page.fill('[name="name"]', 'Test Project');
    await page.fill('[name="description"]', 'E2E test project');
    await page.click('button:has-text("Create")');

    // Verify project created
    await expect(page.locator('text=Test Project')).toBeVisible();

    // Launch preview
    await page.click('text=Test Project');
    await page.click('button:has-text("Preview")');

    // Verify preview launched
    await expect(page.locator('text=Preview running')).toBeVisible({
      timeout: 30000
    });
  });
});
```

See [E2E Testing Guide](./E2E-TESTING.md) for complete documentation.

---

## Visual Regression Testing

### Percy Configuration

```javascript
// percy.config.js
module.exports = {
  version: 2,
  snapshot: {
    widths: [375, 768, 1280],
    minHeight: 1024,
    percyCSS: '.animation { animation: none !important; }'
  }
};
```

### Visual Tests

```typescript
import percySnapshot from '@percy/playwright';

test('dashboard visual regression', async ({ page }) => {
  await page.goto('/dashboard');
  await percySnapshot(page, 'Dashboard - Empty State');

  // Create project
  await createTestProject();
  await percySnapshot(page, 'Dashboard - With Projects');
});
```

---

## Performance Testing

### k6 Load Test

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  }
};

export default function () {
  const res = http.get('http://localhost:46000/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  });
  sleep(1);
}
```

### Lighthouse CI

```yaml
# .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:45000'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }]
      }
    }
  }
};
```

---

## Security Testing

### OWASP ZAP Scan

```bash
# Baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:46000 \
  -r zap-report.html

# Full scan
docker run -t owasp/zap2docker-stable zap-full-scan.py \
  -t http://localhost:46000 \
  -r zap-full-report.html
```

### Snyk Security Scan

```bash
# Scan dependencies
snyk test

# Scan Docker images
snyk container test ghcr.io/svdwalt007/friendly-aep/api-gateway:latest

# Scan code
snyk code test
```

---

## Coverage Goals

### Minimum Requirements

| Metric | Threshold | Current |
|--------|-----------|---------|
| Statements | 80% | 81.57% |
| Branches | 70% | 58.91% |
| Functions | 85% | 80.00% |
| Lines | 80% | 81.51% |

### Enforce Coverage

**vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80
      }
    }
  }
});
```

---

## CI/CD Integration

### GitHub Actions Test Job

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
    redis:
      image: redis:7-alpine

  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - run: pnpm install
    - run: pnpm nx affected -t test --coverage
    - uses: codecov/codecov-action@v4
```

---

## Related Documentation

- [E2E Testing Guide](./E2E-TESTING.md)
- [Development Guide](../guides/DEVELOPMENT-GUIDE.md)
- [CI/CD Pipeline](../deployment/CICD-PIPELINE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology QA Team
