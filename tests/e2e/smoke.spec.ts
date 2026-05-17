import { expect, test } from '@playwright/test';

test.describe('AEP Builder — smoke', () => {
  test('login page loads with the expected form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="text"], input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  });

  test('unauthenticated visits to / are redirected to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('no unhandled console errors on the login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('static assets respond from the dev server', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(400);
  });
});

test.describe('AEP API gateway — smoke', () => {
  test('GET /health returns a JSON status', async ({ request }) => {
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3000';
    const res = await request.get(`${apiBase}/health`);
    // 200 healthy or 503 degraded are both acceptable here; we just want JSON.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});
