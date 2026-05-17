import { describe, expect, it, vi } from 'vitest';
import {
  PerformanceMonitor,
  RequestMetrics,
} from './performance.middleware';

const SILENT_LOGGER = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

function makeMetrics(over: Partial<RequestMetrics> = {}): RequestMetrics {
  return {
    requestId: 'req-1',
    method: 'GET',
    url: '/api/v1/projects',
    statusCode: 200,
    duration: 50,
    timestamp: Date.now(),
    requestSize: 0,
    responseSize: 0,
    isSlow: false,
    ...over,
  };
}

describe('PerformanceMonitor', () => {
  it('records a request and reflects it in recent metrics', () => {
    const monitor = new PerformanceMonitor({ enableAggregation: false }, SILENT_LOGGER);
    monitor.recordRequest(makeMetrics());
    expect(monitor.getRecentMetrics(10)).toHaveLength(1);
  });

  it('aggregates metrics per normalized endpoint', () => {
    const monitor = new PerformanceMonitor({}, SILENT_LOGGER);
    monitor.recordRequest(makeMetrics({ url: '/api/v1/projects/123', duration: 100 }));
    monitor.recordRequest(makeMetrics({ url: '/api/v1/projects/456', duration: 200 }));
    const all = monitor.getEndpointMetrics() as Array<{
      endpoint: string;
      count: number;
      averageDuration: number;
    }>;
    expect(all).toHaveLength(1);
    expect(all[0].endpoint).toBe('GET /api/v1/projects/:id');
    expect(all[0].count).toBe(2);
    expect(all[0].averageDuration).toBe(150);
  });

  it('normalizes UUID, numeric, and ObjectId path segments', () => {
    const monitor = new PerformanceMonitor({}, SILENT_LOGGER);
    monitor.recordRequest(
      makeMetrics({
        url: '/api/v1/users/550e8400-e29b-41d4-a716-446655440000/profile',
      }),
    );
    monitor.recordRequest(makeMetrics({ url: '/api/v1/users/42/profile' }));
    monitor.recordRequest(
      makeMetrics({ url: '/api/v1/users/507f1f77bcf86cd799439011/profile' }),
    );
    const endpoints = monitor.getEndpointMetrics() as Array<{ endpoint: string }>;
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].endpoint).toBe('GET /api/v1/users/:id/profile');
  });

  it('tracks slow vs fast requests and fires onSlowQuery', () => {
    const slowSpy = vi.fn();
    const monitor = new PerformanceMonitor(
      { slowQueryThreshold: 100, onSlowQuery: slowSpy },
      SILENT_LOGGER,
    );
    monitor.recordRequest(makeMetrics({ isSlow: true, duration: 250 }));
    monitor.recordRequest(makeMetrics({ isSlow: false, duration: 10 }));
    expect(slowSpy).toHaveBeenCalledTimes(1);
    expect(monitor.getSlowRequests().length).toBe(1);
  });

  it('separates errorCount from successCount in aggregated stats', () => {
    const monitor = new PerformanceMonitor({}, SILENT_LOGGER);
    monitor.recordRequest(makeMetrics({ statusCode: 500 }));
    monitor.recordRequest(makeMetrics({ statusCode: 200 }));
    const summary = monitor.getSummary();
    expect(summary.totalErrors).toBe(1);
    expect(summary.totalRequests).toBe(2);
    expect(summary.errorRate).toBe(0.5);
  });

  it('returns an empty descriptor for unknown endpoints', () => {
    const monitor = new PerformanceMonitor({}, SILENT_LOGGER);
    expect(monitor.getEndpointMetrics('GET /missing')).toEqual({});
  });

  it('reset() clears all stored metrics', () => {
    const monitor = new PerformanceMonitor({}, SILENT_LOGGER);
    monitor.recordRequest(makeMetrics());
    monitor.reset();
    expect(monitor.getRecentMetrics()).toHaveLength(0);
    expect(monitor.getEndpointMetrics()).toEqual([]);
  });

  it('fires onMetrics for every recorded request', () => {
    const spy = vi.fn();
    const monitor = new PerformanceMonitor({ onMetrics: spy }, SILENT_LOGGER);
    monitor.recordRequest(makeMetrics());
    monitor.recordRequest(makeMetrics());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('caps in-memory request history to prevent leaks', () => {
    const monitor = new PerformanceMonitor({ enableAggregation: false }, SILENT_LOGGER);
    for (let i = 0; i < 10_002; i += 1) {
      monitor.recordRequest(makeMetrics({ requestId: `r-${i}` }));
    }
    expect(monitor.getRecentMetrics(20_000).length).toBeLessThanOrEqual(10_000);
  });

  it('updates min/max durations correctly across requests', () => {
    const monitor = new PerformanceMonitor({}, SILENT_LOGGER);
    monitor.recordRequest(makeMetrics({ duration: 100 }));
    monitor.recordRequest(makeMetrics({ duration: 50 }));
    monitor.recordRequest(makeMetrics({ duration: 300 }));
    const all = monitor.getEndpointMetrics() as Array<{
      minDuration: number;
      maxDuration: number;
    }>;
    expect(all[0].minDuration).toBe(50);
    expect(all[0].maxDuration).toBe(300);
  });
});
