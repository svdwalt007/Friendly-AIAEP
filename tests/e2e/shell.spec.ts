/**
 * @file E2E — Shell navigation and orange singleton rule.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { test, expect } from '@playwright/test';

test.describe('Shell navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Seed localStorage with a mock authenticated user so authGuard passes
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem(
        'aep_user',
        JSON.stringify({
          id: 'u-1',
          username: 'TestUser',
          tenantId: 't-1',
          role: 'admin',
        }),
      );
      localStorage.setItem('aep_access_token', 'mock-token');
      localStorage.setItem('aep_refresh_token', 'mock-refresh');
    });
  });

  test('renders left rail with Dashboard, Projects, Settings', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page.locator('.shell-sidenav')).toBeVisible();

    const labels = page.locator('.shell-sidenav mat-nav-list a');
    await expect(labels).toHaveCount(3);
    await expect(labels.filter({ hasText: 'Dashboard' })).toBeVisible();
    await expect(labels.filter({ hasText: 'Projects' })).toBeVisible();
    await expect(labels.filter({ hasText: 'Settings' })).toBeVisible();
  });

  test('navigates between routes via left rail', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('.shell-sidenav a:has-text("Projects")').click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.locator('.shell-sidenav a:has-text("Settings")').click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('collapses and expands left rail', async ({ page }) => {
    await page.goto('/dashboard');
    const sidenav = page.locator('.shell-sidenav');
    await expect(sidenav).not.toHaveClass(/collapsed/);

    await page.locator('button[aria-label="Collapse sidebar"]').click();
    await expect(sidenav).toHaveClass(/collapsed/);

    await page.locator('button[aria-label="Expand sidebar"]').click();
    await expect(sidenav).not.toHaveClass(/collapsed/);
  });

  test('shows breadcrumb trail for nested routes', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('app-shell-breadcrumb')).toContainText(
      'Projects',
    );
  });

  test('shows user menu with logout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('button[aria-label="User menu"]').click();
    await expect(page.locator('mat-menu')).toContainText('TestUser');
    await expect(
      page.locator('mat-menu button:has-text("Logout")'),
    ).toBeVisible();
  });
});

test.describe('Orange singleton rule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem(
        'aep_user',
        JSON.stringify({
          id: 'u-1',
          username: 'TestUser',
          tenantId: 't-1',
          role: 'admin',
        }),
      );
      localStorage.setItem('aep_access_token', 'mock-token');
      localStorage.setItem('aep_refresh_token', 'mock-refresh');
    });
  });

  test('only one data-friendly-primary element exists per screen', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const primaries = page.locator('[data-friendly-primary]');
    await expect(primaries).toHaveCount(1);
  });
});
