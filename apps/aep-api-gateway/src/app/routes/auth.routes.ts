import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Request schemas
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;

/**
 * Authentication routes
 * Base path: /api/v1/auth
 *
 * Note: POST /api/v1/auth/login is handled by JWT plugin via @fastify/jwt
 * This file documents the route for reference and implements refresh token endpoint
 */
export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/auth/token/refresh
   * Refresh access token using refresh token
   * Public endpoint (no JWT required)
   */
  fastify.post<{ Body: RefreshTokenRequest }>(
    '/api/v1/auth/token/refresh',
    {
      schema: {
        description: 'Refresh access token',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },
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
    async (request: FastifyRequest<{ Body: RefreshTokenRequest }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const { refreshToken: _refreshToken } = refreshTokenSchema.parse(request.body);

        // TODO: Integrate with auth-adapter (libs/iot/auth-adapter)
        // 1. Verify refresh token signature and expiry
        // 2. Extract tenant and user from refresh token
        // 3. Generate new access token and refresh token
        // 4. Update token in Redis cache
        // 5. Emit audit event via audit-service

        // Stub response
        const accessToken = 'new_access_token_stub';
        const newRefreshToken = 'new_refresh_token_stub';
        const expiresIn = 3600; // 1 hour

        return reply.status(200).send({
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn,
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

        fastify.log.error(error);
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid refresh token',
        });
      }
    }
  );
}
