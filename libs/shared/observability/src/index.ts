/**
 * Shared Observability Library
 *
 * Comprehensive observability solution with:
 * - OpenTelemetry integration (traces, metrics, logs)
 * - Structured logging with Pino
 * - Custom metrics collection
 * - Distributed tracing
 *
 * @module @friendly-aep/shared-observability
 */

// Telemetry service exports
export {
  TelemetryService,
  TelemetryConfig,
  initializeTelemetry,
  getTelemetry,
  shutdownTelemetry,
} from './lib/telemetry.service';

// Logger service exports
export {
  LoggerService,
  LoggerConfig,
  LogLevel,
  getLogger,
  createLogger,
} from './lib/logger.service';

// Metrics service exports
export {
  MetricsService,
  MetricType,
  getMetrics,
  createMetrics,
} from './lib/metrics.service';
