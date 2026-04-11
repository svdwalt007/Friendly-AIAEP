/**
 * Example: Basic Cleanup Service Usage
 *
 * This example demonstrates basic setup and usage of the CleanupService
 */

import { CleanupService } from '@friendly-aiaep/preview-runtime';

export function basicExample() {
  // Create cleanup service with default settings
  const cleanupService = new CleanupService();

  // Start automatic cleanup (runs every 5 minutes)
  cleanupService.start();

  console.log('Cleanup service started');
  console.log('Status:', cleanupService.getStatus()); // true

  // Later, stop the service
  setTimeout(() => {
    cleanupService.stop();
    console.log('Cleanup service stopped');
  }, 60000); // Stop after 1 minute
}

/**
 * Example: Custom Configuration
 *
 * Demonstrates how to customize the cleanup service configuration
 */

export function customConfigExample() {
  const cleanupService = new CleanupService({
    // Run every 10 minutes instead of 5
    cronSchedule: '*/10 * * * *',

    // 60 minute timeout instead of 30
    sessionTimeoutMinutes: 60,

    // Custom logger
    logger: {
      info: (message, meta) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
      },
      error: (message, error, meta) => {
        console.error(
          `[ERROR] ${new Date().toISOString()} - ${message}`,
          error || '',
          meta || ''
        );
      },
      warn: (message, meta) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
      },
    },
  });

  cleanupService.start();
  console.log('Custom cleanup service started');
}

/**
 * Example: Manual Cleanup Trigger
 *
 * Shows how to manually trigger cleanup operations
 */

export async function manualCleanupExample() {
  const cleanupService = new CleanupService({
    sessionTimeoutMinutes: 30,
  });

  // Don't start automatic cleanup, just run manually
  console.log('Running manual cleanup...');

  const result = await cleanupService.runCleanup();

  console.log('Cleanup completed:');
  console.log(`  - Sessions cleaned: ${result.sessionsCleanedUp}`);
  console.log(`  - Containers stopped: ${result.containersStopped}`);
  console.log(`  - Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('Errors encountered:');
    result.errors.forEach((err) => {
      console.log(`  - Session ${err.sessionId}: ${err.error}`);
    });
  }
}

/**
 * Example: Integration with Express Server
 *
 * Shows how to integrate cleanup service with an Express server
 */

import express from 'express';

export function expressIntegrationExample() {
  const app = express();
  const cleanupService = new CleanupService({
    sessionTimeoutMinutes: 30,
    logger: {
      info: (msg, meta) => console.log('[CleanupService]', msg, meta || ''),
      error: (msg, err, meta) => console.error('[CleanupService]', msg, err || '', meta || ''),
      warn: (msg, meta) => console.warn('[CleanupService]', msg, meta || ''),
    },
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      cleanup: {
        running: cleanupService.getStatus(),
      },
    });
  });

  // Admin endpoint to trigger manual cleanup
  app.post('/admin/cleanup', async (req, res) => {
    try {
      const result = await cleanupService.runCleanup();
      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Start server and cleanup service
  const server = app.listen(3000, () => {
    console.log('Server started on port 3000');
    cleanupService.start();
    console.log('Cleanup service started');
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');

    // Stop accepting new connections
    server.close(() => {
      console.log('Server closed');
    });

    // Stop cleanup service
    cleanupService.stop();
    await cleanupService.disconnect();
    console.log('Cleanup service stopped');

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Example: Custom Docker Cleanup
 *
 * Demonstrates custom Docker cleanup logic with additional features
 */

import Docker from 'dockerode';
import * as fs from 'fs/promises';
import * as path from 'path';

export function customDockerCleanupExample() {
  const docker = new Docker();
  const logsDir = '/var/log/preview-sessions';

  const cleanupService = new CleanupService({
    dockerCleanup: async (containerId: string) => {
      console.log(`Custom cleanup for container: ${containerId}`);

      try {
        const container = docker.getContainer(containerId);

        // Get container info before cleanup
        const info = await container.inspect();
        console.log(`Container name: ${info.Name}`);
        console.log(`Container status: ${info.State.Status}`);

        // Save logs before removal
        try {
          const logs = await container.logs({
            stdout: true,
            stderr: true,
            timestamps: true,
          });

          const logPath = path.join(logsDir, `${containerId}.log`);
          await fs.writeFile(logPath, logs.toString());
          console.log(`Saved logs to: ${logPath}`);
        } catch (logError) {
          console.warn('Failed to save logs:', logError);
        }

        // Stop container with timeout
        if (info.State.Running) {
          await container.stop({ t: 10 });
          console.log('Container stopped');
        } else {
          console.log('Container already stopped');
        }

        // Remove container and associated volumes
        await container.remove({ force: true, v: true });
        console.log('Container removed');
      } catch (error) {
        if ((error as Error).message?.includes('No such container')) {
          console.log('Container already removed');
        } else {
          throw error;
        }
      }
    },
  });

  cleanupService.start();
}

/**
 * Example: Monitoring and Metrics
 *
 * Shows how to integrate with monitoring/metrics systems
 */

export function monitoringExample() {
  // Mock metrics client (replace with your actual metrics system)
  const metrics = {
    increment: (key: string, value = 1) => {
      console.log(`[METRIC] ${key}: +${value}`);
    },
    gauge: (key: string, value: number) => {
      console.log(`[METRIC] ${key}: ${value}`);
    },
    timing: (key: string, duration: number) => {
      console.log(`[METRIC] ${key}: ${duration}ms`);
    },
  };

  const cleanupService = new CleanupService({
    logger: {
      info: (message, meta) => {
        console.log(message, meta || '');

        // Track cleanup events
        if (message.includes('Cleanup completed')) {
          metrics.increment('cleanup.runs');
          if (meta?.cleaned) {
            metrics.gauge('cleanup.sessions_cleaned', meta.cleaned as number);
          }
        }
      },
      error: (message, error, meta) => {
        console.error(message, error || '', meta || '');
        metrics.increment('cleanup.errors');
      },
      warn: (message, meta) => {
        console.warn(message, meta || '');
        metrics.increment('cleanup.warnings');
      },
    },
  });

  // Wrap runCleanup to track timing
  const originalRunCleanup = cleanupService.runCleanup.bind(cleanupService);
  cleanupService.runCleanup = async () => {
    const start = Date.now();
    try {
      const result = await originalRunCleanup();
      const duration = Date.now() - start;

      metrics.timing('cleanup.duration', duration);
      metrics.gauge('cleanup.sessions_cleaned', result.sessionsCleanedUp);
      metrics.gauge('cleanup.errors', result.errors.length);

      return result;
    } catch (error) {
      metrics.increment('cleanup.failures');
      throw error;
    }
  };

  cleanupService.start();
}

/**
 * Example: Testing Mode
 *
 * Shows how to configure cleanup service for testing
 */

export function testingExample() {
  const mockLogs: string[] = [];

  const cleanupService = new CleanupService({
    // Run every minute for faster testing
    cronSchedule: '* * * * *',

    // Short timeout for testing
    sessionTimeoutMinutes: 5,

    // Mock Docker cleanup
    dockerCleanup: async (containerId: string) => {
      mockLogs.push(`Mock cleanup: ${containerId}`);
      console.log(`Mock cleanup for container: ${containerId}`);
    },

    // Capture logs
    logger: {
      info: (message, meta) => {
        mockLogs.push(`INFO: ${message}`);
      },
      error: (message, error, meta) => {
        mockLogs.push(`ERROR: ${message}`);
      },
      warn: (message, meta) => {
        mockLogs.push(`WARN: ${message}`);
      },
    },
  });

  // Don't start automatic cleanup in tests
  // Instead, call runCleanup() manually in your tests

  return {
    cleanupService,
    getLogs: () => mockLogs,
  };
}

/**
 * Example: Running All Examples
 */

async function runExamples() {
  console.log('=== Basic Example ===');
  basicExample();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n=== Custom Config Example ===');
  customConfigExample();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n=== Manual Cleanup Example ===');
  await manualCleanupExample();

  console.log('\n=== Testing Example ===');
  const testService = testingExample();
  await testService.cleanupService.runCleanup();
  console.log('Test logs:', testService.getLogs());
}

// Uncomment to run examples
// runExamples().catch(console.error);
