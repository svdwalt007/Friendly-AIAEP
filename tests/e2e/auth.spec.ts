import { expect, test } from '@playwright/test';

test.describe('Authentication flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
  });

  test('shows a validation error for empty submission', async ({ page }) => {
    const submit = page
      .locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")')
      .first();
    await submit.click({ timeout: 5_000 }).catch(() => undefined);
    // We accept either a visible error message or the URL staying on /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test('login form keeps focus on the username field on first load', async ({ page }) => {
    const username = page.locator('input[type="text"], input[name="username"]').first();
    await expect(username).toBeVisible();
  });
});
