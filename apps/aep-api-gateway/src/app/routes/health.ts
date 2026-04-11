/**
 * Health check route
 *
 * This route is exempt from authentication and provides basic health status.
 * Useful for load balancers, monitoring systems, and deployment health checks.
 */

import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  /**
   * GET /health
   *
   * Returns health status of the API gateway.
   * This route does not require authentication.
   */
  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
    };
  });

  /**
   * GET /health/ready
   *
   * Readiness probe for Kubernetes and similar orchestrators.
   * Checks if the application is ready to serve traffic.
   */
  fastify.get('/health/ready', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    // Add additional checks here if needed (database, Redis, etc.)
    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /health/live
   *
   * Liveness probe for Kubernetes and similar orchestrators.
   * Checks if the application is alive and should not be restarted.
   */
  fastify.get('/health/live', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            alive: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  });
}
