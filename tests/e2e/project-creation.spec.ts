import { test, expect } from '@playwright/test';
import { DashboardPage } from '../page-objects/dashboard.page';
import { ProjectCreationPage } from '../page-objects/project-creation.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser } from '../helpers/test-utils';

/**
 * E2E Test Suite: Project Creation Flow
 *
 * This suite tests the complete project creation workflow:
 * - Navigation to create project
 * - Form validation
 * - Project configuration
 * - Template selection
 * - Project creation and redirection
 * - Error handling
 */

test.describe('Project Creation Flow', () => {
  let dashboardPage: DashboardPage;
  let projectCreationPage: ProjectCreationPage;

  test.beforeEach(async ({ page }) => {
    // Authenticate user
    await loginAsUser(page, testData.users.standard);

    // Initialize page objects
    dashboardPage = new DashboardPage(page);
    projectCreationPage = new ProjectCreationPage(page);

    // Navigate to dashboard
    await dashboardPage.goto();
  });

  test('should display create project button', async () => {
    // Verify create project button is visible
    await expect(dashboardPage.createProjectButton).toBeVisible();
    await expect(dashboardPage.createProjectButton).toBeEnabled();
  });

  test('should navigate to project creation page', async ({ page }) => {
    // Click create project button
    await dashboardPage.clickCreateProject();

    // Verify navigation to project creation page
    await expect(page).toHaveURL(/.*\/projects\/create/);
    await expect(projectCreationPage.pageTitle).toBeVisible();
    await expect(projectCreationPage.pageTitle).toHaveText('Create New Project');
  });

  test('should validate required fields', async () => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Try to submit without filling fields
    await projectCreationPage.clickSubmit();

    // Verify validation messages
    await expect(projectCreationPage.nameFieldError).toBeVisible();
    await expect(projectCreationPage.nameFieldError).toContainText('required');
  });

  test('should validate project name format', async () => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Enter invalid project name
    await projectCreationPage.fillProjectName('Invalid Name!@#');
    await projectCreationPage.clickSubmit();

    // Verify validation message
    await expect(projectCreationPage.nameFieldError).toBeVisible();
    await expect(projectCreationPage.nameFieldError).toContainText(
      'alphanumeric characters, hyphens, and underscores'
    );
  });

  test('should create project with valid data', async ({ page }) => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Fill project creation form
    const projectName = `test-project-${Date.now()}`;
    await projectCreationPage.fillProjectName(projectName);
    await projectCreationPage.fillDescription(testData.projects.standard.description);
    await projectCreationPage.selectTemplate(testData.projects.standard.template);

    // Submit form
    await projectCreationPage.clickSubmit();

    // Wait for project creation to complete
    await page.waitForURL(/.*\/projects\/[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Verify redirection to project builder
    await expect(page.locator('h1')).toContainText(projectName);
  });

  test('should create project with blank template', async ({ page }) => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Fill project creation form with blank template
    const projectName = `blank-project-${Date.now()}`;
    await projectCreationPage.fillProjectName(projectName);
    await projectCreationPage.fillDescription('A blank project for testing');
    await projectCreationPage.selectTemplate('blank');

    // Submit form
    await projectCreationPage.clickSubmit();

    // Wait for project creation
    await page.waitForURL(/.*\/projects\/[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Verify blank canvas is displayed
    await expect(page.locator('[data-testid="canvas-empty-state"]')).toBeVisible();
  });

  test('should create project with IoT dashboard template', async ({ page }) => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Fill project creation form with IoT template
    const projectName = `iot-project-${Date.now()}`;
    await projectCreationPage.fillProjectName(projectName);
    await projectCreationPage.selectTemplate('iot-dashboard');

    // Submit form
    await projectCreationPage.clickSubmit();

    // Wait for project creation
    await page.waitForURL(/.*\/projects\/[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Verify IoT widgets are present
    await expect(page.locator('[data-testid="widget-sensor-gauge"]').first()).toBeVisible();
  });

  test('should handle duplicate project name error', async () => {
    // Create first project
    await dashboardPage.clickCreateProject();
    const projectName = `duplicate-project-${Date.now()}`;
    await projectCreationPage.fillProjectName(projectName);
    await projectCreationPage.clickSubmit();

    // Wait for creation
    await projectCreationPage.page.waitForURL(/.*\/projects\/[a-zA-Z0-9-]+/, { timeout: 10000 });

    // Navigate back to dashboard
    await dashboardPage.goto();

    // Try to create another project with same name
    await dashboardPage.clickCreateProject();
    await projectCreationPage.fillProjectName(projectName);
    await projectCreationPage.clickSubmit();

    // Verify error message
    await expect(projectCreationPage.errorMessage).toBeVisible();
    await expect(projectCreationPage.errorMessage).toContainText('already exists');
  });

  test('should cancel project creation', async ({ page }) => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Fill some data
    await projectCreationPage.fillProjectName('test-cancel-project');

    // Click cancel
    await projectCreationPage.clickCancel();

    // Verify navigation back to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should preserve form data on validation error', async () => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Fill valid project name and invalid description
    const projectName = 'test-preserve-data';
    const description = 'Test description';
    await projectCreationPage.fillProjectName(projectName);
    await projectCreationPage.fillDescription(description);

    // Clear required field
    await projectCreationPage.clearProjectName();
    await projectCreationPage.clickSubmit();

    // Verify error is shown
    await expect(projectCreationPage.nameFieldError).toBeVisible();

    // Verify description is preserved
    await expect(projectCreationPage.descriptionField).toHaveValue(description);
  });

  test('should display template preview on selection', async () => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Select a template
    await projectCreationPage.selectTemplate('iot-dashboard');

    // Verify template preview is displayed
    await expect(projectCreationPage.templatePreview).toBeVisible();
    await expect(projectCreationPage.templateDescription).toBeVisible();
  });

  test('should show loading state during project creation', async () => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Fill form
    await projectCreationPage.fillProjectName(`loading-test-${Date.now()}`);
    await projectCreationPage.clickSubmit();

    // Verify loading indicator is shown
    await expect(projectCreationPage.loadingIndicator).toBeVisible();

    // Wait for completion
    await projectCreationPage.page.waitForURL(/.*\/projects\/[a-zA-Z0-9-]+/, { timeout: 10000 });
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Navigate to project creation
    await dashboardPage.clickCreateProject();

    // Tab through form fields
    await page.keyboard.press('Tab');
    await expect(projectCreationPage.nameField).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(projectCreationPage.descriptionField).toBeFocused();

    // Type in focused field
    await page.keyboard.type('Test Project');
    await expect(projectCreationPage.descriptionField).toHaveValue('Test Project');
  });
});
