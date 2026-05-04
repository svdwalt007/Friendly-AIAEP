/**
 * API Gateway - Main Entry Point with OpenTelemetry
 *
 * Features:
 * - OpenTelemetry initialization
 * - Distributed tracing
 * - Metrics collection
 * - Structured logging
 * - Comprehensive observability
 */

import Fastify from 'fastify';
import compress from '@fastify/compress';
import { app } from './app/app';
import { initializeTelemetry, getLogger, shutdownTelemetry } from '@friendly-aep/shared-observability';
import telemetryMiddleware from './app/middleware/telemetry.middleware';

// ============================================================================
// Configuration
// ============================================================================
const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.AEP_API_GATEWAY_PORT
    ? Number(process.env.AEP_API_GATEWAY_PORT)
    : 46000;

const isProduction = process.env.NODE_ENV === 'production';
const serviceName = 'aep-api-gateway';
const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';

// ============================================================================
// Initialize OpenTelemetry FIRST (before any other imports)
// ============================================================================
async function initializeObservability() {
  try {
    await initializeTelemetry({
      serviceName,
      serviceVersion,
      environment: process.env.NODE_ENV || 'development',
      jaegerEndpoint: process.env.JAEGER_ENDPOINT,
      otlpEndpoint: process.env.OTLP_ENDPOINT,
      prometheusPort: Number(process.env.PROMETHEUS_PORT) || 9464,
      enableJaeger: process.env.ENABLE_JAEGER === 'true' || !isProduction,
      enableOTLP: process.env.ENABLE_OTLP === 'true',
      enablePrometheus: process.env.ENABLE_PROMETHEUS !== 'false', // Enabled by default
      enableConsoleExport: !isProduction,
    });

    console.log('✅ OpenTelemetry initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    throw error;
  }
}

// ============================================================================
// Create Fastify Server
// ============================================================================
async function createServer() {
  // Get logger instance (after telemetry is initialized)
  const logger = getLogger({
    name: serviceName,
    level: isProduction ? 'info' : 'debug',
  });

  // Create Fastify instance with Pino logger
  const server = Fastify({
    logger: logger.getPinoLogger(),
    pluginTimeout: 20000,
    trustProxy: true,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: true, // We'll handle logging in our middleware
    requestIdHeader: 'x-request-id',
  });

  // ============================================================================
  // Compression Plugin
  // ============================================================================
  await server.register(compress, {
    global: true,
    threshold: 1024,
    encodings: ['gzip', 'deflate'],
    customTypes: /^text\/|^application\/json|^application\/javascript/,
    removeContentLengthHeader: true,
  });

  // ============================================================================
  // Telemetry Middleware (MUST be registered early)
  // ============================================================================
  await server.register(telemetryMiddleware, {
    enableMetrics: true,
    enableLogging: true,
    enableTracing: true,
    ignoreRoutes: ['/health', '/metrics', '/favicon.ico'],
    logRequestBody: false,
    logResponseBody: false,
  });

  // ============================================================================
  // Caching Headers Hook
  // ============================================================================
  server.addHook('onSend', async (request, reply) => {
    if (request.method !== 'GET') {
      return;
    }

    const url = request.url;

    // Static assets - aggressive caching
    if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.header('Expires', new Date(Date.now() + 31536000000).toUTCString());
      return;
    }

    // API responses - short-term caching with validation
    if (url.startsWith('/api/')) {
      if (url.includes('/health') || url.includes('/metrics')) {
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
      } else if (url.includes('/auth') || url.includes('/user')) {
        reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');
      } else if (url.match(/\/api\/(projects|templates|widgets)/)) {
        reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
        reply.header('Vary', 'Authorization, Accept-Encoding');
      } else {
        reply.header('Cache-Control', 'private, max-age=300');
        reply.header('Vary', 'Authorization, Accept-Encoding');
      }
    } else {
      // HTML pages - moderate caching with validation
      reply.header('Cache-Control', 'public, max-age=3600, must-revalidate');
      reply.header('Vary', 'Accept-Encoding');
    }
  });

  // ============================================================================
  // Performance Headers Hook
  // ============================================================================
  server.addHook('onSend', async (request, reply) => {
    const responseTime = reply.getResponseTime();
    reply.header('Server-Timing', `total;dur=${responseTime.toFixed(2)}`);
    reply.header('X-Response-Time', `${responseTime.toFixed(2)}ms`);
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  server.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        err: error,
        url: request.url,
        method: request.method,
      },
      'Request error'
    );

    // Production error response (hide internal details)
    if (isProduction) {
      const statusCode = (error as any).statusCode || 500;
      reply.code(statusCode).send({
        statusCode,
        error: statusCode >= 500 ? 'Internal Server Error' : error.name,
        message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
      });
    } else {
      // Development error response (show details)
      const statusCode = (error as any).statusCode || 500;
      reply.code(statusCode).send({
        statusCode,
        error: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
  });

  // ============================================================================
  // 404 Handler
  // ============================================================================
  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });

  // ============================================================================
  // Register Application Routes
  // ============================================================================
  await server.register(app);

  return server;
}

// ============================================================================
// Graceful Shutdown Handler
// ============================================================================
async function gracefulShutdown(server: Awaited<ReturnType<typeof createServer>>) {
  console.log('Shutting down gracefully...');

  try {
    // Close Fastify server first
    await server.close();
    console.log('✅ Fastify server closed');

    // Shutdown OpenTelemetry
    await shutdownTelemetry();
    console.log('✅ OpenTelemetry shutdown complete');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
}

// ============================================================================
// Bootstrap Application
// ============================================================================
async function bootstrap() {
  try {
    // 1. Initialize OpenTelemetry first
    await initializeObservability();

    // 2. Create and configure server
    const server = await createServer();

    // 3. Setup graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`Received ${signal}`);
        await gracefulShutdown(server);
      });
    });

    // 4. Handle uncaught errors
    process.on('uncaughtException', async (err) => {
      console.error('Uncaught exception:', err);
      await gracefulShutdown(server);
    });

    process.on('unhandledRejection', async (err) => {
      console.error('Unhandled rejection:', err);
      await gracefulShutdown(server);
    });

    // 5. Start listening
    await server.listen({ port, host });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 API Gateway running on http://${host}:${port}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Version: ${serviceVersion}`);
    console.log(`   Prometheus metrics: http://${host}:${process.env.PROMETHEUS_PORT || 9464}/metrics`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
