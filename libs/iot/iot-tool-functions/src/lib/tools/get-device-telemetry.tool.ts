/**
 * Get Device Telemetry Tool
 *
 * LangGraph StructuredTool for retrieving time-series telemetry data
 * for a specific device metric over a specified time range.
 *
 * @module tools/get-device-telemetry
 */

import { z } from 'zod';
import { IoTTool } from '../base-tool';
import type { DeviceTelemetryResponse, ToolConfig } from '../types';

/**
 * Input schema for getDeviceTelemetryTool
 */
const GetDeviceTelemetrySchema = z.object({
  deviceId: z
    .string()
    .min(1)
    .describe('Unique identifier of the device to get telemetry from'),
  metric: z
    .string()
    .min(1)
    .describe(
      'Metric name to retrieve (e.g., "cpu", "memory", "temperature", "battery")'
    ),
  timeRange: z
    .object({
      from: z
        .string()
        .datetime()
        .describe('Start time for telemetry data (ISO 8601 timestamp)'),
      to: z
        .string()
        .datetime()
        .describe('End time for telemetry data (ISO 8601 timestamp)'),
    })
    .describe('Time range for telemetry query'),
  aggregation: z
    .enum(['1m', '5m', '1h', '1d'])
    .optional()
    .describe(
      'Aggregation interval (1m=1 minute, 5m=5 minutes, 1h=1 hour, 1d=1 day)'
    ),
});

type GetDeviceTelemetryInput = z.infer<typeof GetDeviceTelemetrySchema>;

/**
 * Get Device Telemetry Tool
 *
 * Retrieves time-series telemetry data for a device metric over a time range.
 * Uses the QoEService.getDeviceTelemetry() from the fallback SDK.
 *
 * Features:
 * - Time-series data with timestamps and values
 * - Optional aggregation intervals (1m, 5m, 1h, 1d)
 * - Metric units included in response
 * - Redis caching with 5-minute TTL
 * - Fallback to stale cache on API failure
 *
 * Common metrics:
 * - cpu: CPU utilization percentage
 * - memory: Memory usage in MB or percentage
 * - temperature: Device temperature in Celsius
 * - battery: Battery level percentage
 * - signal: Signal strength in dBm
 * - bandwidth: Network bandwidth usage
 *
 * @example
 * ```typescript
 * const tool = new GetDeviceTelemetryTool({ sdk, redis });
 *
 * const result = await tool._call({
 *   deviceId: 'device-123',
 *   metric: 'cpu',
 *   timeRange: {
 *     from: '2024-01-01T00:00:00Z',
 *     to: '2024-01-01T23:59:59Z'
 *   },
 *   aggregation: '5m'
 * });
 * ```
 */
export class GetDeviceTelemetryTool extends IoTTool<
  typeof GetDeviceTelemetrySchema
> {
  name = 'getDeviceTelemetry';
  description =
    'Get time-series telemetry data for a device metric over a specified time range with optional aggregation. ' +
    'Returns an array of data points with timestamps and values, along with the metric name and unit. ' +
    'Supports aggregation intervals of 1m (1 minute), 5m (5 minutes), 1h (1 hour), or 1d (1 day). ' +
    'Use this tool when you need historical metric data or want to analyze device performance over time.';

  schema = GetDeviceTelemetrySchema;

  constructor(config: ToolConfig) {
    super(config);
  }

  /**
   * Executes the tool to retrieve device telemetry
   *
   * @param input - Validated input parameters
   * @returns JSON string with telemetry data or error
   */
  protected async _call(input: GetDeviceTelemetryInput): Promise<string> {
    const result = await this.callWithCache<DeviceTelemetryResponse>(
      this.name,
      input,
      async () => {
        try {
          // Convert time range strings to Date objects
          const startTime = new Date(input.timeRange.from);
          const endTime = new Date(input.timeRange.to);

          // Validate time range
          if (startTime >= endTime) {
            throw new Error(
              'Invalid time range: "from" must be before "to"'
            );
          }

          // Map aggregation to SDK interval format
          const intervalMap: Record<string, '1m' | '5m' | '15m' | '1h' | '1d'> = {
            '1m': '1m',
            '5m': '5m',
            '1h': '1h',
            '1d': '1d',
          };

          const telemetryData = await this.sdk.getDeviceTelemetry(
            input.deviceId,
            {
              startTime,
              endTime,
              metrics: [input.metric],
              interval: input.aggregation
                ? intervalMap[input.aggregation]
                : undefined,
            }
          );

          // Transform response to match expected format
          const telemetry: DeviceTelemetryResponse = {
            dataPoints: telemetryData.dataPoints
              .filter((dp: any) => dp.metric === input.metric)
              .map((dp: any) => ({
                timestamp: dp.timestamp.toISOString(),
                value: dp.value,
              })),
            metric: input.metric,
            unit: telemetryData.dataPoints[0]?.unit || '',
          };

          return {
            success: true,
            data: telemetry,
          };
        } catch (error) {
          throw error; // Let base class handle error and cache fallback
        }
      }
    );

    return this.formatResult(result);
  }
}

/**
 * Factory function to create a GetDeviceTelemetryTool instance
 *
 * @param config - Tool configuration
 * @returns Configured GetDeviceTelemetryTool instance
 *
 * @example
 * ```typescript
 * const tool = createGetDeviceTelemetryTool({ sdk, redis });
 * ```
 */
export function createGetDeviceTelemetryTool(
  config: ToolConfig
): GetDeviceTelemetryTool {
  return new GetDeviceTelemetryTool(config);
}
