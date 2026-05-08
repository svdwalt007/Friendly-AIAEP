/**
 * Comprehensive Test Suite for IoT Tool Functions
 *
 * Tests all IoT StructuredTools, CacheHelper, base tool functionality,
 * factory functions, error handling, and integration scenarios.
 *
 * Coverage: 100% line and branch coverage target.
 *
 * @module iot-tool-functions.spec
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import { CacheHelper } from './cache';
import { GetDeviceListTool } from './tools/get-device-list.tool';
import { GetDeviceDetailsTool } from './tools/get-device-details.tool';
import { GetDeviceTelemetryTool } from './tools/get-device-telemetry.tool';
import { RegisterWebhookTool } from './tools/register-webhook.tool';
import { GetKPIMetricsTool } from './tools/get-kpi-metrics.tool';
import {
  createAllTools,
  createGetDeviceListTool,
  createGetDeviceDetailsTool,
  createGetDeviceTelemetryTool,
  createRegisterWebhookTool,
  createGetKPIMetricsTool,
  MODULE_NAME,
} from '../index';
import type { IoTSdk, ToolConfig } from './types';

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Creates a mock IoTSdk instance with all required methods
 */
function createMockSdk(): IoTSdk {
  return {
    getDeviceList: vi.fn(),
    getDeviceById: vi.fn(),
    getDeviceTelemetry: vi.fn(),
    subscribeToEvents: vi.fn(),
    getFleetKpis: vi.fn(),
  };
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
// 1. CacheHelper Tests
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
    vi.mocked(mockRedis.ttl).mockResolvedValue(120);

    const result = await cache.get('test-key');

    expect(result).toEqual({
      data: testData,
      staleSeconds: 180, // 300 - 120
    });
    expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    expect(mockRedis.ttl).toHaveBeenCalledWith('test-key');
  });

  it('should return null for non-existent key', async () => {
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await cache.get('non-existent');

    expect(result).toBeNull();
  });

  it('should set value with custom TTL', async () => {
    const testData = { test: 'data' };

    await cache.set('test-key', testData, 600);

    expect(mockRedis.setex).toHaveBeenCalledWith(
      'test-key',
      600,
      JSON.stringify(testData)
    );
  });

  it('should set value with default TTL', async () => {
    const testData = { test: 'data' };

    await cache.set('test-key', testData);

    expect(mockRedis.setex).toHaveBeenCalledWith(
      'test-key',
      300,
      JSON.stringify(testData)
    );
  });

  it('should hash params consistently regardless of key order', () => {
    const params1 = { deviceId: '123', metric: 'cpu' };
    const params2 = { metric: 'cpu', deviceId: '123' };

    const hash1 = cache.hashParams(params1);
    const hash2 = cache.hashParams(params2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });

  it('should generate different hashes for different params', () => {
    const hash1 = cache.hashParams({ a: 1 });
    const hash2 = cache.hashParams({ a: 2 });

    expect(hash1).not.toBe(hash2);
  });

  it('should handle hash params fallback for non-object input', () => {
    // When params can't be JSON.stringify'd with sorted keys, fallback is used
    const hash = cache.hashParams('simple-string');
    expect(hash).toHaveLength(16);
  });

  it('should use fallback hash when Object.keys fails', () => {
    // Create an object that throws on Object.keys during JSON.stringify replacer
    const badParams = new Proxy({}, {
      ownKeys() {
        throw new Error('Cannot enumerate keys');
      },
    });

    const hash = cache.hashParams(badParams);
    expect(hash).toHaveLength(16);
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

  it('should return false for non-existent key', async () => {
    vi.mocked(mockRedis.exists).mockResolvedValue(0);

    const exists = await cache.exists('missing');

    expect(exists).toBe(false);
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

  it('should return 0 when no keys to clear', async () => {
    vi.mocked(mockRedis.keys).mockResolvedValue([]);

    const deleted = await cache.clearToolCache('noSuchTool');

    expect(deleted).toBe(0);
  });

  it('should handle expired keys (ttl = -1)', async () => {
    const testData = { foo: 'bar' };
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(testData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(-1);

    const result = await cache.get('expired-key');

    expect(result).toEqual({
      data: testData,
      staleSeconds: 300,
    });
  });

  it('should handle staleSeconds = 0 for fresh cache (ttl = defaultTtl)', async () => {
    const testData = { foo: 'bar' };
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(testData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(300); // Full TTL remaining

    const result = await cache.get('fresh-key');

    expect(result).toEqual({
      data: testData,
      staleSeconds: 0,
    });
  });

  it('should handle malformed JSON gracefully', async () => {
    vi.mocked(mockRedis.get).mockResolvedValue('invalid json{');

    const result = await cache.get('malformed');

    expect(result).toBeNull();
  });

  it('should manage default TTL via getter/setter', () => {
    expect(cache.getDefaultTtl()).toBe(300);

    cache.setDefaultTtl(600);

    expect(cache.getDefaultTtl()).toBe(600);
  });

  it('should generate cache key in correct format', () => {
    const key = cache.generateKey('myTool', { id: '123' });

    expect(key).toMatch(/^iot:tool:myTool:[a-f0-9]{16}$/);
  });

  it('should handle Redis get error gracefully', async () => {
    vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis down'));

    const result = await cache.get('test');

    expect(result).toBeNull();
  });

  it('should handle Redis set error gracefully', async () => {
    vi.mocked(mockRedis.setex).mockRejectedValue(new Error('Redis down'));

    // Should not throw
    await expect(cache.set('key', { data: 1 })).resolves.toBeUndefined();
  });

  it('should handle Redis delete error gracefully', async () => {
    vi.mocked(mockRedis.del).mockRejectedValue(new Error('Redis down'));

    await expect(cache.delete('key')).resolves.toBeUndefined();
  });

  it('should handle Redis exists error gracefully', async () => {
    vi.mocked(mockRedis.exists).mockRejectedValue(new Error('Redis down'));

    const result = await cache.exists('key');

    expect(result).toBe(false);
  });

  it('should handle Redis keys error in clearToolCache', async () => {
    vi.mocked(mockRedis.keys).mockRejectedValue(new Error('Redis down'));

    const deleted = await cache.clearToolCache('tool');

    expect(deleted).toBe(0);
  });

  it('should use default TTL of 300 when not specified', () => {
    const defaultCache = new CacheHelper(mockRedis);

    expect(defaultCache.getDefaultTtl()).toBe(300);
  });

  it('should handle negative staleSeconds as 0', async () => {
    const testData = { foo: 'bar' };
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(testData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(500); // More than maxAge

    const result = await cache.get('very-fresh');

    expect(result!.staleSeconds).toBe(0);
  });
});

// ============================================================================
// 2. GetDeviceListTool Tests
// ============================================================================

describe('GetDeviceListTool', () => {
  let tool: GetDeviceListTool;
  let mockSdk: IoTSdk;
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
      limit: 20,
      offset: 0,
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
    expect(parsed.data.devices[0].lastSeen).toBe('2024-01-01T12:00:00.000Z');
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
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
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
      limit: 20,
      offset: 0,
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
      filters: { deviceType: 'gateway' },
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(mockSdk.getDeviceList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ type: 'gateway' }),
      })
    );
  });

  it('should filter devices by status', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    await tool._call({
      tenantId: 'tenant-123',
      filters: { status: 'online' },
    });

    expect(mockSdk.getDeviceList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ status: 'online' }),
      })
    );
  });

  it('should filter devices by firmware version (client-side)', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [
        { deviceId: 'dev1', name: 'D1', type: 'sensor', status: 'online', firmwareVersion: '1.0.0', lastSeen: new Date() },
        { deviceId: 'dev2', name: 'D2', type: 'sensor', status: 'online', firmwareVersion: '1.0.1', lastSeen: new Date() },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });

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
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    await tool._call({
      tenantId: 'tenant-123',
      filters: { search: 'ABC' },
    });

    expect(mockSdk.getDeviceList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ search: 'ABC' }),
      })
    );
  });

  it('should handle pagination correctly', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 100,
      limit: 25,
      offset: 50,
    });

    const result = await tool._call({
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
    const parsed = JSON.parse(result);
    expect(parsed.data.page).toBe(3);
  });

  it('should return empty device list', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const result = await tool._call({ tenantId: 'tenant-123' });
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

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.staleSeconds).toBe(180);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error on API failure without cache', async () => {
    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('Network timeout'));
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Network timeout');
  });

  it('should handle devices without lastSeen', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [
        { deviceId: 'dev1', name: 'No LastSeen', type: 'sensor', status: 'online' },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.devices[0].lastSeen).toBeUndefined();
  });

  it('should have correct name and description', () => {
    expect(tool.name).toBe('getDeviceList');
    expect(tool.description).toContain('paginated list');
  });
});

// ============================================================================
// 3. GetDeviceDetailsTool Tests
// ============================================================================

describe('GetDeviceDetailsTool', () => {
  let tool: GetDeviceDetailsTool;
  let mockSdk: IoTSdk;
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
    expect(parsed.data.device.lastSeen).toBe('2024-01-15T10:30:00.000Z');
    expect(mockSdk.getDeviceById).toHaveBeenCalledWith('dev-123');
  });

  it('should include empty LwM2M objects array', async () => {
    vi.mocked(mockSdk.getDeviceById).mockResolvedValue({
      deviceId: 'dev-456',
      name: 'Gateway',
      type: 'gateway',
      status: 'online',
      lastSeen: new Date(),
    });

    const result = await tool._call({ deviceId: 'dev-456' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.device.lwm2mObjects).toEqual([]);
  });

  it('should handle device not found (404)', async () => {
    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(new Error('Device not found'));
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
    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(new Error('Connection refused'));
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ deviceId: 'dev-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Connection refused');
  });

  it('should cache successful response', async () => {
    vi.mocked(mockSdk.getDeviceById).mockResolvedValue({
      deviceId: 'dev-789',
      name: 'Cache Test Device',
      type: 'sensor',
      status: 'online',
      lastSeen: new Date(),
    });

    await tool._call({ deviceId: 'dev-789' });

    expect(mockRedis.setex).toHaveBeenCalled();
  });

  it('should return fresh data even when cache exists', async () => {
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
    expect(parsed.data.device.name).toBe('Fresh Device');
  });

  it('should handle device without optional fields', async () => {
    vi.mocked(mockSdk.getDeviceById).mockResolvedValue({
      deviceId: 'dev-min',
      name: 'Minimal Device',
      type: 'sensor',
      status: 'unknown',
    });

    const result = await tool._call({ deviceId: 'dev-min' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.data.device.firmwareVersion).toBeUndefined();
    expect(parsed.data.device.location).toBeUndefined();
    expect(parsed.data.device.metadata).toBeUndefined();
  });

  it('should have correct name and description', () => {
    expect(tool.name).toBe('getDeviceDetails');
    expect(tool.description).toContain('detailed information');
  });
});

// ============================================================================
// 4. GetDeviceTelemetryTool Tests
// ============================================================================

describe('GetDeviceTelemetryTool', () => {
  let tool: GetDeviceTelemetryTool;
  let mockSdk: IoTSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new GetDeviceTelemetryTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should retrieve telemetry successfully', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-123',
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T23:59:59Z'),
      dataPoints: [
        { timestamp: new Date('2024-01-01T00:00:00Z'), value: 45.5, metric: 'cpu', unit: '%' },
        { timestamp: new Date('2024-01-01T00:05:00Z'), value: 48.2, metric: 'cpu', unit: '%' },
      ],
    });

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
      deviceId: 'dev-123',
      startTime: new Date(),
      endTime: new Date(),
      dataPoints: [
        { timestamp: new Date(), value: 50, metric: 'memory', unit: 'MB' },
      ],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'memory',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T01:00:00Z' },
      aggregation: '1m',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({ interval: '1m' })
    );
  });

  it('should use 5m aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-123', startTime: new Date(), endTime: new Date(), dataPoints: [],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'temperature',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T12:00:00Z' },
      aggregation: '5m',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({ interval: '5m' })
    );
  });

  it('should use 1h aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-123', startTime: new Date(), endTime: new Date(), dataPoints: [],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'battery',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-07T00:00:00Z' },
      aggregation: '1h',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({ interval: '1h' })
    );
  });

  it('should use 1d aggregation', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-123', startTime: new Date(), endTime: new Date(), dataPoints: [],
    });

    await tool._call({
      deviceId: 'dev-123',
      metric: 'bandwidth',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-31T00:00:00Z' },
      aggregation: '1d',
    });

    expect(mockSdk.getDeviceTelemetry).toHaveBeenCalledWith(
      'dev-123',
      expect.objectContaining({ interval: '1d' })
    );
  });

  it('should return empty telemetry data', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-123', startTime: new Date(), endTime: new Date(), dataPoints: [],
    });

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'signal',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T01:00:00Z' },
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.dataPoints).toHaveLength(0);
    expect(parsed.data.unit).toBe('');
  });

  it('should reject invalid time range (from >= to)', async () => {
    // The tool catches this as an error through callWithCache
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: {
        from: '2024-01-02T00:00:00Z',
        to: '2024-01-01T00:00:00Z',
      },
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Invalid time range');
  });

  it('should fall back to cache on API error', async () => {
    const cachedData = {
      dataPoints: [{ timestamp: '2024-01-01T00:00:00Z', value: 60 }],
      metric: 'cpu',
      unit: '%',
    };

    vi.mocked(mockSdk.getDeviceTelemetry).mockRejectedValue(new Error('API Error'));
    vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedData));
    vi.mocked(mockRedis.ttl).mockResolvedValue(180);

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T23:59:59Z' },
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.cached).toBe(true);
    expect(parsed.data).toEqual(cachedData);
  });

  it('should return error on API failure without cache', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockRejectedValue(new Error('Service unavailable'));
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T23:59:59Z' },
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Service unavailable');
  });

  it('should filter data points by requested metric', async () => {
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-123',
      startTime: new Date(),
      endTime: new Date(),
      dataPoints: [
        { timestamp: new Date(), value: 50, metric: 'cpu', unit: '%' },
        { timestamp: new Date(), value: 1024, metric: 'memory', unit: 'MB' },
        { timestamp: new Date(), value: 55, metric: 'cpu', unit: '%' },
      ],
    });

    const result = await tool._call({
      deviceId: 'dev-123',
      metric: 'cpu',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T23:59:59Z' },
    });

    const parsed = JSON.parse(result);
    expect(parsed.data.dataPoints).toHaveLength(2);
    expect(parsed.data.metric).toBe('cpu');
  });

  it('should have correct name and description', () => {
    expect(tool.name).toBe('getDeviceTelemetry');
    expect(tool.description).toContain('time-series');
  });
});

// ============================================================================
// 5. RegisterWebhookTool Tests
// ============================================================================

describe('RegisterWebhookTool', () => {
  let tool: RegisterWebhookTool;
  let mockSdk: IoTSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new RegisterWebhookTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should register webhook successfully', async () => {
    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue({
      subscriptionId: 'sub-123',
      eventTypes: ['device.status.changed'],
      createdAt: new Date(),
    });

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
    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue({
      subscriptionId: 'sub-456',
      eventTypes: ['alert.created'],
      createdAt: new Date(),
    });

    const result = await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/alerts',
      filters: { deviceType: 'sensor' },
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith({
      eventTypes: ['alert.created'],
      filters: { deviceType: 'sensor', severity: undefined },
      webhookUrl: 'https://example.com/alerts',
      callbackUrl: 'https://example.com/alerts',
    });
  });

  it('should register webhook with severity filter', async () => {
    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue({
      subscriptionId: 'sub-789',
      eventTypes: ['alert.created'],
      createdAt: new Date(),
    });

    await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/critical',
      filters: { severity: 'critical' },
    });

    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { deviceType: undefined, severity: 'critical' },
      })
    );
  });

  it('should register webhook with both filters', async () => {
    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue({
      subscriptionId: 'sub-both',
      eventTypes: ['alert.created'],
      createdAt: new Date(),
    });

    await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/filtered',
      filters: { deviceType: 'gateway', severity: 'high' },
    });

    expect(mockSdk.subscribeToEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { deviceType: 'gateway', severity: 'high' },
      })
    );
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

  it('should not use cache for webhook registration', async () => {
    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue({
      subscriptionId: 'sub-nocache',
      eventTypes: ['alert.created'],
      createdAt: new Date(),
    });

    await tool._call({
      eventType: 'alert.created',
      callbackUrl: 'https://example.com/webhook',
    });

    // Webhook registration should NOT call setex (no caching)
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it('should handle duplicate subscription error', async () => {
    vi.mocked(mockSdk.subscribeToEvents).mockRejectedValue(
      new Error('Subscription already exists')
    );

    const result = await tool._call({
      eventType: 'device.status.changed',
      callbackUrl: 'https://example.com/webhook',
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Subscription already exists');
  });

  it('should have correct name and description', () => {
    expect(tool.name).toBe('registerWebhook');
    expect(tool.description).toContain('webhook');
  });
});

// ============================================================================
// 6. GetKPIMetricsTool Tests
// ============================================================================

describe('GetKPIMetricsTool', () => {
  let tool: GetKPIMetricsTool;
  let mockSdk: IoTSdk;
  let mockRedis: Redis;

  const baseKpis = {
    totalDevices: 1000,
    onlineDevices: 850,
    offlineDevices: 100,
    degradedDevices: 50,
    averageUptime: 98.5,
    alertCounts: { critical: 5, high: 12, medium: 25, low: 48 },
    timestamp: new Date(),
  };

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
    tool = new GetKPIMetricsTool({ sdk: mockSdk, redis: mockRedis });
  });

  it('should retrieve connectivity KPIs successfully', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(baseKpis);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'connectivity',
      period: '24h',
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis).toHaveLength(5);
    expect(parsed.data.kpis[0]).toEqual({ name: 'Total Devices', value: 1000, unit: 'devices', trend: 0 });
    expect(parsed.data.kpis[1]).toEqual({ name: 'Online Devices', value: 850, unit: 'devices', trend: 0 });
    expect(parsed.data.kpis[2]).toEqual({ name: 'Offline Devices', value: 100, unit: 'devices', trend: 0 });
    expect(parsed.data.kpis[3]).toEqual({ name: 'Degraded Devices', value: 50, unit: 'devices', trend: 0 });
    expect(parsed.data.kpis[4]).toEqual({ name: 'Average Uptime', value: 98.5, unit: '%', trend: 0 });
  });

  it('should retrieve firmware KPIs successfully', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(baseKpis);

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
    // 85% compliance: 850 compliant, 150 needing update
    expect(parsed.data.kpis[1].value + parsed.data.kpis[2].value).toBe(1000);
  });

  it('should handle firmware KPIs with zero devices', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      ...baseKpis,
      totalDevices: 0,
    });

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'firmware',
      period: '7d',
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis[0].value).toBe(0); // 0% compliance
  });

  it('should retrieve alert KPIs successfully', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(baseKpis);

    const result = await tool._call({
      tenantId: 'tenant-123',
      kpiType: 'alerts',
      period: '30d',
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.kpis).toHaveLength(5);
    expect(parsed.data.kpis[0]).toEqual({ name: 'Critical Alerts', value: 5, unit: 'alerts', trend: 0 });
    expect(parsed.data.kpis[4]).toEqual({ name: 'Total Active Alerts', value: 90, unit: 'alerts', trend: 0 });
  });

  it('should use 24h period correctly', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(baseKpis);

    await tool._call({ tenantId: 'tenant-123', kpiType: 'connectivity', period: '24h' });

    const call = vi.mocked(mockSdk.getFleetKpis).mock.calls[0][0]!;
    const hoursDiff = (call.endTime!.getTime() - call.startTime!.getTime()) / (1000 * 60 * 60);
    expect(Math.abs(hoursDiff - 24)).toBeLessThan(1);
  });

  it('should use 7d period correctly', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(baseKpis);

    await tool._call({ tenantId: 'tenant-123', kpiType: 'connectivity', period: '7d' });

    const call = vi.mocked(mockSdk.getFleetKpis).mock.calls[0][0]!;
    const daysDiff = (call.endTime!.getTime() - call.startTime!.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.abs(daysDiff - 7)).toBeLessThan(1);
  });

  it('should use 30d period correctly', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue(baseKpis);

    await tool._call({ tenantId: 'tenant-123', kpiType: 'connectivity', period: '30d' });

    const call = vi.mocked(mockSdk.getFleetKpis).mock.calls[0][0]!;
    const daysDiff = (call.endTime!.getTime() - call.startTime!.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.abs(daysDiff - 30)).toBeLessThan(1);
  });

  it('should return zero KPIs when no data', async () => {
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      degradedDevices: 0,
      averageUptime: 0,
      alertCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      timestamp: new Date(),
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
    const cachedData = { kpis: [{ name: 'Total Devices', value: 500, unit: 'devices', trend: 0 }] };

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
    vi.mocked(mockSdk.getFleetKpis).mockRejectedValue(new Error('Database unavailable'));
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

  it('should have correct name and description', () => {
    expect(tool.name).toBe('getKPIMetrics');
    expect(tool.description).toContain('KPI metrics');
  });
});

// ============================================================================
// 7. Base Tool Tests (IoTTool)
// ============================================================================

describe('IoTTool (Base Class)', () => {
  let mockSdk: IoTSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
  });

  it('should work without Redis (no caching)', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
  });

  it('should return error without cache fallback when no Redis', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('Fail'));

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Fail');
  });

  it('should format Error objects correctly', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('Generic error'));
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('Error: Generic error');
  });

  it('should format string errors correctly', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue('string error');
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('Error: string error');
  });

  it('should format FriendlyApiError correctly', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    const apiError = { message: 'Unauthorized', details: { code: 401 } };

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(apiError);
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toContain('Unauthorized');
    expect(parsed.error).toContain('401');
  });

  it('should format FriendlyApiError without details', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    const apiError = { message: 'Server Error' };

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(apiError);
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('API Error: Server Error');
  });

  it('should format unknown errors (non-object)', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(42);
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('An unknown error occurred');
  });

  it('should format unknown errors (object without message)', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue({ code: 500, status: 'INTERNAL' });
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBe('An unknown error occurred');
  });

  it('should format result as valid JSON string', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const result = await tool._call({ tenantId: 'tenant-123' });

    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('success');
    expect(parsed).toHaveProperty('data');
  });

  it('should handle Redis connection errors gracefully on cache set', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    vi.mocked(mockRedis.setex).mockRejectedValue(new Error('Redis connection refused'));

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    // Should still succeed even if cache fails
    expect(parsed.success).toBe(true);
  });

  it('should use custom cache TTL', () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis, cacheTtl: 600 });

    // Access protected cache through the tool
    expect((tool as any).cache).toBeDefined();
    expect((tool as any).cache.getDefaultTtl()).toBe(600);
  });

  it('should accept null sdk without throwing during construction', () => {
    // SDK is assigned in constructor; null won't throw at construction time
    // (errors happen at call time)
    expect(() => new GetDeviceListTool({ sdk: null as any })).not.toThrow();
  });

  it('should expose validateInput that delegates to schema.parse', () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk });

    // Access protected method
    const validated = (tool as any).validateInput({ tenantId: 'test-tenant' });
    expect(validated.tenantId).toBe('test-tenant');
  });

  it('should expose getCacheHelper', () => {
    const toolWithCache = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });
    const toolWithoutCache = new GetDeviceListTool({ sdk: mockSdk });

    expect((toolWithCache as any).getCacheHelper()).toBeDefined();
    expect((toolWithoutCache as any).getCacheHelper()).toBeUndefined();
  });

  it('should expose getSdk', () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk });

    expect((tool as any).getSdk()).toBe(mockSdk);
  });

  it('should expose isCachingEnabled', () => {
    const toolWithCache = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });
    const toolWithoutCache = new GetDeviceListTool({ sdk: mockSdk });

    expect((toolWithCache as any).isCachingEnabled()).toBe(true);
    expect((toolWithoutCache as any).isCachingEnabled()).toBe(false);
  });
});

// ============================================================================
// 8. Factory Functions Tests
// ============================================================================

describe('Factory Functions', () => {
  let mockSdk: IoTSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
  });

  it('should create GetDeviceListTool via factory', () => {
    const tool = createGetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    expect(tool).toBeInstanceOf(GetDeviceListTool);
    expect(tool.name).toBe('getDeviceList');
  });

  it('should create GetDeviceDetailsTool via factory', () => {
    const tool = createGetDeviceDetailsTool({ sdk: mockSdk, redis: mockRedis });

    expect(tool).toBeInstanceOf(GetDeviceDetailsTool);
    expect(tool.name).toBe('getDeviceDetails');
  });

  it('should create GetDeviceTelemetryTool via factory', () => {
    const tool = createGetDeviceTelemetryTool({ sdk: mockSdk, redis: mockRedis });

    expect(tool).toBeInstanceOf(GetDeviceTelemetryTool);
    expect(tool.name).toBe('getDeviceTelemetry');
  });

  it('should create RegisterWebhookTool via factory', () => {
    const tool = createRegisterWebhookTool({ sdk: mockSdk, redis: mockRedis });

    expect(tool).toBeInstanceOf(RegisterWebhookTool);
    expect(tool.name).toBe('registerWebhook');
  });

  it('should create GetKPIMetricsTool via factory', () => {
    const tool = createGetKPIMetricsTool({ sdk: mockSdk, redis: mockRedis });

    expect(tool).toBeInstanceOf(GetKPIMetricsTool);
    expect(tool.name).toBe('getKPIMetrics');
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

    expect((tools.getDeviceList as any).sdk).toBe(mockSdk);
    expect((tools.getDeviceDetails as any).sdk).toBe(mockSdk);
    expect((tools.getDeviceTelemetry as any).sdk).toBe(mockSdk);
    expect((tools.registerWebhook as any).sdk).toBe(mockSdk);
    expect((tools.getKPIMetrics as any).sdk).toBe(mockSdk);

    expect((tools.getDeviceList as any).cache).toBeDefined();
    expect((tools.getDeviceDetails as any).cache).toBeDefined();
    expect((tools.getDeviceTelemetry as any).cache).toBeDefined();
    expect((tools.getKPIMetrics as any).cache).toBeDefined();
  });

  it('should create tools without Redis', () => {
    const tools = createAllTools({ sdk: mockSdk });

    expect((tools.getDeviceList as any).cache).toBeUndefined();
    expect((tools.getDeviceDetails as any).cache).toBeUndefined();
  });

  it('should export MODULE_NAME', () => {
    expect(MODULE_NAME).toBe('iot-tool-functions');
  });
});

// ============================================================================
// 9. Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  let mockSdk: IoTSdk;
  let mockRedis: Redis;

  beforeEach(() => {
    mockSdk = createMockSdk();
    mockRedis = createMockRedis();
  });

  it('should handle network timeout gracefully', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('Network timeout'));
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Network timeout');
  });

  it('should handle invalid JSON response from SDK', async () => {
    const tool = new GetDeviceDetailsTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceById).mockRejectedValue(
      new Error('Unexpected token < in JSON')
    );
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ deviceId: 'dev-123' });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Unexpected token');
  });

  it('should handle malformed SDK response (null devices)', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: null as any,
      total: undefined as any,
      limit: 20,
      offset: 0,
    });
    vi.mocked(mockRedis.get).mockResolvedValue(null);

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    // The tool catches the error through callWithCache
    expect(parsed.success).toBe(false);
  });

  it('should handle cache get error during fallback', async () => {
    const tool = new GetDeviceListTool({ sdk: mockSdk, redis: mockRedis });

    vi.mocked(mockSdk.getDeviceList).mockRejectedValue(new Error('API fail'));
    vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis fail'));

    const result = await tool._call({ tenantId: 'tenant-123' });
    const parsed = JSON.parse(result);

    // Cache get error is swallowed by CacheHelper, returns null
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('API fail');
  });
});

// ============================================================================
// 10. Integration Tests
// ============================================================================

describe('Integration Scenarios', () => {
  let mockSdk: IoTSdk;
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
        { deviceId: 'dev-workflow', name: 'Test Device', type: 'sensor', status: 'online', lastSeen: new Date() },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const listResult = await tools.getDeviceList._call({ tenantId: 'tenant-123' });
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

    const detailsResult = await tools.getDeviceDetails._call({ deviceId });
    const detailsParsed = JSON.parse(detailsResult);
    expect(detailsParsed.success).toBe(true);

    // Step 3: Get device telemetry
    vi.mocked(mockSdk.getDeviceTelemetry).mockResolvedValue({
      deviceId: 'dev-workflow',
      startTime: new Date(),
      endTime: new Date(),
      dataPoints: [
        { timestamp: new Date(), value: 50, metric: 'cpu', unit: '%' },
      ],
    });

    const telemetryResult = await tools.getDeviceTelemetry._call({
      deviceId,
      metric: 'cpu',
      timeRange: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T23:59:59Z' },
    });

    const telemetryParsed = JSON.parse(telemetryResult);
    expect(telemetryParsed.success).toBe(true);
    expect(telemetryParsed.data.dataPoints).toHaveLength(1);
  });

  it('should handle cache invalidation scenarios', async () => {
    const cache = new CacheHelper(mockRedis, 300);

    await cache.set('test-key', { value: 'initial' });
    expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 300, JSON.stringify({ value: 'initial' }));

    await cache.delete('test-key');
    expect(mockRedis.del).toHaveBeenCalledWith('test-key');

    vi.mocked(mockRedis.get).mockResolvedValue(null);
    const result = await cache.get('test-key');
    expect(result).toBeNull();
  });

  it('should handle concurrent tool calls', async () => {
    vi.mocked(mockSdk.getDeviceList).mockResolvedValue({
      devices: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 100,
      onlineDevices: 90,
      offlineDevices: 10,
      degradedDevices: 0,
      averageUptime: 95,
      alertCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      timestamp: new Date(),
    });

    const results = await Promise.all([
      tools.getDeviceList._call({ tenantId: 'tenant-123' }),
      tools.getKPIMetrics._call({ tenantId: 'tenant-123', kpiType: 'connectivity', period: '24h' }),
    ]);

    const [listResult, kpiResult] = results.map((r) => JSON.parse(r));
    expect(listResult.success).toBe(true);
    expect(kpiResult.success).toBe(true);
  });

  it('should maintain cross-tool cache isolation', async () => {
    const cache = new CacheHelper(mockRedis, 300);

    await cache.set(cache.generateKey('getDeviceList', { tenantId: 'abc' }), { devices: [] });
    await cache.set(cache.generateKey('getKPIMetrics', { tenantId: 'abc' }), { kpis: [] });

    vi.mocked(mockRedis.keys).mockResolvedValue(['iot:tool:getDeviceList:abc123']);

    const deleted = await cache.clearToolCache('getDeviceList');

    expect(deleted).toBe(1);
    expect(mockRedis.keys).toHaveBeenCalledWith('iot:tool:getDeviceList:*');
    expect(mockRedis.keys).not.toHaveBeenCalledWith('iot:tool:getKPIMetrics:*');
  });

  it('should handle webhook + KPI monitoring workflow', async () => {
    // Register webhook for alerts
    vi.mocked(mockSdk.subscribeToEvents).mockResolvedValue({
      subscriptionId: 'sub-mon',
      eventTypes: ['alert.created'],
      createdAt: new Date(),
    });

    const webhookResult = await tools.registerWebhook._call({
      eventType: 'alert.created',
      callbackUrl: 'https://monitoring.example.com/alerts',
      filters: { severity: 'critical' },
    });

    expect(JSON.parse(webhookResult).success).toBe(true);

    // Check alert KPIs
    vi.mocked(mockSdk.getFleetKpis).mockResolvedValue({
      totalDevices: 500,
      onlineDevices: 450,
      offlineDevices: 50,
      degradedDevices: 0,
      averageUptime: 98,
      alertCounts: { critical: 2, high: 5, medium: 10, low: 20 },
      timestamp: new Date(),
    });

    const kpiResult = await tools.getKPIMetrics._call({
      tenantId: 'tenant-123',
      kpiType: 'alerts',
      period: '24h',
    });

    const kpiParsed = JSON.parse(kpiResult);
    expect(kpiParsed.success).toBe(true);
    expect(kpiParsed.data.kpis[0].value).toBe(2); // Critical alerts
  });
});
