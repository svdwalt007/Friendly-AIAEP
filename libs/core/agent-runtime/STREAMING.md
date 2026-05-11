# Agent Runtime Streaming Interface

The streaming interface provides real-time updates for agent execution, enabling WebSocket-based communication with clients for live progress monitoring and interactive feedback.

## Overview

The streaming interface wraps LangGraph's compiled graph execution and converts state changes into JSON-serializable chunks that can be transmitted over WebSocket connections. This enables:

- **Real-time progress updates** - Clients see agent thinking, tool calls, and responses as they happen
- **State change notifications** - Build plan updates, task completions, and approval requests
- **Error reporting** - Immediate notification of errors with recovery information
- **WebSocket compatibility** - All chunks are JSON-serializable for network transmission

## Quick Start

### Basic Usage

```typescript
import {
  streamAgentResponse,
  createAgentGraph,
  type StreamConfig,
  type StreamChunk,
} from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

// Create and compile the agent graph
const graph = await createAgentGraph({
  llmProvider: 'anthropic',
  llmModel: 'claude-opus-4-6',
});
const compiledGraph = await graph.compile();

// Initial state
const initialState = {
  messages: [new HumanMessage('Build a fleet management dashboard')],
  currentAgent: 'supervisor',
  projectId: 'proj-123',
  tenantId: 'tenant-456',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
};

// Stream configuration
const config: StreamConfig = {
  thread_id: 'thread-abc-123',
  debug: true,
};

// Stream agent execution
for await (const chunk of streamAgentResponse(compiledGraph, initialState, config)) {
  console.log(`[${chunk.type}] at ${chunk.timestamp}`);

  // Handle different chunk types
  switch (chunk.type) {
    case 'agent_thinking':
      console.log(`Agent ${chunk.agent} is processing...`);
      break;
    case 'agent_response':
      console.log(`Response: ${chunk.content}`);
      break;
    case 'state':
      console.log(`State update: ${chunk.updateType}`);
      break;
    case 'error':
      console.error(`Error: ${chunk.message}`);
      break;
    case 'completion':
      console.log('Agent execution completed');
      break;
  }
}
```

### Using AgentStream Class

```typescript
import { AgentStream } from '@friendly-tech/core/agent-runtime';

const agentStream = new AgentStream(compiledGraph, config);

try {
  for await (const chunk of agentStream.stream(initialState)) {
    // Process chunks
    console.log(chunk);
  }
} catch (error) {
  console.error('Stream failed:', error);
  agentStream.cancel(); // Cancel if needed
}

console.log('Stream running:', agentStream.running); // false after completion
```

### WebSocket Integration

```typescript
import { sendChunkToWebSocket } from '@friendly-tech/core/agent-runtime';
import type { FastifyInstance } from 'fastify';

// Fastify WebSocket route
fastify.get('/api/v1/agent/stream', { websocket: true }, async (connection, request) => {
  const { sessionId } = request.query;

  // Configure streaming
  const config: StreamConfig = {
    thread_id: sessionId,
    debug: false,
  };

  // Retrieve initial state from session
  const initialState = await getSessionState(sessionId);

  // Stream to client
  try {
    for await (const chunk of streamAgentResponse(graph, initialState, config)) {
      sendChunkToWebSocket(chunk, connection);
    }
  } catch (error) {
    connection.send(JSON.stringify({
      type: 'error',
      message: error.message,
      recoverable: false,
    }));
  }
});
```

## Stream Chunk Types

All chunks extend the base structure:

```typescript
interface BaseStreamChunk {
  type: StreamChunkType;
  timestamp: string;      // ISO 8601 timestamp
  thread_id: string;      // Thread/session identifier
}
```

### 1. Agent Thinking Chunk

Indicates an agent is processing a request.

```typescript
interface AgentThinkingChunk {
  type: 'agent_thinking';
  timestamp: string;
  thread_id: string;
  agent: AgentRole;       // 'supervisor' | 'planning' | 'iot_domain'
  message?: string;       // Optional status message
}
```

**When emitted:**
- Agent transitions (e.g., supervisor → planning)
- Agent begins processing

### 2. Agent Response Chunk

Agent's text response (may be streamed in parts).

```typescript
interface AgentResponseChunk {
  type: 'agent_response';
  timestamp: string;
  thread_id: string;
  agent: AgentRole;
  content: string;        // Response text (may be partial)
  done: boolean;          // True if this is the final chunk
}
```

**When emitted:**
- New AI message is added to conversation
- Can be streamed token-by-token in future enhancements

### 3. Agent Tool Call Chunk

Agent is invoking a tool function.

```typescript
interface AgentToolCallChunk {
  type: 'agent_tool_call';
  timestamp: string;
  thread_id: string;
  agent: AgentRole;
  toolName: string;                    // Tool being called
  args: Record<string, unknown>;       // Tool arguments
}
```

**When emitted:**
- Agent calls a tool (e.g., `getDeviceList`, `createProject`)
- Useful for showing "Agent is querying devices..." in UI

### 4. State Update Chunk

Significant state changes in the agent system.

```typescript
interface StateUpdateChunk {
  type: 'state';
  timestamp: string;
  thread_id: string;
  agent: AgentRole;
  updateType: 'build_plan' | 'task_completed' | 'task_started' | 'approval_requested';
  data: unknown;          // The updated data (type depends on updateType)
}
```

**Update Types:**

- `build_plan` - Build plan created/modified
  ```typescript
  data: {
    buildPlan: BuildTask[];
    totalTasks: number;
  }
  ```

- `task_completed` - A task finished
  ```typescript
  data: BuildTask
  ```

- `task_started` - A task began execution
  ```typescript
  data: BuildTask
  ```

- `approval_requested` - User approval needed
  ```typescript
  data: ApprovalRequest
  ```

### 5. Task Update Chunk

Individual task status changes.

```typescript
interface TaskUpdateChunk {
  type: 'task_update';
  timestamp: string;
  thread_id: string;
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;       // Optional status message
}
```

**When emitted:**
- Task status changes
- Useful for progress indicators in UI

### 6. Build Progress Chunk

Build/codegen progress updates (for future builder integration).

```typescript
interface BuildProgressChunk {
  type: 'build_progress';
  timestamp: string;
  thread_id: string;
  taskId: string;
  progress: number;       // 0-100
  message: string;        // Progress message
}
```

### 7. Message Chunk

Generic message (non-AI messages from conversation).

```typescript
interface MessageChunk {
  type: 'message';
  timestamp: string;
  thread_id: string;
  agent: AgentRole;
  content: string;
  done: boolean;
}
```

### 8. Error Chunk

Error events during execution.

```typescript
interface ErrorChunk {
  type: 'error';
  timestamp: string;
  thread_id: string;
  agent: AgentRole;
  message: string;
  code?: string;          // Error code (e.g., 'AGENT_ERROR', 'EXECUTION_ERROR')
  recoverable: boolean;   // Can execution continue?
  stack?: string;         // Stack trace (only in debug mode)
}
```

**When emitted:**
- Agent encounters an error
- LLM provider failure
- Tool execution failure
- Graph execution error

### 9. Completion Chunk

Final chunk indicating successful completion.

```typescript
interface CompletionChunk {
  type: 'completion';
  timestamp: string;
  thread_id: string;
  finalState: Partial<AEPAgentState>;
  summary?: string;       // Execution summary
}
```

**When emitted:**
- Agent execution completes successfully
- Always the last chunk in a successful stream

## Configuration

### StreamConfig

```typescript
interface StreamConfig {
  thread_id: string;                    // Required: Conversation thread ID
  checkpoint_id?: string;               // Optional: Resume from checkpoint
  configurable?: Record<string, unknown>; // Optional: Graph config overrides
  debug?: boolean;                      // Enable debug logging (default: false)
}
```

**Debug Mode:**
- Enables console logging of all stream events
- Includes stack traces in error chunks
- Logs agent transitions and state changes

## Client-Side Integration

### React Hook Example

```typescript
import { useEffect, useState } from 'react';
import type { StreamChunk } from '@friendly-tech/core/agent-runtime';

export function useAgentStream(sessionId: string, token: string) {
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:45001/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
    );

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      const chunk = JSON.parse(event.data) as StreamChunk;
      setChunks(prev => [...prev, chunk]);

      // Handle completion
      if (chunk.type === 'completion') {
        ws.close();
      }
    };

    ws.onerror = (event) => {
      setError('WebSocket error');
      console.error('WebSocket error:', event);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => ws.close();
  }, [sessionId, token]);

  return { chunks, isConnected, error };
}
```

### Vue Composable Example

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import type { StreamChunk } from '@friendly-tech/core/agent-runtime';

export function useAgentStream(sessionId: string, token: string) {
  const chunks = ref<StreamChunk[]>([]);
  const isConnected = ref(false);
  const error = ref<string | null>(null);

  let ws: WebSocket | null = null;

  onMounted(() => {
    ws = new WebSocket(
      `ws://localhost:45001/api/v1/agent/stream?sessionId=${sessionId}&token=${token}`
    );

    ws.onopen = () => isConnected.value = true;

    ws.onmessage = (event) => {
      const chunk = JSON.parse(event.data) as StreamChunk;
      chunks.value.push(chunk);

      if (chunk.type === 'completion') {
        ws?.close();
      }
    };

    ws.onerror = () => {
      error.value = 'WebSocket error';
    };

    ws.onclose = () => {
      isConnected.value = false;
    };
  });

  onUnmounted(() => {
    ws?.close();
  });

  return { chunks, isConnected, error };
}
```

## Error Handling

### Recoverable vs Non-Recoverable Errors

Errors include a `recoverable` flag:

```typescript
if (chunk.type === 'error') {
  if (chunk.recoverable) {
    // Agent can continue, show warning to user
    showWarning(chunk.message);
  } else {
    // Fatal error, execution stopped
    showError(chunk.message);
    closeWebSocket();
  }
}
```

### Retry Logic

```typescript
async function streamWithRetry(
  graph: CompiledGraph,
  state: Partial<AEPAgentState>,
  config: StreamConfig,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      for await (const chunk of streamAgentResponse(graph, state, config)) {
        yield chunk;
      }
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}
```

## Performance Considerations

### Chunk Batching

For high-frequency updates, consider batching chunks:

```typescript
const chunkBuffer: StreamChunk[] = [];
const BATCH_INTERVAL = 100; // ms

setInterval(() => {
  if (chunkBuffer.length > 0) {
    connection.send(JSON.stringify({
      type: 'batch',
      chunks: chunkBuffer,
    }));
    chunkBuffer.length = 0;
  }
}, BATCH_INTERVAL);

for await (const chunk of streamAgentResponse(graph, state, config)) {
  chunkBuffer.push(chunk);
}
```

### Memory Management

For long-running sessions, limit chunk history:

```typescript
const MAX_CHUNKS = 1000;

const chunks: StreamChunk[] = [];
for await (const chunk of streamAgentResponse(graph, state, config)) {
  chunks.push(chunk);

  // Keep only recent chunks
  if (chunks.length > MAX_CHUNKS) {
    chunks.shift();
  }

  sendChunkToWebSocket(chunk, connection);
}
```

## Testing

### Mock Graph for Testing

```typescript
import { createMockGraph } from '@friendly-tech/core/agent-runtime';

const mockGraph = createMockGraph(async function* (input) {
  // Simulate supervisor
  yield ['supervisor', { ...input, currentAgent: 'supervisor' }];

  // Simulate planning
  const buildPlan = [
    {
      id: 'task-1',
      type: 'project_setup',
      description: 'Setup project',
      agent: 'planning',
      dependencies: [],
      status: 'pending',
    },
  ];
  yield ['planning', { ...input, currentAgent: 'planning', buildPlan }];

  // Simulate completion
  yield ['planning', {
    ...input,
    completedTasks: [{ ...buildPlan[0], status: 'completed' }]
  }];
});

// Use in tests
const chunks: StreamChunk[] = [];
for await (const chunk of streamAgentResponse(mockGraph, state, config)) {
  chunks.push(chunk);
}

expect(chunks).toHaveLength(expectedCount);
```

### Integration Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('AgentStream Integration', () => {
  it('should stream complete agent execution', async () => {
    const graph = await createAgentGraph(config);
    const compiled = await graph.compile();

    const chunks: StreamChunk[] = [];

    for await (const chunk of streamAgentResponse(compiled, initialState, streamConfig)) {
      chunks.push(chunk);
    }

    // Verify chunk sequence
    expect(chunks[0].type).toBe('agent_thinking');
    expect(chunks.some(c => c.type === 'agent_response')).toBe(true);
    expect(chunks[chunks.length - 1].type).toBe('completion');
  });
});
```

## Monitoring and Debugging

### Enable Debug Logging

```typescript
const debugConfig: StreamConfig = {
  thread_id: 'debug-thread',
  debug: true,
};

// Logs will show:
// [AgentStream] Initializing agent stream
// [AgentStream] Node executed: supervisor
// [AgentStream] Agent transition: supervisor -> planning
// [AgentStream] Build plan updated
// [AgentStream] Stream completed successfully in 1234ms
```

### Custom Logging

```typescript
for await (const chunk of streamAgentResponse(graph, state, config)) {
  // Log to monitoring service
  monitoringService.trackEvent('agent_stream_chunk', {
    type: chunk.type,
    thread_id: chunk.thread_id,
    timestamp: chunk.timestamp,
  });

  // Track errors separately
  if (chunk.type === 'error') {
    errorTracker.captureError({
      message: chunk.message,
      agent: chunk.agent,
      recoverable: chunk.recoverable,
    });
  }
}
```

## Future Enhancements

### Token-Level Streaming

Currently, `agent_response` chunks contain complete messages. Future versions will support token-by-token streaming:

```typescript
interface AgentResponseChunk {
  type: 'agent_response';
  agent: AgentRole;
  content: string;        // Single token or partial text
  done: boolean;          // True on final token
  tokenIndex?: number;    // Position in response
}
```

### Stream Checkpointing

Save stream state for resume capability:

```typescript
const checkpoint = await saveStreamCheckpoint(chunks, currentState);

// Resume later
const config: StreamConfig = {
  thread_id: 'thread-123',
  checkpoint_id: checkpoint.id,
};
```

### Bi-directional Communication

Support for client → agent messages during streaming:

```typescript
connection.on('message', async (message) => {
  const data = JSON.parse(message);

  if (data.type === 'interrupt') {
    await graph.interrupt(data.feedback);
  }
});
```

## See Also

- [Agent Runtime README](./README.md) - Main agent runtime documentation
- [Graph Documentation](./GRAPH.md) - LangGraph setup and configuration
- [API Gateway Routes](../../apps/aep-api-gateway/src/app/routes/agent-stream.routes.ts) - WebSocket endpoint implementation
