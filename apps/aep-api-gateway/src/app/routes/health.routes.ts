import { FastifyInstance } from 'fastify';

/**
 * Health check routes
 * Base path: /health
 * Public endpoint (no authentication required)
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  /**
   * GET /health
   * Health check endpoint
   * Returns service status, version, and uptime
   * Public endpoint (no JWT required)
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'degraded', 'unhealthy'],
              },
              version: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  redis: { type: 'string' },
                  influxdb: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // TODO: Add actual health checks
      // 1. PostgreSQL connection check
      // 2. Redis connection check
      // 3. InfluxDB connection check
      // 4. License-agent heartbeat check
      // 5. Determine overall status based on dependencies

      const uptime = process.uptime();
      const version = process.env.APP_VERSION || '1.0.0';

      return reply.status(200).send({
        status: 'healthy',
        version,
        uptime,
        timestamp: new Date().toISOString(),
        services: {
          database: 'healthy',
          redis: 'healthy',
          influxdb: 'healthy',
        },
      });
    }
  );

  /**
   * GET /health/ready
   * Readiness probe for Kubernetes
   * Returns 200 when service is ready to accept traffic
   */
  fastify.get(
    '/health/ready',
    {
      schema: {
        description: 'Readiness probe',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
            },
          },
          503: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // TODO: Check if service is ready
      // 1. Database migrations completed
      // 2. Redis connection established
      // 3. Required environment variables set
      // 4. License validation completed

      return reply.status(200).send({
        ready: true,
      });
    }
  );

  /**
   * GET /health/live
   * Liveness probe for Kubernetes
   * Returns 200 when service is alive
   */
  fastify.get(
    '/health/live',
    {
      schema: {
        description: 'Liveness probe',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              alive: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // Simple check - if we can respond, we're alive
      return reply.status(200).send({
        alive: true,
      });
    }
  );
}
