/**
 * @file jwt plugin — verifies the JWT sign/verify decorator chain and
 * the (currently stubbed) `POST /api/v1/auth/login` endpoint:
 * demo credentials return access + refresh tokens, anything else
 * returns 401, the `authenticate` decorator accepts valid tokens and
 * 401s on missing/expired ones.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwtPlugin from './jwt';

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(jwtPlugin);
  app.get(
    '/api/v1/private',
    { onRequest: [app.authenticate] },
    async (req) => ({ user: req.user }),
  );
  await app.ready();
  return app;
}

describe('plugins/jwt', () => {
  let app: FastifyInstance;
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'a'.repeat(32);
  });

  afterEach(async () => {
    process.env.JWT_SECRET = originalSecret;
    await app?.close();
  });

  it('POST /api/v1/auth/login returns 200 + tokens for the demo credentials', async () => {
    app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'demo', password: 'demo' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toMatch(/^eyJ/);
    expect(body.refreshToken).toMatch(/^eyJ/);
    expect(body.expiresIn).toBe(3600);
    expect(body.user).toMatchObject({
      id: 'user_001',
      username: 'demo',
      tenantId: 'tenant_001',
      role: 'admin',
    });
  });

  it('POST /api/v1/auth/login returns 401 for any other credentials', async () => {
    app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'demo', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Invalid credentials');
  });

  it('POST /api/v1/auth/login rejects missing fields with 400 (schema)', async () => {
    app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'only-user' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('authenticate decorator allows a request bearing a freshly-issued token', async () => {
    app = await build();
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'demo', password: 'demo' },
    });
    const { accessToken } = JSON.parse(login.body);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/private',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.userId).toBe('user_001');
    expect(body.user.tenantId).toBe('tenant_001');
    expect(body.user.role).toBe('admin');
  });

  it('authenticate decorator rejects a missing Authorization header with 401', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/api/v1/private' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Invalid or expired token');
  });

  it('authenticate decorator rejects a malformed token with 401', async () => {
    app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/private',
      headers: { authorization: 'Bearer this-is-not-a-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('authenticate decorator rejects a token signed by a different secret', async () => {
    app = await build();
    // Issue a token from app A (current secret), then verify against app B.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'demo', password: 'demo' },
    });
    const { accessToken } = JSON.parse(login.body);
    await app.close();

    process.env.JWT_SECRET = 'b'.repeat(32);
    app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/private',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
