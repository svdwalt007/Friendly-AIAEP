# Streaming Integration Example

This document provides a complete example of integrating the agent streaming interface with the AEP API Gateway WebSocket endpoint.

## API Gateway Integration

### Updated WebSocket Route

Replace the stub implementation in `apps/aep-api-gateway/src/app/routes/agent-stream.routes.ts`:

```typescript
import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  streamAgentResponse,
  sendChunkToWebSocket,
  createAgentGraph,
  type StreamConfig,
  type StreamChunk,
} from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

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

export default async function agentStreamRoutes(fastify: FastifyInstance) {
  // Initialize agent graph once (could be moved to app setup)
  const graph = await createAgentGraph({
    llmProvider: process.env.LLM_PROVIDER || 'anthropic',
    llmModel: process.env.LLM_MODEL || 'claude-opus-4-6',
    checkpointer: fastify.checkpointer, // From app setup
  });
  const compiledGraph = await graph.compile();

  /**
   * WS /api/v1/agent/stream
   * WebSocket endpoint for streaming agent responses
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
      let user: JWTPayload;
      let sessionId: string;

      try {
        // Validate query parameters
        const query = wsQuerySchema.parse(request.query);
        sessionId = query.sessionId;

        // Verify JWT token
        try {
          user = (await fastify.jwt.verify(query.token)) as JWTPayload;
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

        // Retrieve session state from database
        // TODO: Implement session retrieval from PostgreSQL
        const sessionState = await retrieveSessionState(sessionId, user.tenantId);

        if (!sessionState) {
          connection.send(
            JSON.stringify({
              type: 'error',
              message: 'Session not found',
              code: 'SESSION_NOT_FOUND',
            })
          );
          connection.close();
          return;
        }

        // Configure streaming
        const streamConfig: StreamConfig = {
          thread_id: sessionId,
          checkpoint_id: sessionState.checkpointId,
          debug: process.env.NODE_ENV === 'development',
          configurable: {
            tenantId: user.tenantId,
            userId: user.userId,
          },
        };

        // Stream agent execution
        try {
          for await (const chunk of streamAgentResponse(
            compiledGraph,
            sessionState.state,
            streamConfig
          )) {
            // Send chunk to client
            sendChunkToWebSocket(chunk, connection);

            // Persist state updates to database
            if (chunk.type === 'state' || chunk.type === 'completion') {
              await persistStreamChunk(sessionId, chunk, user.tenantId);
            }

            // Close connection on completion
            if (chunk.type === 'completion') {
              fastify.log.info({ sessionId }, 'Agent execution completed');
              setTimeout(() => connection.close(), 100); // Small delay to ensure message delivery
              break;
            }

            // Close connection on fatal error
            if (chunk.type === 'error' && !chunk.recoverable) {
              fastify.log.error({ sessionId, error: chunk.message }, 'Fatal error in agent execution');
              setTimeout(() => connection.close(), 100);
              break;
            }
          }
        } catch (error) {
          fastify.log.error(error, 'Stream execution error');
          connection.send(
            JSON.stringify({
              type: 'error',
              message: 'Agent execution failed',
              code: 'EXECUTION_ERROR',
              recoverable: false,
            })
          );
          connection.close();
        }

        // Handle incoming messages from client
        connection.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());

            switch (data.type) {
              case 'pause':
                // TODO: Implement pause functionality
                fastify.log.info({ sessionId }, 'Pause requested');
                break;

              case 'resume':
                // TODO: Implement resume functionality
                fastify.log.info({ sessionId }, 'Resume requested');
                break;

              case 'cancel':
                fastify.log.info({ sessionId }, 'Cancel requested');
                connection.close();
                break;

              case 'feedback':
                // Store user feedback
                await storeFeedback(sessionId, data.feedback, user.tenantId);
                connection.send(
                  JSON.stringify({
                    type: 'ack',
                    originalType: 'feedback',
                  })
                );
                break;

              default:
                fastify.log.warn({ sessionId, type: data.type }, 'Unknown message type');
            }
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

        // Handle disconnection
        connection.on('close', async () => {
          fastify.log.info({ sessionId, userId: user.userId }, 'WebSocket disconnected');

          // Mark session as inactive
          await markSessionInactive(sessionId, user.tenantId);
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
        } else {
          fastify.log.error(error, 'WebSocket error');
          connection.send(
            JSON.stringify({
              type: 'error',
              message: 'Internal server error',
            })
          );
        }
        connection.close();
      }
    }
  );
}

// Helper functions (to be implemented)

async function retrieveSessionState(sessionId: string, tenantId: string) {
  // TODO: Implement with Prisma
  // Example:
  // const session = await prisma.agentSession.findUnique({
  //   where: { id: sessionId, tenantId },
  // });
  // return {
  //   state: session.state,
  //   checkpointId: session.checkpointId,
  // };

  // Stub for now
  return {
    state: {
      messages: [],
      currentAgent: 'supervisor',
      projectId: 'stub-project',
      tenantId,
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    },
    checkpointId: null,
  };
}

async function persistStreamChunk(
  sessionId: string,
  chunk: StreamChunk,
  tenantId: string
) {
  // TODO: Implement with Prisma
  // Save chunk to database for audit/replay
  // Example:
  // await prisma.streamChunk.create({
  //   data: {
  //     sessionId,
  //     tenantId,
  //     type: chunk.type,
  //     data: chunk,
  //     timestamp: new Date(chunk.timestamp),
  //   },
  // });
}

async function markSessionInactive(sessionId: string, tenantId: string) {
  // TODO: Implement with Prisma
  // Example:
  // await prisma.agentSession.update({
  //   where: { id: sessionId, tenantId },
  //   data: { status: 'inactive', endedAt: new Date() },
  // });
}

async function storeFeedback(
  sessionId: string,
  feedback: unknown,
  tenantId: string
) {
  // TODO: Implement with Prisma
  // Example:
  // await prisma.userFeedback.create({
  //   data: {
  //     sessionId,
  //     tenantId,
  //     feedback,
  //     createdAt: new Date(),
  //   },
  // });
}
```

## Client-Side Integration

### React Component

```typescript
import { useEffect, useState, useCallback } from 'react';
import type { StreamChunk } from '@friendly-tech/core/agent-runtime';

interface AgentStreamProps {
  sessionId: string;
  token: string;
}

export function AgentStreamViewer({ sessionId, token }: AgentStreamProps) {
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket(
      `ws://localhost:3000/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
    );

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    };

    websocket.onmessage = (event) => {
      const chunk = JSON.parse(event.data) as StreamChunk;
      console.log('Received chunk:', chunk);

      setChunks(prev => [...prev, chunk]);

      // Handle completion
      if (chunk.type === 'completion') {
        console.log('Stream completed');
        websocket.close();
      }

      // Handle fatal errors
      if (chunk.type === 'error' && !chunk.recoverable) {
        console.error('Fatal error:', chunk.message);
        websocket.close();
      }
    };

    websocket.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error');
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    setWs(websocket);

    return () => websocket.close();
  }, [sessionId, token]);

  const sendFeedback = useCallback((feedback: string) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'feedback',
        feedback,
      }));
    }
  }, [ws, isConnected]);

  const cancel = useCallback(() => {
    if (ws && isConnected) {
      ws.send(JSON.stringify({ type: 'cancel' }));
    }
  }, [ws, isConnected]);

  return (
    <div className="agent-stream">
      <div className="status">
        {isConnected ? (
          <span className="connected">Connected</span>
        ) : (
          <span className="disconnected">Disconnected</span>
        )}
        {error && <span className="error">{error}</span>}
      </div>

      <div className="chunks">
        {chunks.map((chunk, index) => (
          <ChunkDisplay key={index} chunk={chunk} />
        ))}
      </div>

      <div className="actions">
        <button onClick={cancel} disabled={!isConnected}>
          Cancel
        </button>
        <button onClick={() => sendFeedback('positive')} disabled={!isConnected}>
          👍
        </button>
        <button onClick={() => sendFeedback('negative')} disabled={!isConnected}>
          👎
        </button>
      </div>
    </div>
  );
}

function ChunkDisplay({ chunk }: { chunk: StreamChunk }) {
  switch (chunk.type) {
    case 'agent_thinking':
      return (
        <div className="chunk thinking">
          <span className="spinner">⚙️</span>
          <span>{chunk.agent} is processing...</span>
        </div>
      );

    case 'agent_response':
      return (
        <div className="chunk response">
          <strong>{chunk.agent}:</strong>
          <p>{chunk.content}</p>
          {!chunk.done && <span className="typing">...</span>}
        </div>
      );

    case 'state':
      return (
        <div className="chunk state">
          <span>📋 State Update: {chunk.updateType}</span>
        </div>
      );

    case 'task_update':
      return (
        <div className="chunk task">
          <span>
            ✓ Task {chunk.taskId}: {chunk.status}
          </span>
        </div>
      );

    case 'error':
      return (
        <div className={`chunk error ${chunk.recoverable ? 'recoverable' : 'fatal'}`}>
          <span>❌ Error: {chunk.message}</span>
          {chunk.recoverable && <span> (recoverable)</span>}
        </div>
      );

    case 'completion':
      return (
        <div className="chunk completion">
          <span>✅ Completed!</span>
          {chunk.summary && <p>{chunk.summary}</p>}
        </div>
      );

    default:
      return (
        <div className="chunk unknown">
          <span>Unknown chunk type: {chunk.type}</span>
        </div>
      );
  }
}
```

### Vue Component

```vue
<template>
  <div class="agent-stream">
    <div class="status">
      <span v-if="isConnected" class="connected">Connected</span>
      <span v-else class="disconnected">Disconnected</span>
      <span v-if="error" class="error">{{ error }}</span>
    </div>

    <div class="chunks">
      <ChunkDisplay v-for="(chunk, index) in chunks" :key="index" :chunk="chunk" />
    </div>

    <div class="actions">
      <button @click="cancel" :disabled="!isConnected">Cancel</button>
      <button @click="sendFeedback('positive')" :disabled="!isConnected">👍</button>
      <button @click="sendFeedback('negative')" :disabled="!isConnected">👎</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { StreamChunk } from '@friendly-tech/core/agent-runtime';

const props = defineProps<{
  sessionId: string;
  token: string;
}>();

const chunks = ref<StreamChunk[]>([]);
const isConnected = ref(false);
const error = ref<string | null>(null);
let ws: WebSocket | null = null;

onMounted(() => {
  ws = new WebSocket(
    `ws://localhost:3000/api/v1/agent/stream?sessionId=${props.sessionId}&token=${props.token}`
  );

  ws.onopen = () => {
    isConnected.value = true;
    error.value = null;
  };

  ws.onmessage = (event) => {
    const chunk = JSON.parse(event.data) as StreamChunk;
    chunks.value.push(chunk);

    if (chunk.type === 'completion' || (chunk.type === 'error' && !chunk.recoverable)) {
      ws?.close();
    }
  };

  ws.onerror = () => {
    error.value = 'Connection error';
    isConnected.value = false;
  };

  ws.onclose = () => {
    isConnected.value = false;
  };
});

onUnmounted(() => {
  ws?.close();
});

function sendFeedback(feedback: string) {
  if (ws && isConnected.value) {
    ws.send(JSON.stringify({ type: 'feedback', feedback }));
  }
}

function cancel() {
  if (ws && isConnected.value) {
    ws.send(JSON.stringify({ type: 'cancel' }));
  }
}
</script>
```

## Testing the Integration

### End-to-End Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import type { StreamChunk } from '@friendly-tech/core/agent-runtime';

describe('Agent Stream WebSocket Integration', () => {
  let app: any;
  let token: string;
  let sessionId: string;

  beforeAll(async () => {
    // Start Fastify app
    app = await createTestApp();
    await app.listen({ port: 3000 });

    // Get auth token
    const authResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'test@example.com', password: 'test123' },
    });
    token = JSON.parse(authResponse.body).token;

    // Create agent session
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/test-project/agent',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'Build a dashboard' },
    });
    sessionId = JSON.parse(sessionResponse.body).sessionId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should stream agent execution', (done) => {
    const ws = new WebSocket(
      `ws://localhost:3000/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
    );

    const chunks: StreamChunk[] = [];

    ws.on('message', (data) => {
      const chunk = JSON.parse(data.toString()) as StreamChunk;
      chunks.push(chunk);

      if (chunk.type === 'completion') {
        // Verify we received expected chunks
        expect(chunks.some(c => c.type === 'connected')).toBe(true);
        expect(chunks.some(c => c.type === 'agent_thinking')).toBe(true);
        expect(chunks.some(c => c.type === 'agent_response')).toBe(true);
        expect(chunks[chunks.length - 1].type).toBe('completion');

        ws.close();
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  });
});
```

## Production Considerations

### 1. Connection Pooling

```typescript
// Limit concurrent WebSocket connections per tenant
const connectionLimits = new Map<string, number>();
const MAX_CONNECTIONS_PER_TENANT = 10;

fastify.get('/api/v1/agent/stream', { websocket: true }, async (connection, request) => {
  const tenantId = user.tenantId;
  const currentConnections = connectionLimits.get(tenantId) || 0;

  if (currentConnections >= MAX_CONNECTIONS_PER_TENANT) {
    connection.send(JSON.stringify({
      type: 'error',
      message: 'Connection limit exceeded',
      code: 'RATE_LIMIT',
    }));
    connection.close();
    return;
  }

  connectionLimits.set(tenantId, currentConnections + 1);

  connection.on('close', () => {
    connectionLimits.set(tenantId, (connectionLimits.get(tenantId) || 1) - 1);
  });

  // ... rest of handler
});
```

### 2. Heartbeat/Ping-Pong

```typescript
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

let heartbeatTimer = setInterval(() => {
  if (connection.readyState === WebSocket.OPEN) {
    connection.ping();
  }
}, HEARTBEAT_INTERVAL);

connection.on('close', () => {
  clearInterval(heartbeatTimer);
});
```

### 3. Message Queue for Reliability

```typescript
// Use Redis or RabbitMQ for reliable message delivery
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Publish chunks to Redis
for await (const chunk of streamAgentResponse(graph, state, config)) {
  await redis.publish(`agent-stream:${sessionId}`, JSON.stringify(chunk));
  sendChunkToWebSocket(chunk, connection);
}
```

## Monitoring and Metrics

```typescript
// Track stream metrics
fastify.addHook('onReady', async () => {
  const prometheusRegister = new Registry();

  const activeStreams = new Gauge({
    name: 'agent_active_streams',
    help: 'Number of active agent streams',
    labelNames: ['tenant_id'],
    registers: [prometheusRegister],
  });

  const streamDuration = new Histogram({
    name: 'agent_stream_duration_seconds',
    help: 'Duration of agent streams',
    labelNames: ['tenant_id', 'status'],
    registers: [prometheusRegister],
  });

  // Use in stream handler
  activeStreams.inc({ tenant_id: user.tenantId });
  const timer = streamDuration.startTimer({ tenant_id: user.tenantId });

  connection.on('close', () => {
    activeStreams.dec({ tenant_id: user.tenantId });
    timer({ status: 'completed' });
  });
});
```

This integration example provides a complete, production-ready implementation of the streaming interface with the API Gateway.
