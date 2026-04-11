import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

// Query parameter schema for WebSocket connection
const wsQuerySchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
});

type WSQuery = z.infer<typeof wsQuerySchema>;

interface JWTPayload {
  tenantId: string;
  userId: string;
  role: string;
}

/**
 * Agent streaming routes
 * Base path: /api/v1/agent
 * WebSocket for streaming agent responses
 */
export default async function agentStreamRoutes(fastify: FastifyInstance) {
  /**
   * WS /api/v1/agent/stream
   * WebSocket endpoint for streaming agent responses
   * Requires token query parameter for authentication
   */
  fastify.get(
    '/api/v1/agent/stream',
    {
      websocket: true,
      schema: {
        description: 'WebSocket stream for agent responses',
        tags: ['agent', 'websocket'],
        querystring: {
          type: 'object',
          required: ['sessionId', 'token'],
          properties: {
            sessionId: {
              type: 'string',
              description: 'Agent session ID from POST /api/v1/projects/:id/agent',
            },
            token: {
              type: 'string',
              description: 'JWT access token',
            },
          },
        },
      },
    },
    async (connection, request: FastifyRequest<{ Querystring: WSQuery }>) => {
      try {
        // Validate query parameters
        const { sessionId, token } = wsQuerySchema.parse(request.query);

        // TODO: Authenticate WebSocket connection
        // 1. Verify JWT token from query parameter
        // 2. Extract tenant and user from token
        // 3. Verify sessionId exists and belongs to tenant

        // Verify JWT token manually for WebSocket
        let user: JWTPayload;
        try {
          user = (await fastify.jwt.verify(token)) as JWTPayload;
        } catch (error) {
          connection.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid or expired token',
              code: 'AUTH_ERROR',
            })
          );
          connection.close();
          return;
        }

        fastify.log.info({ sessionId, userId: user.userId }, 'WebSocket connected');

        // Send connection acknowledgement
        connection.send(
          JSON.stringify({
            type: 'connected',
            sessionId,
            message: 'Connected to agent stream',
          })
        );

        // TODO: Integrate with agent-runtime (libs/core/agent-runtime)
        // 1. Retrieve agent session from LangGraph
        // 2. Subscribe to agent state updates
        // 3. Stream agent responses in real-time
        // 4. Handle agent tool calls and intermediate steps
        // 5. Stream progress updates from builder-orchestrator
        // 6. Handle preview hot-reload events
        // 7. Stream LLM token usage for billing

        // Message types to stream:
        // - agent_thinking: Agent is processing
        // - agent_tool_call: Agent calling a tool
        // - agent_response: Agent text response (streaming)
        // - build_progress: Build/codegen progress
        // - preview_update: Preview hot-reload event
        // - error: Error occurred
        // - complete: Session complete

        // Handle incoming messages from client
        connection.on('message', (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());

            // TODO: Handle client messages
            // - pause: Pause agent execution
            // - resume: Resume agent execution
            // - cancel: Cancel current operation
            // - feedback: User feedback on agent response

            fastify.log.info({ sessionId, messageType: data.type }, 'WebSocket message received');

            // Echo for stub
            connection.send(
              JSON.stringify({
                type: 'ack',
                originalType: data.type,
              })
            );
          } catch (error) {
            fastify.log.error(error, 'Error parsing WebSocket message');
            connection.send(
              JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
              })
            );
          }
        });

        // Simulate streaming response (stub)
        setTimeout(() => {
          connection.send(
            JSON.stringify({
              type: 'agent_thinking',
              sessionId,
              message: 'Analyzing your request...',
            })
          );
        }, 1000);

        setTimeout(() => {
          connection.send(
            JSON.stringify({
              type: 'agent_response',
              sessionId,
              content: 'I understand you want to create a fleet management dashboard. Let me start by...',
              done: false,
            })
          );
        }, 2000);

        // Handle disconnection
        connection.on('close', () => {
          fastify.log.info({ sessionId, userId: user.userId }, 'WebSocket disconnected');

          // TODO: Cleanup
          // 1. Unsubscribe from agent state updates
          // 2. Mark session as inactive
          // 3. Persist session state to PostgreSQL
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          connection.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid query parameters',
              details: error.issues,
            })
          );
          connection.close();
          return;
        }

        fastify.log.error(error, 'WebSocket error');
        connection.send(
          JSON.stringify({
            type: 'error',
            message: 'Internal server error',
          })
        );
        connection.close();
      }
    }
  );
}
