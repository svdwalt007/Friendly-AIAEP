/**
 * Shared Types and Interfaces for IoT Tool Functions
 *
 * This module defines common types, interfaces, and configuration
 * for the LangGraph StructuredTool implementations.
 *
 * @module types
 */

// TODO: Fix circular dependency with sdk-generator
type FallbackSdk = any;
import type Redis from 'ioredis';

/**
 * Configuration for IoT Tools
 */
export interface ToolConfig {
  /** FallbackSdk instance for making API calls */
  sdk: FallbackSdk;

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
