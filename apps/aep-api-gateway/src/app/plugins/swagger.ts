import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

/**
 * Configures Swagger/OpenAPI documentation
 *
 * @see https://github.com/fastify/fastify-swagger
 * @see https://github.com/fastify/fastify-swagger-ui
 */
export default fp(async function (fastify: FastifyInstance) {
  // Register Swagger plugin for OpenAPI schema generation
  await fastify.register(swagger as any, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Friendly AI AEP API Gateway',
        description: `
API Gateway for the Friendly AI Autonomous Engineering Platform (AEP).

This gateway provides:
- Multi-agent orchestration endpoints
- Project and template management
- Builder and preview services
- WebSocket connections for real-time agent communication
- IoT tool function execution
- Metrics and monitoring endpoints

All authenticated endpoints require a valid JWT bearer token.
        `.trim(),
        version: process.env.API_VERSION || '1.0.0',
        contact: {
          name: 'Friendly AI Support',
          email: process.env.SUPPORT_EMAIL || 'support@friendly-ai.dev',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:3000',
          description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
        },
      ],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'projects', description: 'Project management' },
        { name: 'templates', description: 'Template marketplace' },
        { name: 'builder', description: 'Page builder operations' },
        { name: 'preview', description: 'Preview and deployment' },
        { name: 'agents', description: 'Multi-agent orchestration' },
        { name: 'iot', description: 'IoT tool functions' },
        { name: 'metrics', description: 'Metrics and monitoring' },
        { name: 'health', description: 'Health check endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token for authenticated requests. Include as: `Authorization: Bearer <token>`',
          },
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for service-to-service authentication',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 400 },
              error: { type: 'string', example: 'Bad Request' },
              message: { type: 'string', example: 'Invalid input provided' },
            },
            required: ['statusCode', 'error', 'message'],
          },
          RateLimitError: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: 429 },
              error: { type: 'string', example: 'Too Many Requests' },
              message: { type: 'string', example: 'Rate limit exceeded for starter tier. Try again in 60 seconds.' },
              tier: { type: 'string', enum: ['starter', 'pro', 'enterprise'], example: 'starter' },
              limit: { type: 'number', example: 100 },
              ttl: { type: 'number', example: 60000 },
            },
            required: ['statusCode', 'error', 'message', 'tier', 'limit', 'ttl'],
          },
          HealthCheck: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number', example: 12345 },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string', enum: ['healthy', 'degraded', 'down'], example: 'healthy' },
                  redis: { type: 'string', enum: ['healthy', 'degraded', 'down'], example: 'healthy' },
                  influxdb: { type: 'string', enum: ['healthy', 'degraded', 'down'], example: 'healthy' },
                },
              },
            },
            required: ['status', 'timestamp'],
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    hideUntagged: false,
    exposeRoute: true,
    transform: ({ schema, url }: any) => {
      // Transform schema for better documentation
      return { schema, url };
    },
  } as any);

  // Register Swagger UI plugin
  await fastify.register(swaggerUI as any, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      tryItOutEnabled: true,
      requestSnippetsEnabled: true,
      persistAuthorization: true,
    },
    uiHooks: {
      onRequest: function (_request: any, _reply: any, next: any) {
        next();
      },
      preHandler: function (_request: any, _reply: any, next: any) {
        next();
      },
    },
    staticCSP: false, // Disable CSP for Swagger UI assets
    transformStaticCSP: (header: any) => header,
    transformSpecification: (swaggerObject: any, _request: any, _reply: any) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  fastify.log.info('Swagger documentation available at /docs');
});
