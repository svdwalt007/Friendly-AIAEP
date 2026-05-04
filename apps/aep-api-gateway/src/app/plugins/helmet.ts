import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

/**
 * Comprehensive security headers plugin using Helmet
 *
 * Implements production-ready security headers including:
 * - Content Security Policy (CSP) with strict directives
 * - HTTP Strict Transport Security (HSTS) with preload
 * - Cross-Origin policies
 * - XSS and MIME-type sniffing protection
 * - Frame protection
 */
export default fp(async function (fastify: FastifyInstance) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  fastify.register(helmet, {
    // Comprehensive Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // In development, allow unsafe-inline and unsafe-eval for HMR
          ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
          // Add nonce support for production
          ...(isProduction ? ["'nonce-{{nonce}}'"] : []),
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for many CSS-in-JS libraries
          'https://fonts.googleapis.com',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https:',
          'blob:',
          // Add specific CDN domains in production
          ...(isProduction ? ['https://cdn.yourdomain.com'] : []),
        ],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          ...(isDevelopment ? ['http://localhost:*', 'ws://localhost:*'] : []),
          'https://api.anthropic.com',
          // Add your API endpoints
          ...(isProduction ? ['https://api.yourdomain.com'] : []),
        ],
        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
          'https://fonts.googleapis.com',
          'data:',
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        frameSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
      reportOnly: isDevelopment, // Report-only mode in development for debugging
    },

    // Cross-Origin Policies
    crossOriginEmbedderPolicy: isProduction, // Enable in production
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },

    // Frame Protection
    frameguard: { action: 'sameorigin' },

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // HTTP Strict Transport Security with preload
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true, // Submit to browsers' preload list
    },

    // IE-specific protections
    ieNoOpen: true,

    // MIME-type sniffing protection
    noSniff: true,

    // Origin Agent Cluster header
    originAgentCluster: true,

    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },

    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // XSS Filter (legacy but still useful for older browsers)
    xssFilter: true,
  });

  // Add custom security headers
  fastify.addHook('onSend', async (request, reply) => {
    // Permissions Policy (formerly Feature-Policy)
    reply.header('Permissions-Policy', [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
    ].join(', '));

    // Clear-Site-Data header for logout endpoints
    if (request.url.includes('/logout') || request.url.includes('/signout')) {
      reply.header('Clear-Site-Data', '"cache", "cookies", "storage"');
    }

    // Additional security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-DNS-Prefetch-Control', 'off');

    // Prevent caching of sensitive endpoints
    if (request.url.includes('/api/auth') || request.url.includes('/api/user')) {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    }
  });

  fastify.log.info('Security headers configured with Helmet');
});
