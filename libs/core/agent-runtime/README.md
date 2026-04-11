# Agent Runtime — Multi-Agent LLM Orchestration

**LangGraph-based orchestration for the Friendly AI AEP Tool**

Version: 1.0.0 | Module Reference v2.2 Section 5.2 | Layer 1 — Core Engine

---

## Overview

The `agent-runtime` library provides the core multi-agent orchestration system for the Friendly AI AEP Tool. Built on **LangGraph**, it coordinates 3 specialist AI agents (Phase 1) to handle user requests, plan application builds, and provide IoT domain expertise.

### Key Features

- ✅ **Multi-Agent Coordination**: Supervisor routes to specialist agents (planning, iot_domain)
- ✅ **LLM Provider Abstraction**: All agents use Claude Opus 4.6 via `llm-providers` (swappable)
- ✅ **State Persistence**: PostgreSQL checkpointing for conversation recovery
- ✅ **Real-Time Streaming**: WebSocket-compatible async generators
- ✅ **Build Plan Generation**: Structured task planning with dependencies
- ✅ **IoT Domain Expertise**: Friendly One-IoT DM knowledge and tool access
- ✅ **Error Recovery**: Graceful fallbacks and error handling
- ✅ **Type Safety**: Full TypeScript with strict mode

---

## Architecture

### Agent Workflow

```
START
  ↓
Supervisor Agent
  │
  ├─→ Planning Agent ────→ Supervisor (return)
  │     (Build plans)
  │
  ├─→ IoT Domain Agent ──→ Supervisor (return)
  │     (Device queries)
  │
  └─→ END (when FINISH)
```

### Phase 1 Agents (3)

| Agent | Role | Capabilities |
|-------|------|--------------|
| **Supervisor** | Router | Analyzes requests, routes to specialists |
| **Planning** | Build Planner | Creates structured build plans with tasks |
| **IoT Domain** | IoT Expert | Answers device/protocol questions, uses tools |

---

## Quick Start

### 1. Basic Usage

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

// Create the agent graph
const graph = await createAgentGraph({ debug: true });

// Send a request
const result = await graph.invoke({
  messages: [new HumanMessage('Build a fleet dashboard for water meters')],
  currentAgent: AgentRole.SUPERVISOR,
  projectId: 'proj-123',
  tenantId: 'tenant-456',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
});

console.log('Build Plan:', result.buildPlan);
```

### 2. With Streaming

```typescript
import { streamAgentResponse } from '@friendly-tech/core/agent-runtime';

for await (const chunk of streamAgentResponse(graph, initialState, {
  thread_id: 'tenant-456:user-123:session-789'
})) {
  if (chunk.type === 'agent_response') {
    console.log(`${chunk.agent}:`, chunk.content);
  }
}
```

See `QUICK_START.md` for complete tutorial.

---

## API Reference

### createAgentGraph(config?)

Creates and compiles the LangGraph StateGraph.

```typescript
function createAgentGraph(config?: GraphConfig): CompiledGraph
```

### streamAgentResponse(graph, initialState, config)

Streams agent execution events in real-time.

```typescript
async function* streamAgentResponse(
  graph: CompiledGraph,
  initialState: Partial<AEPAgentState>,
  config: StreamConfig
): AsyncGenerator<StreamChunk>
```

### createCheckpointer(config)

Creates a PostgreSQL checkpointer for state persistence.

```typescript
async function createCheckpointer(config: CheckpointerConfig): Promise<CheckpointerInstance>
```

See documentation files for complete API details.

---

## Documentation

| File | Purpose |
|------|---------|
| `README.md` | This file - overview and quick start |
| `QUICK_START.md` | 5-minute tutorial |
| `EXAMPLES.md` | Code examples |
| `GRAPH_IMPLEMENTATION.md` | StateGraph technical details |
| `STREAMING.md` | Streaming interface guide |
| `CHECKPOINTER_README.md` | PostgreSQL persistence guide |
| `INTEGRATION_TESTS.md` | Test documentation |
| `agents/README.md` | Individual agent documentation |

---

## Testing

```bash
# Run all tests
pnpm nx test agent-runtime

# Integration tests
pnpm nx build llm-providers iot-tool-functions
pnpm nx test agent-runtime

# Coverage
pnpm nx test agent-runtime --coverage
```

---

## Production Deployment

```bash
# 1. Start infrastructure
docker-compose -f libs/core/agent-runtime/docker-compose.checkpointer.yml up -d

# 2. Configure environment
cp .env.example .env

# 3. Build library
pnpm nx build agent-runtime
```

See `CHECKPOINTER_EXAMPLES.md` for Kubernetes configuration.

---

## License

UNLICENSED - Proprietary Friendly Technologies Software

---

**Status**: ✅ Production Ready (Phase 1)
**Version**: 1.0.0
**Module Reference**: v2.2 Section 5.2
