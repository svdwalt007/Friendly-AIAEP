/**
 * Get Device List Tool
 *
 * LangGraph StructuredTool for retrieving a paginated list of IoT devices
 * with optional filtering by type, status, firmware version, or search query.
 *
 * @module tools/get-device-list
 */

import { z } from 'zod';
import { IoTTool } from '../base-tool';
import type { DeviceListResponse, ToolConfig } from '../types';

/**
 * Input schema for getDeviceListTool
 */
const GetDeviceListSchema = z.object({
  tenantId: z.string().describe('Tenant ID for filtering devices'),
  filters: z
    .object({
      deviceType: z
        .string()
        .optional()
        .describe('Filter by device type (e.g., "sensor", "gateway")'),
      status: z
        .string()
        .optional()
        .describe('Filter by status (e.g., "online", "offline", "degraded")'),
      fwVersion: z
        .string()
        .optional()
        .describe('Filter by firmware version (e.g., "1.2.3")'),
      search: z
        .string()
        .optional()
        .describe('Search query for device name or ID'),
      page: z
        .number()
        .int()
        .positive()
        .optional()
        .default(1)
        .describe('Page number for pagination (1-indexed)'),
      pageSize: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .default(20)
        .describe('Number of devices per page (max 100)'),
    })
    .optional()
    .describe('Optional filters for device list'),
});

type GetDeviceListInput = z.infer<typeof GetDeviceListSchema>;

/**
 * Get Device List Tool
 *
 * Retrieves a paginated list of IoT devices with optional filtering.
 * Uses the NorthboundService.getDeviceList() from the fallback SDK.
 *
 * Features:
 * - Pagination support (default 20 devices per page)
 * - Filter by device type, status, firmware version
 * - Search by device name or ID
 * - Redis caching with 5-minute TTL
 * - Fallback to stale cache on API failure
 *
 * @example
 * ```typescript
 * const tool = new GetDeviceListTool({ sdk, redis });
 *
 * const result = await tool._call({
 *   tenantId: 'tenant-123',
 *   filters: {
 *     status: 'online',
 *     deviceType: 'sensor',
 *     page: 1,
 *     pageSize: 20
 *   }
 * });
 * ```
 */
export class GetDeviceListTool extends IoTTool<typeof GetDeviceListSchema> {
  name = 'getDeviceList';
  description =
    'Get a paginated list of IoT devices with optional filtering by type, status, firmware version, or search query. ' +
    'Returns device basic information including ID, name, type, status, and last seen timestamp. ' +
    'Use this tool when you need to browse or search through the device inventory.';

  schema = GetDeviceListSchema;

  constructor(config: ToolConfig) {
    super(config);
  }

  /**
   * Executes the tool to retrieve device list
   *
   * @param input - Validated input parameters
   * @returns JSON string with device list or error
   */
  protected async _call(input: GetDeviceListInput): Promise<string> {
    const result = await this.callWithCache<DeviceListResponse>(
      this.name,
      input,
      async () => {
        try {
          // Map filters to SDK parameters
          const filters = input.filters;
          const page = filters?.page ?? 1;
          const pageSize = filters?.pageSize ?? 20;
          const offset = (page - 1) * pageSize;

          const response = await this.sdk.getDeviceList({
            limit: pageSize,
            offset,
            filter: {
              status: filters?.status as any,
              type: filters?.deviceType,
              search: filters?.search,
            },
          });

          // Transform response to match expected format
          const deviceList: DeviceListResponse = {
            devices: response.devices.map((d: any) => ({
              deviceId: d.deviceId,
              name: d.name,
              type: d.type,
              status: d.status,
              firmwareVersion: d.firmwareVersion,
              lastSeen: d.lastSeen?.toISOString(),
            })),
            total: response.total,
            page,
          };

          // Filter by firmware version if specified (client-side filter)
          if (filters?.fwVersion) {
            deviceList.devices = deviceList.devices.filter(
              (d) => d.firmwareVersion === filters.fwVersion
            );
          }

          return {
            success: true,
            data: deviceList,
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
 * Factory function to create a GetDeviceListTool instance
 *
 * @param config - Tool configuration
 * @returns Configured GetDeviceListTool instance
 *
 * @example
 * ```typescript
 * const tool = createGetDeviceListTool({ sdk, redis });
 * ```
 */
export function createGetDeviceListTool(config: ToolConfig): GetDeviceListTool {
  return new GetDeviceListTool(config);
}
