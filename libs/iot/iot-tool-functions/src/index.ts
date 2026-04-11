/**
 * IoT Tool Functions - LangGraph StructuredTools for IoT Operations
 *
 * This module provides 5 core LangGraph StructuredTool classes for interacting
 * with IoT devices through the Friendly AI AEP system:
 *
 * 1. GetDeviceListTool - Paginated device listing with filters
 * 2. GetDeviceDetailsTool - Detailed device information with LwM2M objects
 * 3. GetDeviceTelemetryTool - Time-series telemetry data
 * 4. RegisterWebhookTool - Event webhook registration
 * 5. GetKPIMetricsTool - Fleet-wide KPI metrics
 *
 * All tools feature:
 * - Zod schema validation
 * - Redis caching with fallback
 * - Error handling
 * - LLM-friendly descriptions
 *
 * @module iot-tool-functions
 */

// Export base classes and utilities
export { IoTTool } from './lib/base-tool';
export { CacheHelper } from './lib/cache';

// Export all tools
export {
  GetDeviceListTool,
  createGetDeviceListTool,
} from './lib/tools/get-device-list.tool';
export {
  GetDeviceDetailsTool,
  createGetDeviceDetailsTool,
} from './lib/tools/get-device-details.tool';
export {
  GetDeviceTelemetryTool,
  createGetDeviceTelemetryTool,
} from './lib/tools/get-device-telemetry.tool';
export {
  RegisterWebhookTool,
  createRegisterWebhookTool,
} from './lib/tools/register-webhook.tool';
export {
  GetKPIMetricsTool,
  createGetKPIMetricsTool,
} from './lib/tools/get-kpi-metrics.tool';

// Export types and interfaces
export type {
  ToolConfig,
  CachedResponse,
  DeviceFilters,
  DeviceListResponse,
  DeviceDetailResponse,
  TimeRange,
  TelemetryDataPoint,
  DeviceTelemetryResponse,
  WebhookFilters,
  WebhookResponse,
  KPIMetric,
  KPIMetricsResponse,
  ToolResult,
} from './lib/types';

export type { CachedData } from './lib/cache';

// Convenience function to create all tools at once
import type { ToolConfig } from './lib/types';
import { createGetDeviceListTool } from './lib/tools/get-device-list.tool';
import { createGetDeviceDetailsTool } from './lib/tools/get-device-details.tool';
import { createGetDeviceTelemetryTool } from './lib/tools/get-device-telemetry.tool';
import { createRegisterWebhookTool } from './lib/tools/register-webhook.tool';
import { createGetKPIMetricsTool } from './lib/tools/get-kpi-metrics.tool';

/**
 * Creates all IoT tools with the same configuration
 *
 * @param config - Tool configuration (SDK and optional Redis)
 * @returns Object containing all 5 tool instances
 *
 * @example
 * ```typescript
 * import { createAllTools } from '@friendly-tech/iot/iot-tool-functions';
 * import { FallbackSdk } from '@friendly-tech/iot/sdk-generator';
 * import Redis from 'ioredis';
 *
 * const sdk = new FallbackSdk({ authAdapter, baseProxyUrl });
 * const redis = new Redis();
 *
 * const tools = createAllTools({ sdk, redis });
 *
 * // Use individual tools
 * const devices = await tools.getDeviceList._call({
 *   tenantId: 'tenant-123',
 *   filters: { status: 'online' }
 * });
 * ```
 */
export function createAllTools(config: ToolConfig) {
  return {
    getDeviceList: createGetDeviceListTool(config),
    getDeviceDetails: createGetDeviceDetailsTool(config),
    getDeviceTelemetry: createGetDeviceTelemetryTool(config),
    registerWebhook: createRegisterWebhookTool(config),
    getKPIMetrics: createGetKPIMetricsTool(config),
  };
}

export const MODULE_NAME = 'iot-tool-functions';
