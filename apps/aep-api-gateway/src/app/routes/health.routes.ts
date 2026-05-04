import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    const latencyMs = Date.now() - start;
    await client.quit();
    return { status: 'healthy', latencyMs };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: (err as Error).message };
  }
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { status: 'down', error: 'DATABASE_URL not configured' };
    }
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: (err as Error).message };
  }
}

async function checkInfluxDB(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const url = process.env.INFLUXDB_URL;
    if (!url) {
      return { status: 'down', error: 'INFLUXDB_URL not configured' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${url}/ping`, { signal: controller.signal });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    return { status: response.ok ? 'healthy' : 'degraded', latencyMs };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - start, error: (err as Error).message };
  }
}

export default async function healthRoutes(fastify: FastifyInstance) {
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
              status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
              version: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'object' },
                  redis: { type: 'object' },
                  influxdb: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const [database, redis, influxdb] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkInfluxDB(),
      ]);

      const services = { database, redis, influxdb };
      const statuses = Object.values(services).map((s) => s.status);

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (statuses.some((s) => s === 'down')) {
        overallStatus = statuses.every((s) => s === 'down') ? 'unhealthy' : 'degraded';
      }

      const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

      return reply.status(httpStatus).send({
        status: overallStatus,
        version: process.env.APP_VERSION || '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services,
      });
    }
  );

  fastify.get(
    '/health/ready',
    {
      schema: {
        description: 'Readiness probe',
        tags: ['health'],
        response: {
          200: { type: 'object', properties: { ready: { type: 'boolean' } } },
          503: { type: 'object', properties: { ready: { type: 'boolean' }, reason: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
      const missing = requiredEnvVars.filter((v) => !process.env[v]);

      if (missing.length > 0) {
        return reply.status(503).send({
          ready: false,
          reason: `Missing required environment variables: ${missing.join(', ')}`,
        });
      }

      const redis = await checkRedis();
      if (redis.status === 'down') {
        return reply.status(503).send({
          ready: false,
          reason: 'Redis is not available',
        });
      }

      return reply.status(200).send({ ready: true });
    }
  );

  fastify.get(
    '/health/live',
    {
      schema: {
        description: 'Liveness probe',
        tags: ['health'],
        response: {
          200: { type: 'object', properties: { alive: { type: 'boolean' } } },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({ alive: true });
    }
  );
}
