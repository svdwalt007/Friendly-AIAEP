import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

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

        // TODO: Integrate with preview-runtime (libs/builder/preview-runtime)
        // 1. Verify project exists and belongs to tenant
        // 2. Generate preview build via codegen
        // 3. Create ephemeral Docker container
        // 4. Set preview mode:
        //    - mock: Use mock-api-server for all 3 Friendly APIs
        //    - live: Use iot-api-proxy for real API calls
        //    - disconnected-sim: Simulate periodic connectivity drops
        // 5. Configure hot-reload WebSocket
        // 6. Set auto-destroy timer (max 30 minutes)
        // 7. Emit billing event for preview minutes

        const previewId = `preview_${Date.now()}`;
        const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
        const previewUrl = `https://preview-${projectId}.aep.friendly-tech.com`;

        return reply.status(202).send({
          previewId,
          previewUrl,
          mode,
          expiresAt,
          status: 'building',
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
