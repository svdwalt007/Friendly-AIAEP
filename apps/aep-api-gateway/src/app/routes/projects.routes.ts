import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    async (
      request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>,
      reply: FastifyReply
    ) => {
      const { limit = 20, offset = 0 } = request.query;
      const jwtPayload = request.user as { tenantId?: string };
      const tenantId = jwtPayload?.tenantId;

      const where = tenantId ? { tenantId } : {};
      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, description: true, status: true, createdAt: true, updatedAt: true },
        }),
        prisma.project.count({ where }),
      ]);

      return reply.status(200).send({
        projects: projects.map((p) => ({
          ...p,
          status: p.status.toLowerCase(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        total,
        limit,
        offset,
      });
    }
  );

  /**
   * POST /api/v1/projects
   * Create a new project
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
        const jwtPayload = request.user as { tenantId?: string; userId?: string };
        const tenantId = jwtPayload?.tenantId ?? 'tenant_001';
        const ownerId = jwtPayload?.userId ?? 'user_001';

        const project = await prisma.project.create({
          data: {
            tenantId,
            ownerId,
            name: projectData.name,
            description: projectData.description,
            status: 'ACTIVE',
          },
          select: { id: true, name: true, description: true, status: true, createdAt: true },
        });

        return reply.status(201).send({
          ...project,
          status: project.status.toLowerCase(),
          createdAt: project.createdAt.toISOString(),
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
   * GET /api/v1/projects/:id
   * Get project details by ID
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
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
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
      const { id } = request.params;
      const jwtPayload = request.user as { tenantId?: string };
      const tenantId = jwtPayload?.tenantId;

      const project = await prisma.project.findFirst({
        where: { id, ...(tenantId ? { tenantId } : {}) },
        include: {
          pages: { select: { id: true, name: true, route: true, title: true } },
          dataSources: { select: { id: true } },
        },
      });

      if (!project) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      return reply.status(200).send({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status.toLowerCase(),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        pages: project.pages,
        dataSourceCount: project.dataSources.length,
      });
    }
  );

  /**
   * POST /api/v1/projects/:id/agent
   * Send prompt to agent for project
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
          properties: { id: { type: 'string' } },
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
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: SendPromptRequest }>,
      reply: FastifyReply
    ) => {
      try {
        sendPromptSchema.parse(request.body);
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
