/**
 * Tenant middleware plugin for Fastify auto-loading
 *
 * This plugin is automatically loaded by @fastify/autoload in app.ts
 */

import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import tenantMiddleware from '../middleware/tenant';

/**
 * Plugin that registers tenant-scoped middleware
 * Loaded early in the plugin chain to ensure tenant context is available
 */
async function tenantPlugin(fastify: FastifyInstance) {
  // Register tenant middleware with configuration from environment
  await fastify.register(tenantMiddleware, {
    // deploymentMode is read from DEPLOYMENT_MODE env var by default
    // requireTenantId can be enabled to enforce tenant presence in multi-tenant mode
    requireTenantId: process.env.REQUIRE_TENANT_ID === 'true',
  });
}

export default fp(tenantPlugin, {
  name: 'tenant-plugin',
  fastify: '5.x',
});
