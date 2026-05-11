import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DockerLifecycleManager,
  PreviewContainerConfig,
  ContainerInfo,
  HealthCheckOptions
} from './docker-manager';
import Docker = require('dockerode');

// Mock dockerode
vi.mock('dockerode');

describe('DockerLifecycleManager', () => {
  let manager: DockerLifecycleManager;
  let mockDocker: {
    getImage: ReturnType<typeof vi.fn>;
    pull: ReturnType<typeof vi.fn>;
    createContainer: ReturnType<typeof vi.fn>;
    getContainer: ReturnType<typeof vi.fn>;
    listContainers: ReturnType<typeof vi.fn>;
    createNetwork: ReturnType<typeof vi.fn>;
    getNetwork: ReturnType<typeof vi.fn>;
    listNetworks: ReturnType<typeof vi.fn>;
    modem: {
      followProgress: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock docker instance
    mockDocker = {
      getImage: vi.fn(),
      pull: vi.fn(),
      createContainer: vi.fn(),
      getContainer: vi.fn(),
      listContainers: vi.fn(),
      createNetwork: vi.fn(),
      getNetwork: vi.fn(),
      listNetworks: vi.fn(),
      modem: {
        followProgress: vi.fn()
      }
    };

    // Mock Docker constructor
    (Docker as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockDocker);

    manager = new DockerLifecycleManager();
  });

  afterEach(() => {
    manager.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create a new instance with default Docker options', () => {
      expect(manager).toBeInstanceOf(DockerLifecycleManager);
      expect(Docker).toHaveBeenCalledWith(undefined);
    });

    it('should create a new instance with custom Docker options', () => {
      const options = { socketPath: '/var/run/docker.sock' };
      const customManager = new DockerLifecycleManager(options);
      expect(Docker).toHaveBeenCalledWith(options);
    });
  });

  describe('getDockerInstance', () => {
    it('should return the Docker instance', () => {
      const dockerInstance = manager.getDockerInstance();
      expect(dockerInstance).toBe(mockDocker);
    });
  });

  describe('createPreviewContainer', () => {
    const config: PreviewContainerConfig = {
      volumePath: '/test/path',
      env: {
        NODE_ENV: 'production'
      }
    };

    beforeEach(() => {
      // Mock image inspection to simulate image exists
      mockDocker.getImage.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ Id: 'image-id' })
      });

      // Mock container listing for port availability
      mockDocker.listContainers.mockResolvedValue([]);

      // Mock container creation
      mockDocker.createContainer.mockResolvedValue({
        id: 'container-123'
      });
    });

    it('should create a container with default configuration', async () => {
      const containerInfo = await manager.createPreviewContainer(config);

      expect(containerInfo).toMatchObject({
        containerId: 'container-123',
        port: expect.any(Number),
        status: 'created'
      });

      expect(containerInfo.port).toBeGreaterThanOrEqual(4300);
      expect(containerInfo.port).toBeLessThanOrEqual(4399);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'nginx:alpine',
          Env: ['NODE_ENV=production'],
          Labels: expect.objectContaining({
            'com.friendlyai.aep.managed': 'true',
            'com.friendlyai.aep.type': 'preview-container'
          }),
          HostConfig: expect.objectContaining({
            Binds: ['/test/path:/usr/share/nginx/html:ro']
          })
        })
      );
    });

    it('should create a container with custom image and mount point', async () => {
      const customConfig: PreviewContainerConfig = {
        ...config,
        image: 'custom:latest',
        mountPoint: '/app/dist'
      };

      await manager.createPreviewContainer(customConfig);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'custom:latest',
          HostConfig: expect.objectContaining({
            Binds: ['/test/path:/app/dist:ro']
          })
        })
      );
    });

    it('should emit containerCreated event', async () => {
      const eventHandler = vi.fn();
      manager.on('containerCreated', eventHandler);

      const containerInfo = await manager.createPreviewContainer(config);

      expect(eventHandler).toHaveBeenCalledWith(containerInfo);
    });

    it('should create sidecar container when enableMockApi is true', async () => {
      mockDocker.createNetwork.mockResolvedValue({ id: 'network-123' });

      const configWithMock: PreviewContainerConfig = {
        ...config,
        enableMockApi: true
      };

      const containerInfo = await manager.createPreviewContainer(configWithMock);

      expect(containerInfo.networkId).toBe('network-123');
      expect(containerInfo.sidecarId).toBeDefined();
      expect(containerInfo.sidecarPort).toBeDefined();
      expect(mockDocker.createNetwork).toHaveBeenCalled();
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(2); // Main + sidecar
    });

    it('should pull image if not present', async () => {
      mockDocker.getImage.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(new Error('Image not found'))
      });

      mockDocker.pull.mockImplementation((image, callback) => {
        callback(null, {});
        return Promise.resolve();
      });

      mockDocker.modem.followProgress.mockImplementation((stream, onFinished) => {
        onFinished(null);
      });

      await manager.createPreviewContainer(config);

      expect(mockDocker.pull).toHaveBeenCalledWith('nginx:alpine', expect.any(Function));
    });

    it('should handle container creation failure', async () => {
      mockDocker.createContainer.mockRejectedValue(new Error('Creation failed'));

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      await expect(manager.createPreviewContainer(config)).rejects.toThrow(
        'Failed to create preview container'
      );

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should find available port in range', async () => {
      // Mock containers using ports 4300 and 4301
      mockDocker.listContainers.mockResolvedValue([
        {
          Ports: [{ PublicPort: 4300 }]
        },
        {
          Ports: [{ PublicPort: 4301 }]
        }
      ]);

      const containerInfo = await manager.createPreviewContainer(config);

      expect(containerInfo.port).toBe(4302);
    });

    it('should throw error when no ports available', async () => {
      // Mock all ports in range as used
      const usedContainers = Array.from({ length: 100 }, (_, i) => ({
        Ports: [{ PublicPort: 4300 + i }]
      }));

      mockDocker.listContainers.mockResolvedValue(usedContainers);

      await expect(manager.createPreviewContainer(config)).rejects.toThrow(
        'No available ports in range'
      );
    });

    it('should include custom labels', async () => {
      const configWithLabels: PreviewContainerConfig = {
        ...config,
        labels: {
          'custom.label': 'value',
          'another.label': 'value2'
        }
      };

      await manager.createPreviewContainer(configWithLabels);

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Labels: expect.objectContaining({
            'custom.label': 'value',
            'another.label': 'value2'
          })
        })
      );
    });
  });

  describe('createSidecarContainer', () => {
    beforeEach(() => {
      mockDocker.getImage.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ Id: 'image-id' })
      });

      mockDocker.listContainers.mockResolvedValue([]);

      mockDocker.createContainer.mockResolvedValue({
        id: 'sidecar-456'
      });
    });

    it('should create sidecar container with default image', async () => {
      const result = await manager.createSidecarContainer('network-123');

      expect(result).toMatchObject({
        containerId: 'sidecar-456',
        port: expect.any(Number)
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'node:20-alpine',
          Labels: expect.objectContaining({
            'com.friendlyai.aep.type': 'mock-api-sidecar'
          }),
          HostConfig: expect.objectContaining({
            NetworkMode: 'network-123'
          })
        })
      );
    });

    it('should create sidecar container with custom image', async () => {
      await manager.createSidecarContainer('network-123', 'custom-node:latest');

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'custom-node:latest'
        })
      );
    });

    it('should handle sidecar creation failure', async () => {
      mockDocker.createContainer.mockRejectedValue(new Error('Failed to create'));

      await expect(manager.createSidecarContainer('network-123')).rejects.toThrow(
        'Failed to create sidecar container'
      );
    });
  });

  describe('startContainer', () => {
    it('should start a container', async () => {
      const mockContainer = {
        start: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.startContainer('container-123');

      expect(mockDocker.getContainer).toHaveBeenCalledWith('container-123');
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('should emit containerStarted event', async () => {
      const mockContainer = {
        start: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const eventHandler = vi.fn();
      manager.on('containerStarted', eventHandler);

      await manager.startContainer('container-123');

      expect(eventHandler).toHaveBeenCalledWith('container-123');
    });

    it('should handle start failure', async () => {
      const mockContainer = {
        start: vi.fn().mockRejectedValue(new Error('Start failed'))
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      await expect(manager.startContainer('container-123')).rejects.toThrow(
        'Failed to start container'
      );

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('stopContainer', () => {
    it('should stop a container', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.stopContainer('container-123');

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
    });

    it('should stop a container with custom timeout', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.stopContainer('container-123', 20);

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 20 });
    });

    it('should emit containerStopped event', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const eventHandler = vi.fn();
      manager.on('containerStopped', eventHandler);

      await manager.stopContainer('container-123');

      expect(eventHandler).toHaveBeenCalledWith('container-123');
    });

    it('should ignore already stopped error', async () => {
      const mockContainer = {
        stop: vi.fn().mockRejectedValue({ statusCode: 304 })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await expect(manager.stopContainer('container-123')).resolves.not.toThrow();
    });

    it('should throw on other stop errors', async () => {
      const mockContainer = {
        stop: vi.fn().mockRejectedValue(new Error('Stop failed'))
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await expect(manager.stopContainer('container-123')).rejects.toThrow(
        'Failed to stop container'
      );
    });
  });

  describe('removeContainer', () => {
    it('should remove a container and release port', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Ports: {
              '80/tcp': [{ HostPort: '4300' }]
            },
            Networks: {}
          }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.removeContainer('container-123');

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: false });
    });

    it('should force remove when specified', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Ports: {},
            Networks: {}
          }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.removeContainer('container-123', true);

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should emit containerRemoved event', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Ports: {},
            Networks: {}
          }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const eventHandler = vi.fn();
      manager.on('containerRemoved', eventHandler);

      await manager.removeContainer('container-123');

      expect(eventHandler).toHaveBeenCalledWith('container-123');
    });

    it('should remove network when container is removed', async () => {
      const mockNetwork = {
        remove: vi.fn().mockResolvedValue(undefined)
      };

      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Ports: {},
            Networks: {
              'preview-network-123': {
                NetworkID: 'network-id-123'
              }
            }
          }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await manager.removeContainer('container-123');

      expect(mockDocker.getNetwork).toHaveBeenCalledWith('network-id-123');
      expect(mockNetwork.remove).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when container is healthy', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Status: 'running',
            Health: {
              Status: 'healthy'
            }
          },
          NetworkSettings: {
            Ports: {}
          }
        })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const eventHandler = vi.fn();
      manager.on('healthCheckSuccess', eventHandler);

      const result = await manager.healthCheck('container-123');

      expect(result).toBe(true);
      expect(eventHandler).toHaveBeenCalledWith('container-123');
    });

    it('should poll until healthy status', async () => {
      const mockContainer = {
        inspect: vi
          .fn()
          .mockResolvedValueOnce({
            State: {
              Status: 'running',
              Health: { Status: 'starting' }
            },
            NetworkSettings: { Ports: {} }
          })
          .mockResolvedValueOnce({
            State: {
              Status: 'running',
              Health: { Status: 'starting' }
            },
            NetworkSettings: { Ports: {} }
          })
          .mockResolvedValueOnce({
            State: {
              Status: 'running',
              Health: { Status: 'healthy' }
            },
            NetworkSettings: { Ports: {} }
          })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.healthCheck('container-123', {
        retryInterval: 10
      });

      expect(result).toBe(true);
      expect(mockContainer.inspect).toHaveBeenCalledTimes(3);
    });

    it('should return true when no health check but ports are active', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Status: 'running'
          },
          NetworkSettings: {
            Ports: {
              '80/tcp': [{ HostPort: '4300' }]
            }
          }
        })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.healthCheck('container-123');

      expect(result).toBe(true);
    });

    it('should throw when container is not running', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Status: 'stopped'
          },
          NetworkSettings: { Ports: {} }
        })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await expect(manager.healthCheck('container-123')).rejects.toThrow(
        'Container is not running'
      );
    });

    it('should emit healthCheckFailed on timeout', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Status: 'running',
            Health: { Status: 'starting' }
          },
          NetworkSettings: { Ports: {} }
        })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const eventHandler = vi.fn();
      manager.on('healthCheckFailed', eventHandler);

      const result = await manager.healthCheck('container-123', {
        maxRetries: 2,
        retryInterval: 10
      });

      expect(result).toBe(false);
      expect(eventHandler).toHaveBeenCalledWith(
        'container-123',
        expect.objectContaining({
          message: expect.stringContaining('Health check timeout')
        })
      );
    });

    it('should throw when health status is unhealthy', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          State: {
            Status: 'running',
            Health: { Status: 'unhealthy' }
          },
          NetworkSettings: { Ports: {} }
        })
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await expect(manager.healthCheck('container-123')).rejects.toThrow(
        'Container health check failed'
      );
    });
  });

  describe('getContainerInfo', () => {
    it('should return container inspection data', async () => {
      const inspectData = {
        Id: 'container-123',
        State: { Status: 'running' },
        NetworkSettings: { Ports: {} }
      };

      const mockContainer = {
        inspect: vi.fn().mockResolvedValue(inspectData)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.getContainerInfo('container-123');

      expect(result).toEqual(inspectData);
    });

    it('should throw on inspection failure', async () => {
      const mockContainer = {
        inspect: vi.fn().mockRejectedValue(new Error('Not found'))
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await expect(manager.getContainerInfo('container-123')).rejects.toThrow(
        'Failed to get container info'
      );
    });
  });

  describe('listPreviewContainers', () => {
    it('should list only running preview containers by default', async () => {
      const containers = [
        { Id: 'container-1', State: 'running' },
        { Id: 'container-2', State: 'running' }
      ];

      mockDocker.listContainers.mockResolvedValue(containers);

      const result = await manager.listPreviewContainers();

      expect(result).toEqual(containers);
      expect(mockDocker.listContainers).toHaveBeenCalledWith({
        all: false,
        filters: {
          label: ['com.friendlyai.aep.managed=true']
        }
      });
    });

    it('should list all preview containers when includeAll is true', async () => {
      const containers = [
        { Id: 'container-1', State: 'running' },
        { Id: 'container-2', State: 'exited' }
      ];

      mockDocker.listContainers.mockResolvedValue(containers);

      const result = await manager.listPreviewContainers(true);

      expect(result).toEqual(containers);
      expect(mockDocker.listContainers).toHaveBeenCalledWith({
        all: true,
        filters: {
          label: ['com.friendlyai.aep.managed=true']
        }
      });
    });
  });

  describe('cleanup', () => {
    it('should stop and remove all preview containers', async () => {
      const containers = [
        { Id: 'container-1', State: 'running' },
        { Id: 'container-2', State: 'running' }
      ];

      mockDocker.listContainers.mockResolvedValue(containers);
      mockDocker.listNetworks.mockResolvedValue([]);

      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: {
            Ports: {},
            Networks: {}
          }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.cleanup();

      expect(mockContainer.stop).toHaveBeenCalledTimes(2);
      expect(mockContainer.remove).toHaveBeenCalledTimes(2);
    });

    it('should remove all networks', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const networks = [
        { Id: 'network-1', Name: 'preview-network-1' },
        { Id: 'network-2', Name: 'preview-network-2' }
      ];

      mockDocker.listNetworks.mockResolvedValue(networks);

      const mockNetwork = {
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await manager.cleanup();

      expect(mockNetwork.remove).toHaveBeenCalledTimes(2);
    });

    it('should continue cleanup even if individual container fails', async () => {
      const containers = [
        { Id: 'container-1', State: 'running' },
        { Id: 'container-2', State: 'running' }
      ];

      mockDocker.listContainers.mockResolvedValue(containers);
      mockDocker.listNetworks.mockResolvedValue([]);

      const mockContainer1 = {
        stop: vi.fn().mockRejectedValue(new Error('Failed to stop')),
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: { Ports: {}, Networks: {} }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      const mockContainer2 = {
        stop: vi.fn().mockResolvedValue(undefined),
        inspect: vi.fn().mockResolvedValue({
          NetworkSettings: { Ports: {}, Networks: {} }
        }),
        remove: vi.fn().mockResolvedValue(undefined)
      };

      mockDocker.getContainer
        .mockReturnValueOnce(mockContainer1)
        .mockReturnValueOnce(mockContainer1)
        .mockReturnValueOnce(mockContainer2)
        .mockReturnValueOnce(mockContainer2);

      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      await manager.cleanup();

      expect(errorHandler).toHaveBeenCalled();
      expect(mockContainer2.stop).toHaveBeenCalled();
    });
  });
});
