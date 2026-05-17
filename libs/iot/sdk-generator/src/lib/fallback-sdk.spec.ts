/**
 * Tests for FallbackSdk
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FallbackSdk } from './fallback-sdk';
import { FriendlyApiError } from './errors';

// TODO: Fix circular dependency with auth-adapter
type FriendlyAuthAdapter = any;

// Mock FriendlyAuthAdapter
const createMockAuthAdapter = (): FriendlyAuthAdapter => {
  return {
    isInitialized: vi.fn(() => true),
    getTenantId: vi.fn(() => 'tenant-123'),
    getAuthHeaders: vi.fn(async (apiId: string) => ({
      Authorization: `Bearer mock-token-${apiId}`,
    })),
    handle401: vi.fn(async (apiId: string) => ({
      Authorization: `Bearer refreshed-token-${apiId}`,
    })),
  } as any;
};

describe('FallbackSdk', () => {
  let mockAuthAdapter: FriendlyAuthAdapter;
  let sdk: FallbackSdk;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    mockAuthAdapter = createMockAuthAdapter();
    sdk = new FallbackSdk({
      authAdapter: mockAuthAdapter,
      baseProxyUrl: 'https://api.example.com/proxy',
    });

    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      expect(sdk).toBeInstanceOf(FallbackSdk);
      expect(sdk.getTenantId()).toBe('tenant-123');
      expect(sdk.getBaseProxyUrl()).toBe('https://api.example.com/proxy');
      expect(sdk.getTimeout()).toBe(30000);
    });

    it('should throw if authAdapter is not initialized', () => {
      const uninitializedAdapter = createMockAuthAdapter();
      vi.mocked(uninitializedAdapter.isInitialized).mockReturnValue(false);

      expect(() => {
        new FallbackSdk({
          authAdapter: uninitializedAdapter,
          baseProxyUrl: 'https://api.example.com',
        });
      }).toThrow('AuthAdapter must be initialized');
    });

    it('should use custom timeout if provided', () => {
      const customSdk = new FallbackSdk({
        authAdapter: mockAuthAdapter,
        baseProxyUrl: 'https://api.example.com',
        timeout: 60000,
      });

      expect(customSdk.getTimeout()).toBe(60000);
    });

    it('should strip trailing slash from baseProxyUrl', () => {
      const sdkWithSlash = new FallbackSdk({
        authAdapter: mockAuthAdapter,
        baseProxyUrl: 'https://api.example.com/proxy/',
      });

      expect(sdkWithSlash.getBaseProxyUrl()).toBe('https://api.example.com/proxy');
    });
  });

  describe('getDeviceList', () => {
    it('should fetch device list successfully', async () => {
      const mockResponse = {
        devices: [
          { deviceId: 'dev-1', name: 'Device 1', status: 'online', type: 'router' },
          { deviceId: 'dev-2', name: 'Device 2', status: 'offline', type: 'modem' },
        ],
        total: 2,
        limit: 10,
        offset: 0,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getDeviceList({ limit: 10, offset: 0 });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/northbound/devices?limit=10&offset=0',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token-northbound',
            'Content-Type': 'application/json',
            'X-Tenant-Id': 'tenant-123',
          }),
        })
      );
    });

    it('should handle filters correctly', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ devices: [], total: 0, limit: 10, offset: 0 }),
      } as Response);

      await sdk.getDeviceList({
        limit: 10,
        filter: { status: 'online', type: 'router', search: 'test' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=online'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=router'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });
  });

  describe('getDeviceById', () => {
    it('should fetch device by ID successfully', async () => {
      const mockDevice = {
        deviceId: 'dev-123',
        name: 'Test Device',
        status: 'online',
        type: 'router',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevice,
      } as Response);

      const result = await sdk.getDeviceById('dev-123');

      expect(result).toEqual(mockDevice);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/northbound/devices/dev-123',
        expect.any(Object)
      );
    });
  });

  describe('updateDevice', () => {
    it('should update device successfully', async () => {
      const update = {
        name: 'Updated Name',
        metadata: { location: 'Building A' },
      };

      const mockResponse = {
        deviceId: 'dev-123',
        name: 'Updated Name',
        status: 'online',
        type: 'router',
        metadata: { location: 'Building A' },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.updateDevice('dev-123', update);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/northbound/devices/dev-123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(update),
        })
      );
    });
  });

  describe('getAlerts', () => {
    it('should fetch alerts with filters', async () => {
      const mockResponse = {
        alerts: [
          {
            alertId: 'alert-1',
            deviceId: 'dev-1',
            severity: 'critical',
            status: 'active',
            title: 'Critical Alert',
            description: 'Something is wrong',
            timestamp: new Date(),
          },
        ],
        total: 1,
        limit: 10,
        offset: 0,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getAlerts({
        severity: 'critical',
        status: 'active',
        limit: 10,
      });

      expect(result.alerts).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('severity=critical'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=active'),
        expect.any(Object)
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert successfully', async () => {
      const mockAlert = {
        alertId: 'alert-123',
        deviceId: 'dev-1',
        severity: 'high',
        status: 'acknowledged',
        title: 'Alert',
        description: 'Description',
        timestamp: new Date(),
        acknowledgedAt: new Date(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlert,
      } as Response);

      const result = await sdk.acknowledgeAlert('alert-123');

      expect(result.status).toBe('acknowledged');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/northbound/alerts/alert-123/acknowledge',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert with resolution note', async () => {
      const mockAlert = {
        alertId: 'alert-123',
        deviceId: 'dev-1',
        severity: 'high',
        status: 'resolved',
        title: 'Alert',
        description: 'Description',
        timestamp: new Date(),
        resolvedAt: new Date(),
        resolution: 'Fixed by rebooting',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlert,
      } as Response);

      const result = await sdk.resolveAlert('alert-123', 'Fixed by rebooting');

      expect(result.status).toBe('resolved');
      expect(result.resolution).toBe('Fixed by rebooting');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/northbound/alerts/alert-123/resolve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ resolution: 'Fixed by rebooting' }),
        })
      );
    });
  });

  describe('subscribeToEvents', () => {
    it('should create event subscription', async () => {
      const subscription = {
        eventTypes: ['device.status.changed', 'alert.created'],
        filters: { deviceId: 'dev-123' },
        webhookUrl: 'https://myapp.com/webhook',
      };

      const mockResponse = {
        subscriptionId: 'sub-123',
        eventTypes: subscription.eventTypes,
        filters: subscription.filters,
        webhookUrl: subscription.webhookUrl,
        createdAt: new Date(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.subscribeToEvents(subscription);

      expect(result.subscriptionId).toBe('sub-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/events/subscriptions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(subscription),
        })
      );
    });
  });

  describe('unsubscribeFromEvents', () => {
    it('should delete event subscription', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await sdk.unsubscribeFromEvents('sub-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/events/subscriptions/sub-123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('getEventHistory', () => {
    it('should fetch event history with time range', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');

      const mockResponse = {
        events: [
          {
            eventId: 'evt-1',
            eventType: 'device.status.changed',
            deviceId: 'dev-1',
            timestamp: new Date(),
            payload: { status: 'online' },
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getEventHistory({
        startTime,
        endTime,
        eventTypes: ['device.status.changed'],
        limit: 100,
      });

      expect(result.events).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('startTime='),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('endTime='),
        expect.any(Object)
      );
    });
  });

  describe('getDeviceTelemetry', () => {
    it('should fetch device telemetry data', async () => {
      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();

      const mockResponse = {
        deviceId: 'dev-123',
        startTime,
        endTime,
        dataPoints: [
          { timestamp: new Date(), metric: 'cpu', value: 45.5, unit: '%' },
          { timestamp: new Date(), metric: 'memory', value: 8192, unit: 'MB' },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getDeviceTelemetry('dev-123', {
        startTime,
        endTime,
        metrics: ['cpu', 'memory'],
        interval: '5m',
      });

      expect(result.dataPoints).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('interval=5m'),
        expect.any(Object)
      );
    });
  });

  describe('getFleetKpis', () => {
    it('should fetch fleet KPIs', async () => {
      const mockResponse = {
        totalDevices: 100,
        onlineDevices: 85,
        offlineDevices: 10,
        degradedDevices: 5,
        averageUptime: 99.5,
        alertCounts: {
          critical: 2,
          high: 5,
          medium: 10,
          low: 15,
        },
        timestamp: new Date(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getFleetKpis();

      expect(result.totalDevices).toBe(100);
      expect(result.averageUptime).toBe(99.5);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/qoe/fleet/kpis',
        expect.any(Object)
      );
    });
  });

  describe('getDeviceConnectivity', () => {
    it('should fetch device connectivity status', async () => {
      const mockResponse = {
        deviceId: 'dev-123',
        isConnected: true,
        connectionType: 'ethernet',
        signalStrength: 95,
        bandwidth: {
          upload: 100,
          download: 500,
        },
        latency: 15,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getDeviceConnectivity('dev-123');

      expect(result.isConnected).toBe(true);
      expect(result.connectionType).toBe('ethernet');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/qoe/devices/dev-123/connectivity',
        expect.any(Object)
      );
    });
  });

  describe('getDeviceConfiguration', () => {
    it('should fetch device configuration', async () => {
      const mockResponse = {
        deviceId: 'dev-123',
        configuration: {
          setting1: 'value1',
          setting2: 'value2',
        },
        version: '1.0.0',
        lastUpdated: new Date(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sdk.getDeviceConfiguration('dev-123');

      expect(result.version).toBe('1.0.0');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/proxy/northbound/devices/dev-123/configuration',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw FriendlyApiError on non-OK response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Device not found',
      } as Response);

      await expect(sdk.getDeviceById('non-existent')).rejects.toThrow(FriendlyApiError);
    });

    it('should handle 401 and retry with refreshed token', async () => {
      // First call returns 401
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Token expired',
      } as Response);

      // Second call (after refresh) succeeds
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deviceId: 'dev-123', name: 'Device', status: 'online' }),
      } as Response);

      const result = await sdk.getDeviceById('dev-123');

      expect(result.deviceId).toBe('dev-123');
      expect(mockAuthAdapter.handle401).toHaveBeenCalledWith('northbound');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw timeout error', async () => {
      const shortTimeoutSdk = new FallbackSdk({
        authAdapter: mockAuthAdapter,
        baseProxyUrl: 'https://api.example.com',
        timeout: 100,
      });

      // Mock fetch to delay longer than timeout
      vi.mocked(global.fetch).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      await expect(shortTimeoutSdk.getDeviceById('dev-123')).rejects.toThrow('Request timeout');
    });
  });
});
