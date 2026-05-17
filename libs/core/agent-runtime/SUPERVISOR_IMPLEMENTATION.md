# Supervisor Agent Implementation

## Overview

The Supervisor Agent has been implemented for the `libs/core/agent-runtime` library. It serves as the routing agent for the multi-agent system in the Friendly AI AEP Tool.

## Files Created

### 1. `src/lib/agents/supervisor.ts`

The main implementation file containing the `createSupervisorNode()` function.

**Key Features:**
- Uses the LLM Providers factory to get Claude Opus 4.6
- Analyzes conversation history and routes to appropriate specialist agents
- Supports three routing targets: `planning`, `iot_domain`, and `FINISH`
- Includes structured output parsing with JSON validation
- Provides fallback routing when LLM output cannot be parsed
- Comprehensive error handling with error state tracking
- Context-aware routing based on conversation history, build plan, and completed tasks

**Function Signature:**
```typescript
export function createSupervisorNode(): (state: AEPAgentState) => Promise<Partial<AEPAgentState>>
```

### 2. `src/lib/agents/supervisor.spec.ts`

Comprehensive unit tests for the supervisor agent covering:
- Routing to planning agent for app building requests
- Routing to iot_domain agent for device queries
- Routing to FINISH for conversation completion
- Handling markdown-wrapped JSON responses
- Fallback routing when output parsing fails
- Error handling scenarios
- Context inclusion in prompts
- Reasoning extraction from supervisor output

### 3. Updated `src/lib/constants.ts`

Enhanced the `SUPERVISOR_PROMPT` with:
- Detailed agent descriptions with capabilities and example requests
- Clear routing guidelines
- Context information available to the supervisor
- Structured output format specification
- Explicit instructions for JSON response format

### 4. Updated `src/index.ts`

Added export for the supervisor node:
```typescript
export { createSupervisorNode } from './lib/agents/supervisor';
```

## Implementation Details

### Routing Logic

The supervisor analyzes user messages and routes based on intent:

1. **Planning Agent** - For:
   - Building new applications
   - Project creation
   - Feature development
   - Build planning
   - Keywords: "build", "create", "new app", "project"

2. **IoT Domain Agent** - For:
   - Device queries
   - Telemetry data requests
   - Protocol information (LwM2M)
   - API questions
   - Keywords: "device", "telemetry", "lwm2m", "iot"

3. **FINISH** - For:
   - Conversation completion
   - User satisfaction signals
   - Keywords: "thank you", "that's all", "done"

### LLM Integration

The supervisor uses the `@friendly-tech/core/llm-providers` module:

```typescript
import { getProvider, AgentRole as LLMAgentRole } from '@friendly-tech/core/llm-providers';

const provider = getProvider(LLMAgentRole.SUPERVISOR);
const response = await provider.complete({
  model: provider.config.defaultModel || 'claude-opus-4-6',
  messages: [...],
  max_tokens: 1024,
  temperature: 0.7,
});
```

### Context Building

The supervisor includes rich context in its analysis:
- Project ID and Tenant ID
- Current agent
- Build plan summary
- Completed tasks count
- Error summaries
- Pending approvals
- Recent conversation history (last 5 messages)

### Output Parsing

The supervisor expects JSON output in this format:
```json
{
  "next": "planning" | "iot_domain" | "FINISH",
  "reasoning": "Brief explanation of routing decision"
}
```

The parser handles:
- Plain JSON responses
- Markdown code block wrapped responses (```json ... ```)
- Fallback keyword-based routing if JSON parsing fails

### Error Handling

Comprehensive error handling includes:
- LLM provider initialization failures
- Missing messages in state
- LLM API call failures
- JSON parsing errors
- Unexpected routing decisions

All errors are captured in the state's `errors` array with:
- Agent identifier (SUPERVISOR)
- Error message
- Timestamp
- Recoverable flag

### Fallback Routing

When the LLM response cannot be parsed, the supervisor uses keyword-based fallback:
1. Scans last message for keywords
2. Routes to planning for "build", "create", "new app", "project"
3. Routes to iot_domain for "device", "telemetry", "lwm2m", "iot"
4. Defaults to planning for unknown requests

## Dependencies

- `@langchain/core`: For BaseMessage and AIMessage types
- `@friendly-tech/core/llm-providers`: For LLM provider factory and types
- Internal types from `../types`: AEPAgentState, SupervisorOutput, AgentRole

## Usage Example

```typescript
import { createSupervisorNode, AgentRole } from '@friendly-tech/core/agent-runtime';
import type { AEPAgentState } from '@friendly-tech/core/agent-runtime';

// Create the supervisor node
const supervisorNode = createSupervisorNode();

// Create initial state
const state: AEPAgentState = {
  messages: [
    { content: 'I want to build a fleet dashboard', _getType: () => 'human' }
  ],
  currentAgent: AgentRole.SUPERVISOR,
  projectId: 'project-123',
  tenantId: 'tenant-456',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
};

// Process the state
const updatedState = await supervisorNode(state);

console.log('Next agent:', updatedState.currentAgent);
// Output: Next agent: planning
```

## Testing

Run tests with:
```bash
pnpm nx test agent-runtime --testPathPattern=supervisor
```

The test suite includes:
- 9 comprehensive test cases
- Mocked LLM provider responses
- Various routing scenarios
- Error handling verification
- Context inclusion validation

## Integration with LangGraph

The supervisor node is designed to be used as a node in a LangGraph StateGraph:

```typescript
import { StateGraph } from '@langchain/langgraph';
import { createSupervisorNode } from '@friendly-tech/core/agent-runtime';

const graph = new StateGraph({
  channels: { /* ... */ }
});

// Add supervisor node
graph.addNode('supervisor', createSupervisorNode());

// Add routing logic
graph.addConditionalEdges('supervisor', (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  const decision = JSON.parse(lastMessage.content);
  return decision.next === 'FINISH' ? 'END' : decision.next;
});
```

## Logging

The supervisor includes informative logging:
- `[Supervisor Agent] Supervisor agent processing request`
- `[Supervisor Agent] Using provider: anthropic`
- `[Supervisor Agent] Analyzing message: ...`
- `[Supervisor Agent] Received response from LLM`
- `[Supervisor Agent] Routing decision: planning - ...`
- `[Supervisor Agent] Using fallback routing to planning agent`

## Next Steps

The supervisor is now ready for integration with:
1. Planning Agent implementation
2. IoT Domain Agent implementation
3. LangGraph StateGraph orchestration
4. API Gateway WebSocket streaming
5. Angular Builder UI integration

## Notes

- The supervisor does NOT implement the planning or iot_domain agents - it only routes to them
- The supervisor uses Claude Opus 4.6 by default, but this can be overridden via tenant configuration
- Fallback routing ensures the system remains functional even when LLM responses are unparseable
- The supervisor maintains conversation state across multiple turns
