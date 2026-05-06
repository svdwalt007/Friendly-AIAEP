import { Page, expect } from '@playwright/test';
import { testData } from '../fixtures/test-data';

/**
 * Test Utility Functions
 *
 * Helper functions for common test operations:
 * - Authentication
 * - Project management
 * - Widget operations
 * - API mocking
 * - Assertions
 */

/**
 * Login helper function
 */
export async function loginAsUser(
  page: Page,
  user: { username: string; password: string }
): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.locator('[data-testid="username-field"]').fill(user.username);
  await page.locator('[data-testid="password-field"]').fill(user.password);

  // Click login button
  await page.locator('[data-testid="login-button"]').click();

  // Wait for navigation to dashboard
  await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
}

/**
 * Logout helper function
 */
export async function logout(page: Page): Promise<void> {
  // Click user menu
  await page.locator('[data-testid="user-menu"]').click();

  // Click logout
  await page.locator('[data-testid="logout-button"]').click();

  // Wait for navigation to login
  await page.waitForURL(/.*\/login/);
}

/**
 * Create test project helper
 */
export async function createTestProject(
  page: Page,
  config: {
    name?: string;
    description?: string;
    template?: string;
  }
): Promise<string> {
  const projectName = config.name || `test-project-${Date.now()}`;
  const description = config.description || 'Test project description';
  const template = config.template || 'blank';

  // Navigate to dashboard if not already there
  const url = page.url();
  if (!url.includes('/dashboard')) {
    await page.goto('/dashboard');
  }

  // Click create project button
  await page.locator('[data-testid="create-project-button"]').click();

  // Wait for creation form
  await page.waitForURL(/.*\/projects\/create/);

  // Fill in project details
  await page.locator('[data-testid="project-name-field"]').fill(projectName);
  await page.locator('[data-testid="project-description-field"]').fill(description);

  // Select template
  await page.locator(`[data-testid="template-${template}"]`).click();

  // Submit form
  await page.locator('[data-testid="create-project-submit"]').click();

  // Wait for navigation to project
  await page.waitForURL(/.*\/projects\/[a-zA-Z0-9-]+/, { timeout: 10000 });

  // Extract project ID from URL
  const projectUrl = page.url();
  const match = projectUrl.match(/\/projects\/([a-zA-Z0-9-]+)/);
  const projectId = match ? match[1] : '';

  return projectId;
}

/**
 * Delete project helper
 */
export async function deleteProject(page: Page, projectId: string): Promise<void> {
  // Navigate to dashboard
  await page.goto('/dashboard');

  // Find project card
  const projectCard = page.locator(`[data-testid="project-card-${projectId}"]`);

  // Open menu
  await projectCard.locator('[data-testid="project-menu-button"]').click();

  // Click delete
  await page.locator('[data-testid="delete-project"]').click();

  // Confirm deletion
  await page.locator('[data-testid="confirm-delete"]').click();

  // Wait for deletion to complete
  await expect(projectCard).not.toBeVisible();
}

/**
 * Add widget to canvas helper
 */
export async function addWidgetToCanvas(
  page: Page,
  widgetType: string,
  config?: {
    x?: number;
    y?: number;
    [key: string]: any;
  }
): Promise<void> {
  // Open widget library
  await page.locator('[data-testid="add-widget-button"]').click();

  // Wait for widget library
  await expect(page.locator('[data-testid="widget-library"]')).toBeVisible();

  // Find and click widget type
  await page.locator(`[data-testid="widget-type-${widgetType}"]`).click();

  // Widget should be added to canvas
  await expect(page.locator(`[data-testid="widget-${widgetType}"]`).first()).toBeVisible();

  // If position is specified, move widget
  if (config?.x !== undefined && config?.y !== undefined) {
    const widget = page.locator(`[data-testid="widget-${widgetType}"]`).first();
    await widget.dragTo(page.locator('[data-testid="canvas"]'), {
      targetPosition: { x: config.x, y: config.y },
    });
  }

  // If additional config is provided, apply it
  if (config && Object.keys(config).length > 2) {
    await configureWidget(page, widgetType, config);
  }
}

/**
 * Configure widget properties helper
 */
export async function configureWidget(
  page: Page,
  widgetType: string,
  config: Record<string, any>
): Promise<void> {
  // Select widget
  const widget = page.locator(`[data-testid="widget-${widgetType}"]`).first();
  await widget.click();

  // Wait for properties panel
  await expect(page.locator('[data-testid="properties-panel"]')).toBeVisible();

  // Apply configuration
  for (const [key, value] of Object.entries(config)) {
    if (key === 'x' || key === 'y') continue; // Skip position properties

    const field = page.locator(`[data-testid="property-${key}"]`);

    if (await field.count() > 0) {
      const tagName = await field.evaluate((el) => el.tagName.toLowerCase());

      if (tagName === 'input') {
        const type = await field.getAttribute('type');
        if (type === 'checkbox') {
          if (value) await field.check();
          else await field.uncheck();
        } else {
          await field.fill(String(value));
        }
      } else if (tagName === 'select') {
        await field.selectOption(String(value));
      } else if (tagName === 'textarea') {
        await field.fill(String(value));
      }
    }
  }
}

/**
 * Mock API response helper
 */
export async function mockApiResponse(
  page: Page,
  endpoint: string,
  response: any,
  options?: {
    status?: number;
    delay?: number;
  }
): Promise<void> {
  await page.route(`**/${endpoint}`, async (route) => {
    // Add delay if specified
    if (options?.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }

    // Return mocked response
    await route.fulfill({
      status: options?.status || 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock API error helper
 */
export async function mockApiError(
  page: Page,
  endpoint: string,
  errorCode: number = 500
): Promise<void> {
  await page.route(`**/${endpoint}`, (route) => {
    route.fulfill({
      status: errorCode,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Mock error',
        message: 'This is a mocked error response',
      }),
    });
  });
}

/**
 * Wait for network idle helper
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Take screenshot helper
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }
): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: options?.fullPage ?? false,
    clip: options?.clip,
  });
}

/**
 * Wait for element with retry helper
 */
export async function waitForElementWithRetry(
  page: Page,
  selector: string,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.waitForSelector(selector, { timeout: delay });
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await page.waitForTimeout(delay);
    }
  }
}

/**
 * Execute with retry helper
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Check accessibility helper (using axe-core)
 */
export async function checkAccessibility(
  page: Page,
  options?: {
    rules?: string[];
    context?: string;
  }
): Promise<void> {
  // This would integrate with @axe-core/playwright
  // Implementation depends on the actual integration
  const { injectAxe, checkA11y } = await import('@axe-core/playwright');

  await injectAxe(page);
  await checkA11y(page, options?.context, {
    runOnly: {
      type: 'tag',
      values: options?.rules || ['wcag2a', 'wcag2aa'],
    },
  });
}

/**
 * Fill form helper
 */
export async function fillForm(
  page: Page,
  formData: Record<string, string>
): Promise<void> {
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = page.locator(`[data-testid="${fieldName}"]`);
    await field.fill(value);
  }
}

/**
 * Clear local storage helper
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Clear session storage helper
 */
export async function clearSessionStorage(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
}

/**
 * Set local storage item helper
 */
export async function setLocalStorageItem(
  page: Page,
  key: string,
  value: string
): Promise<void> {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key, value }
  );
}

/**
 * Get local storage item helper
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((key) => localStorage.getItem(key), key);
}

/**
 * Console log collector helper
 */
export class ConsoleLogCollector {
  private logs: Array<{ type: string; text: string }> = [];

  constructor(private page: Page) {
    this.page.on('console', (msg) => {
      this.logs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  }

  getLogs(type?: string): Array<{ type: string; text: string }> {
    if (type) {
      return this.logs.filter((log) => log.type === type);
    }
    return this.logs;
  }

  hasError(): boolean {
    return this.logs.some((log) => log.type === 'error');
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * Network request collector helper
 */
export class NetworkRequestCollector {
  private requests: Array<{
    url: string;
    method: string;
    status?: number;
    responseBody?: any;
  }> = [];

  constructor(private page: Page, private urlPattern?: string) {
    this.page.on('request', (request) => {
      if (!this.urlPattern || request.url().includes(this.urlPattern)) {
        this.requests.push({
          url: request.url(),
          method: request.method(),
        });
      }
    });

    this.page.on('response', (response) => {
      if (!this.urlPattern || response.url().includes(this.urlPattern)) {
        const request = this.requests.find((r) => r.url === response.url());
        if (request) {
          request.status = response.status();
        }
      }
    });
  }

  getRequests(method?: string): typeof this.requests {
    if (method) {
      return this.requests.filter((req) => req.method === method);
    }
    return this.requests;
  }

  hasRequest(urlFragment: string): boolean {
    return this.requests.some((req) => req.url.includes(urlFragment));
  }

  clear(): void {
    this.requests = [];
  }
}
