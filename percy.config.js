/**
 * Percy Visual Testing Configuration
 *
 * This configuration sets up Percy for visual regression testing:
 * - Snapshot settings
 * - Browser configurations
 * - Responsive breakpoints
 * - Asset discovery
 * - Accessibility testing
 */

module.exports = {
  version: 2,

  // Percy project settings
  projectName: 'Friendly-AIAEP',

  // Snapshot configuration
  snapshot: {
    // Enable JavaScript for dynamic content
    enableJavaScript: true,

    // Percy CSS for hiding dynamic elements
    percyCSS: `
      /* Hide dynamic timestamps */
      [data-testid="timestamp"],
      .timestamp {
        visibility: hidden;
      }

      /* Hide avatar images that may change */
      .user-avatar {
        visibility: hidden;
      }

      /* Hide loading animations */
      .loading-spinner,
      .skeleton-loader {
        visibility: hidden;
      }

      /* Stabilize animations */
      * {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,

    // Minimum height for snapshots
    minHeight: 1024,

    // Wait for network idle before capturing
    waitForTimeout: 30000,
    waitForSelector: null,

    // Additional snapshots at these widths
    widths: [375, 768, 1024, 1280, 1920],
  },

  // Discovery configuration
  discovery: {
    // Allow list for resources
    allowedHostnames: [
      'localhost',
      '*.localhost',
      '127.0.0.1',
    ],

    // Network idle timeout
    networkIdleTimeout: 750,

    // Disable asset discovery cache in CI
    disableCache: !!process.env.CI,
  },

  // Static server configuration (if needed)
  static: {
    // Base URL override
    baseUrl: process.env.PERCY_BASE_URL,

    // Clean URLs
    cleanUrls: true,
  },

  // Browser configuration
  browser: {
    // Use Chromium
    name: 'chromium',
  },

  // Accessibility testing
  accessibility: {
    // Run axe-core accessibility tests
    enabled: true,

    // axe-core configuration
    options: {
      // Rules to run
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },

      // Rules to disable
      rules: {
        // Disable color contrast for now (will fix separately)
        'color-contrast': { enabled: false },
      },
    },
  },

  // Upload configuration
  upload: {
    // Concurrency for uploads
    concurrency: 5,

    // Retry failed uploads
    maxRetries: 3,
  },

  // CI/CD specific settings
  ci: {
    // Build URL for GitHub
    buildUrl: process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined,

    // Branch name
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,

    // Pull request number
    pullRequest: process.env.GITHUB_EVENT_NAME === 'pull_request'
      ? process.env.GITHUB_REF?.split('/')[2]
      : undefined,

    // Commit info
    commit: {
      sha: process.env.GITHUB_SHA,
      message: process.env.GITHUB_EVENT_HEAD_COMMIT_MESSAGE,
      authorName: process.env.GITHUB_ACTOR,
    },
  },

  // Debugging
  debug: process.env.PERCY_DEBUG === 'true',

  // Ignored files/patterns
  ignore: [
    // Ignore test files
    '**/*.spec.ts',
    '**/*.test.ts',

    // Ignore node_modules
    '**/node_modules/**',

    // Ignore build artifacts
    '**/dist/**',
    '**/build/**',

    // Ignore configuration files
    '**/*.config.js',
    '**/*.config.ts',
  ],
};
