# Testing Guide

Comprehensive testing documentation for the Friendly AIAEP platform.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses Playwright for E2E testing, component testing, and visual regression testing. Our testing strategy includes:

- **E2E Tests**: Full user journey testing across browsers
- **Component Tests**: Isolated Angular component testing
- **Visual Regression Tests**: Screenshot comparison with Percy
- **Accessibility Tests**: WCAG compliance testing with axe-core
- **Unit Tests**: Vitest for unit testing (see individual libraries)

## Test Types

### E2E Tests (`tests/e2e/`)

Test complete user workflows across the application:

- **Authentication** (`authentication.spec.ts`): Login, logout, session management
- **Project Creation** (`project-creation.spec.ts`): Creating and configuring projects
- **AI Chat** (`ai-chat.spec.ts`): AI assistant interactions
- **Preview System** (`preview.spec.ts`): Live preview functionality

### Component Tests (`tests/components/`)

Test Angular components in isolation:

- Individual component rendering
- Component interactions
- State management
- Props and events
- Accessibility

### Visual Regression Tests (`tests/visual/`)

Capture and compare screenshots:

- **Builder Interface** (`builder.spec.ts`): Canvas, widgets, panels
- **Dashboard** (`dashboard.spec.ts`): Project listings, cards, navigation

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Running application (builder on :45000, API on :45001)

### Installation

Playwright is already installed as part of the project dependencies:

```bash
# Install all dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install
```

### Environment Setup

Create a `.env.test` file for test-specific configuration:

```env
PLAYWRIGHT_BASE_URL=http://localhost:45000
API_BASE_URL=http://localhost:45001
PREVIEW_BASE_URL=http://localhost:46000

# Percy configuration (optional)
PERCY_TOKEN=your-percy-token
PERCY_BRANCH=main
```

## Running Tests

### Run All E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Run in UI mode (interactive)
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug
```

### Run Specific Test Files

```bash
# Run authentication tests only
pnpm exec playwright test tests/e2e/authentication.spec.ts

# Run project creation tests
pnpm exec playwright test tests/e2e/project-creation.spec.ts
```

### Run Tests in Specific Browsers

```bash
# Run in Chromium only
pnpm exec playwright test --project=chromium

# Run in Firefox only
pnpm exec playwright test --project=firefox

# Run in WebKit (Safari) only
pnpm exec playwright test --project=webkit
```

### Run Component Tests

```bash
# Run all component tests
pnpm test:components

# Run specific component test
pnpm exec playwright test -c playwright-ct.config.ts tests/components/example.spec.ts
```

### Run Visual Regression Tests

```bash
# Run visual tests with Percy
pnpm test:visual

# Run visual tests locally (without Percy)
pnpm exec playwright test tests/visual/
```

### Generate Test Reports

```bash
# Show HTML report
pnpm exec playwright show-report

# Generate and open report
pnpm exec playwright show-report test-results/html
```

## Writing Tests

### E2E Test Structure

Use the Page Object Model pattern:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { DashboardPage } from '../page-objects/dashboard.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser } from '../helpers/test-utils';

test.describe('Feature Name', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    // Setup
    await loginAsUser(page, testData.users.standard);
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('should perform action', async ({ page }) => {
    // Arrange
    await dashboardPage.goto();

    // Act
    await dashboardPage.clickCreateProject();

    // Assert
    await expect(page).toHaveURL(/.*\/projects\/create/);
  });
});
```

### Component Test Structure

```typescript
import { test, expect } from '@playwright/experimental-ct-angular';

test.describe('Component Name', () => {
  test('should render correctly', async ({ mount }) => {
    // Mount component
    const component = await mount('<app-button label="Click Me"></app-button>');

    // Assert
    await expect(component).toBeVisible();
    await expect(component).toContainText('Click Me');
  });
});
```

### Visual Regression Test Structure

```typescript
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual Tests', () => {
  test('should capture page state', async ({ page }) => {
    // Navigate to page
    await page.goto('/dashboard');

    // Capture screenshot
    await percySnapshot(page, 'Dashboard - Default State', {
      widths: [1280, 1920],
    });
  });
});
```

## Best Practices

### 1. Use Page Objects

Always use page objects to encapsulate page interactions:

```typescript
// Good
await loginPage.fillUsername('user@example.com');
await loginPage.clickLogin();

// Bad
await page.locator('#username').fill('user@example.com');
await page.locator('button[type="submit"]').click();
```

### 2. Use Test Data Fixtures

Use centralized test data:

```typescript
// Good
await loginAsUser(page, testData.users.standard);

// Bad
await loginPage.fillUsername('hardcoded@example.com');
```

### 3. Use data-testid Attributes

Always use `data-testid` for stable selectors:

```html
<!-- Good -->
<button data-testid="login-button">Login</button>

<!-- Bad (fragile) -->
<button class="btn-primary">Login</button>
```

### 4. Wait for Explicit Conditions

```typescript
// Good
await expect(page.locator('[data-testid="message"]')).toBeVisible();

// Bad
await page.waitForTimeout(5000);
```

### 5. Write Independent Tests

Each test should be independent and not rely on other tests:

```typescript
// Good - Each test sets up its own state
test.beforeEach(async ({ page }) => {
  await createTestProject(page);
});

// Bad - Tests depend on execution order
test('create project', async () => { /* ... */ });
test('edit project', async () => { /* assumes project exists */ });
```

### 6. Use Helpers for Common Operations

```typescript
// Good
await loginAsUser(page, testData.users.standard);
await createTestProject(page, { name: 'Test' });

// Bad - Repeat the same code in every test
await page.goto('/login');
await page.fill('#username', 'user@example.com');
// ... many lines of repeated code
```

### 7. Clean Up Test Data

```typescript
test.afterEach(async ({ page }) => {
  // Clean up created resources
  if (projectId) {
    await deleteProject(page, projectId);
  }
});
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on pull requests and pushes to main:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

### Percy Visual Testing

Visual regression tests run on Percy:

```bash
# Set Percy token
export PERCY_TOKEN=your-token

# Run visual tests
pnpm test:visual
```

## Troubleshooting

### Tests Failing Locally

1. **Services not running**:
   ```bash
   pnpm nx serve aep-builder
   pnpm nx serve aep-api-gateway
   ```

2. **Browsers not installed**:
   ```bash
   pnpm exec playwright install
   ```

3. **Port conflicts**:
   Check if ports 4200, 3000, 3001 are available

### Flaky Tests

1. **Add proper waits**:
   ```typescript
   await expect(element).toBeVisible();
   await page.waitForLoadState('networkidle');
   ```

2. **Increase timeouts** (if needed):
   ```typescript
   test('slow test', async ({ page }) => {
     test.setTimeout(60000);
     // test code
   });
   ```

3. **Use retry logic**:
   ```typescript
   await executeWithRetry(async () => {
     await someUnreliableOperation();
   });
   ```

### Visual Regression Failures

1. **Update baselines**:
   ```bash
   # Accept all visual changes
   pnpm exec percy finalize
   ```

2. **Review differences** in Percy dashboard

3. **Stabilize animations**:
   ```css
   /* Percy CSS in percy.config.js */
   * {
     animation-duration: 0s !important;
   }
   ```

### Debugging Tests

1. **Use debug mode**:
   ```bash
   pnpm exec playwright test --debug
   ```

2. **Use console logs**:
   ```typescript
   console.log(await element.textContent());
   ```

3. **Take screenshots**:
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

4. **Use trace viewer**:
   ```bash
   pnpm exec playwright show-trace trace.zip
   ```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Percy Documentation](https://docs.percy.io)
- [axe-core Documentation](https://www.deque.com/axe/)

## Contributing

When adding new tests:

1. Follow the established patterns
2. Use page objects for E2E tests
3. Add appropriate test data to fixtures
4. Update this documentation if needed
5. Ensure tests pass locally before committing
6. Add visual tests for new UI features

## Support

For questions or issues with testing:

- Check this documentation
- Review existing tests for examples
- Ask in the team's testing channel
- Create an issue in the repository
