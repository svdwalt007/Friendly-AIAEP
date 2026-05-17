/**
 * @file swagger plugin — verifies the OpenAPI doc is generated with the
 * documented metadata (title, openapi version, tags, security schemes),
 * that route schemas are picked up automatically, and that the Swagger
 * UI lands at /docs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import swaggerPlugin from './swagger';

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(swaggerPlugin);
  app.get(
    '/api/v1/widgets',
    {
      schema: {
        tags: ['projects'],
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

describe('plugins/swagger', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('generates an OpenAPI 3.0.3 doc with the documented metadata', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = JSON.parse(res.body);
    expect(doc.openapi).toBe('3.0.3');
    expect(doc.info.title).toBe('Friendly AI AEP API Gateway');
    expect(doc.info.license.name).toBe('MIT');
  });

  it('lists the documented tag set', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = JSON.parse(res.body);
    const tagNames = (doc.tags as Array<{ name: string }>).map((t) => t.name);
    for (const expected of ['auth', 'projects', 'agents', 'iot', 'health']) {
      expect(tagNames).toContain(expected);
    }
  });

  it('declares the bearerAuth + apiKey security schemes', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = JSON.parse(res.body);
    const schemes = doc.components.securitySchemes;
    expect(schemes.bearerAuth.type).toBe('http');
    expect(schemes.bearerAuth.scheme).toBe('bearer');
    expect(schemes.bearerAuth.bearerFormat).toBe('JWT');
    expect(schemes.apiKey.type).toBe('apiKey');
    expect(schemes.apiKey.name).toBe('X-API-Key');
  });

  it('picks up route-level schemas automatically', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = JSON.parse(res.body);
    expect(doc.paths).toHaveProperty('/api/v1/widgets');
    expect(doc.paths['/api/v1/widgets'].get.tags).toContain('projects');
  });

  it('mounts the Swagger UI at /docs', async () => {
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/docs/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('Swagger UI');
  });

  it('honours API_VERSION env for the info.version field', async () => {
    process.env.API_VERSION = '9.9.9-test';
    app = await build();
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = JSON.parse(res.body);
    expect(doc.info.version).toBe('9.9.9-test');
    delete process.env.API_VERSION;
  });
});
