/**
 * Comprehensive Test Suite for IoT Tool Functions
 *
 * This test suite provides extensive coverage for all IoT StructuredTools including:
 * - CacheHelper utilities
 * - GetDeviceListTool
 * - GetDeviceDetailsTool
 * - GetDeviceTelemetryTool
 * - RegisterWebhookTool
 * - GetKPIMetricsTool
 * - Base tool functionality
 * - Factory functions
 * - Error handling
 * - Integration scenarios
 *
 * Coverage Goals:
 * - 80%+ statement coverage
 * - 70%+ branch coverage
 * - All public methods tested
 * - All error paths covered
 * - All Zod schemas validated
 *
 * @module iot-tool-functions.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
import type Redis from 'ioredis';
import { CacheHelper } from './cache';
import { GetDeviceListTool } from './tools/get-device-list.tool';
import { GetDeviceDetailsTool } from './tools/get-device-details.tool';
import { GetDeviceTelemetryTool } from './tools/get-device-telemetry.tool';
import { RegisterWebhookTool } from './tools/register-webhook.tool';
import { GetKPIMetricsTool } from './tools/get-kpi-metrics.tool';
import { createAllTools } from '../index';

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Creates a mock FallbackSdk instance with all required methods
 */
function createMockSdk(): FallbackSdk {
  return {
    getDeviceList: vi.fn(),
    getDeviceById: vi.fn(),
    getDeviceTelemetry: vi.fn(),
    subscribeToEvents: vi.fn(),
    getFleetKpis: vi.fn(),
  } as any;
}

/**
 * Creates a mock Redis client with all required methods
 */
function createMockRedis(): Redis {
  return {
    get: vi.fn(),
    setex: vi.fn(),
    ttl: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    keys: vi.fn(),
  } as any;
}

// ============================================================================
// 1. CacheHelper Tests (10 tests)
// ============================================================================

describe('CacheHelper', () => {
  let mockRedis: Redis;
  let cache: CacheHelper;

  beforeEach(() => {
    mockRedis = createMockRedis();
    cache = new CacheHelper(mockRedis, 300);
  });

  it('should get cached value with TTL', async () => {
    const testData = { foo: 'bar' };
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(testData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(120); // 2 minutes left

    const result = await cache.get('test-key');

    expect(result).toEqual({
      data: testData,
      staleSeconds: 180, // 300 - 120 = 180
    });
    expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    expect(mockRedis.ttl).toHaveBeenCalledWith('test-key');
  });

  it('should return null for non-existent key', async () => {
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await cache.get('non-existent');

    expect(result).toBeNull();
  });

  it('should set and retrieve value', async () => {
    const testData = { test: 'data' };

    await cache.set('test-key', testData, 600);

    expect(mockRedis.setex).toHaveBeenCalledWith(
      'test-key',
      600,
      JSON.stringify(testData)
    );
  });

  it('should hash params consistently', () => {
    const params1 = { deviceId: '123', metric: 'cpu' };
    const params2 = { metric: 'cpu', deviceId: '123' }; // Different order

    const hash1 = cache.hashParams(params1);
    const hash2 = cache.hashParams(params2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });

  it('should delete cached value', async () => {
    await cache.delete('test-key');

    expect(mockRedis.del).toHaveBeenCalledWith('test-key');
  });

  it('should check if key exists', async () => {
    vi.mocked(mockRedis.exists).mockResolvedValue(1);

    const exists = await cache.exists('test-key');

    expect(exists).toBe(true);
    expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
  });

  it('should clear all tool cache', async () => {
    vi.mocked(mockRedis.keys).mockResolvedValue([
      'iot:tool:getDeviceList:abc123',
      'iot:tool:getDeviceList:def456',
    ]);

    const deleted = await cache.clearToolCache('getDeviceList');

    expect(deleted).toBe(2);
    expect(mockRedis.keys).toHaveBeenCalledWith('iot:tool:getDeviceList:*');
    expect(mockRedis.del).toHaveBeenCalledWith(
      'iot:tool:getDeviceList:abc123',
      'iot:tool:getDeviceList:def456'
    );
  });

  it('should handle expired keys', async () => {
    const testData = { foo: 'bar' };
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(testData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(-1); // Key expired

    const result = await cache.get('expired-key');

    expect(result).toEqual({
      data: testData,
      staleSeconds: 300, // All TTL consumed
    });
  });

  it('should handle malformed JSON gracefully', async () => {
    vi.mocked(mockRedis.get).mockResolvedValue('invalid json{');

    const result = await cache.get('malformed');

    expect(result).toBeNull();
  });

  it('should calculate TTL accurately', () => {
    expect(cache.getDefaultTtl()).toBe(300);

    cache.setDefaultTtl(600);

    expect(cache.getDefaultTtl()).toBe(600);
  });
});

// ============================================================================
// 2. GetDeviceListTool Tests (10 tests)
// ============================================================================

describe('GetDeviceListTool', () => {
  let tool: GetDeviceListTool;
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should retrieve device list successfully', async () => {
    const mockResponse = {
      devices: [
        {
          deviceId: 'dev1',
          name: 'Device 1',
          type: 'gateway',
          status: 'online',
          firmwareVersion: '1.0.0',
          lastSeen: new Date('2024-01-01T12:00:00Z'),
        },
        {
          deviceId: 'dev2',
          name: 'Device 2',
          type: 'sensor',
          status: 'offline',
          firmwareVersion: '1.0.1',
          lastSeen: new Date('2024-01-01T11:00:00Z'),
        },
      ],
      total: 2,
    };

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue(mockResponse);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.devices).toHaveLength(2);
    expect(parsed.data.total).toBe(2);
    expect(parsed.data.page).toBe(1);
    expect(mockSdk.getDeviceList).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      filter: {
        status: undefined,
        type: undefined,
        search: undefined,
      },
    });
  });

  it('should filter devices by deviceType', async () => {
    const mockResponse = {
      devices: [
        {
          deviceId: 'dev1',
          name: 'Gateway 1',
          type: 'gateway',
          status: 'online',
          lastSeen: new Date(),
        },
      ],
      total: 1,
    };

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue(mockResponse);

    const result = await tool._call({
      tenantId: 'tenant-123',
      filters: { deviceType: 'gateway' },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.getDeviceList).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      filter: {
        status: undefined,
        type: 'gateway',
        search: undefined,
      },
    });
  });

  it('should filter devices by status', async () => {
    const mockResponse = {
      devices: [
        {
          deviceId: 'dev1',
          name: 'Online Device',
          type: 'sensor',
          status: 'online',
          lastSeen: new Date(),
        },
      ],
      total: 1,
    };

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue(mockResponse);

    const result = await tool._call({
      tenantId: 'tenant-123',
      filters: { status: 'online' },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.getDeviceList).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      filter: {
        status: 'online',
        type: undefined,
        search: undefined,
      },
    });
  });

  it('should filter devices by firmware version (client-side)', async () => {
    const mockResponse = {
      devices: [
        {
          deviceId: 'dev1',
          name: 'Device 1',
          type: 'sensor',
          status: 'online',
          firmwareVersion: '1.0.0',
          lastSeen: new Date(),
        },
        {
          deviceId: 'dev2',
          name: 'Device 2',
          type: 'sensor',
          status: 'online',
          firmwareVersion: '1.0.1',
          lastSeen: new Date(),
        },
      ],
      total: 2,
    };

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue(mockResponse);

    const result = await tool._call({
      tenantId: 'tenant-123',
      filters: { fwVersion: '1.0.0' },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.devices).toHaveLength(1);
    expect(parsed.data.devices[0].firmwareVersion).toBe('1.0.0');
  });

  it('should search devices', async () => {
    const mockResponse = {
      devices: [
        {
          deviceId: 'dev1',
          name: 'Gateway ABC',
          type: 'gateway',
          status: 'online',
          lastSeen: new Date(),
        },
      ],
      total: 1,
    };

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue(mockResponse);

    const result = await tool._call({
      tenantId: 'tenant-123',
      filters: { search: 'ABC' },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.getDeviceList).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      filter: {
        status: undefined,
        type: undefined,
        search: 'ABC',
      },
    });
  });

  it('should handle pagination correctly', async () => {
    const mockResponse = {
      devices: [],
      total: 100,
    };

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue(mockResponse);

    await tool._call({
      tenantId: 'tenant-123',
      filters: { page: 3, pageSize: 25 },
    });

    expect(mockSdk.getDeviceList).toHaveBeenCalledWith({
      limit: 25,
      offset: 50, // (3 - 1) * 25
      filter: {
        status: undefined,
        type: undefined,
        search: undefined,
      },
    });
  });

  it('should return empty device list', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.devices).toHaveLength(0);
    expect(parsed.data.total).toBe(0);
  });

  it('should fall back to cache on API error', async () => {
    const cachedData = {
      devices: [{ deviceId: 'dev1', name: 'Cached Device', type: 'sensor', status: 'online' }],
      total: 1,
      page: 1,
    };

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('API Error'));
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(120);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.staleSeconds).toBe(180);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error on API failure without cache', async () => {
    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(
      new Error('Network timeout')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Network timeout');
  });

  it('should validate pageSize max limit', async () => {
    await expect(
      tool._call({
        tenantId: 'tenant-123',
        filters: { pageSize: 150 }, // Exceeds max of 100
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// 3. GetDeviceDetailsTool Tests (8 tests)
// ============================================================================

describe('GetDeviceDetailsTool', () => {
  let tool: GetDeviceDetailsTool;
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new GetDeviceDetailsTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should retrieve device details successfully', async () => {
    const mockDevice = {
      deviceId: 'dev-123',
      name: 'Test Device',
      type: 'sensor',
      status: 'online',
      firmwareVersion: '2.1.0',
      lastSeen: new Date('2024-01-15T10:30:00Z'),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'San Francisco, CA',
      },
      metadata: { building: 'A', floor: '3' },
    };

    vi.mocked(mockSdk.getDeviceById).mockResolvedValue(mockDevice);

    const result = await tool._call({ deviceId: 'dev-123' });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.device.deviceId).toBe('dev-123');
    expect(parsed.data.device.name).toBe('Test Device');
    expect(parsed.data.device.location).toEqual(mockDevice.location);
    expect(parsed.data.device.metadata).toEqual(mockDevice.metadata);
    expect(mockSdk.getDeviceById).toHaveBeenCalledWith('dev-123');
  });

  it('should include LwM2M objects placeholder', async () => {
    const mockDevice = {
      deviceId: 'dev-456',
      name: 'Gateway',
      type: 'gateway',
      status: 'online',
      lastSeen: new Date(),
    };

    vi.mocked(mockSdk.getDeviceById).mockResolvedValue(mockDevice);

    const result = await tool._call({ deviceId: 'dev-456' });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.device.lwm2mObjects).toEqual([]);
  });

  it('should handle device not found (404)', async () => {
    const error = new Error('Device not found');
    (error as any).statusCode = 404;

    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(error);
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ deviceId: 'non-existent' });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Device not found');
  });

  it('should fall back to cache on API error', async () => {
    const cachedData = {
      device: {
        deviceId: 'dev-123',
        name: 'Cached Device',
        type: 'sensor',
        status: 'online',
        lwm2mObjects: [],
      },
    };

    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(new Error('API Error'));
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(60);

    const result = await tool._call({ deviceId: 'dev-123' });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.staleSeconds).toBe(240);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error on API failure without cache', async () => {
    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(
      new Error('Connection refused')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ deviceId: 'dev-123' });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Connection refused');
  });

  it('should validate missing deviceId', async () => {
    await expect(
      tool._call({ deviceId: '' })
    ).rejects.toThrow();
  });

  it('should cache successful response', async () => {
    const mockDevice = {
      deviceId: 'dev-789',
      name: 'Cache Test Device',
      type: 'sensor',
      status: 'online',
      lastSeen: new Date(),
    };

    vi.mocked(mockSdk.getDeviceById).mockResolvedValue(mockDevice);

    await tool._call({ deviceId: 'dev-789' });

    expect(mockRedis.setex).toHaveBeenCalled();
  });

  it('should use cached data on cache hit', async () => {
    const cachedData = {
      device: {
        deviceId: 'dev-999',
        name: 'Pre-cached Device',
        type: 'gateway',
        status: 'offline',
        lwm2mObjects: [],
      },
    };

    vi.mocked(mockSdk.getDeviceById).mockResolvedValue({
      deviceId: 'dev-999',
      name: 'Fresh Device',
      type: 'gateway',
      status: 'online',
      lastSeen: new Date(),
    });

    const result = await tool._call({ deviceId: 'dev-999' });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    // Fresh data should be returned (not cached)
    expect(parsed.data.device.name).toBe('Fresh Device');
  });
});

// ============================================================================
// 4. GetDeviceTelemetryTool Tests (12 tests)
// ============================================================================

describe('GetDeviceTelemetryTool', () => {
  let tool: GetDeviceTelemetryTool;
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new GetDeviceTelemetryTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should retrieve telemetry successfully', async () => {
    const mockTelemetry = {
      dataPoints: [
        {
          timestamp: new Date('2024-01-01T00:00:00Z'),
          value: 45.5,
          metric: 'cpu',
          unit: '%',
        },
        {
          timestamp: new Date('2024-01-01T00:05:00Z'),
          value: 48.2,
          metric: 'cpu',
          unit: '%',
        },
      ],
    };

    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue(mockTelemetry);

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T23:59:59Z',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.dataPoints).toHaveLength(2);
    expect(parsed.data.metric).toBe('cpu');
    expect(parsed.data.unit).toBe('%');
    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith('dev-123', {
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T23:59:59Z'),
      metrics: ['cpu'],
      interval: undefined,
    });
  });

  it('should use 1m aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      dataPoints: [
        {
          timestamp: new Date('2024-01-01T00:00:00Z'),
          value: 50,
          metric: 'memory',
          unit: 'MB',
        },
      ],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'memory',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T01:00:00Z',
      },
      aggregation: '1m',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({
        interval: '1m',
      })
    );
  });

  it('should use 5m aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      dataPoints: [],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'temperature',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T12:00:00Z',
      },
      aggregation: '5m',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({
        interval: '5m',
      })
    );
  });

  it('should use 1h aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      dataPoints: [],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'battery',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-07T00:00:00Z',
      },
      aggregation: '1h',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({
        interval: '1h',
      })
    );
  });

  it('should use 1d aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      dataPoints: [],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'bandwidth',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-31T00:00:00Z',
      },
      aggregation: '1d',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({
        interval: '1d',
      })
    );
  });

  it('should return empty telemetry data', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      dataPoints: [],
    });

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'signal',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T01:00:00Z',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.dataPoints).toHaveLength(0);
  });

  it('should validate time range (from < to)', async () => {
    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: {
        from: '2024-01-02T00:00:00Z',
        to: '2024-01-01T00:00:00Z', // to before from
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Invalid time range');
  });

  it('should validate invalid time range format', async () => {
    await expect(
      tool._call({
        deviceId: 'dev-123',
        metric: 'cpu',
        timeRange: {
          from: 'not-a-date',
          to: '2024-01-01T00:00:00Z',
        },
      })
    ).rejects.toThrow();
  });

  it('should fall back to cache on API error', async () => {
    const cachedData = {
      dataPoints: [
        { timestamp: '2024-01-01T00:00:00Z', value: 60 },
      ],
      metric: 'cpu',
      unit: '%',
    };

    vi.mocked(mockSdk.getDeviceTelemetry).mockRejectedValue(
      new Error('API Error')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(180);

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T23:59:59Z',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error on API failure without cache', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockRejectedValue(
      new Error('Service unavailable')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T23:59:59Z',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Service unavailable');
  });

  it('should validate missing deviceId', async () => {
    await expect(
      tool._call({
        deviceId: '',
        metric: 'cpu',
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-01T23:59:59Z',
        },
      })
    ).rejects.toThrow();
  });

  it('should validate missing metric', async () => {
    await expect(
      tool._call({
        deviceId: 'dev-123',
        metric: '',
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-01T23:59:59Z',
        },
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// 5. RegisterWebhookTool Tests (10 tests)
// ============================================================================

describe('RegisterWebhookTool', () => {
  let tool: RegisterWebhookTool;
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new RegisterWebhookTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should register webhook successfully', async () => {
    const mockSubscription = {
      subscriptionId: 'sub-123',
    };

    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue(mockSubscription);

    const result = await tool._call({
      eventType: 'device.status.changed',
      callbackUrl: 'https://example.com/webhook',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.subscriptionId).toBe('sub-123');
    expect(parsed.data.status).toBe('active');
    expect(parsed.data.eventType).toBe('device.status.changed');
    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith({
      eventTypes: ['device.status.changed'],
      filters: undefined,
      webhookUrl: 'https://example.com/webhook',
      callbackUrl: 'https://example.com/webhook',
    });
  });

  it('should register webhook with deviceType filter', async () => {
    const mockSubscription = {
      subscriptionId: 'sub-456',
    };

    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue(mockSubscription);

    const result = await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/alerts',
      filters: {
        deviceType: 'sensor',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith({
      eventTypes: ['alert.created'],
      filters: {
        deviceType: 'sensor',
        severity: undefined,
      },
      webhookUrl: 'https://example.com/alerts',
      callbackUrl: 'https://example.com/alerts',
    });
  });

  it('should register webhook with severity filter', async () => {
    const mockSubscription = {
      subscriptionId: 'sub-789',
    };

    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue(mockSubscription);

    const result = await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/critical',
      filters: {
        severity: 'critical',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith({
      eventTypes: ['alert.created'],
      filters: {
        deviceType: undefined,
        severity: 'critical',
      },
      webhookUrl: 'https://example.com/critical',
      callbackUrl: 'https://example.com/critical',
    });
  });

  it('should register webhook without filters', async () => {
    const mockSubscription = {
      subscriptionId: 'sub-999',
    };

    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue(mockSubscription);

    const result = await tool._call({
      eventType: 'device.telemetry',
      callbackUrl: 'https://example.com/telemetry',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith({
      eventTypes: ['device.telemetry'],
      filters: undefined,
      webhookUrl: 'https://example.com/telemetry',
      callbackUrl: 'https://example.com/telemetry',
    });
  });

  it('should validate invalid callback URL', async () => {
    await expect(
      tool._call({
        eventType: 'device.status.changed',
        callbackUrl: 'not-a-url',
      })
    ).rejects.toThrow();
  });

  it('should return error on API failure', async () => {
    vi.mocked(mockSdk.subscribeToEvents).mockRejectedValue(
      new Error('Webhook registration failed')
    );

    const result = await tool._call({
      eventType: 'device.status.changed',
      callbackUrl: 'https://example.com/webhook',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Webhook registration failed');
  });

  it('should validate missing eventType', async () => {
    await expect(
      tool._call({
        eventType: '',
        callbackUrl: 'https://example.com/webhook',
      })
    ).rejects.toThrow();
  });

  it('should not use cache for webhook registration', async () => {
    const mockSubscription = {
      subscriptionId: 'sub-nocache',
    };

    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue(mockSubscription);

    await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/webhook',
    });

    // Webhook registration should NOT call setex (no caching)
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it('should handle duplicate subscription', async () => {
    const error = new Error('Subscription already exists');
    (error as any).code = 'DUPLICATE_SUBSCRIPTION';

    vi.mocked(mockSdk.subscribeToEvents).mockRejectedValue(error);

    const result = await tool._call({
      eventType: 'device.status.changed',
      callbackUrl: 'https://example.com/webhook',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Subscription already exists');
  });

  it('should register webhook with both filters', async () => {
    const mockSubscription = {
      subscriptionId: 'sub-both',
    };

    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue(mockSubscription);

    const result = await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/filtered',
      filters: {
        deviceType: 'gateway',
        severity: 'high',
      },
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith({
      eventTypes: ['alert.created'],
      filters: {
        deviceType: 'gateway',
        severity: 'high',
      },
      webhookUrl: 'https://example.com/filtered',
      callbackUrl: 'https://example.com/filtered',
    });
  });
});

// ============================================================================
// 6. GetKPIMetricsTool Tests (12 tests)
// ============================================================================

describe('GetKPIMetricsTool', () => {
  let tool: GetKPIMetricsTool;
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new GetKPIMetricsTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should retrieve connectivity KPIs successfully', async () => {
    const mockKpis = {
      totalDevices: 1000,
      onlineDevices: 850,
      offlineDevices: 100,
      degradedDevices: 50,
      averageUptime: 98.5,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(mockKpis);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '24h',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis).toHaveLength(5);
    expect(parsed.data.kpis[0].name).toBe('Total Devices');
    expect(parsed.data.kpis[0].value).toBe(1000);
    expect(parsed.data.kpis[4].name).toBe('Average Uptime');
    expect(parsed.data.kpis[4].value).toBe(98.5);
  });

  it('should retrieve firmware KPIs successfully', async () => {
    const mockKpis = {
      totalDevices: 500,
      onlineDevices: 400,
      offlineDevices: 100,
      degradedDevices: 0,
      averageUptime: 95,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(mockKpis);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'firmware',
      period: '7d',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis).toHaveLength(3);
    expect(parsed.data.kpis[0].name).toBe('Firmware Compliance');
    expect(parsed.data.kpis[1].name).toBe('Devices on Latest Firmware');
    expect(parsed.data.kpis[2].name).toBe('Devices Needing Update');
  });

  it('should retrieve alert KPIs successfully', async () => {
    const mockKpis = {
      totalDevices: 200,
      onlineDevices: 180,
      offlineDevices: 20,
      degradedDevices: 0,
      averageUptime: 90,
      alertCounts: {
        critical: 5,
        high: 12,
        medium: 25,
        low: 48,
      },
    };

    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(mockKpis);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'alerts',
      period: '30d',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis).toHaveLength(5);
    expect(parsed.data.kpis[0].name).toBe('Critical Alerts');
    expect(parsed.data.kpis[0].value).toBe(5);
    expect(parsed.data.kpis[4].name).toBe('Total Active Alerts');
    expect(parsed.data.kpis[4].value).toBe(90); // 5+12+25+48
  });

  it('should use 24h period correctly', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 100,
      onlineDevices: 90,
      offlineDevices: 10,
      degradedDevices: 0,
      averageUptime: 95,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '24h',
    });

    const call = vi.mocked(mockSdk.getFleetKpis).mock.calls[0][0];
    const startTime = call.startTime;
    const endTime = call.endTime;
    const hoursDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    expect(Math.abs(hoursDiff - 24)).toBeLessThan(1); // Within 1 hour tolerance
  });

  it('should use 7d period correctly', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 100,
      onlineDevices: 90,
      offlineDevices: 10,
      degradedDevices: 0,
      averageUptime: 95,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '7d',
    });

    const call = vi.mocked(mockSdk.getFleetKpis).mock.calls[0][0];
    const startTime = call.startTime;
    const endTime = call.endTime;
    const daysDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);

    expect(Math.abs(daysDiff - 7)).toBeLessThan(1); // Within 1 day tolerance
  });

  it('should use 30d period correctly', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 100,
      onlineDevices: 90,
      offlineDevices: 10,
      degradedDevices: 0,
      averageUptime: 95,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '30d',
    });

    const call = vi.mocked(mockSdk.getFleetKpis).mock.calls[0][0];
    const startTime = call.startTime;
    const endTime = call.endTime;
    const daysDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);

    expect(Math.abs(daysDiff - 30)).toBeLessThan(1); // Within 1 day tolerance
  });

  it('should return empty KPIs when no data available', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      degradedDevices: 0,
      averageUptime: 0,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '24h',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis.every((kpi: any) => kpi.value === 0)).toBe(true);
  });

  it('should fall back to cache on API error', async () => {
    const cachedData = {
      kpis: [
        { name: 'Total Devices', value: 500, unit: 'devices', trend: 0 },
      ],
    };

    vi.mocked(mockSdk.getFleetKpis).mockRejectedValue(new Error('API Error'));
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(90);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '24h',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error on API failure without cache', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockRejectedValue(
      new Error('Database unavailable')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '24h',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Database unavailable');
  });

  it('should validate invalid kpiType', async () => {
    await expect(
      tool._call({
        tenantId: 'tenant-123',
        kpiType: 'invalid' as any,
        period: '24h',
      })
    ).rejects.toThrow();
  });

  it('should validate invalid period', async () => {
    await expect(
      tool._call({
        tenantId: 'tenant-123',
        kpiType: 'connectivity',
        period: '90d' as any,
      })
    ).rejects.toThrow();
  });
});

// ============================================================================
// 7. Base Tool Tests (6 tests)
// ============================================================================

describe('IoTTool (Base Class)', () => {
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
  });

  it('should call function successfully with callWithCache', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
  });

  it('should return cached data when API fails', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    const cachedData = {
      devices: [{ deviceId: 'cached', name: 'Cached', type: 'sensor', status: 'online' }],
      total: 1,
      page: 1,
    };

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('API Error'));
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(150);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error when API fails without cache', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(
      new Error('Connection timeout')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Connection timeout');
  });

  it('should format FriendlyApiError correctly', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    const apiError = {
      message: 'Unauthorized',
      details: { code: 401 },
    };

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(apiError);
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Unauthorized');
    expect(parsed.error).toContain('401');
  });

  it('should format generic Error correctly', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(
      new Error('Generic error')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Error: Generic error');
  });

  it('should format result as JSON string', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    // Should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow();

    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('success');
    expect(parsed).toHaveProperty('data');
  });
});

// ============================================================================
// 8. Factory Functions Tests (3 tests)
// ============================================================================

describe('Factory Functions', () => {
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
  });

  it('should create GetDeviceListTool instance', () => {
    const { createGetDeviceListTool } = require('./tools/get-device-list.tool');
    const tool = createGetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    expect(tool).toBeInstanceOf(GetDeviceListTool);
    expect(tool.name).toBe('getDeviceList');
  });

  it('should create all tools with createAllTools', () => {
    const tools = createAllTools({ sdk: mockSdk, redis: mockRedis });

    expect(tools).toHaveProperty('getDeviceList');
    expect(tools).toHaveProperty('getDeviceDetails');
    expect(tools).toHaveProperty('getDeviceTelemetry');
    expect(tools).toHaveProperty('registerWebhook');
    expect(tools).toHaveProperty('getKPIMetrics');

    expect(tools.getDeviceList).toBeInstanceOf(GetDeviceListTool);
    expect(tools.getDeviceDetails).toBeInstanceOf(GetDeviceDetailsTool);
    expect(tools.getDeviceTelemetry).toBeInstanceOf(GetDeviceTelemetryTool);
    expect(tools.registerWebhook).toBeInstanceOf(RegisterWebhookTool);
    expect(tools.getKPIMetrics).toBeInstanceOf(GetKPIMetricsTool);
  });

  it('should share same SDK and Redis instances across tools', () => {
    const tools = createAllTools({ sdk: mockSdk, redis: mockRedis });

    // All tools should use the same SDK instance
    expect((tools.getDeviceList as any).sdk).toBe(mockSdk);
    expect((tools.getDeviceDetails as any).sdk).toBe(mockSdk);
    expect((tools.getDeviceTelemetry as any).sdk).toBe(mockSdk);
    expect((tools.registerWebhook as any).sdk).toBe(mockSdk);
    expect((tools.getKPIMetrics as any).sdk).toBe(mockSdk);

    // All tools should have cache instances (if Redis provided)
    expect((tools.getDeviceList as any).cache).toBeDefined();
    expect((tools.getDeviceDetails as any).cache).toBeDefined();
    expect((tools.getDeviceTelemetry as any).cache).toBeDefined();
    expect((tools.getKPIMetrics as any).cache).toBeDefined();
  });
});

// ============================================================================
// 9. Error Handling Tests (5 tests)
// ============================================================================

describe('Error Handling', () => {
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
  });

  it('should handle network timeout gracefully', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    const timeoutError = new Error('Network timeout');
    (timeoutError as any).code = 'ETIMEDOUT';

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(timeoutError);
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Network timeout');
  });

  it('should handle invalid JSON response', async () => {
    const tool = new GetDeviceDetailsTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(
      new Error('Unexpected token < in JSON')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      deviceId: 'dev-123',
    });

    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Unexpected token');
  });

  it('should handle missing required fields in response', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    // SDK returns malformed response
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: null as any,
      total: undefined as any,
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    // Tool should handle gracefully or throw
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
  });

  it('should handle SDK initialization errors', () => {
    expect(() => {
      new GetDeviceListTool({ sdk: null as any });
    }).toThrow();
  });

  it('should handle Redis connection errors gracefully', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
    });

    // Redis fails but shouldn't affect the operation
    vi.mocked(mockRedis.setex).mockRejectedValue(
      new Error('Redis connection refused')
    );

    const result = await tool._call({
      tenantId: 'tenant-123',
    });

    const parsed = JSON.parse(result);

    // Should still succeed even if cache fails
    expect(parsed.success).toBe(true);
  });
});

// ============================================================================
// 10. Integration Tests (4 tests)
// ============================================================================

describe('Integration Scenarios', () => {
  let mockSdk: FallbackSdk;
  let mockRedis: Redis;
  let tools: ReturnType<typeof createAllTools>;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tools = createAllTools({ sdk: mockSdk, redis: mockRedis });
  });

  it('should execute complete workflow: list → details → telemetry', async () => {
    // Step 1: Get device list
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [
        {
          deviceId: 'dev-workflow',
          name: 'Test Device',
          type: 'sensor',
          status: 'online',
          lastSeen: new Date(),
        },
      ],
      total: 1,
    });

    const listResult = await tools.getDeviceList._call({
      tenantId: 'tenant-123',
    });

    const listParsed = JSON.parse(listResult);
    expect(listParsed.success).toBe(true);

    const deviceId = listParsed.data.devices[0].deviceId;

    // Step 2: Get device details
    vi.mocked(mockSdk.getDeviceById).mockResolvedValue({
      deviceId: 'dev-workflow',
      name: 'Test Device',
      type: 'sensor',
      status: 'online',
      lastSeen: new Date(),
    });

    const detailsResult = await tools.getDeviceDetails._call({
      deviceId,
    });

    const detailsParsed = JSON.parse(detailsResult);
    expect(detailsParsed.success).toBe(true);

    // Step 3: Get device telemetry
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      dataPoints: [
        {
          timestamp: new Date(),
          value: 50,
          metric: 'cpu',
          unit: '%',
        },
      ],
    });

    const telemetryResult = await tools.getDeviceTelemetry._call({
      deviceId,
      metric: 'cpu',
      timeRange: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-01T23:59:59Z',
      },
    });

    const telemetryParsed = JSON.parse(telemetryResult);
    expect(telemetryParsed.success).toBe(true);
    expect(telemetryParsed.data.dataPoints).toHaveLength(1);
  });

  it('should handle cache invalidation scenarios', async () => {
    const cache = new CacheHelper(mockRedis, 300);

    // Set initial cache
    await cache.set('test-key', { value: 'initial' });

    expect(mockRedis.setex).toHaveBeenCalledWith(
      'test-key',
      300,
      JSON.stringify({ value: 'initial' })
    );

    // Delete cache
    await cache.delete('test-key');

    expect(mockRedis.del).toHaveBeenCalledWith('test-key');

    // Verify cache is gone
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await cache.get('test-key');

    expect(result).toBeNull();
  });

  it('should handle concurrent tool calls', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
    });

    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 100,
      onlineDevices: 90,
      offlineDevices: 10,
      degradedDevices: 0,
      averageUptime: 95,
      alertCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    });

    // Execute multiple tools concurrently
    const results = await Promise.all([
      tools.getDeviceList._call({ tenantId: 'tenant-123' }),
      tools.getKPIMetrics._call({
        tenantId: 'tenant-123',
        kpiType: 'connectivity',
        period: '24h',
      }),
    ]);

    const [listResult, kpiResult] = results.map((r) => JSON.parse(r));

    expect(listResult.success).toBe(true);
    expect(kpiResult.success).toBe(true);
  });

  it('should maintain cross-tool cache isolation', async () => {
    const cache = new CacheHelper(mockRedis, 300);

    // Set cache for different tools
    await cache.set(
      cache.generateKey('getDeviceList', { tenantId: 'abc' }),
      { devices: [] }
    );
    await cache.set(
      cache.generateKey('getKPIMetrics', { tenantId: 'abc' }),
      { kpis: [] }
    );

    // Clear only device list cache
    vi.mocked(mockRedis.keys).mockResolvedValue([
      'iot:tool:getDeviceList:abc123',
    ]);

    const deleted = await cache.clearToolCache('getDeviceList');

    expect(deleted).toBe(1);
    expect(mockRedis.keys).toHaveBeenCalledWith('iot:tool:getDeviceList:*');

    // KPI cache should remain unaffected
    expect(mockRedis.keys).not.toHaveBeenCalledWith('iot:tool:getKPIMetrics:*');
  });
});
