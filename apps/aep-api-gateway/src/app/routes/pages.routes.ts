import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Page management routes
 * Base path: /api/v1/projects/:id/pages
 * All routes require JWT authentication
 */
export default async function pagesRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/projects/:id/pages
   * List all pages for a project
   * Protected by JWT middleware
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/projects/:id/pages',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'List all pages for a project',
        tags: ['projects', 'pages'],
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
              pages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    projectId: { type: 'string' },
                    route: { type: 'string' },
                    title: { type: 'string' },
                    layoutType: { type: 'string' },
                    widgetCount: { type: 'number' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
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
      const { id: projectId } = request.params;

      // TODO: Integrate with project-registry (libs/core/project-registry)
      // 1. Verify project exists and belongs to tenant
      // 2. Query all pages for project with PageSchema
      // 3. Include widget count per page
      // 4. Return tenant-scoped page list

      // TODO: Page schema includes:
      // - route: page URL path
      // - title: page display title
      // - layoutType: grid/flex/dashboard
      // - responsive breakpoints: 1440px/768px
      // - widget placements and configurations

      // Stub response
      return reply.status(200).send({
        pages: [
          {
            id: 'page_001',
            projectId,
            route: '/dashboard',
            title: 'Main Dashboard',
            layoutType: 'grid',
            widgetCount: 8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'page_002',
            projectId,
            route: '/devices',
            title: 'Device Management',
            layoutType: 'flex',
            widgetCount: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 2,
      });
    }
  );
}
