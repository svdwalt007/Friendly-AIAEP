/**
 * @file tenant plugin (autoload wrapper) — verifies the wrapper boots
 * the underlying tenant middleware and threads through the
 * REQUIRE_TENANT_ID env switch.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import tenantPlugin from './tenant';

describe('plugins/tenant (autoload wrapper)', () => {
  let app: FastifyInstance;
  const originalEnv = process.env.REQUIRE_TENANT_ID;

  beforeEach(() => {
    delete process.env.REQUIRE_TENANT_ID;
  });

  afterEach(async () => {
    process.env.REQUIRE_TENANT_ID = originalEnv;
    await app?.close();
  });

  it('registers the underlying tenant middleware so requests acquire a tenantContext', async () => {
    app = Fastify({ logger: false });
    await app.register(tenantPlugin);
    app.get('/probe', async (req) => ({
      hasContext: req.tenantContext !== undefined,
      deploymentMode: req.tenantContext?.deploymentMode,
    }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/probe' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.hasContext).toBe(true);
    expect(['multi-tenant', 'dedicated']).toContain(body.deploymentMode);
  });

  it('REQUIRE_TENANT_ID=true makes the wrapper enforce tenant presence', async () => {
    process.env.REQUIRE_TENANT_ID = 'true';
    process.env.DEPLOYMENT_MODE = 'multi-tenant';
    app = Fastify({ logger: false });
    await app.register(tenantPlugin);
    app.get('/probe', async () => ({ ok: true }));
    await app.ready();

    // No tenant context attached → enforced middleware should refuse.
    const res = await app.inject({ method: 'GET', url: '/probe' });
    expect([400, 401, 403]).toContain(res.statusCode);
  });

  it('REQUIRE_TENANT_ID unset → wrapper does not enforce, just attaches context', async () => {
    delete process.env.REQUIRE_TENANT_ID;
    app = Fastify({ logger: false });
    await app.register(tenantPlugin);
    app.get('/probe', async () => ({ ok: true }));
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/probe' });
    expect(res.statusCode).toBe(200);
  });
});
