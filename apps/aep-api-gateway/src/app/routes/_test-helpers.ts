/**
 * @file Shared spec helpers for the gateway route tests.
 * Not exported from `index.ts` — internal to specs only.
 */
import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';

export interface FakeUser {
  tenantId: string;
  userId: string;
  role: string;
}

/**
 * Build a Fastify instance with a no-op `authenticate` decorator pre-installed
 * and a default `request.user` set, then register the supplied route plugin.
 * Used by every spec that exercises a route guarded by
 * `onRequest: [fastify.authenticate]`.
 */
export async function buildAuthedApp(
  routes: FastifyPluginAsync,
  user: FakeUser = {
    tenantId: 'tnt-test',
    userId: 'user-test',
    role: 'admin',
  },
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate(
    'authenticate',
    async (request: FastifyRequest) => {
      (request as FastifyRequest & { user: FakeUser }).user = user;
    },
  );
  await app.register(routes);
  await app.ready();
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate?: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    user?: FakeUser;
  }
}
