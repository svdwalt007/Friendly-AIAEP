/**
 * Metrics Service for Custom Business and Application Metrics
 *
 * Features:
 * - Counter metrics (incrementing values)
 * - Gauge metrics (current values)
 * - Histogram metrics (value distributions)
 * - Business metrics tracking
 * - Application performance metrics
 *
 * @module MetricsService
 */

import {
  Meter,
  Counter,
  Histogram,
  ObservableGauge,
  MetricOptions,
  Attributes,
} from '@opentelemetry/api';
import { getTelemetry } from './telemetry.service';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}

/**
 * MetricsService - Manages custom metrics collection
 */
export class MetricsService {
  private meter: Meter;
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private gauges: Map<string, ObservableGauge> = new Map();

  constructor(meterName?: string) {
    const telemetry = getTelemetry();
    this.meter = telemetry.getMeter(meterName);
  }

  /**
   * Get or create a counter metric
   */
  private getCounter(name: string, options?: MetricOptions): Counter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = this.meter.createCounter(name, options);
      this.counters.set(name, counter);
    }
    return counter;
  }

  /**
   * Get or create a histogram metric
   */
  private getHistogram(name: string, options?: MetricOptions): Histogram {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = this.meter.createHistogram(name, options);
      this.histograms.set(name, histogram);
    }
    return histogram;
  }

  // ============================================================================
  // Counter Metrics
  // ============================================================================

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value = 1, attributes?: Attributes): void {
    const counter = this.getCounter(name, {
      description: `Counter for ${name}`,
    });
    counter.add(value, attributes);
  }

  /**
   * Track HTTP request count
   */
  recordHttpRequest(method: string, route: string, statusCode: number): void {
    this.incrementCounter('http.requests.total', 1, {
      method,
      route,
      status_code: statusCode,
    });
  }

  /**
   * Track HTTP error count
   */
  recordHttpError(method: string, route: string, statusCode: number, errorType?: string): void {
    this.incrementCounter('http.errors.total', 1, {
      method,
      route,
      status_code: statusCode,
      error_type: errorType || 'unknown',
    });
  }

  /**
   * Track database query count
   */
  recordDatabaseQuery(operation: string, table?: string): void {
    this.incrementCounter('db.queries.total', 1, {
      operation,
      table: table || 'unknown',
    });
  }

  /**
   * Track database error count
   */
  recordDatabaseError(operation: string, errorType: string): void {
    this.incrementCounter('db.errors.total', 1, {
      operation,
      error_type: errorType,
    });
  }

  /**
   * Track cache hit
   */
  recordCacheHit(cacheKey: string): void {
    this.incrementCounter('cache.hits.total', 1, {
      cache_key: cacheKey,
    });
  }

  /**
   * Track cache miss
   */
  recordCacheMiss(cacheKey: string): void {
    this.incrementCounter('cache.misses.total', 1, {
      cache_key: cacheKey,
    });
  }

  /**
   * Track business event
   */
  recordBusinessEvent(eventName: string, attributes?: Attributes): void {
    this.incrementCounter(`business.events.${eventName}`, 1, attributes);
  }

  // ============================================================================
  // Histogram Metrics (Distributions)
  // ============================================================================

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, attributes?: Attributes): void {
    const histogram = this.getHistogram(name, {
      description: `Histogram for ${name}`,
    });
    histogram.record(value, attributes);
  }

  /**
   * Record HTTP request duration
   */
  recordHttpDuration(method: string, route: string, durationMs: number, statusCode: number): void {
    this.recordHistogram('http.request.duration', durationMs, {
      method,
      route,
      status_code: statusCode,
    });
  }

  /**
   * Record database query duration
   */
  recordDatabaseDuration(operation: string, durationMs: number, table?: string): void {
    this.recordHistogram('db.query.duration', durationMs, {
      operation,
      table: table || 'unknown',
    });
  }

  /**
   * Record cache operation duration
   */
  recordCacheDuration(operation: 'get' | 'set' | 'delete', durationMs: number): void {
    this.recordHistogram('cache.operation.duration', durationMs, {
      operation,
    });
  }

  /**
   * Record external API call duration
   */
  recordExternalApiDuration(
    service: string,
    endpoint: string,
    durationMs: number,
    statusCode?: number
  ): void {
    this.recordHistogram('external.api.duration', durationMs, {
      service,
      endpoint,
      status_code: statusCode || 0,
    });
  }

  /**
   * Record business operation duration
   */
  recordOperationDuration(operation: string, durationMs: number, attributes?: Attributes): void {
    this.recordHistogram(`business.operation.${operation}.duration`, durationMs, attributes);
  }

  /**
   * Record payload size
   */
  recordPayloadSize(type: 'request' | 'response', sizeBytes: number, route?: string): void {
    this.recordHistogram(`http.${type}.size`, sizeBytes, {
      route: route || 'unknown',
    });
  }

  // ============================================================================
  // Gauge Metrics (Current Values)
  // ============================================================================

  /**
   * Create an observable gauge metric
   */
  createGauge(
    name: string,
    callback: () => number,
    options?: MetricOptions & { attributes?: Attributes }
  ): void {
    if (this.gauges.has(name)) {
      console.warn(`Gauge ${name} already exists`);
      return;
    }

    const gauge = this.meter.createObservableGauge(name, options);
    gauge.addCallback((observableResult) => {
      observableResult.observe(callback(), options?.attributes);
    });

    this.gauges.set(name, gauge);
  }

  /**
   * Create system resource gauges (memory, CPU)
   */
  createSystemGauges(): void {
    // Memory usage gauge
    this.createGauge(
      'system.memory.usage',
      () => {
        const memUsage = process.memoryUsage();
        return memUsage.heapUsed;
      },
      {
        description: 'Current memory usage in bytes',
      }
    );

    // Memory RSS gauge
    this.createGauge(
      'system.memory.rss',
      () => {
        const memUsage = process.memoryUsage();
        return memUsage.rss;
      },
      {
        description: 'Resident Set Size in bytes',
      }
    );

    // Event loop lag gauge (if available)
    if (typeof process.hrtime === 'function') {
      let lastTime = process.hrtime();
      this.createGauge(
        'system.event_loop.lag',
        () => {
          const currentTime = process.hrtime();
          const lag = (currentTime[0] - lastTime[0]) * 1000 + (currentTime[1] - lastTime[1]) / 1e6;
          lastTime = currentTime;
          return lag;
        },
        {
          description: 'Event loop lag in milliseconds',
        }
      );
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Time a function execution and record duration
   */
  async timeAsync<T>(
    metricName: string,
    fn: () => Promise<T>,
    attributes?: Attributes
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.recordHistogram(metricName, duration, attributes);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordHistogram(metricName, duration, {
        ...attributes,
        error: 'true',
      });
      throw error;
    }
  }

  /**
   * Time a synchronous function execution and record duration
   */
  time<T>(metricName: string, fn: () => T, attributes?: Attributes): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = Date.now() - start;
      this.recordHistogram(metricName, duration, attributes);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordHistogram(metricName, duration, {
        ...attributes,
        error: 'true',
      });
      throw error;
    }
  }

  /**
   * Create a timer that returns a stop function
   */
  startTimer(metricName: string, attributes?: Attributes): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.recordHistogram(metricName, duration, attributes);
    };
  }

  /**
   * Get all registered metric names
   */
  getRegisteredMetrics(): {
    counters: string[];
    histograms: string[];
    gauges: string[];
  } {
    return {
      counters: Array.from(this.counters.keys()),
      histograms: Array.from(this.histograms.keys()),
      gauges: Array.from(this.gauges.keys()),
    };
  }
}

/**
 * Singleton metrics instance
 */
let defaultMetrics: MetricsService | null = null;

/**
 * Get or create the default metrics instance
 */
export function getMetrics(meterName?: string): MetricsService {
  if (!defaultMetrics) {
    defaultMetrics = new MetricsService(meterName);
  }
  return defaultMetrics;
}

/**
 * Create a new metrics instance (non-singleton)
 */
export function createMetrics(meterName?: string): MetricsService {
  return new MetricsService(meterName);
}
