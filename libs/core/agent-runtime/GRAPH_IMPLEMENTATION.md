# LangGraph StateGraph Implementation

This document describes the LangGraph StateGraph workflow implementation for the AEP Multi-Agent System.

## Overview

The graph orchestrates the flow between three agents:
- **Supervisor**: Routes user requests to specialist agents
- **Planning Agent**: Creates build plans for IoT applications
- **IoT Domain Agent**: Answers questions about devices, protocols, and telemetry

## Graph Structure

```
   START
     ↓
 supervisor (routing hub)
     ├→ planning → supervisor (return after plan)
     ├→ iot_domain → supervisor (return after answer)
     └→ END (when next === 'FINISH')
```

## State Management

The graph uses LangGraph's `Annotation` system to define state:

```typescript
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  currentAgent: Annotation<AgentRole>({
    reducer: (left, right) => right ?? left,
    default: () => AgentRole.SUPERVISOR,
  }),
  // ... other fields
});
```

### State Fields

| Field | Type | Description | Reducer Logic |
|-------|------|-------------|---------------|
| `messages` | `BaseMessage[]` | Conversation history | Concatenate arrays |
| `currentAgent` | `AgentRole` | Active agent | Use right value (last update) |
| `projectId` | `string` | Project identifier | Use right if not empty |
| `tenantId` | `string` | Tenant identifier | Use right if not empty |
| `buildPlan` | `BuildTask[]` | Planned tasks | Use right if non-empty, else keep left |
| `completedTasks` | `BuildTask[]` | Completed tasks | Concatenate arrays |
| `generatedAssets` | `GeneratedAsset[]` | Generated assets | Concatenate arrays |
| `errors` | `AgentError[]` | Error log | Concatenate arrays |
| `approvals` | `ApprovalRequest[]` | Pending approvals | Concatenate arrays |

## Routing Logic

The supervisor routes requests based on intent analysis:

1. **Supervisor analyzes** the user's message and conversation context
2. **Returns a decision** as JSON:
   ```json
   {
     "next": "planning" | "iot_domain" | "FINISH",
     "reasoning": "explanation of routing decision"
   }
   ```
3. **Router extracts** the decision from the supervisor's message
4. **Graph routes** to the appropriate node or END

### Route Extraction

The `extractSupervisorDecision()` function checks:
1. AIMessage `additional_kwargs.supervisor_decision` (primary)
2. JSON content in message body (fallback)
3. `currentAgent` field in state (last resort)

### Conditional Edge

The `routeFromSupervisor()` function maps decisions to nodes:
- `'planning'` → planning node
- `'iot_domain'` → iot_domain node
- `'FINISH'` → END
- No decision → END (with warning)

## Usage Examples

### Basic Usage

```typescript
import { createAgentGraph } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';
import { AgentRole } from '@friendly-tech/core/agent-runtime';

// Create the graph
const graph = createAgentGraph();

// Initialize state
const initialState = {
  messages: [new HumanMessage('Build a fleet monitoring dashboard')],
  currentAgent: AgentRole.SUPERVISOR,
  projectId: 'proj-001',
  tenantId: 'tenant-friendly',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
};

// Run the graph
const result = await graph.invoke(initialState);

console.log('Final state:', result);
console.log('Build plan:', result.buildPlan);
console.log('Messages:', result.messages);
```

### With Debugging

```typescript
const graph = createAgentGraph({ debug: true });

// Console output:
// [Graph] Creating agent graph with config: { debug: true }
// [Graph] Adding agent nodes...
// [Graph] Agent nodes added: supervisor, planning, iot_domain
// [Graph] Defining edges...
// [Graph] Edges defined
// [Graph] Graph structure:
//   START → supervisor
//   supervisor → [conditional] → planning | iot_domain | END
//   planning → supervisor
//   iot_domain → supervisor
// [Graph] Graph compiled successfully
```

### Streaming Events

```typescript
const graph = createAgentGraph();

// Stream events as the graph executes
for await (const event of graph.stream(initialState)) {
  console.log('Event:', event);

  // Extract agent outputs
  const [nodeName, nodeOutput] = Object.entries(event)[0];
  console.log(`Node ${nodeName} completed:`, nodeOutput);
}
```

### With Checkpointing

```typescript
import { createCheckpointer } from '@friendly-tech/core/agent-runtime';

// Create a checkpointer (requires PostgreSQL)
const checkpointer = await createCheckpointer({
  host: 'localhost',
  port: 5432,
  database: 'aep_checkpoints',
  user: 'postgres',
  password: 'password',
});

// Create graph with checkpointing
const graph = createAgentGraph({ checkpointer });

// Run with thread ID for persistence
const result = await graph.invoke(initialState, {
  configurable: { thread_id: 'conversation-123' },
});

// Resume conversation later
const continuedState = {
  ...result,
  messages: [...result.messages, new HumanMessage('Add user authentication')],
};

const resumed = await graph.invoke(continuedState, {
  configurable: { thread_id: 'conversation-123' },
});
```

## Agent Node Behavior

### Supervisor Node

**Input**: Current state with user message
**Output**: Updated state with routing decision

```typescript
{
  currentAgent: AgentRole.PLANNING | AgentRole.IOT_DOMAIN | AgentRole.SUPERVISOR,
  messages: [
    ...existingMessages,
    AIMessage({
      content: JSON.stringify({ next: "planning", reasoning: "..." }),
      additional_kwargs: { supervisor_decision: { ... } }
    })
  ]
}
```

### Planning Node

**Input**: Current state with user requirements
**Output**: Updated state with build plan

```typescript
{
  currentAgent: AgentRole.PLANNING,
  messages: [...existingMessages, AIMessage("Created build plan...")],
  buildPlan: [
    {
      id: 'task-1',
      type: 'project_setup',
      description: '...',
      agent: AgentRole.PLANNING,
      dependencies: [],
      status: 'pending'
    },
    // ... more tasks
  ]
}
```

### IoT Domain Node

**Input**: Current state with IoT-related question
**Output**: Updated state with answer

```typescript
{
  currentAgent: AgentRole.IOT_DOMAIN,
  messages: [
    ...existingMessages,
    AIMessage("Here is information about your devices...")
  ]
}
```

## Error Handling

Errors are captured in the state's `errors` array:

```typescript
{
  errors: [
    {
      agent: AgentRole.SUPERVISOR,
      message: "Failed to route request",
      timestamp: new Date(),
      recoverable: true
    }
  ]
}
```

Agents add error messages and continue execution rather than throwing exceptions.

## Type Safety

The graph is fully typed using TypeScript:

```typescript
type CompiledGraph = ReturnType<typeof createAgentGraph>;

// Graph methods are typed
graph.invoke(state: AEPAgentState): Promise<AEPAgentState>
graph.stream(state: AEPAgentState): AsyncIterator<AEPAgentState>
```

## Testing

See `graph.spec.ts` for comprehensive tests including:
- Routing to planning agent
- Routing to IoT domain agent
- FINISH routing
- State preservation
- Message accumulation
- Streaming support
- Error handling

## Performance Considerations

1. **Message History**: Consider truncating old messages for long conversations
2. **Checkpointing**: Adds persistence overhead but enables resume/rollback
3. **Streaming**: More responsive but uses more network resources
4. **LLM Calls**: Each agent node makes at least one LLM API call

## Future Enhancements

- [ ] Add retry logic for failed agent executions
- [ ] Implement conversation summary for long histories
- [ ] Add metrics collection for agent performance
- [ ] Support parallel specialist agent execution
- [ ] Add user confirmation steps for approvals
- [ ] Implement time-travel debugging UI

## Related Files

- `src/lib/graph.ts` - Main graph implementation
- `src/lib/graph.spec.ts` - Test suite
- `src/lib/types.ts` - State and agent types
- `src/lib/agents/supervisor.ts` - Supervisor node
- `src/lib/agents/planning.ts` - Planning node
- `src/lib/agents/iot-domain.ts` - IoT domain node
- `src/lib/checkpointer.ts` - Checkpointing utilities

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain Messages](https://js.langchain.com/docs/modules/model_io/concepts#messages)
- [State Management in LangGraph](https://langchain-ai.github.io/langgraph/concepts/state_management/)
