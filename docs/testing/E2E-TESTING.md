# E2E Testing Guide

**End-to-End Testing with Playwright**

Complete guide for writing and running E2E tests for Friendly AI AEP.

---

## Table of Contents

1. [Overview](#overview)
2. [Playwright Setup](#playwright-setup)
3. [Writing E2E Tests](#writing-e2e-tests)
4. [Page Object Model](#page-object-model)
5. [Test Scenarios](#test-scenarios)
6. [Best Practices](#best-practices)
7. [Debugging](#debugging)
8. [CI/CD Integration](#cicd-integration)

---

## Overview

### Why E2E Testing?

- Verify complete user journeys
- Test cross-component integration
- Catch UI regressions
- Validate critical business flows
- Test in real browser environments

### Test Strategy

```
Critical Paths (Must Test):
├── Authentication & Authorization
├── Project Creation & Management
├── AI Agent Interaction
├── Preview System
└── Billing & Subscriptions

Secondary Paths (Should Test):
├── Settings Management
├── User Profile
└── Dashboard Navigation
```

---

## Playwright Setup

### Installation

```bash
# Install Playwright and dependencies
pnpm add -D @playwright/test @axe-core/playwright @percy/cli @percy/playwright

# Install browsers
pnpm exec playwright install

# Verify installation
pnpm exec playwright --version
```

### Configuration

The project includes a comprehensive Playwright configuration at `playwright.config.ts` with:

- **Multi-browser support**: Chromium, Firefox, WebKit (Safari), Edge
- **Mobile device emulation**: Pixel 5, iPhone 12, iPad Pro, Galaxy S9+
- **Visual regression**: Percy integration for screenshot comparison
- **Accessibility testing**: axe-core integration for WCAG compliance
- **Parallel execution**: Faster test runs across multiple workers
- **Multiple reporters**: HTML, JSON, JUnit for CI/CD integration

**Key Configuration Features:**

```typescript
// playwright.config.ts (simplified view)
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:45000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Desktop and mobile browsers configured
  projects: [...],

  // Auto-start services for testing
  webServer: [
    { command: 'pnpm nx serve aep-builder', url: 'http://localhost:45000' },
    { command: 'pnpm nx serve aep-api-gateway', url: 'http://localhost:45001/health' },
  ],
});
```

---

## Writing E2E Tests

### Test Organization

The project includes comprehensive E2E test suites:

```
tests/
├── e2e/                        # E2E test suites
│   ├── authentication.spec.ts  # Login/logout flows
│   ├── project-creation.spec.ts # Project creation workflow
│   ├── ai-chat.spec.ts         # AI chat interactions
│   └── preview.spec.ts         # Preview system
├── visual/                     # Visual regression tests
│   ├── builder.spec.ts         # Builder interface screenshots
│   └── dashboard.spec.ts       # Dashboard screenshots
├── components/                 # Component tests
│   └── example.spec.ts         # Angular component tests
├── fixtures/                   # Test data
│   └── test-data.ts           # Centralized test data
├── helpers/                    # Helper functions
│   ├── test-utils.ts          # Common test utilities
│   ├── global-setup.ts        # Global setup
│   └── global-teardown.ts     # Global teardown
└── page-objects/              # Page Object Models
    ├── login.page.ts
    ├── dashboard.page.ts
    ├── builder.page.ts
    ├── project-creation.page.ts
    ├── ai-chat-panel.page.ts
    └── preview-panel.page.ts
```

### Basic Test Structure (Updated)

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { DashboardPage } from '../page-objects/dashboard.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser } from '../helpers/test-utils';

test.describe('User Authentication', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Use page object pattern
    await loginPage.fillUsername(testData.users.standard.username);
    await loginPage.fillPassword(testData.users.standard.password);
    await loginPage.clickLogin();

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(dashboardPage.pageTitle).toBeVisible();
  });

  test('should show error with invalid credentials', async () => {
    // Use test data fixture
    await loginPage.fillUsername('invalid@example.com');
    await loginPage.fillPassword('wrongpassword');
    await loginPage.clickLogin();

    // Use page object locators
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });
});
```

### Advanced Assertions

```typescript
test('should create and preview project', async ({ page }) => {
  // Login
  await login(page, 'demo', 'demo');

  // Create project
  await page.click('button:has-text("New Project")');
  await page.fill('[name="name"]', 'Test Project');
  await page.fill('[name="description"]', 'E2E test project');

  // Wait for network request
  const createResponse = page.waitForResponse(
    response => response.url().includes('/api/v1/projects') && response.status() === 200
  );

  await page.click('button:has-text("Create")');
  await createResponse;

  // Verify project appears
  await expect(page.locator('text=Test Project')).toBeVisible();

  // Launch preview
  await page.click('text=Test Project');
  const previewRequest = page.waitForRequest(
    request => request.url().includes('/api/v1/projects') && request.method() === 'POST'
  );

  await page.click('button:has-text("Launch Preview")');
  await previewRequest;

  // Verify preview URL
  await expect(page.locator('[data-testid="preview-url"]')).toContainText('http://localhost:4300');
});
```

---

## Page Object Model

### LoginPage

```typescript
// e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[name="username"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await this.errorMessage.waitFor({ state: 'visible' });
    expect(await this.errorMessage.textContent()).toContain(message);
  }
}
```

### DashboardPage

```typescript
// e2e/pages/dashboard.page.ts
import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly newProjectButton: Locator;
  readonly projectList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newProjectButton = page.locator('button:has-text("New Project")');
    this.projectList = page.locator('[data-testid="project-list"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createProject(name: string, description: string) {
    await this.newProjectButton.click();
    await this.page.fill('[name="name"]', name);
    await this.page.fill('[name="description"]', description);
    await this.page.click('button:has-text("Create")');
  }

  async getProjectByName(name: string) {
    return this.page.locator(`text=${name}`);
  }
}
```

### Using Page Objects

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';

test('complete project creation flow', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  // Login
  await loginPage.goto();
  await loginPage.login('demo', 'demo');

  // Create project
  await dashboardPage.goto();
  await dashboardPage.createProject('Test Project', 'Description');

  // Verify
  const project = await dashboardPage.getProjectByName('Test Project');
  await expect(project).toBeVisible();
});
```

---

## Test Scenarios

### Implemented Test Suites

The project includes comprehensive test coverage for all critical user journeys:

**1. Authentication Flow (tests/e2e/authentication.spec.ts)**
- Login with valid/invalid credentials
- Logout functionality
- Session persistence across page reloads
- Protected route access control
- Password reset flow
- Multi-tenant isolation
- Token refresh
- Remember me functionality

**2. Project Creation (tests/e2e/project-creation.spec.ts)**
- Project creation workflow
- Form validation
- Template selection
- Duplicate project name handling
- Cancel functionality
- Loading states
- Keyboard navigation

**3. AI Chat Interaction (tests/e2e/ai-chat.spec.ts)**
- Opening/closing chat panel
- Sending messages and receiving responses
- Real-time streaming responses
- Widget creation through chat
- Conversation context maintenance
- Error handling and retries
- Message history management
- Code block rendering
- Multiline input support

**4. Preview System (tests/e2e/preview.spec.ts)**
- Preview panel operations
- Device mode switching (desktop/tablet/mobile)
- Real-time canvas updates
- Preview in new tab
- Device rotation
- Docker container lifecycle
- Session management
- Interactive widget testing

### Visual Regression Tests

**Builder Interface (tests/visual/builder.spec.ts)**
- Empty canvas state
- Widget placement and selection
- Properties panel
- Toolbar states
- Grid and alignment guides
- Zoom levels
- Context menus
- Layer panel
- Theme variations (light/dark/high-contrast)

**Dashboard (tests/visual/dashboard.spec.ts)**
- Empty state
- Project cards (grid/list views)
- Search and filters
- Sort options
- Navigation sidebar
- User menu
- Responsive layouts
- Theme variations

### Running Specific Test Suites

```bash
# Run authentication tests
pnpm exec playwright test tests/e2e/authentication.spec.ts

# Run project creation tests
pnpm exec playwright test tests/e2e/project-creation.spec.ts

# Run AI chat tests
pnpm exec playwright test tests/e2e/ai-chat.spec.ts

# Run preview system tests
pnpm exec playwright test tests/e2e/preview.spec.ts

# Run all visual regression tests
pnpm exec playwright test tests/visual/

# Run with Percy visual testing
npx percy exec -- playwright test tests/visual/
```

---

## Best Practices

### 1. Use Data Test IDs

```html
<!-- Good -->
<button data-testid="create-project">Create</button>

<!-- Avoid -->
<button class="btn btn-primary">Create</button>
```

```typescript
// Good
await page.click('[data-testid="create-project"]');

// Avoid (fragile)
await page.click('.btn.btn-primary');
```

### 2. Wait for Network Requests

```typescript
// Wait for specific API call
const response = await page.waitForResponse(
  response => response.url().includes('/api/v1/projects') && response.status() === 200
);
```

### 3. Use Fixtures

```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/login.page';

type MyFixtures = {
  loginPage: LoginPage;
  authenticatedPage: Page;
};

export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('demo', 'demo');
    await use(page);
  }
});
```

### 4. Isolate Tests

```typescript
test.beforeEach(async ({ page, context }) => {
  // Clear cookies
  await context.clearCookies();

  // Clear local storage
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
```

---

## Debugging

### Debug Mode

```bash
# Run in headed mode with inspector
pnpm exec playwright test --debug

# Run specific test in debug
pnpm exec playwright test --debug auth.spec.ts
```

### Screenshots and Videos

```typescript
test('take screenshot on failure', async ({ page }) => {
  await page.goto('/dashboard');

  // Take screenshot
  await page.screenshot({ path: 'screenshots/dashboard.png' });

  // Screenshot specific element
  await page.locator('#project-list').screenshot({
    path: 'screenshots/project-list.png'
  });
});
```

### Trace Viewer

```bash
# Generate trace
pnpm exec playwright test --trace on

# View trace
pnpm exec playwright show-trace trace.zip
```

---

## CI/CD Integration

### GitHub Actions

```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4

    - run: pnpm install
    - run: pnpm exec playwright install --with-deps chromium

    - run: pnpm nx run aep-builder-e2e:e2e

    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

---

## Visual Regression Testing with Percy

The project includes Percy configuration for automated visual regression testing:

### Percy Setup

```bash
# Install Percy CLI (already included)
pnpm add -D @percy/cli @percy/playwright

# Set Percy token (get from percy.io)
export PERCY_TOKEN=your-percy-token

# Run visual tests with Percy
npx percy exec -- playwright test tests/visual/
```

### Percy Configuration

See `percy.config.js` for comprehensive Percy settings including:
- Snapshot widths (375px to 2560px)
- Accessibility testing integration
- Animation stabilization
- Dynamic content hiding
- CI/CD integration

### Visual Testing Best Practices

1. **Stabilize animations**: Percy CSS disables animations for consistent snapshots
2. **Hide dynamic content**: Timestamps, avatars, loading states are hidden
3. **Multiple widths**: Test responsive layouts at key breakpoints
4. **Accessibility**: Run axe-core tests alongside visual tests
5. **Review changes**: Always review Percy diffs before approving

---

## Component Testing

The project supports Angular component testing with Playwright:

### Component Test Setup

```typescript
import { test, expect } from '@playwright/experimental-ct-angular';

test('should render button component', async ({ mount }) => {
  const component = await mount('<app-button label="Click Me"></app-button>');

  await expect(component).toBeVisible();
  await expect(component).toContainText('Click Me');
});
```

### Running Component Tests

```bash
# Run all component tests
pnpm test:components

# Run specific component test
pnpm exec playwright test -c playwright-ct.config.ts tests/components/example.spec.ts
```

See `tests/components/example.spec.ts` for comprehensive component testing examples.

---

## Helper Functions and Utilities

The project includes extensive helper functions in `tests/helpers/test-utils.ts`:

### Authentication Helpers

```typescript
import { loginAsUser, logout } from '../helpers/test-utils';

// Login as standard user
await loginAsUser(page, testData.users.standard);

// Logout
await logout(page);
```

### Project Management Helpers

```typescript
import { createTestProject, deleteProject } from '../helpers/test-utils';

// Create test project
const projectId = await createTestProject(page, {
  name: 'Test Project',
  template: 'blank'
});

// Delete project when done
await deleteProject(page, projectId);
```

### Widget Helpers

```typescript
import { addWidgetToCanvas, configureWidget } from '../helpers/test-utils';

// Add widget to canvas
await addWidgetToCanvas(page, 'temperature-gauge', {
  x: 100,
  y: 100,
  value: 72,
  label: 'Room Temperature'
});

// Configure widget properties
await configureWidget(page, 'temperature-gauge', {
  value: 75,
  unit: 'F'
});
```

### API Mocking Helpers

```typescript
import { mockApiResponse, mockApiError } from '../helpers/test-utils';

// Mock successful API response
await mockApiResponse(page, 'api/projects', { id: '123', name: 'Test' });

// Mock API error
await mockApiError(page, 'api/projects', 500);
```

### Accessibility Helpers

```typescript
import { checkAccessibility } from '../helpers/test-utils';

// Run accessibility checks on current page
await checkAccessibility(page, {
  rules: ['wcag2a', 'wcag2aa'],
  context: '[data-testid="main-content"]'
});
```

---

## Related Documentation

- [Testing README](../../tests/README.md) - Comprehensive testing guide
- [Testing Strategy](./TESTING-STRATEGY.md) - Overall testing approach
- [Development Guide](../guides/DEVELOPMENT-GUIDE.md) - Development workflow
- [CI/CD Pipeline](../deployment/CICD-PIPELINE.md) - Automated testing in CI/CD

---

**Last Updated**: 2026-04-15
**Version**: 3.0.0
**Maintained by**: Friendly Technology QA Team
