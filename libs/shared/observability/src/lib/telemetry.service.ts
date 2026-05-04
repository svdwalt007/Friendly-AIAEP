/**
 * OpenTelemetry Telemetry Service
 *
 * Comprehensive observability setup with:
 * - Distributed tracing (Jaeger)
 * - Metrics collection (Prometheus)
 * - Log correlation
 * - Auto-instrumentation for HTTP, Fastify, Prisma
 *
 * @module TelemetryService
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { context, trace, metrics, Span, SpanStatusCode } from '@opentelemetry/api';

/**
 * Telemetry configuration options
 */
export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  jaegerEndpoint?: string;
  otlpEndpoint?: string;
  prometheusPort?: number;
  enableConsoleExport?: boolean;
  enableJaeger?: boolean;
  enableOTLP?: boolean;
  enablePrometheus?: boolean;
  sampleRate?: number;
}

/**
 * Default telemetry configuration
 */
const DEFAULT_CONFIG: Partial<TelemetryConfig> = {
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318',
  prometheusPort: Number(process.env.PROMETHEUS_PORT) || 9464,
  enableConsoleExport: process.env.NODE_ENV === 'development',
  enableJaeger: process.env.ENABLE_JAEGER === 'true' || process.env.NODE_ENV !== 'production',
  enableOTLP: process.env.ENABLE_OTLP === 'true',
  enablePrometheus: process.env.ENABLE_PROMETHEUS === 'true' || true,
  sampleRate: Number(process.env.TRACE_SAMPLE_RATE) || 1.0,
};

/**
 * TelemetryService - Manages OpenTelemetry SDK and instrumentation
 */
export class TelemetryService {
  private sdk: NodeSDK | null = null;
  private config: Required<TelemetryConfig>;
  private isInitialized = false;
  private prometheusExporter: PrometheusExporter | null = null;

  constructor(config: TelemetryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<TelemetryConfig>;
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('TelemetryService already initialized');
      return;
    }

    try {
      // Configure trace exporters
      const traceExporters: any[] = [];

      if (this.config.enableJaeger) {
        const jaegerExporter = new JaegerExporter({
          endpoint: this.config.jaegerEndpoint,
        });
        traceExporters.push(jaegerExporter);
      }

      if (this.config.enableOTLP) {
        const otlpTraceExporter = new OTLPTraceExporter({
          url: `${this.config.otlpEndpoint}/v1/traces`,
        });
        traceExporters.push(otlpTraceExporter);
      }

      // Configure metric readers
      const metricReaders: any[] = [];

      if (this.config.enablePrometheus) {
        this.prometheusExporter = new PrometheusExporter({
          port: this.config.prometheusPort,
        });
        metricReaders.push(this.prometheusExporter);
      }

      if (this.config.enableOTLP) {
        const otlpMetricExporter = new OTLPMetricExporter({
          url: `${this.config.otlpEndpoint}/v1/metrics`,
        });
        metricReaders.push(otlpMetricExporter);
      }

      // Initialize SDK with auto-instrumentations
      this.sdk = new NodeSDK({
        resourceDetectors: [],
        traceExporter: traceExporters.length > 0 ? traceExporters[0] : undefined,
        metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Fine-tune auto-instrumentation
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable file system instrumentation (too noisy)
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
            },
          }),
        ],
      });

      // Start the SDK
      await this.sdk.start();
      this.isInitialized = true;

      console.log(`✅ OpenTelemetry initialized for ${this.config.serviceName}`);
      console.log(`   Environment: ${this.config.environment}`);
      console.log(`   Jaeger: ${this.config.enableJaeger ? 'enabled' : 'disabled'}`);
      console.log(`   OTLP: ${this.config.enableOTLP ? 'enabled' : 'disabled'}`);
      console.log(`   Prometheus: ${this.config.enablePrometheus ? `enabled on port ${this.config.prometheusPort}` : 'disabled'}`);
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized || !this.sdk) {
      return;
    }

    try {
      await this.sdk.shutdown();
      this.isInitialized = false;
      console.log('✅ OpenTelemetry shutdown complete');
    } catch (error) {
      console.error('Error during OpenTelemetry shutdown:', error);
      throw error;
    }
  }

  /**
   * Get the current tracer
   */
  getTracer(name?: string) {
    return trace.getTracer(name || this.config.serviceName);
  }

  /**
   * Get the current meter for metrics
   */
  getMeter(name?: string) {
    return metrics.getMeter(name || this.config.serviceName);
  }

  /**
   * Create a span and execute a function within its context
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      attributes?: Record<string, string | number | boolean>;
      kind?: number;
    }
  ): Promise<T> {
    const tracer = this.getTracer();
    return tracer.startActiveSpan(name, options || {}, async (span) => {
      try {
        if (options?.attributes) {
          span.setAttributes(options.attributes);
        }
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get the current active span
   */
  getCurrentSpan(): Span | undefined {
    return trace.getSpan(context.active());
  }

  /**
   * Add attributes to the current span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Record an exception in the current span
   */
  recordException(error: Error): void {
    const span = this.getCurrentSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Get trace context for log correlation
   */
  getTraceContext(): { traceId?: string; spanId?: string; traceFlags?: string } {
    const span = this.getCurrentSpan();
    if (!span) {
      return {};
    }

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags.toString(16).padStart(2, '0'),
    };
  }

  /**
   * Check if telemetry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get Prometheus metrics endpoint (if enabled)
   */
  getPrometheusEndpoint(): string | null {
    if (!this.config.enablePrometheus) {
      return null;
    }
    return `http://localhost:${this.config.prometheusPort}/metrics`;
  }
}

/**
 * Singleton instance
 */
let telemetryInstance: TelemetryService | null = null;

/**
 * Initialize the global telemetry service
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<TelemetryService> {
  if (telemetryInstance) {
    console.warn('Telemetry already initialized, returning existing instance');
    return telemetryInstance;
  }

  telemetryInstance = new TelemetryService(config);
  await telemetryInstance.initialize();
  return telemetryInstance;
}

/**
 * Get the global telemetry instance
 */
export function getTelemetry(): TelemetryService {
  if (!telemetryInstance) {
    throw new Error('Telemetry not initialized. Call initializeTelemetry() first.');
  }
  return telemetryInstance;
}

/**
 * Shutdown the global telemetry instance
 */
export async function shutdownTelemetry(): Promise<void> {
  if (telemetryInstance) {
    await telemetryInstance.shutdown();
    telemetryInstance = null;
  }
}
