/**
 * @file preview-runtime plugin — verifies the stub runtime exposed when
 * the @friendly-tech/builder/preview-runtime package isn't available
 * (the normal case in unit tests): launchPreview seeds a session,
 * getPreviewStatus reports its ttl/url, stopPreview removes it,
 * listActiveSessions enumerates, shutdown clears all.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import previewRuntimePlugin from './preview-runtime';

describe('plugins/preview-runtime (stub)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(previewRuntimePlugin);
    await app.ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('decorates the instance with previewRuntime + the documented surface', () => {
    expect(app.previewRuntime).toBeDefined();
    expect(typeof app.previewRuntime.launchPreview).toBe('function');
    expect(typeof app.previewRuntime.getPreviewStatus).toBe('function');
    expect(typeof app.previewRuntime.stopPreview).toBe('function');
    expect(typeof app.previewRuntime.listActiveSessions).toBe('function');
    expect(typeof app.previewRuntime.shutdown).toBe('function');
  });

  it('launchPreview returns a session with the documented shape + defaults', async () => {
    const session = await app.previewRuntime.launchPreview({});
    expect(session['sessionId']).toMatch(/^preview_\d+$/);
    expect(session['previewUrl']).toBe(
      `http://localhost:46001/preview/${session['sessionId']}`,
    );
    expect(session['mode']).toBe('mock');
    expect(session['status']).toBe('running');
    expect(session['expiresAt']).toBeInstanceOf(Date);
  });

  it('launchPreview honours custom mode + durationMinutes', async () => {
    const before = Date.now();
    const session = await app.previewRuntime.launchPreview({
      mode: 'live',
      durationMinutes: 5,
    });
    expect(session['mode']).toBe('live');
    const expiresAt = session['expiresAt'] as Date;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      5 * 60_000 - 100,
    );
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(
      5 * 60_000 + 100,
    );
  });

  it('getPreviewStatus returns null for unknown sessions', async () => {
    expect(await app.previewRuntime.getPreviewStatus('nope')).toBeNull();
  });

  it('getPreviewStatus returns sessionId, previewUrl, status + a positive ttl', async () => {
    const session = await app.previewRuntime.launchPreview({});
    const status = await app.previewRuntime.getPreviewStatus(
      session['sessionId'] as string,
    );
    expect(status).toMatchObject({
      sessionId: session['sessionId'],
      previewUrl: session['previewUrl'],
      status: 'running',
    });
    expect(status?.['ttl']).toBeGreaterThan(0);
  });

  it('stopPreview removes the session (status returns null after)', async () => {
    const session = await app.previewRuntime.launchPreview({});
    await app.previewRuntime.stopPreview(session['sessionId'] as string);
    expect(
      await app.previewRuntime.getPreviewStatus(session['sessionId'] as string),
    ).toBeNull();
  });

  it('listActiveSessions enumerates current sessions with usage stats', async () => {
    // The stub keys sessions by `preview_${Date.now()}` which collides if
    // we launch two back-to-back in the same millisecond. Yield once so
    // the second insertion gets a distinct id.
    await app.previewRuntime.launchPreview({});
    await new Promise((resolve) => setTimeout(resolve, 2));
    await app.previewRuntime.launchPreview({});
    const result = await app.previewRuntime.listActiveSessions('tnt-1');
    expect(result.total).toBe(2);
    expect(result.sessions.length).toBe(2);
    expect(result.usage).toEqual({ current: 2, limit: 10 });
  });

  it('shutdown clears every active session', async () => {
    await app.previewRuntime.launchPreview({});
    await new Promise((resolve) => setTimeout(resolve, 2));
    await app.previewRuntime.launchPreview({});
    await app.previewRuntime.shutdown();
    const result = await app.previewRuntime.listActiveSessions('any');
    expect(result.total).toBe(0);
  });
});
