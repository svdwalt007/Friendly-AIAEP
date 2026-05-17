/**
 * @file helmet plugin — verifies the security headers fan-out:
 * Helmet's defaults (CSP, HSTS, frame, referrer, MIME), the custom
 * Permissions-Policy header on every response, and the URL-conditional
 * Clear-Site-Data + no-cache overrides for logout / auth endpoints.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import helmetPlugin from './helmet';

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(helmetPlugin);
  app.get('/api/widgets', async () => ({ ok: true }));
  app.get('/api/auth/whoami', async () => ({ id: 'u' }));
  app.get('/api/user/profile', async () => ({ id: 'u' }));
  app.get('/auth/logout', async () => ({ ok: true }));
  app.get('/account/signout', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('plugins/helmet', () => {
  let app: FastifyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    await app?.close();
  });

  it('emits a Content-Security-Policy header by default', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/widgets' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('strips the X-Powered-By header', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/widgets' });
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('emits HSTS with preload + 1y max-age + subdomains', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/widgets' });
    const hsts = res.headers['strict-transport-security'] as string;
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('emits the documented Permissions-Policy directive list', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/widgets' });
    const pp = res.headers['permissions-policy'] as string;
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('fullscreen=(self)');
  });

  it('emits X-Content-Type-Options nosniff', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/widgets' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('adds Clear-Site-Data on logout endpoints', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/auth/logout' });
    expect(res.headers['clear-site-data']).toBe('"cache", "cookies", "storage"');
  });

  it('adds Clear-Site-Data on signout endpoints too', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/account/signout' });
    expect(res.headers['clear-site-data']).toBe('"cache", "cookies", "storage"');
  });

  it('does NOT add Clear-Site-Data on regular endpoints', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/widgets' });
    expect(res.headers['clear-site-data']).toBeUndefined();
  });

  it('forces no-store on /api/auth/* endpoints', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/auth/whoami' });
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
  });

  it('forces no-store on /api/user/* endpoints', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/user/profile' });
    expect(res.headers['cache-control']).toContain('no-store');
  });
});
