import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

/**
 * Configures Helmet for security headers
 *
 * @see https://github.com/fastify/fastify-helmet
 */
export default fp(async function (fastify: FastifyInstance) {
  fastify.register(helmet, {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Swagger UI
        styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for Swagger UI
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: 'same-origin' },
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    // Frame Guard (X-Frame-Options)
    frameguard: { action: 'deny' },
    // Hide Powered By
    hidePoweredBy: true,
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // IE No Open
    ieNoOpen: true,
    // No Sniff (X-Content-Type-Options)
    noSniff: true,
    // Origin Agent Cluster
    originAgentCluster: true,
    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // Referrer Policy
    referrerPolicy: { policy: 'no-referrer' },
    // X-XSS-Protection
    xssFilter: true,
  });
});
