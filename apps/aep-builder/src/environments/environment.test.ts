/**
 * Test Environment Configuration
 * Used for CI/CD testing and automated tests
 */
export const environment = {
  production: false,
  name: 'test',

  // API Endpoints
  apiUrl: 'http://localhost:46000',
  previewUrl: 'http://localhost:46001',
  grafanaUrl: 'http://localhost:3000',

  // Feature Flags
  features: {
    iotEnabled: true,
    builderEnabled: true,
    grafanaIntegration: true,
    aiAgentRuntime: true,
    templateMarketplace: false,
    debugMode: false,
  },

  // Logging
  logging: {
    level: 'info',
    enableConsole: true,
    enableRemote: false,
  },

  // Security
  security: {
    enableCSP: true,
    strictMode: true,
  },

  // Performance
  performance: {
    enableServiceWorker: false,
    enableCaching: false,
  },
};
