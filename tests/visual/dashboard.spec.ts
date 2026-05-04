import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';
import { DashboardPage } from '../page-objects/dashboard.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser, createTestProject } from '../helpers/test-utils';

/**
 * Visual Regression Test Suite: Dashboard
 *
 * This suite captures screenshots of the dashboard:
 * - Empty dashboard state
 * - Dashboard with projects
 * - Project cards and lists
 * - Search and filters
 * - User menu and navigation
 * - Responsive layouts
 * - Theme variations
 */

test.describe('Dashboard Visual Regression', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    // Authenticate user
    await loginAsUser(page, testData.users.standard);

    // Initialize page object
    dashboardPage = new DashboardPage(page);

    // Navigate to dashboard
    await dashboardPage.goto();

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should capture empty dashboard', async ({ page }) => {
    // Capture empty state
    await percySnapshot(page, 'Dashboard - Empty State', {
      widths: [1280, 1920],
    });
  });

  test('should capture dashboard with projects', async ({ page }) => {
    // Create test projects
    for (let i = 0; i < 5; i++) {
      await createTestProject(page, {
        name: `Test Project ${i + 1}`,
        template: i % 2 === 0 ? 'blank' : 'iot-dashboard',
      });
    }

    // Navigate back to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Capture with projects
    await percySnapshot(page, 'Dashboard - With Projects', {
      widths: [1280, 1920],
    });
  });

  test('should capture project grid view', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 6; i++) {
      await createTestProject(page, {
        name: `Grid Project ${i + 1}`,
        template: 'blank',
      });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Set grid view
    await dashboardPage.setViewMode('grid');
    await page.waitForTimeout(500);

    // Capture grid view
    await percySnapshot(page, 'Dashboard - Grid View', {
      widths: [1280, 1920],
    });
  });

  test('should capture project list view', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 6; i++) {
      await createTestProject(page, {
        name: `List Project ${i + 1}`,
        template: 'blank',
      });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Set list view
    await dashboardPage.setViewMode('list');
    await page.waitForTimeout(500);

    // Capture list view
    await percySnapshot(page, 'Dashboard - List View', {
      widths: [1280, 1920],
    });
  });

  test('should capture search functionality', async ({ page }) => {
    // Create projects
    await createTestProject(page, { name: 'IoT Dashboard Project' });
    await createTestProject(page, { name: 'Analytics Dashboard' });
    await createTestProject(page, { name: 'Monitoring System' });

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Enter search term
    await dashboardPage.searchProjects('Dashboard');
    await page.waitForTimeout(500);

    // Capture search results
    await percySnapshot(page, 'Dashboard - Search Results', {
      widths: [1280, 1920],
    });
  });

  test('should capture filter panel', async ({ page }) => {
    // Create projects with different templates
    await createTestProject(page, { name: 'Project 1', template: 'blank' });
    await createTestProject(page, { name: 'Project 2', template: 'iot-dashboard' });

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Open filter panel
    await dashboardPage.clickFilterButton();
    await page.waitForTimeout(300);

    // Capture filter panel
    await percySnapshot(page, 'Dashboard - Filter Panel', {
      widths: [1280, 1920],
    });
  });

  test('should capture sort options', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 4; i++) {
      await createTestProject(page, { name: `Project ${i + 1}` });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Open sort dropdown
    await dashboardPage.clickSortDropdown();
    await page.waitForTimeout(300);

    // Capture sort options
    await percySnapshot(page, 'Dashboard - Sort Options', {
      widths: [1280],
    });
  });

  test('should capture project card hover state', async ({ page }) => {
    // Create project
    await createTestProject(page, { name: 'Hover Test Project' });

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Hover over project card
    await dashboardPage.projectCards.first().hover();
    await page.waitForTimeout(300);

    // Capture hover state
    await percySnapshot(page, 'Dashboard - Project Card Hover', {
      widths: [1280],
    });
  });

  test('should capture project card menu', async ({ page }) => {
    // Create project
    await createTestProject(page, { name: 'Menu Test Project' });

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Open project menu
    await dashboardPage.clickProjectMenu(0);
    await page.waitForTimeout(300);

    // Capture menu
    await percySnapshot(page, 'Dashboard - Project Card Menu', {
      widths: [1280],
    });
  });

  test('should capture user menu', async ({ page }) => {
    // Click user menu
    await dashboardPage.clickUserMenu();
    await page.waitForTimeout(300);

    // Capture user menu
    await percySnapshot(page, 'Dashboard - User Menu', {
      widths: [1280],
    });
  });

  test('should capture navigation sidebar', async ({ page }) => {
    // Capture with sidebar
    await percySnapshot(page, 'Dashboard - Navigation Sidebar', {
      widths: [1280, 1920],
    });
  });

  test('should capture collapsed sidebar', async ({ page }) => {
    // Collapse sidebar
    await dashboardPage.toggleSidebar();
    await page.waitForTimeout(300);

    // Capture collapsed state
    await percySnapshot(page, 'Dashboard - Sidebar Collapsed', {
      widths: [1280],
    });
  });

  test('should capture create project button states', async ({ page }) => {
    // Default state
    await percySnapshot(page, 'Dashboard - Create Button Default', {
      widths: [1280],
    });

    // Hover state
    await dashboardPage.createProjectButton.hover();
    await page.waitForTimeout(200);

    await percySnapshot(page, 'Dashboard - Create Button Hover', {
      widths: [1280],
    });
  });

  test('should capture notification panel', async ({ page }) => {
    // Trigger notifications (mock)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('notification', {
          detail: { message: 'Project saved successfully', type: 'success' },
        })
      );
    });

    await page.waitForTimeout(500);

    // Capture notifications
    await percySnapshot(page, 'Dashboard - Notifications', {
      widths: [1280],
    });
  });

  test('should capture loading state', async ({ page }) => {
    // Navigate to dashboard but intercept to delay
    await page.route('**/api/projects', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      route.continue();
    });

    await dashboardPage.goto();

    // Capture loading state
    await percySnapshot(page, 'Dashboard - Loading State', {
      widths: [1280],
    });
  });

  test('should capture error state', async ({ page }) => {
    // Make API fail
    await page.route('**/api/projects', (route) => {
      route.abort('failed');
    });

    await dashboardPage.goto();
    await page.waitForTimeout(2000);

    // Capture error state
    await percySnapshot(page, 'Dashboard - Error State', {
      widths: [1280],
    });
  });

  test('should capture pagination', async ({ page }) => {
    // Create many projects
    for (let i = 0; i < 15; i++) {
      await createTestProject(page, { name: `Pagination Project ${i + 1}` });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Capture with pagination
    await percySnapshot(page, 'Dashboard - Pagination', {
      widths: [1280, 1920],
    });
  });

  test('should capture tablet layout', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 4; i++) {
      await createTestProject(page, { name: `Tablet Project ${i + 1}` });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Capture tablet layout
    await percySnapshot(page, 'Dashboard - Tablet Layout', {
      widths: [768, 1024],
    });
  });

  test('should capture mobile layout', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 3; i++) {
      await createTestProject(page, { name: `Mobile Project ${i + 1}` });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Capture mobile layout
    await percySnapshot(page, 'Dashboard - Mobile Layout', {
      widths: [375, 414],
    });
  });

  test('should capture dark theme', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 4; i++) {
      await createTestProject(page, { name: `Dark Theme Project ${i + 1}` });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Switch to dark theme
    await dashboardPage.setTheme('dark');
    await page.waitForTimeout(500);

    // Capture dark theme
    await percySnapshot(page, 'Dashboard - Dark Theme', {
      widths: [1280, 1920],
    });
  });

  test('should capture recent projects section', async ({ page }) => {
    // Create projects
    for (let i = 0; i < 3; i++) {
      await createTestProject(page, { name: `Recent Project ${i + 1}` });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Capture recent section
    await percySnapshot(page, 'Dashboard - Recent Projects', {
      widths: [1280, 1920],
    });
  });

  test('should capture templates section', async ({ page }) => {
    // Navigate to templates tab
    await dashboardPage.clickTemplatesTab();
    await page.waitForTimeout(500);

    // Capture templates
    await percySnapshot(page, 'Dashboard - Templates', {
      widths: [1280, 1920],
    });
  });

  test('should capture settings panel', async ({ page }) => {
    // Open settings
    await dashboardPage.clickSettings();
    await page.waitForTimeout(500);

    // Capture settings
    await percySnapshot(page, 'Dashboard - Settings Panel', {
      widths: [1280, 1920],
    });
  });

  test('should capture help menu', async ({ page }) => {
    // Open help menu
    await dashboardPage.clickHelpMenu();
    await page.waitForTimeout(300);

    // Capture help menu
    await percySnapshot(page, 'Dashboard - Help Menu', {
      widths: [1280],
    });
  });

  test('should capture full dashboard at multiple breakpoints', async ({ page }) => {
    // Create sample projects
    for (let i = 0; i < 6; i++) {
      await createTestProject(page, {
        name: `Breakpoint Test ${i + 1}`,
        template: i % 2 === 0 ? 'blank' : 'iot-dashboard',
      });
    }

    // Navigate to dashboard
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');

    // Capture at all breakpoints
    await percySnapshot(page, 'Dashboard - All Breakpoints', {
      widths: [375, 768, 1024, 1280, 1440, 1920, 2560],
      minHeight: 1024,
    });
  });
});
