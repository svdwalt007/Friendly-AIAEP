/**
 * Fallback SDK for IoT Tool Functions
 *
 * This SDK provides hardcoded implementations of the 13 IoT tool functions
 * based on Module Reference v2.2 specification. These functions route through
 * the AEP API Gateway to the appropriate Friendly API endpoints.
 *
 * @module fallback-sdk
 */

import { FriendlyApiError } from './errors';

// TODO: Fix circular dependency with auth-adapter
type FriendlyAuthAdapter = any;

/**
 * Configuration for the Fallback SDK
 */
export interface FallbackSdkConfig {
  /** Auth adapter for authentication */
  authAdapter: FriendlyAuthAdapter;

  /** Base URL of the AEP API Gateway proxy */
  baseProxyUrl: string;

  /** Optional timeout for requests in milliseconds (default: 30000) */
  timeout?: number;

  /** Optional tenant ID override (defaults to authAdapter.getTenantId()) */
  tenantId?: string;
}

// ============================================================================
// Type Definitions - Device Management
// ============================================================================

export interface Device {
  deviceId: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  firmwareVersion?: string;
  lastSeen?: Date;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  metadata?: Record<string, any>;
}

export interface DeviceUpdate {
  name?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  metadata?: Record<string, any>;
}

export interface DeviceListParams {
  limit?: number;
  offset?: number;
  filter?: {
    status?: Device['status'];
    type?: string;
    search?: string;
  };
}

export interface DeviceListResponse {
  devices: Device[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Type Definitions - Alert Management
// ============================================================================

export interface Alert {
  alertId: string;
  deviceId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  title: string;
  description: string;
  timestamp: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
  metadata?: Record<string, any>;
}

export interface AlertListParams {
  severity?: Alert['severity'];
  status?: Alert['status'];
  limit?: number;
  offset?: number;
  deviceId?: string;
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Type Definitions - Event Management
// ============================================================================

export interface EventSubscription {
  eventTypes: string[];
  filters?: {
    deviceId?: string;
    severity?: string;
    [key: string]: any;
  };
  webhookUrl?: string;
  callbackUrl?: string;
}

export interface SubscriptionResponse {
  subscriptionId: string;
  eventTypes: string[];
  filters?: Record<string, any>;
  webhookUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EventHistoryParams {
  startTime: Date;
  endTime: Date;
  eventTypes?: string[];
  deviceId?: string;
  limit?: number;
  offset?: number;
}

export interface Event {
  eventId: string;
  eventType: string;
  deviceId?: string;
  timestamp: Date;
  severity?: string;
  payload: Record<string, any>;
}

export interface EventListResponse {
  events: Event[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Type Definitions - Telemetry/QoE
// ============================================================================

export interface TelemetryParams {
  startTime: Date;
  endTime: Date;
  metrics?: string[];
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}

export interface TelemetryDataPoint {
  timestamp: Date;
  metric: string;
  value: number;
  unit?: string;
}

export interface TelemetryData {
  deviceId: string;
  startTime: Date;
  endTime: Date;
  dataPoints: TelemetryDataPoint[];
}

export interface FleetKpiParams {
  startTime?: Date;
  endTime?: Date;
  deviceType?: string;
}

export interface FleetKPIs {
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
}

export interface ConnectivityStatus {
  deviceId: string;
  isConnected: boolean;
  connectionType?: 'ethernet' | 'wifi' | 'cellular' | 'unknown';
  signalStrength?: number;
  bandwidth?: {
    upload: number;
    download: number;
  };
  latency?: number;
  lastConnected?: Date;
  lastDisconnected?: Date;
}

// ============================================================================
// Type Definitions - Configuration
// ============================================================================

export interface DeviceConfig {
  deviceId: string;
  configuration: Record<string, any>;
  version: string;
  lastUpdated: Date;
  appliedAt?: Date;
}

// ============================================================================
// Fallback SDK Implementation
// ============================================================================

/**
 * Fallback SDK for IoT Tool Functions
 *
 * Provides hardcoded implementations of the 13 IoT tool functions that route
 * through the AEP API Gateway to Friendly API endpoints.
 *
 * @example
 * ```typescript
 * const sdk = new FallbackSdk({
 *   authAdapter: myAuthAdapter,
 *   baseProxyUrl: 'https://api.example.com/proxy'
 * });
 *
 * const devices = await sdk.getDeviceList({ limit: 10 });
 * const device = await sdk.getDeviceById('device-123');
 * ```
 */
export class FallbackSdk {
  private authAdapter: FriendlyAuthAdapter;
  private baseProxyUrl: string;
  private timeout: number;
  private tenantId: string;

  constructor(config: FallbackSdkConfig) {
    this.authAdapter = config.authAdapter;
    this.baseProxyUrl = config.baseProxyUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000;
    this.tenantId = config.tenantId || config.authAdapter.getTenantId();

    if (!this.authAdapter.isInitialized()) {
      throw new Error('AuthAdapter must be initialized before creating FallbackSdk');
    }
  }

  /**
   * Internal method to make HTTP requests with authentication
   */
  private async request<T>(
    apiId: 'northbound' | 'events' | 'qoe',
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    body?: any,
    retryOn401 = true
  ): Promise<T> {
    const url = `${this.baseProxyUrl}/${apiId}${endpoint}`;

    try {
      const headers = await this.authAdapter.getAuthHeaders(apiId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'X-Tenant-Id': this.tenantId,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - refresh token and retry once
      if (response.status === 401 && retryOn401) {
        await this.authAdapter.handle401(apiId);
        return this.request<T>(apiId, method, endpoint, body, false);
      }

      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          errorDetails = await response.text();
        }

        throw new FriendlyApiError({
          statusCode: response.status,
          message: `API request failed: ${response.statusText}`,
          apiSource: apiId as 'northbound' | 'events' | 'qoe',
          details: { endpoint, error: errorDetails },
        });
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof FriendlyApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FriendlyApiError({
            statusCode: 408,
            message: `Request timeout after ${this.timeout}ms`,
            apiSource: apiId as 'northbound' | 'events' | 'qoe',
            details: { endpoint, timeout: this.timeout },
          });
        }

        throw new FriendlyApiError({
          statusCode: 0,
          message: `Request failed: ${error.message}`,
          apiSource: apiId as 'northbound' | 'events' | 'qoe',
          details: { endpoint, error: error.message },
        });
      }

      throw new FriendlyApiError({
        statusCode: 0,
        message: 'Unknown error occurred',
        apiSource: apiId as 'northbound' | 'events' | 'qoe',
        details: { endpoint },
      });
    }
  }

  // ============================================================================
  // Device Management Functions
  // ============================================================================

  /**
   * Retrieves a paginated list of devices
   *
   * @param params - Optional parameters for filtering and pagination
   * @returns List of devices with pagination metadata
   *
   * @example
   * ```typescript
   * const response = await sdk.getDeviceList({
   *   limit: 20,
   *   offset: 0,
   *   filter: { status: 'online' }
   * });
   * console.log(`Found ${response.total} devices`);
   * ```
   */
  async getDeviceList(params?: DeviceListParams): Promise<DeviceListResponse> {
    const queryParams = new URLSearchParams();

    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.filter?.status) queryParams.set('status', params.filter.status);
    if (params?.filter?.type) queryParams.set('type', params.filter.type);
    if (params?.filter?.search) queryParams.set('search', params.filter.search);

    const endpoint = `/devices${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.request<DeviceListResponse>('northbound', 'GET', endpoint);
  }

  /**
   * Retrieves detailed information about a specific device
   *
   * @param deviceId - The unique identifier of the device
   * @returns Device details
   *
   * @example
   * ```typescript
   * const device = await sdk.getDeviceById('device-123');
   * console.log(`Device ${device.name} is ${device.status}`);
   * ```
   */
  async getDeviceById(deviceId: string): Promise<Device> {
    return this.request<Device>('northbound', 'GET', `/devices/${deviceId}`);
  }

  /**
   * Updates device properties
   *
   * @param deviceId - The unique identifier of the device
   * @param update - Device properties to update
   * @returns Updated device details
   *
   * @example
   * ```typescript
   * const updated = await sdk.updateDevice('device-123', {
   *   name: 'New Device Name',
   *   metadata: { location: 'Building A' }
   * });
   * ```
   */
  async updateDevice(deviceId: string, update: DeviceUpdate): Promise<Device> {
    return this.request<Device>('northbound', 'PUT', `/devices/${deviceId}`, update);
  }

  // ============================================================================
  // Alert Management Functions
  // ============================================================================

  /**
   * Retrieves a list of alerts with optional filtering
   *
   * @param params - Optional parameters for filtering alerts
   * @returns List of alerts with pagination metadata
   *
   * @example
   * ```typescript
   * const alerts = await sdk.getAlerts({
   *   severity: 'critical',
   *   status: 'active',
   *   limit: 10
   * });
   * ```
   */
  async getAlerts(params?: AlertListParams): Promise<AlertListResponse> {
    const queryParams = new URLSearchParams();

    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.deviceId) queryParams.set('deviceId', params.deviceId);

    const endpoint = `/alerts${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.request<AlertListResponse>('northbound', 'GET', endpoint);
  }

  /**
   * Acknowledges an alert
   *
   * @param alertId - The unique identifier of the alert
   * @returns Updated alert with acknowledgment details
   *
   * @example
   * ```typescript
   * const alert = await sdk.acknowledgeAlert('alert-456');
   * console.log(`Alert acknowledged at ${alert.acknowledgedAt}`);
   * ```
   */
  async acknowledgeAlert(alertId: string): Promise<Alert> {
    return this.request<Alert>('northbound', 'POST', `/alerts/${alertId}/acknowledge`);
  }

  /**
   * Resolves an alert with a resolution note
   *
   * @param alertId - The unique identifier of the alert
   * @param resolution - Resolution note or description
   * @returns Updated alert with resolution details
   *
   * @example
   * ```typescript
   * const alert = await sdk.resolveAlert('alert-456', 'Fixed by rebooting device');
   * ```
   */
  async resolveAlert(alertId: string, resolution: string): Promise<Alert> {
    return this.request<Alert>(
      'northbound',
      'POST',
      `/alerts/${alertId}/resolve`,
      { resolution }
    );
  }

  // ============================================================================
  // Event Management Functions
  // ============================================================================

  /**
   * Subscribes to real-time events
   *
   * @param subscription - Event subscription configuration
   * @returns Subscription details including subscription ID
   *
   * @example
   * ```typescript
   * const sub = await sdk.subscribeToEvents({
   *   eventTypes: ['device.status.changed', 'alert.created'],
   *   filters: { deviceId: 'device-123' },
   *   webhookUrl: 'https://myapp.com/webhooks/events'
   * });
   * console.log(`Subscription ID: ${sub.subscriptionId}`);
   * ```
   */
  async subscribeToEvents(subscription: EventSubscription): Promise<SubscriptionResponse> {
    return this.request<SubscriptionResponse>('events', 'POST', '/subscriptions', subscription);
  }

  /**
   * Unsubscribes from event notifications
   *
   * @param subscriptionId - The unique identifier of the subscription
   *
   * @example
   * ```typescript
   * await sdk.unsubscribeFromEvents('sub-789');
   * ```
   */
  async unsubscribeFromEvents(subscriptionId: string): Promise<void> {
    await this.request<void>('events', 'DELETE', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Retrieves historical events within a time range
   *
   * @param params - Parameters for querying event history
   * @returns List of historical events
   *
   * @example
   * ```typescript
   * const events = await sdk.getEventHistory({
   *   startTime: new Date('2024-01-01'),
   *   endTime: new Date('2024-01-31'),
   *   eventTypes: ['device.status.changed'],
   *   limit: 100
   * });
   * ```
   */
  async getEventHistory(params: EventHistoryParams): Promise<EventListResponse> {
    const queryParams = new URLSearchParams();

    queryParams.set('startTime', params.startTime.toISOString());
    queryParams.set('endTime', params.endTime.toISOString());

    if (params.eventTypes?.length) {
      queryParams.set('eventTypes', params.eventTypes.join(','));
    }
    if (params.deviceId) queryParams.set('deviceId', params.deviceId);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const endpoint = `/events/history?${queryParams}`;
    return this.request<EventListResponse>('events', 'GET', endpoint);
  }

  // ============================================================================
  // Telemetry/QoE Functions
  // ============================================================================

  /**
   * Retrieves telemetry data for a specific device
   *
   * @param deviceId - The unique identifier of the device
   * @param params - Telemetry query parameters
   * @returns Telemetry data points
   *
   * @example
   * ```typescript
   * const telemetry = await sdk.getDeviceTelemetry('device-123', {
   *   startTime: new Date(Date.now() - 3600000),
   *   endTime: new Date(),
   *   metrics: ['cpu', 'memory', 'temperature'],
   *   interval: '5m'
   * });
   * ```
   */
  async getDeviceTelemetry(deviceId: string, params: TelemetryParams): Promise<TelemetryData> {
    const queryParams = new URLSearchParams();

    queryParams.set('startTime', params.startTime.toISOString());
    queryParams.set('endTime', params.endTime.toISOString());

    if (params.metrics?.length) {
      queryParams.set('metrics', params.metrics.join(','));
    }
    if (params.interval) {
      queryParams.set('interval', params.interval);
    }

    const endpoint = `/devices/${deviceId}/telemetry?${queryParams}`;
    return this.request<TelemetryData>('qoe', 'GET', endpoint);
  }

  /**
   * Retrieves fleet-wide KPIs and statistics
   *
   * @param params - Optional parameters for filtering KPIs
   * @returns Fleet KPI metrics
   *
   * @example
   * ```typescript
   * const kpis = await sdk.getFleetKpis({
   *   startTime: new Date(Date.now() - 86400000),
   *   endTime: new Date()
   * });
   * console.log(`Fleet uptime: ${kpis.averageUptime}%`);
   * ```
   */
  async getFleetKpis(params?: FleetKpiParams): Promise<FleetKPIs> {
    const queryParams = new URLSearchParams();

    if (params?.startTime) queryParams.set('startTime', params.startTime.toISOString());
    if (params?.endTime) queryParams.set('endTime', params.endTime.toISOString());
    if (params?.deviceType) queryParams.set('deviceType', params.deviceType);

    const endpoint = `/fleet/kpis${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.request<FleetKPIs>('qoe', 'GET', endpoint);
  }

  /**
   * Retrieves connectivity status for a specific device
   *
   * @param deviceId - The unique identifier of the device
   * @returns Device connectivity status and metrics
   *
   * @example
   * ```typescript
   * const connectivity = await sdk.getDeviceConnectivity('device-123');
   * console.log(`Device is ${connectivity.isConnected ? 'online' : 'offline'}`);
   * ```
   */
  async getDeviceConnectivity(deviceId: string): Promise<ConnectivityStatus> {
    return this.request<ConnectivityStatus>('qoe', 'GET', `/devices/${deviceId}/connectivity`);
  }

  // ============================================================================
  // Configuration Functions
  // ============================================================================

  /**
   * Retrieves the current configuration for a device
   *
   * @param deviceId - The unique identifier of the device
   * @returns Device configuration
   *
   * @example
   * ```typescript
   * const config = await sdk.getDeviceConfiguration('device-123');
   * console.log(`Config version: ${config.version}`);
   * ```
   */
  async getDeviceConfiguration(deviceId: string): Promise<DeviceConfig> {
    return this.request<DeviceConfig>('northbound', 'GET', `/devices/${deviceId}/configuration`);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Gets the tenant ID being used by this SDK instance
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Gets the base proxy URL
   */
  getBaseProxyUrl(): string {
    return this.baseProxyUrl;
  }

  /**
   * Gets the configured timeout in milliseconds
   */
  getTimeout(): number {
    return this.timeout;
  }
}
