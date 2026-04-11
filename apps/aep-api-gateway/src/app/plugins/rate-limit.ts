import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

/**
 * Subscription tier type
 */
export type SubscriptionTier = 'starter' | 'pro' | 'enterprise';


/**
 * Rate limit configuration per tier
 */
const RATE_LIMITS: Record<SubscriptionTier, number> = {
  starter: 100, // 100 requests per minute
  pro: 500, // 500 requests per minute
  enterprise: 2000, // 2000 requests per minute
};

/**
 * Default tier for unauthenticated requests
 */
const DEFAULT_TIER: SubscriptionTier = 'starter';

/**
 * Extracts subscription tier from JWT payload
 */
function getTierFromRequest(request: FastifyRequest): SubscriptionTier {
  try {
    // Check if user is authenticated and has JWT payload
    if (request.user && typeof request.user === 'object') {
      const payload = request.user as any;
      // Map tier values: free -> starter, professional -> pro, enterprise -> enterprise
      const tier = payload.tier;
      if (tier === 'free') return 'starter';
      if (tier === 'professional') return 'pro';
      if (tier === 'enterprise') return 'enterprise';
      return DEFAULT_TIER;
    }
    return DEFAULT_TIER;
  } catch (error) {
    request.log.warn({ error }, 'Failed to extract tier from JWT payload');
    return DEFAULT_TIER;
  }
}

/**
 * Configures rate limiting with Redis backend and tier-based limits
 *
 * @see https://github.com/fastify/fastify-rate-limit
 */
export default fp(async function (fastify: FastifyInstance) {
  // Configure Redis client for distributed rate limiting
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  // Connect to Redis
  try {
    await redisClient.connect();
    fastify.log.info('Connected to Redis for rate limiting');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect to Redis, rate limiting will use in-memory store');
  }

  // Close Redis connection when Fastify closes
  fastify.addHook('onClose', async () => {
    await redisClient.quit();
  });

  // Register rate limit plugin
  await fastify.register(rateLimit as any, {
    global: true,
    max: async (request: FastifyRequest) => {
      const tier = getTierFromRequest(request);
      return RATE_LIMITS[tier];
    },
    timeWindow: '1 minute',
    cache: 10000, // Cache size
    allowList: (request: FastifyRequest) => {
      // Allow health check endpoints
      if (request.url === '/health' || request.url === '/api/health') {
        return true;
      }
      // Allow admin IPs in production
      if (process.env.ADMIN_IPS) {
        const adminIps = process.env.ADMIN_IPS.split(',');
        const clientIp = request.ip;
        return adminIps.includes(clientIp);
      }
      return false;
    },
    redis: redisClient.status === 'ready' ? redisClient : undefined,
    nameSpace: 'aep-rate-limit:',
    continueExceeding: true,
    skipOnError: true, // Skip rate limiting if Redis is down
    keyGenerator: (request: FastifyRequest) => {
      // Use user ID if authenticated, otherwise use IP address
      if (request.user && typeof request.user === 'object') {
        const payload = request.user as any;
        return `user:${payload.sub}`;
      }
      return `ip:${request.ip}`;
    },
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      const tier = getTierFromRequest(request);
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${tier} tier. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        tier,
        limit: RATE_LIMITS[tier],
        ttl: context.ttl,
      };
    },
    addHeadersOnExceeding: {
      'X-RateLimit-Limit': true,
      'X-RateLimit-Remaining': true,
      'X-RateLimit-Reset': true,
    },
    addHeaders: {
      'X-RateLimit-Limit': true,
      'X-RateLimit-Remaining': true,
      'X-RateLimit-Reset': true,
    },
  });

  fastify.log.info('Rate limiting plugin configured with tier-based limits');
});
