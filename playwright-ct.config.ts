import { defineConfig, devices } from '@playwright/experimental-ct-angular';

/**
 * Playwright Component Testing Configuration
 *
 * This configuration sets up component testing for Angular components:
 * - Isolated component testing
 * - Multi-browser support
 * - Visual regression for components
 * - Accessibility testing
 */

export default defineConfig({
  // Test directory for component tests
  testDir: './tests/components',

  // Snapshot path template
  snapshotDir: './tests/components/__snapshots__',

  // Maximum time one test can run
  timeout: 10 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/component-tests' }],
    ['json', { outputFile: 'test-results/component-results.json' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Component testing specific options
    ctPort: 3100,
    ctTemplateDir: './tests/components',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
