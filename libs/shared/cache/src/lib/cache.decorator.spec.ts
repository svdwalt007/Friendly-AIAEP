import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cacheable, CacheEvict, CachePut, createCacheKey } from './cache.decorator';
import type { CacheService } from './cache.service';

function makeMockCache(): CacheService {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    deletePattern: vi.fn().mockResolvedValue(0),
    clear: vi.fn().mockResolvedValue(true),
  } as unknown as CacheService;
}

describe('Cacheable decorator', () => {
  let mock: CacheService;

  beforeEach(() => {
    mock = makeMockCache();
  });

  afterEach(() => vi.restoreAllMocks());

  it('caches the method result on first call and returns cache on second', async () => {
    let invocations = 0;
    class Svc {
      @Cacheable({ cacheService: mock, key: 'svc' })
      async load(id: string) {
        invocations += 1;
        return { id };
      }
    }

    const svc = new Svc();
    const a = await svc.load('1');
    expect(a).toEqual({ id: '1' });
    expect(invocations).toBe(1);
    expect(mock.set).toHaveBeenCalled();

    (mock.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: '1' });
    const b = await svc.load('1');
    expect(b).toEqual({ id: '1' });
    expect(invocations).toBe(1);
  });

  it('skips caching when condition returns false', async () => {
    class Svc {
      @Cacheable({
        cacheService: mock,
        key: 'svc',
        condition: (id: string) => id !== 'admin',
      })
      async load(id: string) {
        return { id };
      }
    }
    await new Svc().load('admin');
    expect(mock.get).not.toHaveBeenCalled();
    expect(mock.set).not.toHaveBeenCalled();
  });

  it('does not cache null results by default', async () => {
    class Svc {
      @Cacheable({ cacheService: mock, key: 'svc' })
      async load() {
        return null;
      }
    }
    await new Svc().load();
    expect(mock.set).not.toHaveBeenCalled();
  });

  it('caches null results when cacheNullValues is true', async () => {
    class Svc {
      @Cacheable({ cacheService: mock, key: 'svc', cacheNullValues: true })
      async load() {
        return null;
      }
    }
    await new Svc().load();
    expect(mock.set).toHaveBeenCalled();
  });

  it('falls back to method when cache.get throws', async () => {
    (mock.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    class Svc {
      @Cacheable({ cacheService: mock, key: 'svc' })
      async load() {
        return 'fresh';
      }
    }
    expect(await new Svc().load()).toBe('fresh');
  });

  it('uses function-style key when provided', async () => {
    class Svc {
      @Cacheable({ cacheService: mock, key: (id: string) => `user:${id}` })
      async load(id: string) {
        return id;
      }
    }
    await new Svc().load('42');
    expect(mock.set).toHaveBeenCalledWith('user:42', '42', undefined);
  });
});

describe('CacheEvict decorator', () => {
  let mock: CacheService;
  beforeEach(() => (mock = makeMockCache()));

  it('clears all entries when allEntries is true', async () => {
    class Svc {
      @CacheEvict({ cacheService: mock, allEntries: true })
      async wipe() {
        return 'ok';
      }
    }
    await new Svc().wipe();
    expect(mock.clear).toHaveBeenCalled();
  });

  it('deletes a specific key after method execution', async () => {
    class Svc {
      @CacheEvict({ cacheService: mock, key: (id: string) => `u:${id}` })
      async remove(_id: string) {
        return 'ok';
      }
    }
    await new Svc().remove('7');
    expect(mock.delete).toHaveBeenCalledWith('u:7');
  });

  it('evicts before invocation when beforeInvocation is true', async () => {
    const calls: string[] = [];
    (mock.delete as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('delete');
      return true;
    });
    class Svc {
      @CacheEvict({
        cacheService: mock,
        key: 'k',
        beforeInvocation: true,
      })
      async run() {
        calls.push('method');
      }
    }
    await new Svc().run();
    expect(calls).toEqual(['delete', 'method']);
  });

  it('uses deletePattern when key contains *', async () => {
    class Svc {
      @CacheEvict({ cacheService: mock, key: 'u:*' })
      async run() {
        return 'ok';
      }
    }
    await new Svc().run();
    expect(mock.deletePattern).toHaveBeenCalledWith('u:*');
  });
});

describe('CachePut decorator', () => {
  let mock: CacheService;
  beforeEach(() => (mock = makeMockCache()));

  it('always executes method and writes result to cache', async () => {
    class Svc {
      @CachePut({ cacheService: mock, key: 'k', ttl: 30 })
      async run() {
        return { x: 1 };
      }
    }
    await new Svc().run();
    expect(mock.set).toHaveBeenCalledWith('k', { x: 1 }, 30);
  });

  it('skips cache update when condition returns false', async () => {
    class Svc {
      @CachePut({ cacheService: mock, key: 'k', condition: () => false })
      async run() {
        return 'v';
      }
    }
    await new Svc().run();
    expect(mock.set).not.toHaveBeenCalled();
  });
});

describe('createCacheKey', () => {
  it('returns the prefix when no parts are supplied', () => {
    expect(createCacheKey('p')).toBe('p');
  });

  it('joins parts with colons and stringifies primitives', () => {
    expect(createCacheKey('user', '1', 2, true)).toBe('user:1:2:true');
  });

  it('stringifies objects via JSON', () => {
    expect(createCacheKey('q', { a: 1 })).toBe('q:{"a":1}');
  });
});
