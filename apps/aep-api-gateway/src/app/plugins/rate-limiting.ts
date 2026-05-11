import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

/**
 * Subscription tiers with their respective rate limits
 */
export enum SubscriptionTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * Rate limit configuration per tier
 *
 * Structure:
 * - max: Maximum number of requests
 * - timeWindow: Time window in milliseconds
 * - ban: Number of consecutive violations before banning (optional)
 */
const TIER_LIMITS = {
  [SubscriptionTier.FREE]: {
    max: 100,           // 100 requests
    timeWindow: 60000,  // per minute
    ban: 5,             // Ban after 5 violations
  },
  [SubscriptionTier.STARTER]: {
    max: 1000,          // 1000 requests
    timeWindow: 60000,  // per minute
    ban: 10,
  },
  [SubscriptionTier.PROFESSIONAL]: {
    max: 10000,         // 10000 requests
    timeWindow: 60000,  // per minute
    ban: 20,
  },
  [SubscriptionTier.ENTERPRISE]: {
    max: 100000,        // 100000 requests
    timeWindow: 60000,  // per minute
    ban: 0,             // No ban for enterprise
  },
};

/**
 * Default rate limit for unauthenticated requests
 */
const DEFAULT_LIMIT = {
  max: 50,
  timeWindow: 60000,
  ban: 3,
};

/**
 * Interface for user information extracted from request
 */
interface UserInfo {
  userId?: string;
  tier: SubscriptionTier;
  tenantId?: string;
}

/**
 * Extract user information from request
 *
 * This function should be customized based on your authentication system
 */
function getUserInfo(request: FastifyRequest): UserInfo {
  try {
    // Try to get user from JWT token
    const user = (request as any).user;

    if (user) {
      return {
        userId: user.id || user.sub,
        tier: user.tier || SubscriptionTier.FREE,
        tenantId: user.tenantId || user.organizationId,
      };
    }
  } catch (error) {
    // User not authenticated or token invalid
  }

  // Default to FREE tier for unauthenticated users
  return {
    tier: SubscriptionTier.FREE,
  };
}

/**
 * Generate a unique key for rate limiting based on user/IP
 */
function generateRateLimitKey(request: FastifyRequest, userInfo: UserInfo): string {
  // Use userId if available, otherwise fall back to IP address
  const identifier = userInfo.userId || request.ip;
  const tenant = userInfo.tenantId || 'default';

  return `rate-limit:${tenant}:${identifier}:${userInfo.tier}`;
}

/**
 * Tiered rate limiting plugin with Redis backend
 *
 * Features:
 * - Different rate limits per subscription tier
 * - Redis-backed for distributed rate limiting
 * - Graceful degradation if Redis is unavailable
 * - Automatic ban after consecutive violations
 * - Custom rate limit keys per user/tenant
 */
export default fp(async function (fastify: FastifyInstance) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:46102';
  const enableRedis = process.env.ENABLE_REDIS !== 'false';

  let redis: Redis | undefined;
  let redisAvailable = false;

  // Initialize Redis connection with error handling
  if (enableRedis) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError(err) {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true; // Reconnect on READONLY errors
          }
          return false;
        },
      });

      // Test Redis connection
      await redis.ping();
      redisAvailable = true;

      redis.on('error', (err) => {
        fastify.log.error({ err }, 'Redis connection error, falling back to in-memory rate limiting');
        redisAvailable = false;
      });

      redis.on('connect', () => {
        fastify.log.info('Redis connected for rate limiting');
        redisAvailable = true;
      });

      fastify.log.info('Redis-backed rate limiting enabled');
    } catch (error) {
      fastify.log.warn(
        { error },
        'Failed to connect to Redis, using in-memory rate limiting'
      );
      redis = undefined;
    }
  } else {
    fastify.log.info('Redis disabled, using in-memory rate limiting');
  }

  // Register rate limiting plugin
  await fastify.register(rateLimit, {
    global: true,
    max: (request: FastifyRequest, _key: string) => {
      const userInfo = getUserInfo(request);
      const limits = TIER_LIMITS[userInfo.tier] || DEFAULT_LIMIT;
      return limits.max;
    },
    timeWindow: (request: FastifyRequest, _key: string) => {
      const userInfo = getUserInfo(request);
      const limits = TIER_LIMITS[userInfo.tier] || DEFAULT_LIMIT;
      return limits.timeWindow;
    },
    cache: 10000, // Cache size for in-memory mode
    allowList: (request: FastifyRequest) => {
      // Whitelist health check endpoints
      if (request.url.includes('/health') || request.url.includes('/metrics')) {
        return true;
      }
      return false;
    },
    continueExceeding: true, // Continue to increment counter even after limit is exceeded
    skipOnError: true, // Skip rate limiting if there's an error (graceful degradation)

    // Custom key generator
    keyGenerator: (request: FastifyRequest) => {
      const userInfo = getUserInfo(request);
      return generateRateLimitKey(request, userInfo);
    },

    // Redis store (if available)
    ...(redis && redisAvailable
      ? {
          redis,
          nameSpace: 'fastify-rate-limit:',
        }
      : {}),

    // Enhanced error handling
    errorResponseBuilder: (request, context) => {
      const userInfo = getUserInfo(request);

      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${userInfo.tier} tier`,
        tier: userInfo.tier,
        limit: context.max,
        remaining: context.after ? 0 : 0,
        resetTime: new Date(Date.now() + context.ttl).toISOString(),
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },

    // Add rate limit headers to response
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },

    // Add custom headers with tier information
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  // Add hook to log rate limit violations
  fastify.addHook('onResponse', async (request, reply) => {
    const remaining = reply.getHeader('x-ratelimit-remaining');

    if (remaining && parseInt(remaining.toString()) < 10) {
      const userInfo = getUserInfo(request);
      fastify.log.warn({
        userId: userInfo.userId,
        tier: userInfo.tier,
        remaining,
        path: request.url,
      }, 'User approaching rate limit');
    }
  });

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    if (redis) {
      await redis.quit();
      fastify.log.info('Redis connection closed');
    }
  });

  fastify.log.info('Tiered rate limiting configured');
});
