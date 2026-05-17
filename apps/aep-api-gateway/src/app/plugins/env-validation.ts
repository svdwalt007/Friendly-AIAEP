import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.string().default('46000'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  DATABASE_URL: z.string().startsWith('postgresql://').optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  ANTHROPIC_API_KEY: z.string().optional(),
  INFLUXDB_URL: z.string().optional(),
  DEPLOYMENT_MODE: z.enum(['multi-tenant', 'dedicated']).optional(),
});

export default fp(async function (fastify: FastifyInstance) {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );
    fastify.log.warn(
      `Environment validation warnings:\n${errors.join('\n')}`
    );

    if (process.env.NODE_ENV === 'production') {
      const critical = result.error.issues.filter((i) =>
        ['JWT_SECRET'].includes(String(i.path[0]))
      );
      if (critical.length > 0) {
        fastify.log.error('Critical environment variables missing in production. Refusing to start.');
        process.exit(1);
      }
    }
  } else {
    fastify.log.info('Environment validation passed');
  }
});
