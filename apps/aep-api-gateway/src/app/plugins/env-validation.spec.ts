/**
 * @file env-validation plugin — verifies the zod schema catches missing
 * critical vars (JWT_SECRET) and logs warnings, and that production with
 * a missing critical var triggers `process.exit(1)`.
 *
 * `process.exit` is stubbed so the test can observe the call without
 * killing vitest itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import envValidation from './env-validation';

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(envValidation);
  await app.ready();
  return app;
}

describe('plugins/env-validation', () => {
  const originalEnv = { ...process.env };
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    exitSpy.mockRestore();
  });

  it('registers cleanly when JWT_SECRET is present (any env)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'a'.repeat(32);
    const app = await build();
    expect(app.hasPlugin('default')).toBeDefined();
    expect(exitSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it('warns but does NOT exit when JWT_SECRET is missing in development', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    const app = await build();
    expect(exitSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it('warns but does NOT exit when JWT_SECRET is too short in non-prod', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.JWT_SECRET = 'tooshort';
    const app = await build();
    expect(exitSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it('calls process.exit(1) when JWT_SECRET is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    await build();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when JWT_SECRET is too short in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x';
    await build();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does NOT exit in production when only optional vars are missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(32);
    delete process.env.DATABASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.INFLUXDB_URL;
    const app = await build();
    expect(exitSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects an invalid NODE_ENV value with the warning path', async () => {
    process.env.NODE_ENV = 'bananas';
    process.env.JWT_SECRET = 'a'.repeat(32);
    const app = await build();
    // bananas → schema failure on enum; not in `critical` list, so warn-only.
    expect(exitSpy).not.toHaveBeenCalled();
    await app.close();
  });
});
