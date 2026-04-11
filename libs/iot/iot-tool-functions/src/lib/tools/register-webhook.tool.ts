/**
 * Register Webhook Tool
 *
 * LangGraph StructuredTool for registering a webhook to receive
 * real-time IoT event notifications with optional filtering.
 *
 * @module tools/register-webhook
 */

import { z } from 'zod';
import { IoTTool } from '../base-tool';
import type { WebhookResponse, ToolConfig } from '../types';

/**
 * Input schema for registerWebhookTool
 */
const RegisterWebhookSchema = z.object({
  eventType: z
    .string()
    .min(1)
    .describe(
      'Event type to subscribe to (e.g., "device.status.changed", "alert.created", "device.telemetry")'
    ),
  callbackUrl: z
    .string()
    .url()
    .describe(
      'HTTPS URL where event notifications will be sent (must be publicly accessible)'
    ),
  filters: z
    .object({
      deviceType: z
        .string()
        .optional()
        .describe('Filter events by device type (e.g., "sensor", "gateway")'),
      severity: z
        .string()
        .optional()
        .describe(
          'Filter events by severity level (e.g., "critical", "high", "medium", "low")'
        ),
    })
    .optional()
    .describe('Optional filters to narrow down event notifications'),
});

type RegisterWebhookInput = z.infer<typeof RegisterWebhookSchema>;

/**
 * Register Webhook Tool
 *
 * Registers a webhook endpoint to receive real-time IoT event notifications.
 * Uses the EventsService.subscribeToEvents() from the fallback SDK.
 *
 * Features:
 * - Subscribe to specific event types
 * - Filter events by device type or severity
 * - Receive real-time notifications via HTTPS callback
 * - Returns subscription ID for management
 * - Note: This tool creates subscriptions but typically does NOT cache results
 *
 * Common event types:
 * - device.status.changed: Device goes online/offline
 * - alert.created: New alert is generated
 * - alert.resolved: Alert is resolved
 * - device.telemetry: Telemetry threshold crossed
 * - device.config.updated: Device configuration changed
 * - device.firmware.updated: Firmware update completed
 *
 * @example
 * ```typescript
 * const tool = new RegisterWebhookTool({ sdk, redis });
 *
 * const result = await tool._call({
 *   eventType: 'device.status.changed',
 *   callbackUrl: 'https://myapp.com/webhooks/iot-events',
 *   filters: {
 *     deviceType: 'sensor',
 *     severity: 'critical'
 *   }
 * });
 * ```
 */
export class RegisterWebhookTool extends IoTTool<
  typeof RegisterWebhookSchema
> {
  name = 'registerWebhook';
  description =
    'Register a webhook for IoT events with optional filters by device type or severity. ' +
    'Returns a subscription ID that can be used to manage or cancel the webhook. ' +
    'The webhook will receive POST requests with event data whenever matching events occur. ' +
    'Use this tool when you need to set up real-time event notifications for your application.';

  schema = RegisterWebhookSchema;

  constructor(config: ToolConfig) {
    super(config);
  }

  /**
   * Executes the tool to register a webhook subscription
   *
   * @param input - Validated input parameters
   * @returns JSON string with subscription details or error
   */
  protected async _call(input: RegisterWebhookInput): Promise<string> {
    // Note: Webhook registrations are typically NOT cached since they
    // create new resources. We'll skip caching for this tool.
    try {
      const subscription = await this.sdk.subscribeToEvents({
        eventTypes: [input.eventType],
        filters: input.filters
          ? {
              deviceType: input.filters.deviceType,
              severity: input.filters.severity,
            }
          : undefined,
        webhookUrl: input.callbackUrl,
        callbackUrl: input.callbackUrl,
      });

      const response: WebhookResponse = {
        subscriptionId: subscription.subscriptionId,
        status: 'active',
        eventType: input.eventType,
      };

      return this.formatResult({
        success: true,
        data: response,
      });
    } catch (error) {
      return this.formatResult({
        success: false,
        error: this.formatError(error),
      });
    }
  }
}

/**
 * Factory function to create a RegisterWebhookTool instance
 *
 * @param config - Tool configuration
 * @returns Configured RegisterWebhookTool instance
 *
 * @example
 * ```typescript
 * const tool = createRegisterWebhookTool({ sdk, redis });
 * ```
 */
export function createRegisterWebhookTool(
  config: ToolConfig
): RegisterWebhookTool {
  return new RegisterWebhookTool(config);
}
