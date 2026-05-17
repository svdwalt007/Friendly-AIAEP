import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface JWTPayload {
  tenantId: string;
  userId: string;
  role: string;
}

/**
 * License validation routes
 * Base path: /api/v1/license
 * All routes require JWT authentication
 */
export default async function licenseRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/license/validate
   * Validate license key and return entitlements
   * Protected by JWT middleware
   */
  fastify.get(
    '/api/v1/license/validate',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Validate license and get entitlements',
        tags: ['license'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              tier: {
                type: 'string',
                enum: ['starter', 'pro', 'enterprise'],
              },
              deploymentMode: {
                type: 'string',
                enum: ['saas', 'dedicated'],
              },
              features: {
                type: 'object',
                properties: {
                  helmSupport: { type: 'boolean' },
                  gitPush: { type: 'boolean' },
                  ollama: { type: 'boolean' },
                  airGap: { type: 'boolean' },
                  thirdPartyIngestion: { type: 'boolean' },
                  customWidgets: { type: 'boolean' },
                },
              },
              limits: {
                type: 'object',
                properties: {
                  aiSessions: { type: 'number' },
                  apiCallsPerMonth: { type: 'number' },
                  maxProjects: { type: 'number' },
                },
              },
              gracePeriod: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  hours: { type: 'number' },
                },
              },
              expiresAt: { type: 'string' },
              tenantHash: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              error: { type: 'string' },
              message: { type: 'string' },
              gracePeriodRemaining: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JWTPayload;

      // TODO: Integrate with license-service (libs/core/license-service)
      // 1. Get tenant from JWT payload
      // 2. Retrieve license key from tenant record
      // 3. Validate license key format:
      //    FTECH-AEP-{TIER}-{DEPLOY_MODE}-{TENANT_HASH}-{EXPIRY}-{FLAGS}-{HMAC}
      // 4. Verify HMAC-SHA256 signature
      // 5. Check expiry date
      // 6. Parse feature flags from license
      // 7. Validate tenant binding
      // 8. Validate deployment mode (S=SaaS, D=Dedicated)
      // 9. Check with license-agent for grace period status
      // 10. Return entitlements based on tier:
      //     - Starter ($499/mo): 50 AI sessions, 100k API calls, no grace
      //     - Pro ($2,499/mo): 500 AI sessions, 2M API calls, 24h grace
      //     - Enterprise ($7,999/mo): Unlimited AI, 20M API calls, 7d grace + air-gap

      // Stub response for Pro tier
      return reply.status(200).send({
        valid: true,
        tier: 'pro',
        deploymentMode: 'saas',
        features: {
          helmSupport: false,
          gitPush: true,
          ollama: false,
          airGap: false,
          thirdPartyIngestion: true,
          customWidgets: false,
        },
        limits: {
          aiSessions: 500,
          apiCallsPerMonth: 2000000,
          maxProjects: 50,
        },
        gracePeriod: {
          enabled: true,
          hours: 24,
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        tenantHash: user.tenantId.substring(0, 8),
      });
    }
  );
}
