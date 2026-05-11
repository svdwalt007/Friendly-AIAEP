/**
 * Telemetry Middleware for Fastify
 *
 * Features:
 * - Automatic request/response tracing
 * - HTTP metrics collection
 * - Request/response logging
 * - Error tracking
 * - Performance monitoring
 *
 * @module TelemetryMiddleware
 */

import { FastifyRequest, FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { context, trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { getTelemetry, getLogger, getMetrics } from '@friendly-aep/shared-observability';

/**
 * Telemetry middleware options
 */
export interface TelemetryMiddlewareOptions {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableTracing?: boolean;
  ignoreRoutes?: string[];
  logRequestBody?: boolean;
  logResponseBody?: boolean;
}

/**
 * Default middleware options
 */
const DEFAULT_OPTIONS: TelemetryMiddlewareOptions = {
  enableMetrics: true,
  enableLogging: true,
  enableTracing: true,
  ignoreRoutes: ['/health', '/metrics', '/favicon.ico'],
  logRequestBody: false, // Disabled by default for security
  logResponseBody: false, // Disabled by default for performance
};

/**
 * Check if route should be ignored
 */
function shouldIgnoreRoute(url: string, ignoreRoutes: string[]): boolean {
  return ignoreRoutes.some((route) => url.startsWith(route));
}

/**
 * Get route pattern from Fastify request
 */
function getRoutePattern(request: FastifyRequest): string {
  // Try to get the route pattern from Fastify's routerPath
  if (request.routeOptions?.url) {
    return request.routeOptions.url;
  }
  // Fallback to the raw URL
  return request.url;
}

/**
 * Sanitize route for metrics (remove IDs and dynamic segments)
 */
function sanitizeRoute(route: string): string {
  // Replace UUIDs and numeric IDs with placeholders
  return route
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Telemetry middleware plugin for Fastify
 */
async function telemetryMiddleware(
  fastify: FastifyInstance,
  options: TelemetryMiddlewareOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Initialize services
  const telemetry = getTelemetry();
  const logger = getLogger({ name: 'api-gateway' });
  const metrics = getMetrics('api-gateway');

  // Create system gauges
  if (config.enableMetrics) {
    metrics.createSystemGauges();
  }

  // ============================================================================
  // Request Hook - Start tracing and timing
  // ============================================================================
  fastify.addHook('onRequest', async (request, _reply) => {
    // Skip ignored routes
    if (shouldIgnoreRoute(request.url, config.ignoreRoutes || [])) {
      return;
    }

    // Store request start time
    (request as any).startTime = Date.now();

    // Start tracing span
    if (config.enableTracing) {
      const tracer = telemetry.getTracer();
      const span = tracer.startSpan(`${request.method} ${request.url}`, {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': request.method,
          'http.url': request.url,
          'http.target': request.url,
          'http.host': request.hostname,
          'http.scheme': request.protocol,
          'http.user_agent': request.headers['user-agent'] || '',
          'http.request_id': request.id,
        },
      });

      // Store span in request context for later use
      (request as any).span = span;

      // Set span as active in context
      const activeContext = trace.setSpan(context.active(), span);
      (request as any).otelContext = activeContext;
    }

    // Log request
    if (config.enableLogging) {
      logger.info(`Incoming request: ${request.method} ${request.url}`, {
        http: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          query: request.query,
          params: request.params,
          ...(config.logRequestBody && { body: request.body }),
        },
        request_id: request.id,
      });
    }
  });

  // ============================================================================
  // Response Hook - End tracing and record metrics
  // ============================================================================
  fastify.addHook('onResponse', async (request, reply) => {
    // Skip ignored routes
    if (shouldIgnoreRoute(request.url, config.ignoreRoutes || [])) {
      return;
    }

    // Calculate request duration
    const startTime = (request as any).startTime;
    const duration = startTime ? Date.now() - startTime : 0;

    const route = sanitizeRoute(getRoutePattern(request));
    const statusCode = reply.statusCode;

    // Record metrics
    if (config.enableMetrics) {
      metrics.recordHttpRequest(request.method, route, statusCode);
      metrics.recordHttpDuration(request.method, route, duration, statusCode);

      // Record error metric if status code indicates error
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        metrics.recordHttpError(request.method, route, statusCode, errorType);
      }
    }

    // Update and end tracing span
    if (config.enableTracing) {
      const span = (request as any).span;
      if (span) {
        span.setAttributes({
          'http.status_code': statusCode,
          'http.response_time_ms': duration,
        });

        // Set span status based on HTTP status code
        if (statusCode >= 400) {
          span.setStatus({
            code: statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
            message: statusCode >= 500 ? 'Server Error' : 'Client Error',
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
      }
    }

    // Log response
    if (config.enableLogging) {
      const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel](`Response: ${request.method} ${request.url} - ${statusCode}`, {
        http: {
          method: request.method,
          url: request.url,
          status_code: statusCode,
          duration_ms: duration,
        },
        request_id: request.id,
      });
    }
  });

  // ============================================================================
  // Error Hook - Record errors in traces and metrics
  // ============================================================================
  fastify.addHook('onError', async (request, _reply, error) => {
    // Skip ignored routes
    if (shouldIgnoreRoute(request.url, config.ignoreRoutes || [])) {
      return;
    }

    const route = sanitizeRoute(getRoutePattern(request));

    // Record error in span
    if (config.enableTracing) {
      const span = (request as any).span;
      if (span) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      }
    }

    // Record error metric
    if (config.enableMetrics) {
      const statusCode = (error as any).statusCode || 500;
      metrics.recordHttpError(request.method, route, statusCode, error.name);
    }

    // Log error
    if (config.enableLogging) {
      logger.error(`Request error: ${request.method} ${request.url}`, error, {
        http: {
          method: request.method,
          url: request.url,
        },
        request_id: request.id,
      });
    }
  });

  // ============================================================================
  // Add tracing context decorator to request
  // ============================================================================
  fastify.decorateRequest('getTraceContext', function (this: FastifyRequest) {
    return telemetry.getTraceContext();
  });

  // Add logger decorator to request
  fastify.decorateRequest('logger', logger);

  // Add metrics decorator to request
  fastify.decorateRequest('metrics', metrics);

  logger.info('Telemetry middleware registered', {
    enableMetrics: config.enableMetrics,
    enableLogging: config.enableLogging,
    enableTracing: config.enableTracing,
  });
}

/**
 * Export as Fastify plugin
 */
export default fastifyPlugin(telemetryMiddleware, {
  fastify: '5.x',
  name: 'telemetry-middleware',
});

/**
 * Extend Fastify types to include telemetry decorators
 */
declare module 'fastify' {
  interface FastifyRequest {
    getTraceContext(): { traceId?: string; spanId?: string; traceFlags?: string };
    logger: ReturnType<typeof getLogger>;
    metrics: ReturnType<typeof getMetrics>;
  }
}
