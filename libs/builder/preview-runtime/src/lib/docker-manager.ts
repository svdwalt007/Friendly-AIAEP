import Docker = require('dockerode');
import { EventEmitter } from 'events';

/**
 * Configuration for creating a preview container
 */
export interface PreviewContainerConfig {
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

/**
 * Information about a created container
 */
export interface ContainerInfo {
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

/**
 * Options for health check
 */
export interface HealthCheckOptions {
  /** Maximum number of retries (default: 30) */
  maxRetries?: number;
  /** Interval between retries in ms (default: 1000) */
  retryInterval?: number;
  /** HTTP method to use (default: GET) */
  method?: 'GET' | 'HEAD';
  /** Expected status code (default: 200) */
  expectedStatus?: number;
}

/**
 * Docker lifecycle manager events
 */
export interface DockerLifecycleEvents {
  containerCreated: (info: ContainerInfo) => void;
  containerStarted: (containerId: string) => void;
  containerStopped: (containerId: string) => void;
  containerRemoved: (containerId: string) => void;
  healthCheckStarted: (containerId: string) => void;
  healthCheckSuccess: (containerId: string) => void;
  healthCheckFailed: (containerId: string, error: Error) => void;
  error: (error: Error) => void;
}

/**
 * Docker container lifecycle manager for preview environments
 *
 * Manages the complete lifecycle of Docker containers including:
 * - Image pulling
 * - Container creation with volume mounts and port mapping
 * - Health checks
 * - Sidecar container management
 * - Network linking
 * - Container cleanup
 *
 * @example
 * ```typescript
 * const manager = new DockerLifecycleManager();
 *
 * const containerInfo = await manager.createPreviewContainer({
 *   volumePath: '/path/to/angular/dist',
 *   enableMockApi: true
 * });
 *
 * await manager.startContainer(containerInfo.containerId);
 * const healthy = await manager.healthCheck(containerInfo.containerId);
 *
 * // Later...
 * await manager.stopContainer(containerInfo.containerId);
 * await manager.removeContainer(containerInfo.containerId);
 * ```
 */
export class DockerLifecycleManager extends EventEmitter {
  private docker: Docker;
  private readonly portRangeStart = 4300;
  private readonly portRangeEnd = 4399;
  private readonly usedPorts = new Set<number>();

  constructor(dockerOptions?: Docker.DockerOptions) {
    super();
    this.docker = new Docker(dockerOptions);
  }

  /**
   * Gets the Docker instance for advanced operations
   */
  public getDockerInstance(): Docker {
    return this.docker;
  }

  /**
   * Pulls a Docker image if not already present
   *
   * @param image - Image name with optional tag
   * @returns Promise that resolves when image is pulled
   * @throws Error if pull fails
   */
  private async pullImage(image: string): Promise<void> {
    try {
      // Check if image exists locally
      try {
        await this.docker.getImage(image).inspect();
        return; // Image already exists
      } catch (error) {
        // Image doesn't exist, need to pull
      }

      return new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(new Error(`Failed to pull image ${image}: ${err.message}`));
            return;
          }

          this.docker.modem.followProgress(
            stream,
            (err: Error | null) => {
              if (err) {
                reject(new Error(`Failed to pull image ${image}: ${err.message}`));
              } else {
                resolve();
              }
            },
            (_event: { status?: string; progress?: string }) => {
              // Optional: emit progress events
              // this.emit('pullProgress', _event);
            }
          );
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to pull image ${image}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Finds an available port in the configured range
   *
   * @returns Available port number
   * @throws Error if no ports available
   */
  private async findAvailablePort(): Promise<number> {
    const containers = await this.docker.listContainers({ all: true });

    // Get all used ports from existing containers
    const usedPorts = new Set<number>(this.usedPorts);
    containers.forEach((container: Docker.ContainerInfo) => {
      if (container.Ports && Array.isArray(container.Ports)) {
        container.Ports.forEach((port: Docker.Port) => {
          if (port.PublicPort) {
            usedPorts.add(port.PublicPort);
          }
        });
      }
    });

    // Find first available port in range
    for (let port = this.portRangeStart; port <= this.portRangeEnd; port++) {
      if (!usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }

    throw new Error(
      `No available ports in range ${this.portRangeStart}-${this.portRangeEnd}`
    );
  }

  /**
   * Releases a port back to the available pool
   *
   * @param port - Port to release
   */
  private releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  /**
   * Creates a Docker network for container communication
   *
   * @param name - Network name
   * @returns Network ID
   */
  private async createNetwork(name: string): Promise<string> {
    try {
      const network = await this.docker.createNetwork({
        Name: name,
        Driver: 'bridge',
        CheckDuplicate: true,
        Labels: {
          'com.friendlyai.aep.managed': 'true',
          'com.friendlyai.aep.type': 'preview-network'
        }
      });
      return network.id;
    } catch (error) {
      throw new Error(
        `Failed to create network ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a preview container with the specified configuration
   *
   * @param config - Container configuration
   * @returns Container information including ID and port
   * @throws Error if container creation fails
   */
  public async createPreviewContainer(
    config: PreviewContainerConfig
  ): Promise<ContainerInfo> {
    const image = config.image || 'nginx:alpine';
    const mountPoint = config.mountPoint || '/usr/share/nginx/html';
    const healthCheckPath = config.healthCheckPath || '/';

    try {
      // Pull base image
      await this.pullImage(image);

      // Find available port
      const port = await this.findAvailablePort();

      // Create network if mock API is enabled
      let networkId: string | undefined;
      let networkName: string | undefined;
      if (config.enableMockApi) {
        networkName = `preview-network-${Date.now()}`;
        networkId = await this.createNetwork(networkName);
      }

      // Prepare environment variables
      const envArray = Object.entries(config.env || {}).map(
        ([key, value]) => `${key}=${value}`
      );

      // Prepare labels
      const labels = {
        'com.friendlyai.aep.managed': 'true',
        'com.friendlyai.aep.type': 'preview-container',
        'com.friendlyai.aep.port': String(port),
        ...config.labels
      };

      // Create container
      const container = await this.docker.createContainer({
        Image: image,
        Env: envArray,
        Labels: labels,
        ExposedPorts: {
          '80/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '80/tcp': [{ HostPort: String(port) }]
          },
          Binds: [`${config.volumePath}:${mountPoint}:ro`],
          AutoRemove: false,
          NetworkMode: networkName || 'bridge'
        },
        Healthcheck: {
          Test: ['CMD-SHELL', `wget --quiet --tries=1 --spider http://localhost:80${healthCheckPath} || exit 1`],
          Interval: (config.healthCheckInterval || 5) * 1000000000, // Convert to nanoseconds
          Timeout: 3000000000, // 3 seconds
          Retries: 3,
          StartPeriod: 10000000000 // 10 seconds
        }
      });

      const containerInfo: ContainerInfo = {
        containerId: container.id,
        port,
        networkId,
        status: 'created'
      };

      // Create sidecar if mock API enabled
      if (config.enableMockApi && networkId) {
        try {
          const sidecarInfo = await this.createSidecarContainer(
            networkId,
            config.mockApiImage
          );
          containerInfo.sidecarId = sidecarInfo.containerId;
          containerInfo.sidecarPort = sidecarInfo.port;
        } catch (error) {
          // Cleanup main container if sidecar creation fails
          await container.remove({ force: true }).catch(() => {});
          this.releasePort(port);
          throw error;
        }
      }

      this.emit('containerCreated', containerInfo);
      return containerInfo;
    } catch (error) {
      this.emit('error', error as Error);
      throw new Error(
        `Failed to create preview container: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a sidecar container for the mock API server
   *
   * @param networkId - Network ID to attach to
   * @param image - Docker image to use (default: node:20-alpine)
   * @returns Container information
   */
  public async createSidecarContainer(
    networkId: string,
    image?: string
  ): Promise<{ containerId: string; port: number }> {
    const mockApiImage = image || 'node:20-alpine';

    try {
      // Pull sidecar image
      await this.pullImage(mockApiImage);

      // Find available port for sidecar
      const port = await this.findAvailablePort();

      // Create sidecar container
      const container = await this.docker.createContainer({
        Image: mockApiImage,
        Cmd: ['node', '/app/server.js'],
        Labels: {
          'com.friendlyai.aep.managed': 'true',
          'com.friendlyai.aep.type': 'mock-api-sidecar',
          'com.friendlyai.aep.port': String(port)
        },
        ExposedPorts: {
          '3000/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '3000/tcp': [{ HostPort: String(port) }]
          },
          NetworkMode: networkId,
          AutoRemove: false
        },
        Env: [
          'NODE_ENV=production',
          'MOCK_API_PORT=3000'
        ]
      });

      return {
        containerId: container.id,
        port
      };
    } catch (error) {
      throw new Error(
        `Failed to create sidecar container: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Starts a container
   *
   * @param containerId - Container ID to start
   * @throws Error if start fails
   */
  public async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      this.emit('containerStarted', containerId);
    } catch (error) {
      this.emit('error', error as Error);
      throw new Error(
        `Failed to start container ${containerId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stops a container
   *
   * @param containerId - Container ID to stop
   * @param timeout - Timeout in seconds before forcing stop (default: 10)
   * @throws Error if stop fails
   */
  public async stopContainer(
    containerId: string,
    timeout = 10
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: timeout });
      this.emit('containerStopped', containerId);
    } catch (error) {
      // Ignore error if container is already stopped
      const err = error as { statusCode?: number };
      if (err.statusCode !== 304) {
        this.emit('error', error as Error);
        throw new Error(
          `Failed to stop container ${containerId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Restarts a container
   *
   * @param containerId - Container ID to restart
   * @param timeout - Timeout in seconds before forcing restart (default: 10)
   * @throws Error if restart fails
   */
  public async restartContainer(
    containerId: string,
    timeout = 10
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart({ t: timeout });
      this.emit('containerStarted', containerId);
    } catch (error) {
      this.emit('error', error as Error);
      throw new Error(
        `Failed to restart container ${containerId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Removes a container and cleans up resources
   *
   * @param containerId - Container ID to remove
   * @param force - Force removal even if running (default: false)
   * @throws Error if removal fails
   */
  public async removeContainer(
    containerId: string,
    force = false
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      // Get container info to release port
      const info = await container.inspect();
      const ports = info.NetworkSettings.Ports || {};

      // Release ports
      Object.values(ports).forEach((portBindings: Docker.PortBinding[] | null) => {
        if (portBindings && Array.isArray(portBindings)) {
          portBindings.forEach((binding: Docker.PortBinding) => {
            if (binding?.HostPort) {
              this.releasePort(parseInt(binding.HostPort, 10));
            }
          });
        }
      });

      // Remove container
      await container.remove({ force });

      // Remove network if it exists and is empty
      const networks = info.NetworkSettings.Networks || {};
      if (networks) {
        for (const [networkName, networkInfo] of Object.entries(networks)) {
          if (networkName.startsWith('preview-network-') && networkInfo && typeof networkInfo === 'object' && 'NetworkID' in networkInfo) {
            try {
              const network = this.docker.getNetwork(networkInfo.NetworkID);
              await network.remove();
            } catch (error) {
              // Ignore errors when removing network (might still be in use)
            }
          }
        }
      }

      this.emit('containerRemoved', containerId);
    } catch (error) {
      this.emit('error', error as Error);
      throw new Error(
        `Failed to remove container ${containerId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Performs health check on a container by polling the health endpoint
   *
   * @param containerId - Container ID to check
   * @param options - Health check options
   * @returns true if container is healthy, false otherwise
   */
  public async healthCheck(
    containerId: string,
    options: HealthCheckOptions = {}
  ): Promise<boolean> {
    const maxRetries = options.maxRetries || 30;
    const retryInterval = options.retryInterval || 1000;

    this.emit('healthCheckStarted', containerId);

    try {
      const container = this.docker.getContainer(containerId);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Check container state
          const info = await container.inspect();

          if (info.State.Status !== 'running') {
            throw new Error(`Container is not running: ${info.State.Status}`);
          }

          // Check health status if available
          if (info.State.Health) {
            const health = info.State.Health.Status;
            if (health === 'healthy') {
              this.emit('healthCheckSuccess', containerId);
              return true;
            } else if (health === 'unhealthy') {
              throw new Error('Container health check failed');
            }
            // Status is 'starting', continue polling
          } else {
            // No health check configured, verify port is accessible
            const ports = info.NetworkSettings.Ports || {};
            const hasActivePorts = Object.values(ports).some(
              (bindings: Docker.PortBinding[] | null) => bindings && Array.isArray(bindings) && bindings.length > 0
            );

            if (hasActivePorts) {
              this.emit('healthCheckSuccess', containerId);
              return true;
            }
          }
        } catch (error) {
          if (attempt === maxRetries) {
            throw error;
          }
        }

        // Wait before next attempt
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
      }

      const error = new Error(
        `Health check timeout after ${maxRetries} attempts`
      );
      this.emit('healthCheckFailed', containerId, error);
      return false;
    } catch (error) {
      const err = error as Error;
      this.emit('healthCheckFailed', containerId, err);
      throw new Error(
        `Health check failed for container ${containerId}: ${err.message}`
      );
    }
  }

  /**
   * Gets container information
   *
   * @param containerId - Container ID
   * @returns Container inspection data
   */
  public async getContainerInfo(containerId: string): Promise<Docker.ContainerInspectInfo> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      throw new Error(
        `Failed to get container info ${containerId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Lists all preview containers managed by this lifecycle manager
   *
   * @param includeAll - Include stopped containers (default: false)
   * @returns Array of container information
   */
  public async listPreviewContainers(
    includeAll = false
  ): Promise<Docker.ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({
        all: includeAll,
        filters: {
          label: ['com.friendlyai.aep.managed=true']
        }
      });
      return containers;
    } catch (error) {
      throw new Error(
        `Failed to list preview containers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Cleans up all preview containers and networks
   *
   * @param force - Force removal even if running (default: true)
   */
  public async cleanup(force = true): Promise<void> {
    try {
      const containers = await this.listPreviewContainers(true);

      for (const containerInfo of containers) {
        const containerId = containerInfo.Id;

        try {
          // Stop if running
          if (containerInfo.State === 'running') {
            await this.stopContainer(containerId);
          }

          // Remove container
          await this.removeContainer(containerId, force);
        } catch (error) {
          // Continue cleanup even if individual container fails
          this.emit('error', error as Error);
        }
      }

      // Clean up networks
      const networks = await this.docker.listNetworks({
        filters: {
          label: ['com.friendlyai.aep.managed=true']
        }
      });

      for (const networkInfo of networks) {
        try {
          const network = this.docker.getNetwork(networkInfo.Id);
          await network.remove();
        } catch (error) {
          // Ignore errors when removing networks
        }
      }

      // Clear used ports
      this.usedPorts.clear();
    } catch (error) {
      throw new Error(
        `Failed to cleanup preview containers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
