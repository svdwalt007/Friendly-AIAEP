import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PreviewMode } from '@friendly-tech/builder/preview-runtime';

// Request schemas
const triggerPreviewSchema = z.object({
  mode: z.enum(['mock', 'live', 'disconnected-sim']).default('mock'),
  duration: z.number().min(1).max(30).optional(), // minutes, max 30
});

const publishProjectSchema = z.object({
  environment: z.enum(['dev', 'staging', 'prod']),
  gitBranch: z.string().optional(),
  runTests: z.boolean().default(true),
});

type TriggerPreviewRequest = z.infer<typeof triggerPreviewSchema>;
type PublishProjectRequest = z.infer<typeof publishProjectSchema>;

/**
 * Preview and publish routes
 * Base path: /api/v1/projects/:id
 * All routes require JWT authentication
 */
export default async function previewRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/projects/:id/preview
   * Trigger preview build
   * Protected by JWT middleware
   */
  fastify.post<{ Params: { id: string }; Body: TriggerPreviewRequest }>(
    '/api/v1/projects/:id/preview',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Trigger preview build',
        tags: ['projects', 'preview'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['mock', 'live', 'disconnected-sim'],
              default: 'mock',
            },
            duration: {
              type: 'number',
              minimum: 1,
              maximum: 30,
              description: 'Preview duration in minutes (max 30)',
            },
          },
        },
        response: {
          202: {
            type: 'object',
            properties: {
              previewId: { type: 'string' },
              previewUrl: { type: 'string' },
              mode: { type: 'string' },
              expiresAt: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: TriggerPreviewRequest }>, reply: FastifyReply) => {
      try {
        const { id: projectId } = request.params;
        const { mode, duration = 30 } = triggerPreviewSchema.parse(request.body);

        // Extract user info from JWT token
        const user = request.user as { sub: string; tenantId: string };
        if (!user || !user.sub || !user.tenantId) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid or missing authentication token',
          });
        }

        // Map string mode to PreviewMode enum
        const previewMode = mode === 'mock' ? PreviewMode.MOCK :
                           mode === 'live' ? PreviewMode.LIVE :
                           PreviewMode.DISCONNECTED_SIM;

        // Create preview session using PreviewRuntimeService
        const session = await fastify.previewRuntime.launchPreview({
          projectId,
          tenantId: user.tenantId,
          mode: previewMode,
          durationMinutes: duration,
          enableHotReload: true,
        });

        return reply.status(202).send({
          previewId: session.sessionId,
          previewUrl: session.previewUrl,
          mode: session.mode,
          expiresAt: (session.expiresAt as Date).toISOString(),
          status: session.status,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid request body',
            details: error.issues,
          });
        }

        // Handle preview runtime errors
        const err = error as Error;
        if (err.message.includes('Session limit exceeded')) {
          return reply.status(429).send({
            statusCode: 429,
            error: 'Too Many Requests',
            message: err.message,
          });
        }

        if (err.message.includes('Project not found') || err.message.includes('Tenant not found')) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }

        throw error;
      }
    }
  );

  /**
   * GET /api/v1/projects/:id/preview/:previewId
   * Get preview session status
   * Protected by JWT middleware
   */
  fastify.get<{ Params: { id: string; previewId: string } }>(
    '/api/v1/projects/:id/preview/:previewId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Get preview session status',
        tags: ['projects', 'preview'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'previewId'],
          properties: {
            id: { type: 'string' },
            previewId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              previewId: { type: 'string' },
              previewUrl: { type: 'string' },
              mode: { type: 'string' },
              status: { type: 'string' },
              expiresAt: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string; previewId: string } }>, reply: FastifyReply) => {
      try {
        const { previewId } = request.params;

        // Get preview session status
        const status = await fastify.previewRuntime.getPreviewStatus(previewId);

        if (!status) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `Preview session ${previewId} not found`,
          });
        }

        return reply.status(200).send({
          previewId: status.sessionId,
          previewUrl: status.previewUrl,
          status: status.status,
          ttl: status.ttl,
          timestamp: (status.timestamp as Date).toISOString(),
        });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('not found')) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /api/v1/projects/:id/preview/:previewId
   * Stop and destroy preview session
   * Protected by JWT middleware
   */
  fastify.delete<{ Params: { id: string; previewId: string } }>(
    '/api/v1/projects/:id/preview/:previewId',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Stop and destroy preview session',
        tags: ['projects', 'preview'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'previewId'],
          properties: {
            id: { type: 'string' },
            previewId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              previewId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string; previewId: string } }>, reply: FastifyReply) => {
      try {
        const { previewId } = request.params;

        // Stop the preview session
        await fastify.previewRuntime.stopPreview(previewId);

        return reply.status(200).send({
          message: 'Preview session stopped successfully',
          previewId,
        });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('not found')) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: err.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/projects/:id/previews
   * List all active preview sessions for a project
   * Protected by JWT middleware
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/projects/:id/previews',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'List active preview sessions for project',
        tags: ['projects', 'preview'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              previews: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    previewId: { type: 'string' },
                    previewUrl: { type: 'string' },
                    mode: { type: 'string' },
                    status: { type: 'string' },
                    expiresAt: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        // Extract user info from JWT token
        const user = request.user as { sub: string; tenantId: string };
        if (!user || !user.tenantId) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid or missing authentication token',
          });
        }

        // List all active sessions for this tenant
        const response = await fastify.previewRuntime.listActiveSessions(user.tenantId);

        return reply.status(200).send({
          previews: response.sessions,
          total: response.total,
          usage: response.usage,
        });
      } catch (error) {
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/projects/:id/publish
   * Publish project to target environment
   * Protected by JWT middleware
   */
  fastify.post<{ Params: { id: string }; Body: PublishProjectRequest }>(
    '/api/v1/projects/:id/publish',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Publish project to environment',
        tags: ['projects', 'publish'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['environment'],
          properties: {
            environment: {
              type: 'string',
              enum: ['dev', 'staging', 'prod'],
            },
            gitBranch: { type: 'string' },
            runTests: { type: 'boolean', default: true },
          },
        },
        response: {
          202: {
            type: 'object',
            properties: {
              publishId: { type: 'string' },
              environment: { type: 'string' },
              status: { type: 'string' },
              pipelineStages: { type: 'array' },
            },
          },
          403: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: PublishProjectRequest }>, reply: FastifyReply) => {
      try {
        const { environment } = publishProjectSchema.parse(request.body);

        // TODO: Integrate with publish-service (libs/builder/publish-service)
        // 1. Verify project exists and belongs to tenant
        // 2. Check policy-service for publish permissions
        //    - Preview required before publish
        //    - Prod requires Admin role
        //    - Git push requires Pro+ tier
        // 3. Execute 10-stage pipeline via builder-orchestrator:
        //    a. Vitest unit tests
        //    b. Playwright E2E tests
        //    c. ESLint + TypeScript check
        //    d. AOT build (Angular)
        //    e. Docker image generation
        //    f. Helm chart generation (Enterprise tier only)
        //    g. License injection via license-service
        //    h. Semver tagging
        //    i. Git push (Pro+ tier)
        //    j. Docker registry push
        // 4. Choose deployment target:
        //    - SaaS: Friendly infrastructure
        //    - Dedicated: Self-contained package
        // 5. Emit audit event and billing event
        // 6. Stream progress via WebSocket

        const publishId = `publish_${Date.now()}`;

        return reply.status(202).send({
          publishId,
          environment,
          status: 'queued',
          pipelineStages: [
            'test',
            'lint',
            'build',
            'docker',
            'helm',
            'license',
            'tag',
            'git-push',
            'registry-push',
            'audit',
          ],
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid request body',
            details: error.issues,
          });
        }
        throw error;
      }
    }
  );
}
