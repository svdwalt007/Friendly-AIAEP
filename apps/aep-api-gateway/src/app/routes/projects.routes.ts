import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Request schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  templateId: z.string().optional(),
  deploymentMode: z.enum(['saas', 'dedicated']).optional(),
});

const sendPromptSchema = z.object({
  prompt: z.string().min(1),
  context: z.record(z.string(), z.any()).optional(),
});

type CreateProjectRequest = z.infer<typeof createProjectSchema>;
type SendPromptRequest = z.infer<typeof sendPromptSchema>;

/**
 * Project management routes
 * Base path: /api/v1/projects
 * All routes require JWT authentication
 */
export default async function projectsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/projects
   * List all projects for the authenticated tenant
   * Protected by JWT middleware
   */
  fastify.get<{ Querystring: { limit?: number; offset?: number } }>(
    '/api/v1/projects',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'List all projects for tenant',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'number', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              projects: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    status: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>, reply: FastifyReply) => {
      // User context available in request.user if needed
      const { limit = 20, offset = 0 } = request.query;

      // TODO: Integrate with project-registry (libs/core/project-registry)
      // 1. Query projects filtered by tenantId from JWT
      // 2. Apply pagination (limit, offset)
      // 3. Return tenant-scoped project list

      // Stub response
      return reply.status(200).send({
        projects: [
          {
            id: 'proj_001',
            name: 'Fleet Management Dashboard',
            description: 'IoT device fleet monitoring',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        limit,
        offset,
      });
    }
  );

  /**
   * POST /api/v1/projects
   * Create a new project
   * Protected by JWT middleware
   */
  fastify.post<{ Body: CreateProjectRequest }>(
    '/api/v1/projects',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Create a new project',
        tags: ['projects'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            templateId: { type: 'string' },
            deploymentMode: { type: 'string', enum: ['saas', 'dedicated'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateProjectRequest }>, reply: FastifyReply) => {
      try {
        const projectData = createProjectSchema.parse(request.body);

        // TODO: Integrate with project-registry (libs/core/project-registry)
        // 1. Create project record with tenantId from JWT
        // 2. If templateId provided, initialize from template-marketplace
        // 3. Set deploymentMode (saas or dedicated)
        // 4. Emit audit event via audit-service
        // 5. Check license tier via policy-service

        // Stub response
        const newProject = {
          id: `proj_${Date.now()}`,
          name: projectData.name,
          description: projectData.description || '',
          status: 'created',
          createdAt: new Date().toISOString(),
        };

        return reply.status(201).send(newProject);
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
   * GET /api/v1/projects/:id
   * Get project details by ID
   * Protected by JWT middleware
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/projects/:id',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Get project details',
        tags: ['projects'],
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
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              deploymentMode: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              pages: { type: 'array' },
              dataSourceCount: { type: 'number' },
            },
          },
          404: {
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      // User context available in request.user if needed
      const { id } = request.params;

      // TODO: Integrate with project-registry (libs/core/project-registry)
      // 1. Query project by ID with tenant scope check
      // 2. Include related pages, widgets, data sources
      // 3. Return 404 if not found or tenant mismatch

      // Stub response
      return reply.status(200).send({
        id,
        name: 'Fleet Management Dashboard',
        description: 'IoT device fleet monitoring',
        status: 'active',
        deploymentMode: 'saas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [],
        dataSourceCount: 3,
      });
    }
  );

  /**
   * POST /api/v1/projects/:id/agent
   * Send prompt to agent for project
   * Protected by JWT middleware
   */
  fastify.post<{ Params: { id: string }; Body: SendPromptRequest }>(
    '/api/v1/projects/:id/agent',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Send prompt to agent',
        tags: ['projects', 'agent'],
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
          required: ['prompt'],
          properties: {
            prompt: { type: 'string', minLength: 1 },
            context: { type: 'object' },
          },
        },
        response: {
          202: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: SendPromptRequest }>, reply: FastifyReply) => {
      try {
        // User context, params, and prompt data available if needed
        sendPromptSchema.parse(request.body);

        // TODO: Integrate with agent-runtime (libs/core/agent-runtime)
        // 1. Verify project exists and belongs to tenant
        // 2. Check policy-service for AI session limits (50/500/Unlimited per tier)
        // 3. Create agent session via agent-runtime
        // 4. Route to supervisor agent via LangGraph
        // 5. Return sessionId for WebSocket streaming connection
        // 6. Emit billing event for AI session start

        // Stub response
        const sessionId = `sess_${Date.now()}`;

        return reply.status(202).send({
          sessionId,
          status: 'processing',
          message: 'Agent processing your request. Connect to WebSocket for streaming response.',
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
