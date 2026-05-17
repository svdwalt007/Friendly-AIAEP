import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CacheService, createCacheService, getCacheService } from './cache.service';

const SILENT_LOGGER = {
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
};

describe('CacheService (in-memory fallback only)', () => {
  let cache: CacheService;
  const ORIGINAL_REDIS_URL = process.env['REDIS_URL'];

  beforeEach(() => {
    vi.useFakeTimers();
    delete process.env['REDIS_URL'];
    cache = new CacheService(
      { defaultTTL: 60, namespace: 'test', enableFallback: true },
      SILENT_LOGGER,
    );
  });

  afterEach(async () => {
    await cache.close();
    vi.useRealTimers();
    if (ORIGINAL_REDIS_URL !== undefined) process.env['REDIS_URL'] = ORIGINAL_REDIS_URL;
  });

  it('set/get round-trips a typed value', async () => {
    await cache.set('user:1', { id: 1, name: 'Sean' });
    const value = await cache.get<{ id: number; name: string }>('user:1');
    expect(value).toEqual({ id: 1, name: 'Sean' });
  });

  it('get returns null on miss', async () => {
    expect(await cache.get('absent')).toBeNull();
  });

  it('delete removes a key', async () => {
    await cache.set('k', 'v');
    expect(await cache.delete('k')).toBe(true);
    expect(await cache.get('k')).toBeNull();
  });

  it('has reports existence', async () => {
    expect(await cache.has('k')).toBe(false);
    await cache.set('k', 'v');
    expect(await cache.has('k')).toBe(true);
  });

  it('expires entries past TTL', async () => {
    await cache.set('soon', 'gone', 1);
    vi.advanceTimersByTime(1_500);
    expect(await cache.get('soon')).toBeNull();
  });

  it('deletePattern removes matching memory keys', async () => {
    await cache.set('user:1', 'a');
    await cache.set('user:2', 'b');
    await cache.set('post:1', 'c');
    const deleted = await cache.deletePattern('user:*');
    expect(deleted).toBeGreaterThanOrEqual(2);
    expect(await cache.get('user:1')).toBeNull();
    expect(await cache.get('post:1')).toBe('c');
  });

  it('clear wipes all memory entries', async () => {
    await cache.set('k', 'v');
    await cache.clear();
    expect(await cache.get('k')).toBeNull();
  });

  it('getStats reports hit/miss counts and hitRate', async () => {
    await cache.set('k', 'v');
    await cache.get('k');
    await cache.get('absent');
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });

  it('resetStats clears counters', async () => {
    await cache.set('k', 'v');
    cache.resetStats();
    expect(cache.getStats()).toEqual({
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
    });
  });

  it('buildKey deduplicates namespace prefix', async () => {
    await cache.set('test:already-prefixed', 'v');
    // The key path with double prefix would miss — single prefix should hit.
    expect(await cache.get('test:already-prefixed')).toBe('v');
  });
});

describe('createCacheService / getCacheService factories', () => {
  it('createCacheService returns a fresh instance', () => {
    delete process.env['REDIS_URL'];
    const a = createCacheService({}, SILENT_LOGGER);
    const b = createCacheService({}, SILENT_LOGGER);
    expect(a).not.toBe(b);
  });

  it('getCacheService returns the same singleton on repeated calls', () => {
    delete process.env['REDIS_URL'];
    const first = getCacheService({}, SILENT_LOGGER);
    const second = getCacheService();
    expect(first).toBe(second);
  });
});
