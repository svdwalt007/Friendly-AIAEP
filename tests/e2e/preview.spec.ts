import { test, expect } from '@playwright/test';
import { BuilderPage } from '../page-objects/builder.page';
import { PreviewPanel } from '../page-objects/preview-panel.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser, createTestProject, addWidgetToCanvas } from '../helpers/test-utils';

/**
 * E2E Test Suite: Preview System
 *
 * This suite tests the preview functionality:
 * - Opening preview panel
 * - Desktop, tablet, and mobile previews
 * - Real-time updates during editing
 * - Preview in new tab
 * - Responsive design testing
 * - Docker container management
 * - Session lifecycle
 */

test.describe('Preview System', () => {
  let builderPage: BuilderPage;
  let previewPanel: PreviewPanel;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Authenticate and create test project
    await loginAsUser(page, testData.users.standard);
    projectId = await createTestProject(page, {
      name: `preview-test-${Date.now()}`,
      template: 'blank',
    });

    // Initialize page objects
    builderPage = new BuilderPage(page);
    previewPanel = new PreviewPanel(page);

    // Navigate to builder
    await builderPage.goto(projectId);

    // Add a widget for testing
    await addWidgetToCanvas(page, 'text-display');
  });

  test('should display preview button', async () => {
    // Verify preview button is visible
    await expect(builderPage.previewButton).toBeVisible();
    await expect(builderPage.previewButton).toBeEnabled();
  });

  test('should open preview panel', async () => {
    // Preview panel should be closed initially
    await expect(previewPanel.panel).not.toBeVisible();

    // Open preview
    await builderPage.clickPreview();

    // Verify preview panel is visible
    await expect(previewPanel.panel).toBeVisible();
    await expect(previewPanel.iframe).toBeVisible();
  });

  test('should close preview panel', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.panel).toBeVisible();

    // Close preview
    await previewPanel.closePanel();

    // Verify panel is closed
    await expect(previewPanel.panel).not.toBeVisible();
  });

  test('should display loading state while initializing preview', async () => {
    // Click preview button
    await builderPage.clickPreview();

    // Verify loading indicator appears
    await expect(previewPanel.loadingIndicator).toBeVisible();

    // Wait for preview to load
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify loading indicator disappears
    await expect(previewPanel.loadingIndicator).not.toBeVisible();
  });

  test('should render widgets in preview', async ({ page }) => {
    // Add a specific widget
    await addWidgetToCanvas(page, 'temperature-gauge', {
      value: 72,
      label: 'Room Temperature',
    });

    // Open preview
    await builderPage.clickPreview();

    // Wait for preview to load
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify widget is rendered in preview
    const iframeContent = previewPanel.iframe.frameLocator(':scope');
    await expect(iframeContent.getByText('Room Temperature')).toBeVisible();
  });

  test('should update preview in real-time when editing', async ({ page }) => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Add a new widget
    await addWidgetToCanvas(page, 'button', { label: 'Click Me' });

    // Wait for preview to update
    await page.waitForTimeout(1000);

    // Verify new widget appears in preview
    const iframeContent = previewPanel.iframe.frameLocator(':scope');
    await expect(iframeContent.getByRole('button', { name: 'Click Me' })).toBeVisible();
  });

  test('should switch to tablet preview mode', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Switch to tablet mode
    await previewPanel.selectDeviceMode('tablet');

    // Verify iframe has tablet dimensions
    const iframeBox = await previewPanel.iframe.boundingBox();
    expect(iframeBox?.width).toBeLessThan(1024);
    expect(iframeBox?.width).toBeGreaterThan(600);
  });

  test('should switch to mobile preview mode', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Switch to mobile mode
    await previewPanel.selectDeviceMode('mobile');

    // Verify iframe has mobile dimensions
    const iframeBox = await previewPanel.iframe.boundingBox();
    expect(iframeBox?.width).toBeLessThanOrEqual(600);
  });

  test('should switch between device modes', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Test desktop mode
    await previewPanel.selectDeviceMode('desktop');
    let iframeBox = await previewPanel.iframe.boundingBox();
    const desktopWidth = iframeBox?.width || 0;

    // Switch to tablet
    await previewPanel.selectDeviceMode('tablet');
    iframeBox = await previewPanel.iframe.boundingBox();
    const tabletWidth = iframeBox?.width || 0;

    // Switch to mobile
    await previewPanel.selectDeviceMode('mobile');
    iframeBox = await previewPanel.iframe.boundingBox();
    const mobileWidth = iframeBox?.width || 0;

    // Verify dimensions decrease
    expect(desktopWidth).toBeGreaterThan(tabletWidth);
    expect(tabletWidth).toBeGreaterThan(mobileWidth);
  });

  test('should rotate device in mobile mode', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Switch to mobile mode
    await previewPanel.selectDeviceMode('mobile');

    // Get portrait dimensions
    let iframeBox = await previewPanel.iframe.boundingBox();
    const portraitWidth = iframeBox?.width || 0;
    const portraitHeight = iframeBox?.height || 0;

    // Rotate to landscape
    await previewPanel.clickRotate();

    // Get landscape dimensions
    iframeBox = await previewPanel.iframe.boundingBox();
    const landscapeWidth = iframeBox?.width || 0;
    const landscapeHeight = iframeBox?.height || 0;

    // Verify dimensions are swapped
    expect(landscapeWidth).toBe(portraitHeight);
    expect(landscapeHeight).toBe(portraitWidth);
  });

  test('should open preview in new tab', async ({ context, page }) => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Click open in new tab
    const newPagePromise = context.waitForEvent('page');
    await previewPanel.clickOpenInNewTab();

    // Wait for new page
    const newPage = await newPagePromise;
    await newPage.waitForLoadState();

    // Verify new page has preview content
    await expect(newPage.locator('[data-testid="preview-container"]')).toBeVisible();

    // Close new page
    await newPage.close();
  });

  test('should display preview URL', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify preview URL is displayed
    await expect(previewPanel.previewUrl).toBeVisible();

    // Verify URL contains session ID
    const url = await previewPanel.previewUrl.textContent();
    expect(url).toMatch(/localhost:3001\/preview\/.+/);
  });

  test('should copy preview URL to clipboard', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Click copy URL button
    await previewPanel.clickCopyUrl();

    // Verify copy confirmation
    await expect(previewPanel.copyConfirmation).toBeVisible();
  });

  test('should refresh preview', async ({ page }) => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Add unique widget
    const timestamp = Date.now();
    await addWidgetToCanvas(page, 'text-display', { text: `Test ${timestamp}` });

    // Click refresh
    await previewPanel.clickRefresh();

    // Verify loading indicator appears
    await expect(previewPanel.loadingIndicator).toBeVisible();

    // Wait for preview to reload
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify updated content is displayed
    const iframeContent = previewPanel.iframe.frameLocator(':scope');
    await expect(iframeContent.getByText(`Test ${timestamp}`)).toBeVisible();
  });

  test('should handle preview errors gracefully', async ({ page }) => {
    // Intercept preview API and make it fail
    await page.route('**/api/preview/start', (route) => {
      route.abort('failed');
    });

    // Try to open preview
    await builderPage.clickPreview();

    // Verify error message is displayed
    await expect(previewPanel.errorMessage).toBeVisible({ timeout: 10000 });
    await expect(previewPanel.errorMessage).toContainText('preview');
  });

  test('should retry failed preview initialization', async ({ page }) => {
    // Make first call fail, second succeed
    let callCount = 0;
    await page.route('**/api/preview/start', (route) => {
      callCount++;
      if (callCount === 1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    // Try to open preview
    await builderPage.clickPreview();

    // Wait for error
    await expect(previewPanel.errorMessage).toBeVisible({ timeout: 10000 });

    // Click retry
    await previewPanel.clickRetry();

    // Verify preview loads successfully
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });
  });

  test('should display preview session status', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify session status is displayed
    await expect(previewPanel.sessionStatus).toBeVisible();
    await expect(previewPanel.sessionStatus).toContainText('Active');
  });

  test('should show preview controls', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify all controls are visible
    await expect(previewPanel.deviceModeSelector).toBeVisible();
    await expect(previewPanel.refreshButton).toBeVisible();
    await expect(previewPanel.openInNewTabButton).toBeVisible();
    await expect(previewPanel.closeButton).toBeVisible();
  });

  test('should maintain preview state when switching back to editor', async ({ page }) => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Switch to tablet mode
    await previewPanel.selectDeviceMode('tablet');

    // Close preview
    await previewPanel.closePanel();

    // Re-open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Verify tablet mode is still selected
    const selectedMode = await previewPanel.getSelectedDeviceMode();
    expect(selectedMode).toBe('tablet');
  });

  test('should support interactive widgets in preview', async ({ page }) => {
    // Add interactive button widget
    await addWidgetToCanvas(page, 'counter-button', {
      label: 'Count',
      initialValue: 0
    });

    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Interact with widget in preview
    const iframeContent = previewPanel.iframe.frameLocator(':scope');
    const button = iframeContent.getByRole('button', { name: /Count/ });

    await button.click();
    await button.click();

    // Verify interaction worked (counter incremented)
    await expect(iframeContent.getByText('2')).toBeVisible();
  });

  test('should display console logs from preview', async () => {
    // Open preview
    await builderPage.clickPreview();
    await expect(previewPanel.iframe).toBeVisible({ timeout: 30000 });

    // Enable console view
    await previewPanel.toggleConsole();

    // Verify console panel is visible
    await expect(previewPanel.consolePanel).toBeVisible();
  });

  test('should handle preview timeout', async ({ page }) => {
    // Set very short timeout for testing
    await page.evaluate(() => {
      (window as any).PREVIEW_TIMEOUT = 1000;
    });

    // Intercept and delay preview response
    await page.route('**/api/preview/start', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });

    // Try to open preview
    await builderPage.clickPreview();

    // Verify timeout error is displayed
    await expect(previewPanel.errorMessage).toBeVisible({ timeout: 5000 });
    await expect(previewPanel.errorMessage).toContainText('timeout');
  });
});
