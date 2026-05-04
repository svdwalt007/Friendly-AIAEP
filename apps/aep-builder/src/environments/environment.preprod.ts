/**
 * Pre-Production Environment Configuration
 * Used for final testing before production release
 */
export const environment = {
  production: true,
  name: 'preprod',

  // API Endpoints - Update these with your actual pre-prod URLs
  apiUrl: 'https://api-preprod.friendly-aep.example.com',
  previewUrl: 'https://preview-preprod.friendly-aep.example.com',
  grafanaUrl: 'https://grafana-preprod.friendly-aep.example.com',

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
    level: 'info',
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
