/**
 * @file billing.routes — verifies the (currently stubbed) usage endpoint
 * returns a well-formed Pro-tier response shape and accepts the
 * documented querystring values.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import billingRoutes from './billing.routes';
import { buildAuthedApp } from './_test-helpers';

describe('routes/billing — GET /api/v1/billing/usage', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with the documented period / plan / usage / charges / alerts shape', async () => {
    app = await buildAuthedApp(billingRoutes);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('period');
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('usage');
    expect(body).toHaveProperty('charges');
    expect(body).toHaveProperty('alerts');
    expect(body.plan.tier).toBe('pro');
    expect(body.plan.currency).toBe('USD');
    expect(typeof body.charges.total).toBe('number');
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('accepts each documented period querystring (current/previous/ytd) without 4xx', async () => {
    app = await buildAuthedApp(billingRoutes);
    for (const period of ['current', 'previous', 'ytd']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/usage?period=${period}`,
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('rejects a period value outside the documented enum with 400', async () => {
    app = await buildAuthedApp(billingRoutes);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/usage?period=quarterly',
    });
    expect(res.statusCode).toBe(400);
  });

  it('exposes the LLM-token breakdown (claude + ollama) in the usage block', async () => {
    app = await buildAuthedApp(billingRoutes);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/billing/usage',
    });
    const body = JSON.parse(res.body);
    expect(body.usage.aiSessions.llmTokens).toHaveProperty('claude');
    expect(body.usage.aiSessions.llmTokens).toHaveProperty('ollama');
  });
});
