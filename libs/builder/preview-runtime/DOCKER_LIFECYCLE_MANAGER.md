# Docker Lifecycle Manager

The `DockerLifecycleManager` class provides a complete lifecycle management solution for Docker containers in the AEP preview runtime environment. It handles container creation, startup, health checking, networking, and cleanup operations.

## Features

- **Image Management**: Automatically pulls Docker images if not present locally
- **Port Management**: Intelligent port allocation within configurable range (4300-4399)
- **Health Checking**: Polls container health endpoints with configurable retry logic
- **Sidecar Support**: Creates and manages mock API sidecar containers
- **Network Management**: Creates and manages Docker networks for container communication
- **Event Emission**: Emits events for all lifecycle operations
- **Resource Cleanup**: Comprehensive cleanup of containers, networks, and ports
- **Type Safety**: Full TypeScript support with strict mode

## Installation

The Docker lifecycle manager is part of the `preview-runtime` library:

```typescript
import { DockerLifecycleManager } from '@friendly-aiaep/builder-preview-runtime';
```

## Dependencies

- `dockerode`: ^4.0.2
- `@types/dockerode`: ^3.3.23 (dev dependency)

## Quick Start

### Basic Usage

```typescript
import { DockerLifecycleManager } from '@friendly-aiaep/builder-preview-runtime';

// Create manager instance
const manager = new DockerLifecycleManager();

// Create a preview container
const containerInfo = await manager.createPreviewContainer({
  volumePath: '/path/to/angular/dist',
  env: {
    NODE_ENV: 'production'
  }
});

console.log(`Container created on port ${containerInfo.port}`);

// Start the container
await manager.startContainer(containerInfo.containerId);

// Wait for health check
const healthy = await manager.healthCheck(containerInfo.containerId);

if (healthy) {
  console.log('Container is healthy and ready!');
  console.log(`Access at http://localhost:${containerInfo.port}`);
}

// Later, cleanup
await manager.stopContainer(containerInfo.containerId);
await manager.removeContainer(containerInfo.containerId);
```

### With Mock API Sidecar

```typescript
const containerInfo = await manager.createPreviewContainer({
  volumePath: '/path/to/angular/dist',
  enableMockApi: true,
  mockApiImage: 'node:20-alpine',
  env: {
    NODE_ENV: 'production',
    API_URL: 'http://mock-api:45001'
  }
});

// Container info includes sidecar details
console.log(`Main container port: ${containerInfo.port}`);
console.log(`Mock API port: ${containerInfo.sidecarPort}`);
console.log(`Network ID: ${containerInfo.networkId}`);
```

## API Reference

### Constructor

```typescript
new DockerLifecycleManager(dockerOptions?: Docker.DockerOptions)
```

Creates a new Docker lifecycle manager instance.

**Parameters:**
- `dockerOptions` (optional): Docker connection options (socket path, host, etc.)

**Example:**
```typescript
// Use default Docker socket
const manager = new DockerLifecycleManager();

// Custom Docker connection
const manager = new DockerLifecycleManager({
  socketPath: '/var/run/docker.sock'
});
```

### createPreviewContainer

```typescript
async createPreviewContainer(config: PreviewContainerConfig): Promise<ContainerInfo>
```

Creates a new preview container with the specified configuration.

**Parameters:**

```typescript
interface PreviewContainerConfig {
  /** Base image to use (default: nginx:alpine) */
  image?: string;

  /** Path to mount the generated Angular source */
  volumePath: string;

  /** Container mount point (default: /usr/share/nginx/html) */
  mountPoint?: string;

  /** Environment variables to pass to the container */
  env?: Record<string, string>;

  /** Enable mock API sidecar container */
  enableMockApi?: boolean;

  /** Mock API server image (default: node:20-alpine) */
  mockApiImage?: string;

  /** Health check path (default: /) */
  healthCheckPath?: string;

  /** Health check interval in seconds (default: 5) */
  healthCheckInterval?: number;

  /** Container labels */
  labels?: Record<string, string>;
}
```

**Returns:**

```typescript
interface ContainerInfo {
  /** Container ID */
  containerId: string;

  /** Host port mapped to container */
  port: number;

  /** Container network ID */
  networkId?: string;

  /** Sidecar container ID (if mock API enabled) */
  sidecarId?: string;

  /** Sidecar port (if mock API enabled) */
  sidecarPort?: number;

  /** Container status */
  status: 'created' | 'running' | 'stopped' | 'error';
}
```

**Example:**
```typescript
const config: PreviewContainerConfig = {
  image: 'nginx:alpine',
  volumePath: '/var/www/app',
  mountPoint: '/usr/share/nginx/html',
  env: {
    NODE_ENV: 'production',
    APP_VERSION: '1.0.0'
  },
  enableMockApi: true,
  healthCheckPath: '/health',
  healthCheckInterval: 10,
  labels: {
    'app.version': '1.0.0',
    'environment': 'preview'
  }
};

const info = await manager.createPreviewContainer(config);
```

### startContainer

```typescript
async startContainer(containerId: string): Promise<void>
```

Starts a created container.

**Parameters:**
- `containerId`: Container ID to start

**Example:**
```typescript
await manager.startContainer('container-123');
```

### stopContainer

```typescript
async stopContainer(containerId: string, timeout?: number): Promise<void>
```

Stops a running container.

**Parameters:**
- `containerId`: Container ID to stop
- `timeout` (optional): Timeout in seconds before forcing stop (default: 10)

**Example:**
```typescript
// Stop with default timeout
await manager.stopContainer('container-123');

// Stop with custom timeout
await manager.stopContainer('container-123', 30);
```

### removeContainer

```typescript
async removeContainer(containerId: string, force?: boolean): Promise<void>
```

Removes a container and cleans up associated resources (ports, networks).

**Parameters:**
- `containerId`: Container ID to remove
- `force` (optional): Force removal even if running (default: false)

**Example:**
```typescript
// Remove stopped container
await manager.removeContainer('container-123');

// Force remove running container
await manager.removeContainer('container-123', true);
```

### healthCheck

```typescript
async healthCheck(
  containerId: string,
  options?: HealthCheckOptions
): Promise<boolean>
```

Performs health check on a container by polling until healthy or timeout.

**Parameters:**
- `containerId`: Container ID to check
- `options` (optional): Health check options

```typescript
interface HealthCheckOptions {
  /** Maximum number of retries (default: 30) */
  maxRetries?: number;

  /** Interval between retries in ms (default: 1000) */
  retryInterval?: number;

  /** HTTP method to use (default: GET) */
  method?: 'GET' | 'HEAD';

  /** Expected status code (default: 200) */
  expectedStatus?: number;
}
```

**Returns:** `true` if container is healthy, `false` if timeout occurs

**Example:**
```typescript
// Default health check (30 retries, 1s interval)
const healthy = await manager.healthCheck('container-123');

// Custom health check
const healthy = await manager.healthCheck('container-123', {
  maxRetries: 60,
  retryInterval: 2000,
  expectedStatus: 200
});
```

### createSidecarContainer

```typescript
async createSidecarContainer(
  networkId: string,
  image?: string
): Promise<{ containerId: string; port: number }>
```

Creates a sidecar container for the mock API server.

**Parameters:**
- `networkId`: Network ID to attach the sidecar to
- `image` (optional): Docker image to use (default: node:20-alpine)

**Returns:** Object with container ID and mapped port

**Example:**
```typescript
const networkId = await manager.createNetwork('my-network');
const sidecar = await manager.createSidecarContainer(networkId);

console.log(`Sidecar ID: ${sidecar.containerId}`);
console.log(`Sidecar port: ${sidecar.port}`);
```

### getContainerInfo

```typescript
async getContainerInfo(containerId: string): Promise<Docker.ContainerInspectInfo>
```

Gets detailed container information.

**Parameters:**
- `containerId`: Container ID to inspect

**Returns:** Container inspection data

**Example:**
```typescript
const info = await manager.getContainerInfo('container-123');
console.log(`Status: ${info.State.Status}`);
console.log(`Ports:`, info.NetworkSettings.Ports);
```

### listPreviewContainers

```typescript
async listPreviewContainers(includeAll?: boolean): Promise<Docker.ContainerInfo[]>
```

Lists all preview containers managed by this lifecycle manager.

**Parameters:**
- `includeAll` (optional): Include stopped containers (default: false)

**Returns:** Array of container information

**Example:**
```typescript
// List only running containers
const running = await manager.listPreviewContainers();

// List all containers (including stopped)
const all = await manager.listPreviewContainers(true);

console.log(`Running containers: ${running.length}`);
console.log(`Total containers: ${all.length}`);
```

### cleanup

```typescript
async cleanup(force?: boolean): Promise<void>
```

Cleans up all preview containers and networks.

**Parameters:**
- `force` (optional): Force removal even if running (default: true)

**Example:**
```typescript
// Cleanup all resources
await manager.cleanup();

// Cleanup only stopped containers
await manager.cleanup(false);
```

### getDockerInstance

```typescript
getDockerInstance(): Docker
```

Gets the underlying Docker instance for advanced operations.

**Returns:** Dockerode instance

**Example:**
```typescript
const docker = manager.getDockerInstance();
const images = await docker.listImages();
```

## Events

The `DockerLifecycleManager` extends `EventEmitter` and emits the following events:

```typescript
interface DockerLifecycleEvents {
  containerCreated: (info: ContainerInfo) => void;
  containerStarted: (containerId: string) => void;
  containerStopped: (containerId: string) => void;
  containerRemoved: (containerId: string) => void;
  healthCheckStarted: (containerId: string) => void;
  healthCheckSuccess: (containerId: string) => void;
  healthCheckFailed: (containerId: string, error: Error) => void;
  error: (error: Error) => void;
}
```

**Example:**
```typescript
manager.on('containerCreated', (info) => {
  console.log(`Container created: ${info.containerId} on port ${info.port}`);
});

manager.on('containerStarted', (containerId) => {
  console.log(`Container started: ${containerId}`);
});

manager.on('healthCheckSuccess', (containerId) => {
  console.log(`Container is healthy: ${containerId}`);
});

manager.on('healthCheckFailed', (containerId, error) => {
  console.error(`Health check failed for ${containerId}:`, error);
});

manager.on('error', (error) => {
  console.error('Docker operation error:', error);
});
```

## Advanced Usage

### Complete Lifecycle Example

```typescript
import { DockerLifecycleManager } from '@friendly-aiaep/builder-preview-runtime';

async function deployPreview() {
  const manager = new DockerLifecycleManager();

  try {
    // Setup event handlers
    manager.on('containerCreated', (info) => {
      console.log(`✓ Container created on port ${info.port}`);
    });

    manager.on('healthCheckSuccess', (containerId) => {
      console.log(`✓ Container is healthy`);
    });

    // Create and start container
    console.log('Creating preview container...');
    const containerInfo = await manager.createPreviewContainer({
      volumePath: '/path/to/dist',
      image: 'nginx:alpine',
      enableMockApi: true,
      env: {
        NODE_ENV: 'preview',
        API_URL: 'http://mock-api:45001'
      },
      labels: {
        'project': 'my-app',
        'environment': 'preview'
      }
    });

    console.log('Starting containers...');
    await manager.startContainer(containerInfo.containerId);

    if (containerInfo.sidecarId) {
      await manager.startContainer(containerInfo.sidecarId);
    }

    console.log('Performing health check...');
    const healthy = await manager.healthCheck(containerInfo.containerId, {
      maxRetries: 60,
      retryInterval: 2000
    });

    if (!healthy) {
      throw new Error('Container failed health check');
    }

    console.log(`Preview available at http://localhost:${containerInfo.port}`);
    if (containerInfo.sidecarPort) {
      console.log(`Mock API available at http://localhost:${containerInfo.sidecarPort}`);
    }

    return containerInfo;

  } catch (error) {
    console.error('Deployment failed:', error);
    await manager.cleanup(true);
    throw error;
  }
}

// Usage
const container = await deployPreview();

// Later, cleanup
const manager = new DockerLifecycleManager();
await manager.stopContainer(container.containerId);
await manager.removeContainer(container.containerId);
```

### Multi-Container Management

```typescript
async function createMultiplePreview() {
  const manager = new DockerLifecycleManager();
  const containers: ContainerInfo[] = [];

  try {
    // Create multiple preview environments
    for (let i = 0; i < 3; i++) {
      const info = await manager.createPreviewContainer({
        volumePath: `/path/to/dist${i}`,
        labels: {
          'instance': String(i)
        }
      });

      await manager.startContainer(info.containerId);
      containers.push(info);
    }

    // Wait for all to be healthy
    const healthChecks = containers.map(c =>
      manager.healthCheck(c.containerId)
    );

    const results = await Promise.all(healthChecks);
    const allHealthy = results.every(r => r === true);

    if (!allHealthy) {
      throw new Error('Some containers failed health check');
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

### Custom Health Check Integration

```typescript
async function deployWithCustomHealthCheck() {
  const manager = new DockerLifecycleManager();

  const containerInfo = await manager.createPreviewContainer({
    volumePath: '/path/to/dist',
    healthCheckPath: '/api/health'
  });

  await manager.startContainer(containerInfo.containerId);

  // Custom health check logic
  let healthy = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (!healthy && attempts < maxAttempts) {
    try {
      const response = await fetch(`http://localhost:${containerInfo.port}/api/health`);

      if (response.ok) {
        const data = await response.json();
        healthy = data.status === 'ready';
      }
    } catch (error) {
      // Container not ready yet
    }

    if (!healthy) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!healthy) {
    throw new Error('Custom health check failed');
  }

  return containerInfo;
}
```

## Port Management

The Docker lifecycle manager automatically manages port allocation within the range 4300-4399:

- Automatically finds available ports
- Tracks used ports across instances
- Releases ports when containers are removed
- Throws error when range is exhausted

**Example:**
```typescript
// Create multiple containers - ports are automatically assigned
const container1 = await manager.createPreviewContainer({ volumePath: '/path1' });
console.log(`Container 1 port: ${container1.port}`); // e.g., 4300

const container2 = await manager.createPreviewContainer({ volumePath: '/path2' });
console.log(`Container 2 port: ${container2.port}`); // e.g., 4301

// Ports are released when containers are removed
await manager.removeContainer(container1.containerId);
// Port 4300 is now available again
```

## Network Management

When `enableMockApi` is true, the manager creates a bridge network for container communication:

- Network is created with a unique name
- Main container and sidecar are attached to the network
- Network is automatically removed when the main container is removed
- Containers can communicate using container names

**Example:**
```typescript
const containerInfo = await manager.createPreviewContainer({
  volumePath: '/path/to/dist',
  enableMockApi: true,
  env: {
    // Main container can access sidecar at http://mock-api:45001
    API_URL: 'http://mock-api:45001'
  }
});

console.log(`Network ID: ${containerInfo.networkId}`);
```

## Error Handling

All methods throw descriptive errors on failure:

```typescript
try {
  await manager.createPreviewContainer({
    volumePath: '/invalid/path'
  });
} catch (error) {
  if (error.message.includes('No available ports')) {
    console.error('Port range exhausted');
  } else if (error.message.includes('Failed to pull image')) {
    console.error('Image pull failed');
  } else {
    console.error('Container creation failed:', error);
  }
}
```

## Best Practices

1. **Always cleanup**: Use try-finally blocks to ensure cleanup
```typescript
const manager = new DockerLifecycleManager();
let container;

try {
  container = await manager.createPreviewContainer({ volumePath: '/path' });
  await manager.startContainer(container.containerId);
  // ... use container
} finally {
  if (container) {
    await manager.removeContainer(container.containerId, true);
  }
}
```

2. **Use event handlers**: Monitor container lifecycle
```typescript
manager.on('error', (error) => {
  logger.error('Docker error:', error);
});

manager.on('healthCheckFailed', (containerId, error) => {
  logger.warn(`Health check failed for ${containerId}`, error);
});
```

3. **Configure health checks**: Adjust timeouts based on application needs
```typescript
const healthy = await manager.healthCheck(containerId, {
  maxRetries: 60, // 60 attempts
  retryInterval: 2000, // 2 seconds between attempts
});
```

4. **Cleanup on shutdown**: Ensure all containers are removed
```typescript
process.on('SIGTERM', async () => {
  await manager.cleanup(true);
  process.exit(0);
});
```

## Testing

The Docker lifecycle manager includes comprehensive unit tests:

```bash
# Run tests
nx test builder-preview-runtime

# Run tests in watch mode
nx test builder-preview-runtime --watch

# Run tests with coverage
nx test builder-preview-runtime --coverage
```

## Troubleshooting

### Docker connection issues
```typescript
// Verify Docker is accessible
const manager = new DockerLifecycleManager();
const docker = manager.getDockerInstance();

try {
  await docker.ping();
  console.log('Docker is accessible');
} catch (error) {
  console.error('Cannot connect to Docker:', error);
}
```

### Container not starting
```typescript
// Get detailed container info
const info = await manager.getContainerInfo(containerId);
console.log('Container state:', info.State);
console.log('Container logs:', await container.logs());
```

### Port conflicts
```typescript
// List all containers to check port usage
const containers = await manager.listPreviewContainers(true);
containers.forEach(c => {
  console.log(`Container ${c.Id}: Ports ${c.Ports}`);
});
```

## Related Documentation

- [Preview Runtime](./README.md)
- [Session Manager](./SESSION_MANAGER.md)
- [Cleanup Service](./CLEANUP_SERVICE.md)
- [Dockerode Documentation](https://github.com/apocas/dockerode)
