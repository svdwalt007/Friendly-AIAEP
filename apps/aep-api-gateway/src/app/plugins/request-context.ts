import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';

export default fp(async function (fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    const tenantId = (request.headers['x-tenant-id'] as string) || undefined;

    request.requestId = requestId;

    request.log = request.log.child({
      requestId,
      tenantId,
      method: request.method,
      url: request.url,
    });
  });

  // Attach the response header in `onSend` (runs BEFORE the body is
  // dispatched to the client) so callers and tests using app.inject() can
  // observe it. `onResponse` fires too late to mutate headers.
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    reply.header('x-request-id', request.requestId);
    return payload;
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info(
      {
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'request completed'
    );
  });
});

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}
