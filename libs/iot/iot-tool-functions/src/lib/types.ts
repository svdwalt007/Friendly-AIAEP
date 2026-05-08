/**
 * Shared Types and Interfaces for IoT Tool Functions
 *
 * This module defines common types, interfaces, and configuration
 * for the LangGraph StructuredTool implementations.
 *
 * @module types
 */

import type Redis from 'ioredis';

/**
 * Minimal interface for the SDK methods used by IoT tools.
 *
 * This mirrors the subset of FallbackSdk (from @friendly-tech/iot/sdk-generator)
 * that the tool classes actually call. A local interface is used instead of a
 * direct cross-project source import because the @nx/js:tsc executor resolves
 * tsconfig path aliases to source .ts files, which violates the rootDir
 * constraint when projects live in separate directories.
 *
 * When FallbackSdk's method signatures change, update this interface to match.
 */
export interface IoTSdk {
  getDeviceList(params?: {
    limit?: number;
    offset?: number;
    filter?: {
      status?: 'online' | 'offline' | 'degraded' | 'unknown';
      type?: string;
      search?: string;
    };
  }): Promise<{
    devices: Array<{
      deviceId: string;
      name: string;
      type: string;
      status: string;
      firmwareVersion?: string;
      lastSeen?: Date;
      location?: { latitude?: number; longitude?: number; address?: string };
      metadata?: Record<string, unknown>;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>;

  getDeviceById(deviceId: string): Promise<{
    deviceId: string;
    name: string;
    type: string;
    status: string;
    firmwareVersion?: string;
    lastSeen?: Date;
    location?: { latitude?: number; longitude?: number; address?: string };
    metadata?: Record<string, unknown>;
    lwm2mObjects?: Array<{
      objectId: number;
      instanceId: number;
      resources: Record<string, unknown>;
    }>;
  }>;

  getDeviceTelemetry(
    deviceId: string,
    params: {
      startTime: Date;
      endTime: Date;
      metrics?: string[];
      interval?: '1m' | '5m' | '15m' | '1h' | '1d';
    }
  ): Promise<{
    deviceId: string;
    startTime: Date;
    endTime: Date;
    dataPoints: Array<{
      timestamp: Date;
      metric: string;
      value: number;
      unit?: string;
    }>;
  }>;

  subscribeToEvents(subscription: {
    eventTypes: string[];
    filters?: {
      deviceId?: string;
      deviceType?: string;
      severity?: string;
      [key: string]: unknown;
    };
    webhookUrl?: string;
    callbackUrl?: string;
  }): Promise<{
    subscriptionId: string;
    eventTypes: string[];
    filters?: Record<string, unknown>;
    webhookUrl?: string;
    createdAt: Date;
    expiresAt?: Date;
  }>;

  getFleetKpis(params?: {
    startTime?: Date;
    endTime?: Date;
    deviceType?: string;
  }): Promise<{
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    degradedDevices: number;
    averageUptime: number;
    alertCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    timestamp: Date;
  }>;
}

/**
 * Configuration for IoT Tools
 */
export interface ToolConfig {
  /** IoTSdk instance for making API calls (compatible with FallbackSdk) */
  sdk: IoTSdk;

  /** Optional Redis client for caching responses */
  redis?: Redis;

  /** Optional cache TTL in seconds (default: 300 = 5 minutes) */
  cacheTtl?: number;
}

/**
 * Base response type for cached data
 */
export interface CachedResponse<T> {
  /** The actual response data */
  data: T;

  /** Whether this response was served from cache */
  cached?: boolean;

  /** How many seconds the cached data has been stale */
  staleSeconds?: number;
}

/**
 * Device filter options for getDeviceList
 */
export interface DeviceFilters {
  deviceType?: string;
  status?: string;
  fwVersion?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Device list response
 */
export interface DeviceListResponse {
  devices: Array<{
    deviceId: string;
    name: string;
    type: string;
    status: string;
    firmwareVersion?: string;
    lastSeen?: string;
  }>;
  total: number;
  page: number;
}

/**
 * Device detail response with LwM2M objects
 */
export interface DeviceDetailResponse {
  device: {
    deviceId: string;
    name: string;
    type: string;
    status: string;
    firmwareVersion?: string;
    lastSeen?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      address?: string;
    };
    metadata?: Record<string, any>;
    lwm2mObjects?: Array<{
      objectId: number;
      instanceId: number;
      resources: Record<string, any>;
    }>;
  };
}

/**
 * Time range for telemetry queries
 */
export interface TimeRange {
  from: string; // ISO timestamp
  to: string; // ISO timestamp
}

/**
 * Telemetry data point
 */
export interface TelemetryDataPoint {
  timestamp: string;
  value: number;
}

/**
 * Device telemetry response
 */
export interface DeviceTelemetryResponse {
  dataPoints: TelemetryDataPoint[];
  metric: string;
  unit: string;
}

/**
 * Webhook filter options
 */
export interface WebhookFilters {
  deviceType?: string;
  severity?: string;
}

/**
 * Webhook registration response
 */
export interface WebhookResponse {
  subscriptionId: string;
  status: string;
  eventType: string;
}

/**
 * KPI metric
 */
export interface KPIMetric {
  name: string;
  value: number;
  unit: string;
  trend: number;
}

/**
 * KPI metrics response
 */
export interface KPIMetricsResponse {
  kpis: KPIMetric[];
}

/**
 * Tool execution result
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  staleSeconds?: number;
}
