/**
 * Test Data Fixtures
 *
 * Centralized test data for E2E tests including:
 * - User credentials
 * - Project configurations
 * - Widget configurations
 * - API mock data
 */

export const testData = {
  // User accounts for testing
  users: {
    standard: {
      username: 'test.user@example.com',
      password: 'TestPassword123!',
      role: 'user',
      tenant: 'tenant1',
    },
    admin: {
      username: 'admin@example.com',
      password: 'AdminPassword123!',
      role: 'admin',
      tenant: 'tenant1',
    },
    tenant1: {
      username: 'tenant1.user@example.com',
      password: 'Tenant1Pass123!',
      role: 'user',
      tenant: 'tenant1',
    },
    tenant2: {
      username: 'tenant2.user@example.com',
      password: 'Tenant2Pass123!',
      role: 'user',
      tenant: 'tenant2',
    },
    specialPassword: {
      username: 'special@example.com',
      password: 'P@ssw0rd!#$%^&*()',
      role: 'user',
      tenant: 'tenant1',
    },
  },

  // Project configurations
  projects: {
    standard: {
      name: 'Standard Test Project',
      description: 'A standard test project for E2E testing',
      template: 'blank',
    },
    iotDashboard: {
      name: 'IoT Dashboard Project',
      description: 'IoT monitoring dashboard with sensors',
      template: 'iot-dashboard',
    },
    analytics: {
      name: 'Analytics Dashboard',
      description: 'Data analytics and visualization',
      template: 'analytics',
    },
  },

  // Widget configurations
  widgets: {
    temperatureGauge: {
      type: 'temperature-gauge',
      config: {
        label: 'Temperature',
        value: 72,
        unit: 'F',
        min: 0,
        max: 100,
        thresholds: {
          low: 60,
          high: 85,
        },
      },
    },
    humiditySensor: {
      type: 'humidity-sensor',
      config: {
        label: 'Humidity',
        value: 45,
        unit: '%',
        min: 0,
        max: 100,
      },
    },
    lineChart: {
      type: 'chart-line',
      config: {
        title: 'Temperature Over Time',
        xAxis: 'Time',
        yAxis: 'Temperature (F)',
        dataPoints: 50,
      },
    },
    statusIndicator: {
      type: 'status-indicator',
      config: {
        label: 'System Status',
        status: 'online',
        states: {
          online: { color: 'green', text: 'Online' },
          offline: { color: 'red', text: 'Offline' },
          warning: { color: 'yellow', text: 'Warning' },
        },
      },
    },
    textDisplay: {
      type: 'text-display',
      config: {
        text: 'Test Text',
        fontSize: 16,
        fontWeight: 'normal',
        color: '#000000',
      },
    },
    button: {
      type: 'button',
      config: {
        label: 'Click Me',
        variant: 'primary',
        size: 'medium',
      },
    },
    counterButton: {
      type: 'counter-button',
      config: {
        label: 'Count',
        initialValue: 0,
      },
    },
  },

  // AI chat test messages
  aiChat: {
    simpleGreeting: 'Hello, can you help me?',
    widgetRequest: 'Create a temperature gauge widget',
    complexRequest: 'Create an IoT dashboard with temperature, humidity, and status indicators',
    codeRequest: 'Show me TypeScript code for a temperature sensor class',
    followUp: 'Add a humidity sensor too',
    longRequest:
      'I need a comprehensive IoT monitoring dashboard with multiple sensor types including temperature, humidity, pressure, and air quality sensors. Please include charts for historical data visualization.',
  },

  // API mock responses
  api: {
    projects: {
      list: [
        {
          id: 'proj-1',
          name: 'Test Project 1',
          description: 'Test project description',
          template: 'blank',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'proj-2',
          name: 'Test Project 2',
          description: 'Another test project',
          template: 'iot-dashboard',
          createdAt: '2024-01-14T10:00:00Z',
          updatedAt: '2024-01-14T10:00:00Z',
        },
      ],
      single: {
        id: 'proj-1',
        name: 'Test Project 1',
        description: 'Test project description',
        template: 'blank',
        canvas: {
          widgets: [],
          layout: {
            width: 1920,
            height: 1080,
          },
        },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
    },
    aiChat: {
      response: {
        message: 'I can help you create a temperature gauge widget. Let me add that to your canvas.',
        action: {
          type: 'add-widget',
          widget: {
            type: 'temperature-gauge',
            config: {
              label: 'Temperature',
              value: 72,
              unit: 'F',
            },
          },
        },
      },
      streamChunk: {
        delta: 'Here is the TypeScript code:',
        isComplete: false,
      },
    },
    preview: {
      session: {
        id: 'session-123',
        projectId: 'proj-1',
        url: 'http://localhost:3001/preview/session-123',
        status: 'active',
        containerId: 'container-123',
        createdAt: '2024-01-15T10:00:00Z',
      },
    },
    auth: {
      login: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh-token-123',
        user: {
          id: 'user-1',
          email: 'test.user@example.com',
          role: 'user',
          tenant: 'tenant1',
        },
        expiresIn: 3600,
      },
    },
  },

  // Template configurations
  templates: {
    blank: {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start with an empty canvas',
      thumbnail: '/assets/templates/blank.png',
    },
    iotDashboard: {
      id: 'iot-dashboard',
      name: 'IoT Dashboard',
      description: 'Pre-configured IoT monitoring dashboard',
      thumbnail: '/assets/templates/iot-dashboard.png',
      widgets: [
        {
          type: 'temperature-gauge',
          position: { x: 50, y: 50 },
        },
        {
          type: 'humidity-sensor',
          position: { x: 300, y: 50 },
        },
        {
          type: 'chart-line',
          position: { x: 50, y: 250 },
        },
      ],
    },
    analytics: {
      id: 'analytics',
      name: 'Analytics Dashboard',
      description: 'Data analytics and visualization',
      thumbnail: '/assets/templates/analytics.png',
    },
  },

  // Device configurations for preview testing
  devices: {
    desktop: {
      width: 1920,
      height: 1080,
    },
    laptop: {
      width: 1366,
      height: 768,
    },
    tablet: {
      width: 768,
      height: 1024,
    },
    mobile: {
      width: 375,
      height: 667,
    },
  },

  // Error messages
  errors: {
    invalidCredentials: 'Invalid credentials. Please try again.',
    requiredField: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    projectExists: 'A project with this name already exists',
    networkError: 'Network error. Please try again.',
    timeout: 'Request timed out. Please try again.',
    unauthorized: 'You are not authorized to perform this action',
    notFound: 'Resource not found',
  },

  // Success messages
  success: {
    projectCreated: 'Project created successfully',
    projectSaved: 'Project saved successfully',
    projectDeleted: 'Project deleted successfully',
    loginSuccess: 'Login successful',
    logoutSuccess: 'Logout successful',
    passwordResetSent: 'Password reset email sent successfully',
  },

  // Wait times (in milliseconds)
  timeouts: {
    short: 1000,
    medium: 3000,
    long: 10000,
    veryLong: 30000,
  },

  // Test environment URLs
  urls: {
    base: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4200',
    api: process.env.API_BASE_URL || 'http://localhost:3000',
    preview: process.env.PREVIEW_BASE_URL || 'http://localhost:3001',
  },
};

/**
 * Helper function to generate unique test data
 */
export function generateTestData(prefix: string = 'test') {
  const timestamp = Date.now();
  return {
    projectName: `${prefix}-project-${timestamp}`,
    userName: `${prefix}-user-${timestamp}@example.com`,
    description: `Test description created at ${timestamp}`,
  };
}

/**
 * Helper function to get random item from array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Helper function to wait for specific duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
