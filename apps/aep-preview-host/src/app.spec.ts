/**
 * @file Tests for the preview-host Express app factory.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createPreviewApp,
  PreviewRecord,
  sweepExpiredPreviews,
} from './app';

const options = { host: 'localhost', port: 46001 };

describe('createPreviewApp', () => {
  it('GET /health reports healthy with current uptime + activePreviews count', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    activePreviews.set('p1', {
      projectId: 'proj-1',
      tenantId: 't-1',
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.activePreviews).toBe(1);
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /api/previews returns the empty list initially', async () => {
    const { app } = createPreviewApp(options);
    const res = await request(app).get('/api/previews');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ previews: [], total: 0 });
  });

  it('POST /api/previews creates a record with a 30-min default lifetime + correct URL', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    const before = Date.now();
    const res = await request(app)
      .post('/api/previews')
      .send({ projectId: 'p-1', tenantId: 't-1' });

    expect(res.status).toBe(201);
    expect(res.body.previewId).toMatch(/^preview_\d+$/);
    expect(res.body.previewUrl).toBe(
      `http://localhost:46001/preview/${res.body.previewId}`,
    );
    expect(res.body.mode).toBe('mock');
    expect(res.body.status).toBe('running');

    const stored = activePreviews.get(res.body.previewId);
    expect(stored).toBeTruthy();
    expect(stored!.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      29 * 60 * 1000,
    );
    expect(stored!.expiresAt.getTime() - before).toBeLessThanOrEqual(
      31 * 60 * 1000,
    );
  });

  it('POST /api/previews honours custom durationMinutes + mode', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    const res = await request(app)
      .post('/api/previews')
      .send({ projectId: 'p', tenantId: 't', mode: 'live', durationMinutes: 5 });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe('live');

    const stored = activePreviews.get(res.body.previewId)!;
    const lifetimeMs = stored.expiresAt.getTime() - stored.createdAt.getTime();
    expect(lifetimeMs).toBe(5 * 60 * 1000);
  });

  it('GET /api/previews lists every active record', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    activePreviews.set('a', {
      projectId: 'p-a',
      tenantId: 't',
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    activePreviews.set('b', {
      projectId: 'p-b',
      tenantId: 't',
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await request(app).get('/api/previews');
    expect(res.body.total).toBe(2);
    expect(res.body.previews.map((p: { id: string }) => p.id).sort()).toEqual([
      'a',
      'b',
    ]);
  });

  it('GET /api/previews/:id returns 200 for an existing preview, 404 otherwise', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    activePreviews.set('x', {
      projectId: 'p-x',
      tenantId: 't',
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const ok = await request(app).get('/api/previews/x');
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe('x');
    expect(ok.body.projectId).toBe('p-x');

    const missing = await request(app).get('/api/previews/missing');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Preview not found');
  });

  it('DELETE /api/previews/:id removes the record (200) or returns 404 if absent', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    activePreviews.set('y', {
      projectId: 'p-y',
      tenantId: 't',
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const ok = await request(app).delete('/api/previews/y');
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('Preview stopped');
    expect(activePreviews.has('y')).toBe(false);

    const missing = await request(app).delete('/api/previews/y');
    expect(missing.status).toBe(404);
  });

  it('GET /preview/:id renders the HTML banner for an existing preview', async () => {
    const { app, activePreviews } = createPreviewApp(options);
    activePreviews.set('z', {
      projectId: 'My Project',
      tenantId: 't',
      status: 'running',
      createdAt: new Date(),
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    });

    const res = await request(app).get('/preview/z');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Preview Mode');
    expect(res.text).toContain('My Project');
  });

  it('GET /preview/:id returns the not-found page (404) when no record exists', async () => {
    const { app } = createPreviewApp(options);
    const res = await request(app).get('/preview/missing');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Preview not found');
  });
});

describe('sweepExpiredPreviews', () => {
  function make(expiresAt: Date): PreviewRecord {
    return {
      projectId: 'p',
      tenantId: 't',
      status: 'running',
      createdAt: new Date(0),
      expiresAt,
    };
  }

  it('removes records whose expiresAt is in the past', () => {
    const store = new Map<string, PreviewRecord>();
    store.set('expired-1', make(new Date('2026-01-01T00:00:00.000Z')));
    store.set('expired-2', make(new Date('2026-02-01T00:00:00.000Z')));
    store.set('active', make(new Date('2099-01-01T00:00:00.000Z')));

    const removed = sweepExpiredPreviews(store, new Date('2026-03-01'));
    expect(removed).toBe(2);
    expect(store.size).toBe(1);
    expect(store.has('active')).toBe(true);
  });

  it('returns 0 when nothing is expired', () => {
    const store = new Map<string, PreviewRecord>();
    store.set('a', make(new Date('2099-01-01T00:00:00.000Z')));
    expect(sweepExpiredPreviews(store, new Date('2026-03-01'))).toBe(0);
    expect(store.size).toBe(1);
  });

  it('uses the current Date by default', () => {
    const store = new Map<string, PreviewRecord>();
    store.set('past', make(new Date(0)));
    const removed = sweepExpiredPreviews(store);
    expect(removed).toBe(1);
  });
});
