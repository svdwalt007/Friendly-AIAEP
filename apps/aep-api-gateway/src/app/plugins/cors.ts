import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

/**
 * Configures CORS plugin for cross-origin requests
 *
 * @see https://github.com/fastify/fastify-cors
 */
export default fp(async function (fastify: FastifyInstance) {
  fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g., mobile apps, curl, Postman)
      if (!origin) {
        cb(null, true);
        return;
      }

      // Define allowed origins based on environment
      const allowedOrigins = [
        process.env.CORS_ORIGIN_BUILDER || 'http://localhost:45000',
        process.env.CORS_ORIGIN_PREVIEW || 'http://localhost:4201',
        process.env.CORS_ORIGIN_ADMIN || 'http://localhost:4202',
      ];

      // Allow all localhost origins in development
      if (process.env.NODE_ENV === 'development') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
          cb(null, true);
          return;
        }
      }

      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  });
});
