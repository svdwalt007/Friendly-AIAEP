/**
 * @file sensible plugin — verifies @fastify/sensible is registered and its
 * httpErrors helpers are accessible on the FastifyInstance.
 */
import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import sensiblePlugin from './sensible';

describe('plugins/sensible', () => {
  it('registers @fastify/sensible and exposes httpErrors on the instance', async () => {
    const app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.ready();

    expect(typeof app.httpErrors?.notFound).toBe('function');
    expect(typeof app.httpErrors?.badRequest).toBe('function');

    const err = app.httpErrors.notFound('missing');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('missing');

    await app.close();
  });
});
