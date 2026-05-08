import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Performance Monitoring Middleware
 *
 * Features:
 * - Request timing and duration tracking
 * - Slow query detection with configurable thresholds
 * - Performance metrics collection
 * - Memory usage monitoring
 * - Request size tracking
 * - Response size tracking
 * - Endpoint performance aggregation
 * - Alerting for performance degradation
 */

/**
 * Performance metrics for a single request
 */
export interface RequestMetrics {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  userAgent?: string;
  userId?: string;
  tenantId?: string;
  requestSize: number;
  responseSize: number;
  memoryUsage?: NodeJS.MemoryUsage;
  isSlow: boolean;
}

/**
 * Aggregated performance metrics per endpoint
 */
export interface EndpointMetrics {
  endpoint: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  slowCount: number;
  errorCount: number;
  successCount: number;
  lastUpdated: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /**
   * Threshold for slow requests in milliseconds
   */
  slowQueryThreshold?: number;

  /**
   * Enable memory monitoring
   */
  enableMemoryMonitoring?: boolean;

  /**
   * Enable request/response size tracking
   */
  enableSizeTracking?: boolean;

  /**
   * Enable endpoint aggregation
   */
  enableAggregation?: boolean;

  /**
   * Aggregation window in milliseconds
   */
  aggregationWindow?: number;

  /**
   * Custom slow query handler
   */
  onSlowQuery?: (metrics: RequestMetrics) => void;

  /**
   * Custom metrics handler
   */
  onMetrics?: (metrics: RequestMetrics) => void;
}

/**
 * Performance monitoring service
 */
class PerformanceMonitor {
  private config: Required<PerformanceConfig>;
  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  private requestMetrics: RequestMetrics[] = [];
  private logger: any;

  constructor(config: PerformanceConfig = {}, logger?: any) {
    this.config = {
      slowQueryThreshold: config.slowQueryThreshold || 1000,
      enableMemoryMonitoring: config.enableMemoryMonitoring !== false,
      enableSizeTracking: config.enableSizeTracking !== false,
      enableAggregation: config.enableAggregation !== false,
      aggregationWindow: config.aggregationWindow || 60000,
      onSlowQuery: config.onSlowQuery || (() => {}),
      onMetrics: config.onMetrics || (() => {}),
    };

    this.logger = logger || console;

    // Start cleanup interval for old metrics
    if (this.config.enableAggregation) {
      this.startCleanupInterval();
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(metrics: RequestMetrics): void {
    // Store individual metrics
    this.requestMetrics.push(metrics);

    // Limit stored metrics to prevent memory leaks
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics = this.requestMetrics.slice(-5000);
    }

    // Update endpoint aggregation
    if (this.config.enableAggregation) {
      this.updateEndpointMetrics(metrics);
    }

    // Call custom metrics handler
    this.config.onMetrics(metrics);

    // Handle slow queries
    if (metrics.isSlow) {
      this.logger.warn({
        requestId: metrics.requestId,
        method: metrics.method,
        url: metrics.url,
        duration: metrics.duration,
        userId: metrics.userId,
        tenantId: metrics.tenantId,
      }, `Slow request detected: ${metrics.duration}ms`);

      this.config.onSlowQuery(metrics);
    }
  }

  /**
   * Update endpoint metrics aggregation
   */
  private updateEndpointMetrics(metrics: RequestMetrics): void {
    const endpoint = this.normalizeEndpoint(metrics.method, metrics.url);
    const existing = this.endpointMetrics.get(endpoint);

    if (existing) {
      // Update existing metrics
      existing.count++;
      existing.totalDuration += metrics.duration;
      existing.averageDuration = existing.totalDuration / existing.count;
      existing.minDuration = Math.min(existing.minDuration, metrics.duration);
      existing.maxDuration = Math.max(existing.maxDuration, metrics.duration);
      existing.lastUpdated = Date.now();

      if (metrics.isSlow) {
        existing.slowCount++;
      }

      if (metrics.statusCode >= 400) {
        existing.errorCount++;
      } else {
        existing.successCount++;
      }
    } else {
      // Create new metrics entry
      this.endpointMetrics.set(endpoint, {
        endpoint,
        count: 1,
        totalDuration: metrics.duration,
        averageDuration: metrics.duration,
        minDuration: metrics.duration,
        maxDuration: metrics.duration,
        slowCount: metrics.isSlow ? 1 : 0,
        errorCount: metrics.statusCode >= 400 ? 1 : 0,
        successCount: metrics.statusCode < 400 ? 1 : 0,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Normalize endpoint URL for aggregation
   * Replaces dynamic segments with placeholders
   */
  private normalizeEndpoint(method: string, url: string): string {
    // Remove query parameters
    const baseUrl = url.split('?')[0];

    // Replace UUIDs and IDs with placeholders
    const normalized = baseUrl
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{24}/g, '/:id'); // MongoDB ObjectId

    return `${method} ${normalized}`;
  }

  /**
   * Get endpoint metrics
   */
  getEndpointMetrics(endpoint?: string): EndpointMetrics | EndpointMetrics[] {
    if (endpoint) {
      return this.endpointMetrics.get(endpoint) || ({} as EndpointMetrics);
    }

    return Array.from(this.endpointMetrics.values());
  }

  /**
   * Get recent request metrics
   */
  getRecentMetrics(limit = 100): RequestMetrics[] {
    return this.requestMetrics.slice(-limit);
  }

  /**
   * Get slow requests
   */
  getSlowRequests(limit = 100): RequestMetrics[] {
    return this.requestMetrics
      .filter((m) => m.isSlow)
      .slice(-limit);
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const allMetrics = Array.from(this.endpointMetrics.values());

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.count, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalSlow = allMetrics.reduce((sum, m) => sum + m.slowCount, 0);

    const avgDuration = allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.averageDuration, 0) / allMetrics.length
      : 0;

    return {
      totalRequests,
      totalErrors,
      totalSlow,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      slowRate: totalRequests > 0 ? totalSlow / totalRequests : 0,
      averageDuration: avgDuration,
      endpointCount: allMetrics.length,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.endpointMetrics.clear();
    this.requestMetrics = [];
    this.logger.info('Performance metrics reset');
  }

  /**
   * Start cleanup interval for old metrics
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const window = this.config.aggregationWindow;

      // Remove old endpoint metrics
      for (const [endpoint, metrics] of this.endpointMetrics.entries()) {
        if (now - metrics.lastUpdated > window * 10) {
          this.endpointMetrics.delete(endpoint);
        }
      }

      // Limit request metrics array size
      if (this.requestMetrics.length > 5000) {
        this.requestMetrics = this.requestMetrics.slice(-2500);
      }
    }, this.config.aggregationWindow);
  }
}

/**
 * Global performance monitor instance
 */
let performanceMonitor: PerformanceMonitor;

/**
 * Get or create performance monitor instance
 */
export function getPerformanceMonitor(config?: PerformanceConfig, logger?: any): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(config, logger);
  }
  return performanceMonitor;
}

/**
 * Create performance monitoring middleware plugin
 *
 * Usage:
 * ```typescript
 * fastify.register(performanceMonitoring, {
 *   slowQueryThreshold: 1000,
 *   enableMemoryMonitoring: true,
 * });
 * ```
 */
export default fp(async function performanceMonitoring(
  fastify: FastifyInstance,
  options: PerformanceConfig = {}
) {
  const monitor = getPerformanceMonitor(options, fastify.log);

  // Add request timing hook
  fastify.addHook('onRequest', async (request, _reply) => {
    (request as any).startTime = process.hrtime.bigint();

    // Track request size if enabled
    if (options.enableSizeTracking) {
      const contentLength = request.headers['content-length'];
      (request as any).requestSize = contentLength ? parseInt(contentLength) : 0;
    }
  });

  // Add response timing and metrics hook
  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime;
    if (!startTime) return;

    // Calculate duration in milliseconds
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms

    // Get user information if available
    const user = (request as any).user;

    // Get response size
    const responseSize = reply.getHeader('content-length')
      ? parseInt(reply.getHeader('content-length') as string)
      : 0;

    // Create metrics object
    const metrics: RequestMetrics = {
      requestId: (request.id as string) || 'unknown',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      timestamp: Date.now(),
      userAgent: request.headers['user-agent'],
      userId: user?.id || user?.sub,
      tenantId: user?.tenantId,
      requestSize: (request as any).requestSize || 0,
      responseSize,
      isSlow: duration > (options.slowQueryThreshold || 1000),
    };

    // Add memory usage if enabled
    if (options.enableMemoryMonitoring) {
      metrics.memoryUsage = process.memoryUsage();
    }

    // Record metrics
    monitor.recordRequest(metrics);
  });

  // Add performance metrics endpoints
  fastify.get('/metrics/performance', async (_request, _reply) => {
    return monitor.getSummary();
  });

  fastify.get('/metrics/performance/endpoints', async (request, _reply) => {
    const endpoint = request.query && (request.query as any).endpoint;
    return monitor.getEndpointMetrics(endpoint);
  });

  fastify.get('/metrics/performance/slow', async (request, _reply) => {
    const limit = request.query && (request.query as any).limit
      ? parseInt((request.query as any).limit)
      : 100;
    return monitor.getSlowRequests(limit);
  });

  fastify.get('/metrics/performance/recent', async (request, _reply) => {
    const limit = request.query && (request.query as any).limit
      ? parseInt((request.query as any).limit)
      : 100;
    return monitor.getRecentMetrics(limit);
  });

  fastify.post('/metrics/performance/reset', async (_request, _reply) => {
    monitor.reset();
    return { success: true, message: 'Performance metrics reset' };
  });

  fastify.log.info('Performance monitoring middleware registered');
});

/**
 * Export performance monitor for direct access
 */
export { PerformanceMonitor };
