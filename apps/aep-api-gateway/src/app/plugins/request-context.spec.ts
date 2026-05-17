/**
 * @file request-context plugin — verifies request-id propagation (echoed
 * from header when present, generated otherwise) and that the response
 * always carries x-request-id back.
 */
import { describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import requestContext from './request-context';

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(requestContext);
  app.get('/echo', async (req) => ({ requestId: req.requestId }));
  await app.ready();
  return app;
}

describe('plugins/request-context', () => {
  it('echoes an incoming x-request-id header back on the response', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/echo',
      headers: { 'x-request-id': 'caller-supplied-id' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBe('caller-supplied-id');
    expect(JSON.parse(res.body).requestId).toBe('caller-supplied-id');
    await app.close();
  });

  it('generates a UUID when no x-request-id header is provided', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/echo' });
    expect(res.statusCode).toBe(200);
    const id = res.headers['x-request-id'] as string;
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(JSON.parse(res.body).requestId).toBe(id);
    await app.close();
  });

  it('issues different ids across requests', async () => {
    const app = await build();
    const a = await app.inject({ method: 'GET', url: '/echo' });
    const b = await app.inject({ method: 'GET', url: '/echo' });
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    await app.close();
  });
});
