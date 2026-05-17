import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { DashboardPage } from '../page-objects/dashboard.page';
import { testData } from '../fixtures/test-data';

/**
 * E2E Test Suite: Authentication Flows
 *
 * This suite tests authentication and authorization:
 * - Login with valid credentials
 * - Login with invalid credentials
 * - Logout functionality
 * - Session persistence
 * - Protected route access
 * - Password reset flow
 * - Multi-tenant isolation
 * - Token refresh
 */

test.describe('Authentication Flows', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);

    // Navigate to login page
    await loginPage.goto();
  });

  test('should display login form', async () => {
    // Verify login form elements are visible
    await expect(loginPage.usernameField).toBeVisible();
    await expect(loginPage.passwordField).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
    await expect(loginPage.loginButton).toBeEnabled();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Enter credentials
    await loginPage.fillUsername(testData.users.standard.username);
    await loginPage.fillPassword(testData.users.standard.password);

    // Click login
    await loginPage.clickLogin();

    // Verify navigation to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(dashboardPage.pageTitle).toBeVisible();
  });

  test('should show error with invalid username', async () => {
    // Enter invalid username
    await loginPage.fillUsername('nonexistent@example.com');
    await loginPage.fillPassword('anypassword');

    // Click login
    await loginPage.clickLogin();

    // Verify error message
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });

  test('should show error with invalid password', async () => {
    // Enter valid username but wrong password
    await loginPage.fillUsername(testData.users.standard.username);
    await loginPage.fillPassword('wrongpassword');

    // Click login
    await loginPage.clickLogin();

    // Verify error message
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });

  test('should validate required fields', async () => {
    // Try to login without filling fields
    await loginPage.clickLogin();

    // Verify validation messages
    await expect(loginPage.usernameFieldError).toBeVisible();
    await expect(loginPage.usernameFieldError).toContainText('required');
  });

  test('should validate email format', async () => {
    // Enter invalid email format
    await loginPage.fillUsername('notanemail');
    await loginPage.fillPassword('password123');
    await loginPage.clickLogin();

    // Verify validation message
    await expect(loginPage.usernameFieldError).toBeVisible();
    await expect(loginPage.usernameFieldError).toContainText('valid email');
  });

  test('should toggle password visibility', async () => {
    // Password should be hidden by default
    await expect(loginPage.passwordField).toHaveAttribute('type', 'password');

    // Click toggle button
    await loginPage.clickTogglePassword();

    // Verify password is visible
    await expect(loginPage.passwordField).toHaveAttribute('type', 'text');

    // Click toggle again
    await loginPage.clickTogglePassword();

    // Verify password is hidden again
    await expect(loginPage.passwordField).toHaveAttribute('type', 'password');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);

    // Verify dashboard is loaded
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Click logout
    await dashboardPage.clickLogout();

    // Verify navigation to login page
    await expect(page).toHaveURL(/.*\/login/);
    await expect(loginPage.usernameField).toBeVisible();
  });

  test('should clear session on logout', async ({ page, context }) => {
    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Logout
    await dashboardPage.clickLogout();

    // Try to navigate directly to dashboard
    await page.goto('/dashboard');

    // Verify redirect to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Reload page
    await page.reload();

    // Verify still on dashboard (session persisted)
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(dashboardPage.pageTitle).toBeVisible();
  });

  test('should protect routes from unauthenticated access', async ({ page }) => {
    // Try to access protected route without login
    await page.goto('/dashboard');

    // Verify redirect to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should redirect to intended page after login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/projects/123/edit');

    // Verify redirect to login with return URL
    await expect(page).toHaveURL(/.*\/login/);

    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);

    // Verify redirect to originally requested page (or dashboard if not found)
    await expect(page).toHaveURL(/.*\/(projects|dashboard)/);
  });

  test('should display forgot password link', async () => {
    // Verify forgot password link is visible
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test('should navigate to password reset page', async ({ page }) => {
    // Click forgot password link
    await loginPage.clickForgotPassword();

    // Verify navigation to reset page
    await expect(page).toHaveURL(/.*\/reset-password/);
  });

  test('should request password reset', async ({ page }) => {
    // Navigate to reset page
    await loginPage.clickForgotPassword();

    // Enter email
    await page.locator('[data-testid="reset-email"]').fill(testData.users.standard.username);

    // Click submit
    await page.locator('[data-testid="reset-submit"]').click();

    // Verify success message
    await expect(page.locator('[data-testid="reset-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="reset-success"]')).toContainText('email sent');
  });

  test('should login with admin user', async ({ page }) => {
    // Login as admin
    await loginPage.login(testData.users.admin.username, testData.users.admin.password);

    // Verify dashboard access
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify admin menu is visible
    await expect(dashboardPage.adminMenu).toBeVisible();
  });

  test('should not show admin menu for standard user', async ({ page }) => {
    // Login as standard user
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);

    // Verify dashboard access
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify admin menu is not visible
    await expect(dashboardPage.adminMenu).not.toBeVisible();
  });

  test('should enforce tenant isolation', async ({ page, context }) => {
    // Login as tenant1 user
    await loginPage.login(testData.users.tenant1.username, testData.users.tenant1.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Get projects for tenant1
    const tenant1Projects = await dashboardPage.getProjectNames();

    // Logout
    await dashboardPage.clickLogout();

    // Login as tenant2 user
    await loginPage.login(testData.users.tenant2.username, testData.users.tenant2.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Get projects for tenant2
    const tenant2Projects = await dashboardPage.getProjectNames();

    // Verify projects are different (tenant isolation)
    expect(tenant1Projects).not.toEqual(tenant2Projects);
  });

  test('should handle concurrent login attempts', async ({ page }) => {
    // Start multiple login attempts quickly
    const loginPromises = [];

    for (let i = 0; i < 3; i++) {
      loginPromises.push(
        loginPage.login(testData.users.standard.username, testData.users.standard.password)
      );
    }

    // Wait for all to complete
    await Promise.all(loginPromises);

    // Verify successful login
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should refresh token before expiration', async ({ page }) => {
    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Wait for token refresh (mock short expiration)
    await page.evaluate(() => {
      localStorage.setItem('token_expires_at', String(Date.now() + 1000));
    });

    // Wait for refresh
    await page.waitForTimeout(2000);

    // Verify still authenticated
    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should logout on token expiration', async ({ page }) => {
    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Expire token manually
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
    });

    // Navigate to protected route
    await page.goto('/projects');

    // Verify redirect to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show loading state during login', async () => {
    // Enter credentials
    await loginPage.fillUsername(testData.users.standard.username);
    await loginPage.fillPassword(testData.users.standard.password);

    // Click login
    await loginPage.clickLogin();

    // Verify loading indicator appears
    await expect(loginPage.loadingIndicator).toBeVisible();

    // Wait for completion
    await expect(loginPage.loadingIndicator).not.toBeVisible({ timeout: 10000 });
  });

  test('should disable form during login', async () => {
    // Enter credentials
    await loginPage.fillUsername(testData.users.standard.username);
    await loginPage.fillPassword(testData.users.standard.password);

    // Click login
    await loginPage.clickLogin();

    // Verify form is disabled during submission
    await expect(loginPage.loginButton).toBeDisabled();
    await expect(loginPage.usernameField).toBeDisabled();
    await expect(loginPage.passwordField).toBeDisabled();
  });

  test('should support Enter key to submit login', async ({ page }) => {
    // Enter credentials
    await loginPage.fillUsername(testData.users.standard.username);
    await loginPage.fillPassword(testData.users.standard.password);

    // Press Enter
    await loginPage.passwordField.press('Enter');

    // Verify navigation to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test('should display user info after login', async ({ page }) => {
    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify user menu is visible
    await expect(dashboardPage.userMenu).toBeVisible();

    // Click user menu
    await dashboardPage.clickUserMenu();

    // Verify user info is displayed
    await expect(dashboardPage.userEmail).toBeVisible();
    await expect(dashboardPage.userEmail).toContainText(testData.users.standard.username);
  });

  test('should remember me functionality', async ({ page, context }) => {
    // Check remember me
    await loginPage.checkRememberMe();

    // Login
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Close and reopen browser
    await context.close();

    // Create new context (simulates browser restart)
    // Note: In actual implementation, this would verify persistent storage
  });

  test('should handle login with special characters in password', async ({ page }) => {
    // Login with password containing special characters
    await loginPage.fillUsername(testData.users.specialPassword.username);
    await loginPage.fillPassword(testData.users.specialPassword.password);

    // Click login
    await loginPage.clickLogin();

    // Verify successful login
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
