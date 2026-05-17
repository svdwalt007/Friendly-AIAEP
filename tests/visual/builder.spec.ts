import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';
import { BuilderPage } from '../page-objects/builder.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser, createTestProject, addWidgetToCanvas } from '../helpers/test-utils';

/**
 * Visual Regression Test Suite: Builder Interface
 *
 * This suite captures screenshots for visual regression testing:
 * - Empty builder state
 * - Builder with widgets
 * - Properties panel states
 * - Widget selection states
 * - Toolbar and menus
 * - Responsive layouts
 * - Theme variations
 */

test.describe('Builder Visual Regression', () => {
  let builderPage: BuilderPage;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Authenticate and create test project
    await loginAsUser(page, testData.users.standard);
    projectId = await createTestProject(page, {
      name: `visual-test-${Date.now()}`,
      template: 'blank',
    });

    // Initialize page objects
    builderPage = new BuilderPage(page);

    // Navigate to builder
    await builderPage.goto(projectId);

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should capture empty builder canvas', async ({ page }) => {
    // Capture empty state
    await percySnapshot(page, 'Builder - Empty Canvas', {
      widths: [1280, 1920],
    });
  });

  test('should capture builder with single widget', async ({ page }) => {
    // Add a widget
    await addWidgetToCanvas(page, 'temperature-gauge', {
      value: 72,
      label: 'Room Temperature',
    });

    // Wait for widget to render
    await page.waitForTimeout(1000);

    // Capture with widget
    await percySnapshot(page, 'Builder - Single Widget', {
      widths: [1280, 1920],
    });
  });

  test('should capture builder with multiple widgets', async ({ page }) => {
    // Add multiple widgets
    await addWidgetToCanvas(page, 'temperature-gauge', { x: 50, y: 50 });
    await addWidgetToCanvas(page, 'humidity-sensor', { x: 250, y: 50 });
    await addWidgetToCanvas(page, 'chart-line', { x: 50, y: 250 });
    await addWidgetToCanvas(page, 'status-indicator', { x: 450, y: 50 });

    // Wait for all widgets to render
    await page.waitForTimeout(1500);

    // Capture layout
    await percySnapshot(page, 'Builder - Multiple Widgets Layout', {
      widths: [1280, 1920],
    });
  });

  test('should capture widget selection state', async ({ page }) => {
    // Add widget
    await addWidgetToCanvas(page, 'temperature-gauge');

    // Select widget
    await page.locator('[data-testid="widget-temperature-gauge"]').first().click();

    // Wait for selection highlight
    await page.waitForTimeout(500);

    // Capture selected state
    await percySnapshot(page, 'Builder - Widget Selected', {
      widths: [1280, 1920],
    });
  });

  test('should capture properties panel', async ({ page }) => {
    // Add and select widget
    await addWidgetToCanvas(page, 'temperature-gauge');
    await page.locator('[data-testid="widget-temperature-gauge"]').first().click();

    // Wait for properties panel
    await expect(builderPage.propertiesPanel).toBeVisible();

    // Capture with properties panel
    await percySnapshot(page, 'Builder - Properties Panel Open', {
      widths: [1280, 1920],
    });
  });

  test('should capture widget library panel', async ({ page }) => {
    // Open widget library
    await builderPage.clickAddWidget();

    // Wait for library to open
    await expect(builderPage.widgetLibrary).toBeVisible();

    // Capture widget library
    await percySnapshot(page, 'Builder - Widget Library', {
      widths: [1280, 1920],
    });
  });

  test('should capture toolbar states', async ({ page }) => {
    // Capture default toolbar
    await percySnapshot(page, 'Builder - Toolbar Default', {
      widths: [1280, 1920],
    });

    // Add widget and select it
    await addWidgetToCanvas(page, 'temperature-gauge');
    await page.locator('[data-testid="widget-temperature-gauge"]').first().click();

    // Capture toolbar with selection
    await percySnapshot(page, 'Builder - Toolbar With Selection', {
      widths: [1280, 1920],
    });
  });

  test('should capture grid and alignment guides', async ({ page }) => {
    // Enable grid
    await builderPage.toggleGrid();

    // Add widgets
    await addWidgetToCanvas(page, 'temperature-gauge', { x: 100, y: 100 });
    await addWidgetToCanvas(page, 'humidity-sensor', { x: 300, y: 100 });

    // Capture with grid
    await percySnapshot(page, 'Builder - Grid and Guides', {
      widths: [1280, 1920],
    });
  });

  test('should capture zoom levels', async ({ page }) => {
    // Add widgets
    await addWidgetToCanvas(page, 'temperature-gauge');
    await addWidgetToCanvas(page, 'chart-line');

    // Capture at 100% zoom
    await percySnapshot(page, 'Builder - Zoom 100%', {
      widths: [1280],
    });

    // Zoom in
    await builderPage.setZoom(150);
    await page.waitForTimeout(500);

    // Capture at 150% zoom
    await percySnapshot(page, 'Builder - Zoom 150%', {
      widths: [1280],
    });

    // Zoom out
    await builderPage.setZoom(75);
    await page.waitForTimeout(500);

    // Capture at 75% zoom
    await percySnapshot(page, 'Builder - Zoom 75%', {
      widths: [1280],
    });
  });

  test('should capture context menu', async ({ page }) => {
    // Add widget
    await addWidgetToCanvas(page, 'temperature-gauge');

    // Right-click widget
    await page.locator('[data-testid="widget-temperature-gauge"]').first().click({ button: 'right' });

    // Wait for context menu
    await page.waitForTimeout(300);

    // Capture context menu
    await percySnapshot(page, 'Builder - Context Menu', {
      widths: [1280],
    });
  });

  test('should capture layer panel', async ({ page }) => {
    // Add multiple widgets
    await addWidgetToCanvas(page, 'temperature-gauge');
    await addWidgetToCanvas(page, 'humidity-sensor');
    await addWidgetToCanvas(page, 'chart-line');

    // Open layers panel
    await builderPage.clickLayersPanel();

    // Wait for panel
    await expect(builderPage.layersPanel).toBeVisible();

    // Capture layers
    await percySnapshot(page, 'Builder - Layers Panel', {
      widths: [1280, 1920],
    });
  });

  test('should capture responsive canvas sizes', async ({ page }) => {
    // Add widgets
    await addWidgetToCanvas(page, 'temperature-gauge');

    // Desktop view
    await builderPage.setCanvasSize('desktop');
    await page.waitForTimeout(500);
    await percySnapshot(page, 'Builder - Canvas Desktop', {
      widths: [1920],
    });

    // Tablet view
    await builderPage.setCanvasSize('tablet');
    await page.waitForTimeout(500);
    await percySnapshot(page, 'Builder - Canvas Tablet', {
      widths: [1280],
    });

    // Mobile view
    await builderPage.setCanvasSize('mobile');
    await page.waitForTimeout(500);
    await percySnapshot(page, 'Builder - Canvas Mobile', {
      widths: [1280],
    });
  });

  test('should capture widget configuration modal', async ({ page }) => {
    // Add widget
    await addWidgetToCanvas(page, 'chart-line');

    // Open configuration
    await page.locator('[data-testid="widget-chart-line"]').first().dblclick();

    // Wait for modal
    await page.waitForTimeout(500);

    // Capture configuration
    await percySnapshot(page, 'Builder - Widget Configuration Modal', {
      widths: [1280, 1920],
    });
  });

  test('should capture data binding panel', async ({ page }) => {
    // Add widget
    await addWidgetToCanvas(page, 'temperature-gauge');
    await page.locator('[data-testid="widget-temperature-gauge"]').first().click();

    // Open data binding
    await builderPage.clickDataBindingTab();

    // Wait for panel
    await page.waitForTimeout(500);

    // Capture data binding
    await percySnapshot(page, 'Builder - Data Binding Panel', {
      widths: [1280, 1920],
    });
  });

  test('should capture error states', async ({ page }) => {
    // Add widget with invalid configuration
    await addWidgetToCanvas(page, 'chart-line', {
      dataSource: 'invalid-source',
    });

    // Wait for error indicator
    await page.waitForTimeout(1000);

    // Capture error state
    await percySnapshot(page, 'Builder - Widget Error State', {
      widths: [1280],
    });
  });

  test('should capture loading states', async ({ page }) => {
    // Trigger loading state (e.g., saving project)
    await builderPage.clickSave();

    // Capture during save
    await percySnapshot(page, 'Builder - Saving State', {
      widths: [1280],
    });
  });

  test('should capture undo/redo states', async ({ page }) => {
    // Initial state
    await percySnapshot(page, 'Builder - Initial State', {
      widths: [1280],
    });

    // Add widget
    await addWidgetToCanvas(page, 'temperature-gauge');
    await page.waitForTimeout(500);

    // After adding widget
    await percySnapshot(page, 'Builder - After Add Widget', {
      widths: [1280],
    });

    // Undo
    await builderPage.clickUndo();
    await page.waitForTimeout(500);

    // After undo
    await percySnapshot(page, 'Builder - After Undo', {
      widths: [1280],
    });

    // Redo
    await builderPage.clickRedo();
    await page.waitForTimeout(500);

    // After redo
    await percySnapshot(page, 'Builder - After Redo', {
      widths: [1280],
    });
  });

  test('should capture dark theme', async ({ page }) => {
    // Switch to dark theme
    await builderPage.setTheme('dark');
    await page.waitForTimeout(500);

    // Add widgets
    await addWidgetToCanvas(page, 'temperature-gauge');
    await addWidgetToCanvas(page, 'chart-line');

    // Capture dark theme
    await percySnapshot(page, 'Builder - Dark Theme', {
      widths: [1280, 1920],
    });
  });

  test('should capture high contrast theme', async ({ page }) => {
    // Switch to high contrast theme
    await builderPage.setTheme('high-contrast');
    await page.waitForTimeout(500);

    // Add widgets
    await addWidgetToCanvas(page, 'temperature-gauge');

    // Capture high contrast
    await percySnapshot(page, 'Builder - High Contrast Theme', {
      widths: [1280],
    });
  });

  test('should capture keyboard shortcuts overlay', async ({ page }) => {
    // Open shortcuts overlay
    await page.keyboard.press('Shift+?');

    // Wait for overlay
    await page.waitForTimeout(300);

    // Capture shortcuts
    await percySnapshot(page, 'Builder - Keyboard Shortcuts', {
      widths: [1280],
    });
  });

  test('should capture full page at different breakpoints', async ({ page }) => {
    // Add comprehensive layout
    await addWidgetToCanvas(page, 'temperature-gauge', { x: 50, y: 50 });
    await addWidgetToCanvas(page, 'humidity-sensor', { x: 300, y: 50 });
    await addWidgetToCanvas(page, 'chart-line', { x: 50, y: 250 });

    // Open properties panel
    await page.locator('[data-testid="widget-temperature-gauge"]').first().click();

    // Capture at multiple breakpoints
    await percySnapshot(page, 'Builder - Full Interface', {
      widths: [1280, 1440, 1920, 2560],
      minHeight: 1024,
    });
  });
});
