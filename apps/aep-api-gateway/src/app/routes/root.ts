import { FastifyInstance } from 'fastify';

/**
 * Root route
 * Provides basic API information
 */
export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        description: 'API information',
        tags: ['root'],
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              description: { type: 'string' },
              documentation: { type: 'string' },
              health: { type: 'string' },
            },
          },
        },
      },
    },
    async function () {
      return {
        name: 'Friendly AI AEP API Gateway',
        version: '1.0.0',
        description: 'Unified HTTP/WS gateway for Friendly AI AEP Tool',
        documentation: '/docs',
        health: '/health',
      };
    }
  );
}
