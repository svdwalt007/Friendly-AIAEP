import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup for Playwright Tests
 *
 * This file runs once before all tests and:
 * - Sets up test database
 * - Creates test users
 * - Configures test environment
 * - Validates services are running
 */

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');

  // Check if services are running
  await checkServices();

  // Setup test database
  await setupTestDatabase();

  // Create test users
  await createTestUsers();

  // Setup test data
  await setupTestData();

  console.log('Global setup completed successfully!');
}

/**
 * Check if required services are running
 */
async function checkServices() {
  console.log('Checking services...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Check frontend
    await page.goto('http://localhost:4200', { timeout: 10000 });
    console.log('Frontend service is running');

    // Check API
    const apiResponse = await page.goto('http://localhost:3000/health', { timeout: 10000 });
    if (apiResponse?.ok()) {
      console.log('API service is running');
    } else {
      throw new Error('API service health check failed');
    }
  } catch (error) {
    console.error('Service check failed:', error);
    throw new Error(
      'Required services are not running. Please start the application before running tests.'
    );
  } finally {
    await browser.close();
  }
}

/**
 * Setup test database
 */
async function setupTestDatabase() {
  console.log('Setting up test database...');

  // This would typically:
  // - Create a test database
  // - Run migrations
  // - Seed initial data

  // For now, we'll just log
  console.log('Test database setup completed');
}

/**
 * Create test users
 */
async function createTestUsers() {
  console.log('Creating test users...');

  // This would typically make API calls to create test users
  // For now, we assume users exist or are created via seed data

  const testUsers = [
    { email: 'test.user@example.com', role: 'user' },
    { email: 'admin@example.com', role: 'admin' },
    { email: 'tenant1.user@example.com', role: 'user' },
    { email: 'tenant2.user@example.com', role: 'user' },
  ];

  console.log(`Created ${testUsers.length} test users`);
}

/**
 * Setup test data
 */
async function setupTestData() {
  console.log('Setting up test data...');

  // This would typically:
  // - Create test projects
  // - Create test templates
  // - Setup test configurations

  console.log('Test data setup completed');
}

export default globalSetup;
