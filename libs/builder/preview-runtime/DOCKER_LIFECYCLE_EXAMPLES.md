# Docker Lifecycle Manager - Usage Examples

This document provides practical examples for using the `DockerLifecycleManager` class.

## Table of Contents

1. [Basic Container Lifecycle](#basic-container-lifecycle)
2. [With Mock API Sidecar](#with-mock-api-sidecar)
3. [Custom Health Checks](#custom-health-checks)
4. [Event Monitoring](#event-monitoring)
5. [Multi-Container Management](#multi-container-management)
6. [Production Deployment](#production-deployment)
7. [Error Handling](#error-handling)
8. [Resource Cleanup](#resource-cleanup)

## Basic Container Lifecycle

```typescript
import { DockerLifecycleManager } from '@friendly-aiaep/builder-preview-runtime';

async function basicPreview() {
  const manager = new DockerLifecycleManager();

  // Create container
  const container = await manager.createPreviewContainer({
    volumePath: '/path/to/angular/dist',
  });

  console.log(`Container created: ${container.containerId}`);
  console.log(`Port: ${container.port}`);

  // Start container
  await manager.startContainer(container.containerId);
  console.log('Container started');

  // Health check
  const healthy = await manager.healthCheck(container.containerId);
  if (healthy) {
    console.log(`Preview ready at http://localhost:${container.port}`);
  }

  // Cleanup (later)
  await manager.stopContainer(container.containerId);
  await manager.removeContainer(container.containerId);
}
```

## With Mock API Sidecar

```typescript
async function previewWithMockApi() {
  const manager = new DockerLifecycleManager();

  // Create container with mock API sidecar
  const container = await manager.createPreviewContainer({
    volumePath: '/path/to/angular/dist',
    enableMockApi: true,
    env: {
      NODE_ENV: 'preview',
      API_URL: 'http://mock-api:45001',
    },
  });

  console.log(`Main container: http://localhost:${container.port}`);
  console.log(`Mock API: http://localhost:${container.sidecarPort}`);
  console.log(`Network: ${container.networkId}`);

  // Start both containers
  await manager.startContainer(container.containerId);
  if (container.sidecarId) {
    await manager.startContainer(container.sidecarId);
  }

  // Health check main container
  const mainHealthy = await manager.healthCheck(container.containerId);

  // Optional: Health check sidecar
  if (container.sidecarId) {
    const sidecarHealthy = await manager.healthCheck(container.sidecarId);
    console.log(`Sidecar healthy: ${sidecarHealthy}`);
  }

  if (mainHealthy) {
    console.log('Preview environment ready!');
  }
}
```

## Custom Health Checks

```typescript
async function customHealthCheck() {
  const manager = new DockerLifecycleManager();

  const container = await manager.createPreviewContainer({
    volumePath: '/path/to/dist',
    healthCheckPath: '/api/health',
    healthCheckInterval: 10,
  });

  await manager.startContainer(container.containerId);

  // Custom health check with more retries
  const healthy = await manager.healthCheck(container.containerId, {
    maxRetries: 60,
    retryInterval: 2000,
    expectedStatus: 200,
  });

  console.log(`Health check result: ${healthy}`);
}
```

## Event Monitoring

```typescript
async function monitoredDeployment() {
  const manager = new DockerLifecycleManager();

  // Setup event handlers
  manager.on('containerCreated', (info) => {
    console.log(`✓ Container created: ${info.containerId} on port ${info.port}`);
  });

  manager.on('containerStarted', (containerId) => {
    console.log(`✓ Container started: ${containerId}`);
  });

  manager.on('healthCheckStarted', (containerId) => {
    console.log(`⏳ Health check started: ${containerId}`);
  });

  manager.on('healthCheckSuccess', (containerId) => {
    console.log(`✓ Health check passed: ${containerId}`);
  });

  manager.on('healthCheckFailed', (containerId, error) => {
    console.error(`✗ Health check failed: ${containerId}`, error);
  });

  manager.on('containerStopped', (containerId) => {
    console.log(`⏸ Container stopped: ${containerId}`);
  });

  manager.on('containerRemoved', (containerId) => {
    console.log(`✓ Container removed: ${containerId}`);
  });

  manager.on('error', (error) => {
    console.error('Docker operation error:', error);
  });

  // Deploy with monitoring
  const container = await manager.createPreviewContainer({
    volumePath: '/path/to/dist',
  });

  await manager.startContainer(container.containerId);
  await manager.healthCheck(container.containerId);
}
```

## Multi-Container Management

```typescript
async function multiplePreviewEnvironments() {
  const manager = new DockerLifecycleManager();
  const containers: any[] = [];

  try {
    // Create multiple preview environments
    const configs = [
      { volumePath: '/path/to/app1/dist', labels: { app: 'app1' } },
      { volumePath: '/path/to/app2/dist', labels: { app: 'app2' } },
      { volumePath: '/path/to/app3/dist', labels: { app: 'app3' } },
    ];

    for (const config of configs) {
      const container = await manager.createPreviewContainer(config);
      await manager.startContainer(container.containerId);
      containers.push(container);
    }

    // Wait for all to be healthy
    const healthChecks = containers.map((c) =>
      manager.healthCheck(c.containerId)
    );

    const results = await Promise.all(healthChecks);
    const allHealthy = results.every((r) => r === true);

    if (allHealthy) {
      console.log('All preview environments ready:');
      containers.forEach((c) => {
        console.log(`- http://localhost:${c.port}`);
      });
    }

    return containers;
  } catch (error) {
    // Cleanup on failure
    for (const container of containers) {
      await manager.removeContainer(container.containerId, true);
    }
    throw error;
  }
}
```

## Production Deployment

```typescript
import { DockerLifecycleManager } from '@friendly-aiaep/builder-preview-runtime';

class PreviewDeploymentService {
  private manager: DockerLifecycleManager;
  private activeContainers = new Map<string, any>();

  constructor() {
    this.manager = new DockerLifecycleManager();
    this.setupEventHandlers();
    this.setupShutdownHandlers();
  }

  private setupEventHandlers() {
    this.manager.on('error', (error) => {
      console.error('[PreviewService] Error:', error);
      // Send to monitoring/logging service
    });

    this.manager.on('healthCheckFailed', (containerId, error) => {
      console.error(`[PreviewService] Health check failed for ${containerId}`, error);
      // Alert team
    });
  }

  private setupShutdownHandlers() {
    process.on('SIGTERM', async () => {
      console.log('[PreviewService] Shutting down...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[PreviewService] Shutting down...');
      await this.cleanup();
      process.exit(0);
    });
  }

  async deployPreview(
    projectId: string,
    distPath: string,
    enableMockApi = false
  ) {
    const container = await this.manager.createPreviewContainer({
      volumePath: distPath,
      enableMockApi,
      labels: {
        'project.id': projectId,
        'environment': 'preview',
        'created.at': new Date().toISOString(),
      },
      env: {
        PROJECT_ID: projectId,
        NODE_ENV: 'preview',
      },
    });

    await this.manager.startContainer(container.containerId);

    if (container.sidecarId) {
      await this.manager.startContainer(container.sidecarId);
    }

    const healthy = await this.manager.healthCheck(container.containerId, {
      maxRetries: 60,
      retryInterval: 2000,
    });

    if (!healthy) {
      await this.manager.removeContainer(container.containerId, true);
      throw new Error('Preview deployment failed health check');
    }

    this.activeContainers.set(projectId, container);

    return {
      url: `http://localhost:${container.port}`,
      mockApiUrl: container.sidecarPort
        ? `http://localhost:${container.sidecarPort}`
        : null,
      containerId: container.containerId,
    };
  }

  async stopPreview(projectId: string) {
    const container = this.activeContainers.get(projectId);
    if (!container) {
      throw new Error(`No active preview for project ${projectId}`);
    }

    await this.manager.stopContainer(container.containerId);
    await this.manager.removeContainer(container.containerId);

    if (container.sidecarId) {
      await this.manager.stopContainer(container.sidecarId);
      await this.manager.removeContainer(container.sidecarId);
    }

    this.activeContainers.delete(projectId);
  }

  async listActivePreviews() {
    const containers = await this.manager.listPreviewContainers();
    return containers.map((c) => ({
      id: c.Id,
      projectId: c.Labels['project.id'],
      status: c.State,
      ports: c.Ports,
    }));
  }

  async cleanup() {
    console.log('[PreviewService] Cleaning up all containers...');
    await this.manager.cleanup(true);
    this.activeContainers.clear();
  }
}

// Usage
async function main() {
  const service = new PreviewDeploymentService();

  try {
    const preview = await service.deployPreview(
      'project-123',
      '/path/to/dist',
      true
    );

    console.log(`Preview deployed: ${preview.url}`);
    console.log(`Mock API: ${preview.mockApiUrl}`);

    // Later...
    await service.stopPreview('project-123');
  } catch (error) {
    console.error('Deployment failed:', error);
    await service.cleanup();
  }
}
```

## Error Handling

```typescript
async function robustDeployment() {
  const manager = new DockerLifecycleManager();
  let container;

  try {
    container = await manager.createPreviewContainer({
      volumePath: '/path/to/dist',
    });

    await manager.startContainer(container.containerId);

    const healthy = await manager.healthCheck(container.containerId, {
      maxRetries: 30,
      retryInterval: 1000,
    });

    if (!healthy) {
      throw new Error('Health check failed');
    }

    console.log(`Preview ready at http://localhost:${container.port}`);
  } catch (error) {
    console.error('Deployment failed:', error);

    // Cleanup on error
    if (container) {
      try {
        await manager.stopContainer(container.containerId).catch(() => {});
        await manager.removeContainer(container.containerId, true);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }

    throw error;
  }
}
```

## Resource Cleanup

```typescript
async function cleanupExample() {
  const manager = new DockerLifecycleManager();

  // List all preview containers
  const containers = await manager.listPreviewContainers(true);
  console.log(`Found ${containers.length} preview containers`);

  // Cleanup all
  await manager.cleanup(true);
  console.log('All preview containers cleaned up');
}

// Scheduled cleanup
async function scheduledCleanup() {
  const manager = new DockerLifecycleManager();

  // Run every hour
  setInterval(async () => {
    console.log('[Cleanup] Running scheduled cleanup...');

    const containers = await manager.listPreviewContainers(true);

    for (const container of containers) {
      const createdAt = new Date(container.Created * 1000);
      const age = Date.now() - createdAt.getTime();
      const maxAge = 4 * 60 * 60 * 1000; // 4 hours

      if (age > maxAge) {
        console.log(`[Cleanup] Removing old container: ${container.Id}`);
        try {
          await manager.stopContainer(container.Id);
          await manager.removeContainer(container.Id, true);
        } catch (error) {
          console.error(`[Cleanup] Failed to remove ${container.Id}:`, error);
        }
      }
    }

    console.log('[Cleanup] Scheduled cleanup complete');
  }, 60 * 60 * 1000); // Every hour
}
```

## Advanced: Custom Docker Configuration

```typescript
async function customDockerConfig() {
  // Connect to remote Docker daemon
  const manager = new DockerLifecycleManager({
    host: 'tcp://192.168.1.100',
    port: 2375,
  });

  // Or use Unix socket
  const localManager = new DockerLifecycleManager({
    socketPath: '/var/run/docker.sock',
  });

  // Create container with custom image
  const container = await manager.createPreviewContainer({
    volumePath: '/path/to/dist',
    image: 'custom-nginx:latest',
    mountPoint: '/app/public',
    env: {
      NGINX_PORT: '80',
      CUSTOM_VAR: 'value',
    },
  });

  await manager.startContainer(container.containerId);
}
```

## Testing Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DockerLifecycleManager } from './docker-manager';

describe('Preview Deployment Integration', () => {
  let manager: DockerLifecycleManager;
  let containerId: string;

  beforeEach(() => {
    manager = new DockerLifecycleManager();
  });

  afterEach(async () => {
    if (containerId) {
      await manager.removeContainer(containerId, true);
    }
  });

  it('should deploy preview environment', async () => {
    const container = await manager.createPreviewContainer({
      volumePath: './test-fixtures/dist',
    });

    containerId = container.containerId;

    expect(container.containerId).toBeDefined();
    expect(container.port).toBeGreaterThanOrEqual(4300);
    expect(container.port).toBeLessThanOrEqual(4399);

    await manager.startContainer(container.containerId);

    const healthy = await manager.healthCheck(container.containerId, {
      maxRetries: 30,
      retryInterval: 1000,
    });

    expect(healthy).toBe(true);
  });
});
```

## Additional Resources

- [Docker Lifecycle Manager Documentation](./DOCKER_LIFECYCLE_MANAGER.md)
- [Preview Runtime README](./README.md)
- [Dockerode API Documentation](https://github.com/apocas/dockerode)
