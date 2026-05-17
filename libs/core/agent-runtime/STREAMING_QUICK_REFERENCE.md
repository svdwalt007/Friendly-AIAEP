# Streaming Interface Quick Reference

## Installation

```bash
pnpm add @friendly-tech/core/agent-runtime
```

## Basic Usage

```typescript
import { streamAgentResponse } from '@friendly-tech/core/agent-runtime';

for await (const chunk of streamAgentResponse(graph, initialState, config)) {
  console.log(chunk.type, chunk);
}
```

## Chunk Types Cheat Sheet

| Type | Purpose | Key Fields |
|------|---------|------------|
| `agent_thinking` | Agent is processing | `agent`, `message?` |
| `agent_response` | Agent's text response | `agent`, `content`, `done` |
| `agent_tool_call` | Tool being invoked | `agent`, `toolName`, `args` |
| `state` | State change | `agent`, `updateType`, `data` |
| `task_update` | Task status change | `taskId`, `status`, `message?` |
| `build_progress` | Build progress | `taskId`, `progress`, `message` |
| `message` | Generic message | `agent`, `content`, `done` |
| `error` | Error occurred | `agent`, `message`, `recoverable` |
| `completion` | Execution complete | `finalState`, `summary?` |

## Common Patterns

### WebSocket Handler

```typescript
fastify.get('/stream', { websocket: true }, async (connection, request) => {
  for await (const chunk of streamAgentResponse(graph, state, config)) {
    connection.send(JSON.stringify(chunk));
  }
});
```

### React Hook

```typescript
function useAgentStream(sessionId: string) {
  const [chunks, setChunks] = useState<StreamChunk[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`ws://...?sessionId=${sessionId}`);
    ws.onmessage = (e) => setChunks(prev => [...prev, JSON.parse(e.data)]);
    return () => ws.close();
  }, [sessionId]);

  return chunks;
}
```

### Error Handling

```typescript
for await (const chunk of streamAgentResponse(graph, state, config)) {
  if (chunk.type === 'error') {
    if (chunk.recoverable) {
      console.warn('Recoverable error:', chunk.message);
    } else {
      console.error('Fatal error:', chunk.message);
      break;
    }
  }
}
```

### AgentStream Class

```typescript
const stream = new AgentStream(graph, config);

for await (const chunk of stream.stream(initialState)) {
  // Process chunks
}

// Cancel if needed
stream.cancel();
```

## Configuration

```typescript
const config: StreamConfig = {
  thread_id: 'required-thread-id',
  checkpoint_id: 'optional-checkpoint', // Resume from checkpoint
  debug: true,                          // Enable logging
  configurable: {},                     // Graph config overrides
};
```

## Type Guards

```typescript
function isAgentResponse(chunk: StreamChunk): chunk is AgentResponseChunk {
  return chunk.type === 'agent_response';
}

function isError(chunk: StreamChunk): chunk is ErrorChunk {
  return chunk.type === 'error';
}

function isStateUpdate(chunk: StreamChunk): chunk is StateUpdateChunk {
  return chunk.type === 'state';
}
```

## Common Filters

```typescript
// Get all errors
const errors = chunks.filter(c => c.type === 'error');

// Get all agent responses
const responses = chunks.filter(c => c.type === 'agent_response');

// Get all state updates of specific type
const buildPlans = chunks.filter(
  c => c.type === 'state' && c.updateType === 'build_plan'
);

// Get final state
const completion = chunks.find(c => c.type === 'completion');
const finalState = completion?.finalState;
```

## Helper Functions

```typescript
import { sendChunkToWebSocket, createMockGraph } from '@friendly-tech/core/agent-runtime';

// Send to WebSocket
sendChunkToWebSocket(chunk, websocketConnection);

// Create mock for testing
const mockGraph = createMockGraph(async function* (input) {
  yield ['node', { ...input }];
});
```

## All Chunk Interfaces

```typescript
// Base
interface BaseStreamChunk {
  type: StreamChunkType;
  timestamp: string;
  thread_id: string;
}

// Agent Thinking
interface AgentThinkingChunk extends BaseStreamChunk {
  type: 'agent_thinking';
  agent: AgentRole;
  message?: string;
}

// Agent Response
interface AgentResponseChunk extends BaseStreamChunk {
  type: 'agent_response';
  agent: AgentRole;
  content: string;
  done: boolean;
}

// Agent Tool Call
interface AgentToolCallChunk extends BaseStreamChunk {
  type: 'agent_tool_call';
  agent: AgentRole;
  toolName: string;
  args: Record<string, unknown>;
}

// State Update
interface StateUpdateChunk extends BaseStreamChunk {
  type: 'state';
  agent: AgentRole;
  updateType: 'build_plan' | 'task_completed' | 'task_started' | 'approval_requested';
  data: unknown;
}

// Task Update
interface TaskUpdateChunk extends BaseStreamChunk {
  type: 'task_update';
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

// Build Progress
interface BuildProgressChunk extends BaseStreamChunk {
  type: 'build_progress';
  taskId: string;
  progress: number;
  message: string;
}

// Message
interface MessageChunk extends BaseStreamChunk {
  type: 'message';
  agent: AgentRole;
  content: string;
  done: boolean;
}

// Error
interface ErrorChunk extends BaseStreamChunk {
  type: 'error';
  agent: AgentRole;
  message: string;
  code?: string;
  recoverable: boolean;
  stack?: string;
}

// Completion
interface CompletionChunk extends BaseStreamChunk {
  type: 'completion';
  finalState: Partial<AEPAgentState>;
  summary?: string;
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { createMockGraph, streamAgentResponse } from '@friendly-tech/core/agent-runtime';

describe('streaming', () => {
  it('should stream chunks', async () => {
    const graph = createMockGraph(async function* (input) {
      yield ['test', { ...input }];
    });

    const chunks: StreamChunk[] = [];
    for await (const chunk of streamAgentResponse(graph, state, config)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

## Debugging

```typescript
// Enable debug mode
const config: StreamConfig = {
  thread_id: 'debug-123',
  debug: true, // Logs all events to console
};

// Custom logging
for await (const chunk of streamAgentResponse(graph, state, config)) {
  console.log(`[${chunk.type}] at ${chunk.timestamp}`);

  if (chunk.type === 'error' && chunk.stack) {
    console.error('Stack trace:', chunk.stack);
  }
}
```
