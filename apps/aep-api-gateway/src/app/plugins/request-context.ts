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

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('x-request-id', request.requestId);
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
