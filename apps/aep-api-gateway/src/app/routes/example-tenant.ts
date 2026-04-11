/**
 * Example route demonstrating tenant-scoped middleware usage
 *
 * This file shows how to use request.tenantContext in your route handlers
 * to implement tenant-aware database queries.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Example data structure (replace with actual Prisma models)
 */
interface ExampleProject {
  id: string;
  name: string;
  tenantId?: string;
  createdAt: Date;
}

export default async function (fastify: FastifyInstance) {
  /**
   * GET /example/tenant-info
   * Returns the current tenant context information
   */
  fastify.get(
    '/example/tenant-info',
    async (request: FastifyRequest) => {
      const { tenantId, deploymentMode, shouldFilterByTenant } = request.tenantContext;

      return {
        tenantContext: {
          tenantId,
          deploymentMode,
          shouldFilterByTenant,
        },
        message: shouldFilterByTenant
          ? `Running in multi-tenant mode with tenant: ${tenantId}`
          : `Running in ${deploymentMode} mode - no tenant filtering`,
      };
    }
  );

  /**
   * GET /example/projects
   * Example of tenant-aware data fetching
   *
   * In a real implementation, replace the mock data with Prisma queries
   */
  fastify.get(
    '/example/projects',
    async (request: FastifyRequest) => {
      const { tenantId, shouldFilterByTenant } = request.tenantContext;

      // Mock database query logic
      const mockProjects: ExampleProject[] = [
        {
          id: '1',
          name: 'Project Alpha',
          tenantId: 'tenant-123',
          createdAt: new Date(),
        },
        {
          id: '2',
          name: 'Project Beta',
          tenantId: 'tenant-456',
          createdAt: new Date(),
        },
        {
          id: '3',
          name: 'Project Gamma',
          tenantId: 'tenant-123',
          createdAt: new Date(),
        },
      ];

      let filteredProjects: ExampleProject[];

      if (shouldFilterByTenant) {
        // Multi-tenant mode: filter by tenantId
        filteredProjects = mockProjects.filter(
          (project) => project.tenantId === tenantId
        );

        fastify.log.info(
          { tenantId, count: filteredProjects.length },
          'Fetched projects with tenant filter'
        );
      } else {
        // Dedicated mode: return all projects (no tenant filtering)
        filteredProjects = mockProjects;

        fastify.log.info(
          { count: filteredProjects.length },
          'Fetched all projects (dedicated mode)'
        );
      }

      return {
        projects: filteredProjects,
        meta: {
          tenantFiltered: shouldFilterByTenant,
          count: filteredProjects.length,
        },
      };
    }
  );

  /**
   * POST /example/projects
   * Example of tenant-aware data creation
   */
  fastify.post<{
    Body: { name: string; description?: string };
  }>(
    '/example/projects',
    async (request: FastifyRequest<{ Body: { name: string; description?: string } }>, reply: FastifyReply) => {
      const { tenantId, shouldFilterByTenant } = request.tenantContext;
      const { name, description } = request.body;

      // In multi-tenant mode, always include tenantId
      const projectData = shouldFilterByTenant
        ? {
            name,
            description,
            tenantId: tenantId!, // Guaranteed to exist when shouldFilterByTenant is true
          }
        : {
            name,
            description,
            // No tenantId in dedicated mode
          };

      fastify.log.info(
        {
          tenantId: shouldFilterByTenant ? tenantId : 'N/A',
          projectName: name,
        },
        'Creating new project'
      );

      // Mock project creation
      const newProject: ExampleProject = {
        id: `project-${Date.now()}`,
        name: projectData.name,
        tenantId: projectData.tenantId,
        createdAt: new Date(),
      };

      reply.code(201).send({
        project: newProject,
        message: shouldFilterByTenant
          ? `Project created for tenant ${tenantId}`
          : 'Project created (dedicated mode)',
      });
    }
  );

  /**
   * GET /example/health
   * Health check endpoint that doesn't require tenant context
   */
  fastify.get(
    '/example/health',
    async (request: FastifyRequest) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        deploymentMode: request.tenantContext.deploymentMode,
      };
    }
  );
}

/**
 * Real-world Prisma integration example (commented out):
 *
 * import { PrismaClient } from '@prisma/client';
 * import { createTenantClient } from '@friendly-aiaep/prisma-schema';
 *
 * const prisma = new PrismaClient();
 *
 * // Helper to get appropriate DB client
 * function getDbClient(request: FastifyRequest) {
 *   const { tenantId, shouldFilterByTenant } = request.tenantContext;
 *   return shouldFilterByTenant ? createTenantClient(tenantId!) : prisma;
 * }
 *
 * // Use in routes
 * fastify.get('/api/projects', async (_request, _reply) => {
 *   const db = getDbClient(request);
 *   const projects = await db.project.findMany({
 *     include: { owner: true }
 *   });
 *   return { projects };
 * });
 *
 * fastify.post('/api/projects', async (_request, _reply) => {
 *   const db = getDbClient(request);
 *   const { name, description } = request.body;
 *
 *   const project = await db.project.create({
 *     data: {
 *       name,
 *       description,
 *       // In multi-tenant mode, tenantId is automatically added by the client extension
 *     }
 *   });
 *
 *   reply.code(201).send({ project });
 * });
 */
