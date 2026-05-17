/**
 * @file pages.routes — verifies the (currently stubbed) pages listing
 * route echoes the project id from the path and returns the documented
 * shape (id/route/title/layoutType/widgetCount per page).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import pagesRoutes from './pages.routes';
import { buildAuthedApp } from './_test-helpers';

describe('routes/pages — GET /api/v1/projects/:id/pages', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with a paginated list shape for an authenticated request', async () => {
    app = await buildAuthedApp(pagesRoutes);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/proj-9/pages',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.pages)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBe(body.pages.length);
  });

  it('echoes the path projectId on every returned page', async () => {
    app = await buildAuthedApp(pagesRoutes);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/abcdef-1234/pages',
    });
    const body = JSON.parse(res.body);
    expect(body.pages.length).toBeGreaterThan(0);
    for (const page of body.pages) {
      expect(page.projectId).toBe('abcdef-1234');
      expect(page).toHaveProperty('id');
      expect(page).toHaveProperty('route');
      expect(page).toHaveProperty('title');
      expect(page).toHaveProperty('layoutType');
      expect(typeof page.widgetCount).toBe('number');
    }
  });
});
