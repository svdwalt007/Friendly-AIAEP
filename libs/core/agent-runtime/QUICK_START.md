# Agent Runtime - Quick Start Guide

Get started with the LangGraph StateGraph workflow in 5 minutes.

## Installation

The package is already part of the monorepo:

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
```

## Basic Usage

### 1. Create the Graph

```typescript
import { createAgentGraph } from '@friendly-tech/core/agent-runtime';

const graph = createAgentGraph();
```

### 2. Prepare Initial State

```typescript
import { HumanMessage } from '@langchain/core/messages';
import { AgentRole } from '@friendly-tech/core/agent-runtime';

const initialState = {
  messages: [new HumanMessage('Build a fleet dashboard')],
  currentAgent: AgentRole.SUPERVISOR,
  projectId: 'my-project',
  tenantId: 'my-tenant',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
};
```

### 3. Run the Graph

```typescript
const result = await graph.invoke(initialState);

console.log('Build plan:', result.buildPlan);
console.log('Messages:', result.messages);
```

## Complete Minimal Example

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function main() {
  // Create graph
  const graph = createAgentGraph({ debug: true });

  // Prepare state
  const state = {
    messages: [new HumanMessage('Build an IoT dashboard')],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'dashboard-001',
    tenantId: 'tenant-001',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  // Execute
  const result = await graph.invoke(state);

  // View results
  console.log('Tasks:', result.buildPlan.length);
  console.log('Errors:', result.errors.length);
}

main().catch(console.error);
```

## Common Patterns

### Pattern 1: Sequential Requests

```typescript
let state = { /* initial state */ };

// Request 1
state = await graph.invoke(state);

// Request 2
state = {
  ...state,
  messages: [...state.messages, new HumanMessage('Follow-up question')]
};
state = await graph.invoke(state);
```

### Pattern 2: Streaming

```typescript
for await (const event of graph.stream(initialState)) {
  console.log('Event:', event);
}
```

### Pattern 3: Error Checking

```typescript
const result = await graph.invoke(initialState);

if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}

if (result.buildPlan.length > 0) {
  console.log('Plan created with', result.buildPlan.length, 'tasks');
}
```

## Configuration Options

### Debug Mode

```typescript
const graph = createAgentGraph({ debug: true });
// Logs graph construction and execution flow
```

### With Checkpointing

```typescript
import { createCheckpointer } from '@friendly-tech/core/agent-runtime';

const checkpointer = await createCheckpointer({
  host: 'localhost',
  port: 5432,
  database: 'aep_db',
  user: 'postgres',
  password: 'password',
});

const graph = createAgentGraph({ checkpointer });

// Use with thread ID
const result = await graph.invoke(initialState, {
  configurable: { thread_id: 'conv-123' },
});
```

## Agent Routing

The supervisor automatically routes to:

- **Planning Agent** - For building apps, creating projects
  - Keywords: build, create, new app, project

- **IoT Domain Agent** - For device queries, protocol questions
  - Keywords: device, telemetry, sensor, LwM2M

- **END** - When conversation is complete
  - Keywords: thank you, done, that's all

## State Fields Explained

```typescript
{
  messages: [],        // Conversation history
  currentAgent: '',    // Active agent
  projectId: '',       // Project identifier
  tenantId: '',        // Tenant identifier
  buildPlan: [],       // Planned tasks
  completedTasks: [],  // Finished tasks
  generatedAssets: [], // Generated files/code
  errors: [],          // Error log
  approvals: [],       // Pending user approvals
}
```

## Next Steps

1. **Read examples**: See `EXAMPLES.md` for detailed use cases
2. **Understand the graph**: Read `GRAPH_IMPLEMENTATION.md`
3. **Explore agents**: Check `src/lib/agents/`
4. **Review types**: See `src/lib/types.ts`
5. **Test it**: Run `src/lib/graph.spec.ts`

## Troubleshooting

### No LLM Response

Ensure environment variables are set:

```bash
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
```

### Build Plan Empty

The planning agent needs clear requirements:

```typescript
// ❌ Too vague
new HumanMessage('Build something')

// ✅ Clear requirements
new HumanMessage('Build a dashboard to monitor 1000 smart water meters')
```

### Routing to Wrong Agent

Check the supervisor's decision in messages:

```typescript
const lastMsg = result.messages[result.messages.length - 1];
if (lastMsg.additional_kwargs?.supervisor_decision) {
  console.log('Decision:', lastMsg.additional_kwargs.supervisor_decision);
}
```

## API Reference

### `createAgentGraph(config?: GraphConfig)`

Creates and compiles the agent graph.

**Parameters:**
- `config.debug` - Enable verbose logging (default: `false`)
- `config.checkpointer` - Optional checkpointer for state persistence

**Returns:** Compiled graph with `invoke()` and `stream()` methods

### `graph.invoke(state, config?)`

Executes the graph with given state.

**Parameters:**
- `state` - Initial agent state
- `config.configurable.thread_id` - Optional thread ID for checkpointing

**Returns:** Promise<AgentState> - Final state after execution

### `graph.stream(state, config?)`

Streams execution events.

**Parameters:**
- `state` - Initial agent state
- `config.configurable.thread_id` - Optional thread ID

**Returns:** AsyncIterator<Partial<AgentState>> - Event stream

## Getting Help

- Check the examples in `EXAMPLES.md`
- Review test cases in `src/lib/graph.spec.ts`
- Read the full documentation in `GRAPH_IMPLEMENTATION.md`
- Inspect agent prompts in `src/lib/constants.ts`
