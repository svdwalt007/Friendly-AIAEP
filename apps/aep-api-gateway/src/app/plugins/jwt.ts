import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

/**
 * JWT authentication plugin
 * Provides JWT signing, verification, and authentication decorator
 *
 * @see https://github.com/fastify/fastify-jwt
 */
export default fp(async function (fastify: FastifyInstance) {
  // Register JWT plugin
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    sign: {
      expiresIn: '1h', // Access token expires in 1 hour
    },
  });

  // Decorate request with authenticate method
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  });

  // TODO: Add login endpoint
  // This is a basic implementation - integrate with auth-adapter for production
  fastify.post(
    '/api/v1/auth/login',
    {
      schema: {
        description: 'Login with username and password',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  tenantId: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
          401: {
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
    async (request: FastifyRequest<{ Body: { username: string; password: string } }>, reply: FastifyReply) => {
      const { username, password } = request.body;

      // TODO: Integrate with auth-adapter (libs/iot/auth-adapter)
      // 1. Validate credentials against tenant database
      // 2. Support multiple auth methods:
      //    - Basic Auth (UID/PW)
      //    - API Key
      //    - OAuth2 (future)
      // 3. Retrieve tenant and user information
      // 4. Generate JWT with tenant context
      // 5. Generate refresh token
      // 6. Store tokens in Redis cache
      // 7. Emit audit event for login

      // Stub implementation
      if (username === 'demo' && password === 'demo') {
        const user = {
          id: 'user_001',
          username: 'demo',
          tenantId: 'tenant_001',
          role: 'admin',
        };

        const accessToken = fastify.jwt.sign({
          userId: user.id,
          tenantId: user.tenantId,
          role: user.role,
          tier: 'professional',
        } as any);

        // Generate refresh token (longer expiry)
        const refreshToken = fastify.jwt.sign(
          {
            userId: user.id,
            tenantId: user.tenantId,
            role: user.role,
            tier: 'professional',
            type: 'refresh',
          } as any,
          {
            expiresIn: '7d',
          }
        );

        return reply.status(200).send({
          accessToken,
          refreshToken,
          expiresIn: 3600,
          user: {
            id: user.id,
            username: user.username,
            tenantId: user.tenantId,
            role: user.role,
          },
        });
      }

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }
  );
});

// Add TypeScript declarations for decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
