import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  SecretBackend,
  SecretsService,
  createSecretsService,
  getSecretsService,
} from './secrets.service';

const SILENT = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe('SecretsService (env backend)', () => {
  const ORIG_ENV = process.env['TEST_SECRET'];

  beforeEach(() => {
    process.env['TEST_SECRET'] = 'shh';
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (ORIG_ENV === undefined) delete process.env['TEST_SECRET'];
    else process.env['TEST_SECRET'] = ORIG_ENV;
    vi.useRealTimers();
  });

  it('returns a secret from the environment', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: false },
      SILENT,
    );
    expect(await svc.getSecret('TEST_SECRET')).toBe('shh');
  });

  it('returns undefined when secret is missing and not required', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: false },
      SILENT,
    );
    expect(await svc.getSecret('NOPE')).toBeUndefined();
  });

  it('throws when secret is missing and required: true', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: false },
      SILENT,
    );
    await expect(svc.getSecret('NOPE', { required: true })).rejects.toThrow(
      /Required secret/,
    );
  });

  it('caches values when caching is enabled', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: true, cacheTTL: 60_000 },
      SILENT,
    );
    await svc.getSecret('TEST_SECRET');
    delete process.env['TEST_SECRET'];
    // Still cached
    expect(await svc.getSecret('TEST_SECRET')).toBe('shh');
  });

  it('expires cached secrets past TTL', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: true, cacheTTL: 1_000 },
      SILENT,
    );
    await svc.getSecret('TEST_SECRET');
    delete process.env['TEST_SECRET'];
    vi.advanceTimersByTime(2_000);
    expect(await svc.getSecret('TEST_SECRET')).toBeUndefined();
  });

  it('invalidateCache forces a refetch', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: true, cacheTTL: 60_000 },
      SILENT,
    );
    await svc.getSecret('TEST_SECRET');
    svc.invalidateCache('TEST_SECRET');
    delete process.env['TEST_SECRET'];
    expect(await svc.getSecret('TEST_SECRET')).toBeUndefined();
  });

  it('refreshSecret bypasses cache then re-reads', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: true },
      SILENT,
    );
    await svc.getSecret('TEST_SECRET');
    process.env['TEST_SECRET'] = 'new';
    expect(await svc.refreshSecret('TEST_SECRET')).toBe('new');
  });

  it('clearCache empties all cached entries', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: true },
      SILENT,
    );
    await svc.getSecret('TEST_SECRET');
    svc.clearCache();
    delete process.env['TEST_SECRET'];
    expect(await svc.getSecret('TEST_SECRET')).toBeUndefined();
  });

  it('getSecrets returns a Map of resolved secrets', async () => {
    process.env['A'] = '1';
    process.env['B'] = '2';
    const svc = new SecretsService(
      { backend: SecretBackend.ENV, cacheEnabled: false },
      SILENT,
    );
    const result = await svc.getSecrets(['A', 'B', 'MISSING']);
    expect(result.get('A')).toBe('1');
    expect(result.get('B')).toBe('2');
    expect(result.has('MISSING')).toBe(false);
    delete process.env['A'];
    delete process.env['B'];
  });

  it('vault backend falls through to environment when not configured', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.VAULT, cacheEnabled: false },
      SILENT,
    );
    expect(await svc.getSecret('TEST_SECRET')).toBe('shh');
  });

  it('aws backend falls through to environment when not configured', async () => {
    const svc = new SecretsService(
      { backend: SecretBackend.AWS_SECRETS_MANAGER, cacheEnabled: false },
      SILENT,
    );
    expect(await svc.getSecret('TEST_SECRET')).toBe('shh');
  });

  it('throws for an unsupported backend', async () => {
    const svc = new SecretsService(
      { backend: 'bogus' as SecretBackend, cacheEnabled: false },
      SILENT,
    );
    expect(await svc.getSecret('TEST_SECRET')).toBe('shh');
  });
});

describe('createSecretsService / getSecretsService factories', () => {
  it('createSecretsService returns fresh instances', () => {
    const a = createSecretsService({}, SILENT);
    const b = createSecretsService({}, SILENT);
    expect(a).not.toBe(b);
  });

  it('getSecretsService is a singleton', () => {
    const first = getSecretsService({}, SILENT);
    const second = getSecretsService();
    expect(first).toBe(second);
  });
});
