/**
 * Development Environment Configuration
 * Used for local development with hot-reload and debugging
 */
export const environment = {
  production: false,
  name: 'development',

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
    templateMarketplace: true,
    debugMode: true,
  },

  // Logging
  logging: {
    level: 'debug',
    enableConsole: true,
    enableRemote: false,
  },

  // Security
  security: {
    enableCSP: false,
    strictMode: false,
  },

  // Performance
  performance: {
    enableServiceWorker: false,
    enableCaching: false,
  },
};
