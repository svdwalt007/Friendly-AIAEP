/**
 * @file license.routes — verifies the validate endpoint surfaces all
 * the contract fields (tier/features/limits/gracePeriod/tenantHash)
 * and derives tenantHash from the authenticated user's tenantId.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import licenseRoutes from './license.routes';
import { buildAuthedApp } from './_test-helpers';

describe('routes/license — GET /api/v1/license/validate', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with the full entitlements payload for a Pro tenant', async () => {
    app = await buildAuthedApp(licenseRoutes, {
      tenantId: 'tnt-12345abcdef67890',
      userId: 'u-1',
      role: 'admin',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/license/validate',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.valid).toBe(true);
    expect(body.tier).toBe('pro');
    expect(body.deploymentMode).toBe('saas');
    expect(body.features).toMatchObject({
      gitPush: true,
      thirdPartyIngestion: true,
      airGap: false,
    });
    expect(body.limits.aiSessions).toBe(500);
    expect(body.limits.apiCallsPerMonth).toBe(2_000_000);
    expect(body.gracePeriod.enabled).toBe(true);
  });

  it('derives tenantHash as the first 8 chars of tenantId', async () => {
    app = await buildAuthedApp(licenseRoutes, {
      tenantId: 'tnt-12345abcdef67890',
      userId: 'u',
      role: 'admin',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/license/validate',
    });
    const body = JSON.parse(res.body);
    expect(body.tenantHash).toBe('tnt-1234');
  });

  it('returns an expiresAt in the future (≈ 30 days out)', async () => {
    app = await buildAuthedApp(licenseRoutes);
    const before = Date.now();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/license/validate',
    });
    const body = JSON.parse(res.body);
    const expires = new Date(body.expiresAt).getTime();
    expect(expires - before).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000);
    expect(expires - before).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000);
  });
});
