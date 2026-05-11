/**
 * Production Environment Configuration
 * Used for live production deployment
 */
export const environment = {
  production: true,
  name: 'production',

  // API Endpoints - Update these with your actual production URLs
  apiUrl: 'https://api.friendly-aep.example.com',
  previewUrl: 'https://preview.friendly-aep.example.com',
  grafanaUrl: 'https://grafana.friendly-aep.example.com',

  // Feature Flags
  features: {
    iotEnabled: true,
    builderEnabled: true,
    grafanaIntegration: true,
    aiAgentRuntime: true,
    templateMarketplace: true,
    debugMode: false,
  },

  // Logging
  logging: {
    level: 'error',
    enableConsole: false,
    enableRemote: true,
  },

  // Security
  security: {
    enableCSP: true,
    strictMode: true,
  },

  // Performance
  performance: {
    enableServiceWorker: true,
    enableCaching: true,
  },
};
