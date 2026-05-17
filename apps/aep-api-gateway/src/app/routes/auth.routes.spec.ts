import { describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes';

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(authRoutes);
  await app.ready();
  return app;
}

describe('POST /api/v1/auth/token/refresh', () => {
  it('returns a new access + refresh token for a non-empty refresh token', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token/refresh',
      payload: { refreshToken: 'abc' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('expiresIn');
    expect(typeof body.expiresIn).toBe('number');
    await app.close();
  });

  it('rejects an empty refresh token with 400 (Fastify schema validation)', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token/refresh',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a non-object body with 400', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/token/refresh',
      payload: 'not-an-object',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
