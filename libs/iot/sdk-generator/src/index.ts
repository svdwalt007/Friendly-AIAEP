export const MODULE_NAME = 'sdk-generator';

// Main SDK Generator class
export { SdkGenerator, createSdkGenerator, TemplateName, SdkGenerationError } from './lib/sdk-generator';

// SDK Generator type definitions
export type {
  GeneratedSdk,
  TypeDefinition,
  PropertyDefinition,
  ServiceOperation,
  ParameterDefinition,
  SdkGeneratorOptions,
  TemplateContext,
  GeneratedFile,
  GenerationStatistics,
  SdkGenerationResult,
} from './lib/types';

// Error handling exports
export {
  FriendlyApiError,
  createFromResponse,
  isFriendlyApiError,
} from './lib/errors';

export type {
  FriendlyApiErrorOptions,
} from './lib/errors';

// Export fallback SDK
export { FallbackSdk } from './lib/fallback-sdk';
export type { FallbackSdkConfig } from './lib/fallback-sdk';

// Export type definitions
export type {
  // Device Management
  Device,
  DeviceUpdate,
  DeviceListParams,
  DeviceListResponse,
  // Alert Management
  Alert,
  AlertListParams,
  AlertListResponse,
  // Event Management
  EventSubscription,
  SubscriptionResponse,
  EventHistoryParams,
  Event,
  EventListResponse,
  // Telemetry/QoE
  TelemetryParams,
  TelemetryDataPoint,
  TelemetryData,
  FleetKpiParams,
  FleetKPIs,
  ConnectivityStatus,
  // Configuration
  DeviceConfig,
} from './lib/fallback-sdk';
