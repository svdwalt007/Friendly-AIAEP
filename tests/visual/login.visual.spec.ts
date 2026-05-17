/**
 * Percy snapshot of the login page. Run with `pnpm test:visual` to push
 * screenshots to Percy for diffing; `pnpm test:visual:local` runs the same
 * spec without a Percy upload so engineers can sanity-check the snapshot
 * call sites before incurring Percy quota.
 */
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual — login', () => {
  test('login page', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await percySnapshot(page, 'Login — empty');
  });
});
