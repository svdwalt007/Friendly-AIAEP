/**
 * @file CORS plugin — exercises the origin allowlist for the common cases
 * (no-origin / localhost dev / allowlisted prod / rejected prod) and the
 * preflight (OPTIONS) negotiation surface.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import corsPlugin from './cors';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(corsPlugin);
  app.get('/ping', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('plugins/cors', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN_BUILDER;
    delete process.env.CORS_ORIGIN_PREVIEW;
    delete process.env.CORS_ORIGIN_ADMIN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows requests with no Origin header (curl/server-to-server)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/ping' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('allows the default builder origin (45000) when no override is configured', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'http://localhost:45000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:45000',
    );
    await app.close();
  });

  it('rejects an unknown origin in production', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'http://evil.example' },
    });
    expect(res.statusCode).toBe(500);
    await app.close();
  });

  it('allows any localhost origin in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'http://localhost:9999' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('honours CORS_ORIGIN_BUILDER override', async () => {
    process.env.CORS_ORIGIN_BUILDER = 'https://app.friendly.example';
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { origin: 'https://app.friendly.example' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('returns the expected preflight allow-methods + allow-headers', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/ping',
      headers: {
        origin: 'http://localhost:45000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,x-tenant-id',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
    expect(res.headers['access-control-allow-headers']).toContain('X-Tenant-ID');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    await app.close();
  });
});
