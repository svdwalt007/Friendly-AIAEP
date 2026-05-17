# AEP Agent Nodes

This directory contains the individual agent node implementations for the Friendly AI AEP multi-agent system.

## Planning Agent

The Product Planning Agent (`planning.ts`) analyzes user requirements and creates comprehensive build plans for IoT-enabled applications.

### Purpose

- Analyze user requirements from conversation messages
- Generate structured build plans with task dependencies
- Integrate with project-registry for CRUD operations
- Coordinate with other specialist agents
- Validate build plans for completeness and consistency

### Capabilities

The Planning Agent has access to 3 project-registry tool functions:

1. **createProjectTool** - Create a new project in the registry
2. **updateProjectTool** - Update project metadata
3. **getProjectTool** - Retrieve project details

### Knowledge Base

The agent has comprehensive IoT context knowledge:

- **Device Types**: Smart sensors, actuators, gateways
- **Protocols**: LwM2M (Lightweight M2M) with object-based model
- **Widget Catalogue**: Real-time dashboards, device monitors, time-series charts, map views
- **Template Names**: iot-dashboard, device-manager, telemetry-viewer, alert-center, custom-builder
- **Three API Capabilities**: Device Management, Telemetry, Control

### LLM Configuration

- **Provider**: Anthropic
- **Model**: Claude Opus 4.6 (configured via AgentRole.PLANNING)
- **Temperature**: 0.6 (balanced creativity and precision for planning)
- **Max Tokens**: 8192 (allows for comprehensive build plans)

### Build Plan Structure

Each generated build plan contains `BuildTask` objects with:

```typescript
interface BuildTask {
  id: string;              // Unique task identifier
  type: string;            // Task type (e.g., 'project_setup', 'api_integration')
  description: string;     // Detailed task description
  agent: AgentRole;        // Which agent should handle this task
  dependencies: string[];  // Array of task IDs that must complete first
  status: TaskStatus;      // 'pending' | 'in_progress' | 'completed' | 'failed'
}
```

### Validation

The planning agent validates generated build plans for:

- **Unique IDs**: All tasks have unique identifiers
- **Valid Dependencies**: All dependency references point to valid task IDs
- **No Circular Dependencies**: Depth-first search to detect cycles
- **Required Fields**: All mandatory fields are present

### Usage Example

```typescript
import { createPlanningNode } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';
import type { AEPAgentState } from '@friendly-tech/core/agent-runtime';

// Create the planning node
const planningNode = createPlanningNode();

// Prepare state with user requirements
const state: AEPAgentState = {
  messages: [
    new HumanMessage('I want to build a fleet operations dashboard for 10,000 smart water meters')
  ],
  currentAgent: 'supervisor',
  projectId: 'project-123',
  tenantId: 'tenant-456',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
};

// Execute the planning agent
const result = await planningNode(state);

// Result contains updated state with build plan
console.log(result.buildPlan);    // Array of BuildTask objects
console.log(result.messages);     // Updated conversation with planning response
```

### Phase 1 Implementation Notes

- Project registry tools return **mock data** for Phase 1
- Will integrate with actual `@friendly-tech/core/project-registry` in Phase 2
- Graceful fallback if LLM doesn't return perfectly formatted JSON
- Extracts tasks from natural language if JSON parsing fails

### Error Handling

The Planning Agent implements comprehensive error handling:

1. **LLM Provider Errors**: If the LLM provider fails:
   - Returns a graceful error message asking user to rephrase
   - Adds error details to `state.errors`
   - Marks the error as recoverable

2. **Validation Errors**: If the generated plan fails validation:
   - Logs validation errors for debugging
   - Falls back to a basic single-task plan
   - Ensures user can proceed rather than getting stuck

3. **Tool Execution Errors**: Project registry tool failures are logged but don't block planning

## IoT Domain Agent

The IoT Domain Agent (`iot-domain.ts`) is a specialized agent that handles all IoT-specific queries and device operations.

### Purpose

- Answer questions about IoT devices, protocols, and the Friendly One-IoT DM platform
- Query live device data using IoT tool functions
- Provide expertise on LwM2M objects and telemetry patterns
- Explain device lifecycle and API capabilities

### Capabilities

The IoT Domain Agent has access to 5 core IoT tool functions:

1. **getDeviceListTool** - Retrieve paginated list of devices with filters
2. **getDeviceDetailsTool** - Get detailed device information including LwM2M objects
3. **getDeviceTelemetryTool** - Fetch time-series telemetry data
4. **registerWebhookTool** - Register event webhooks
5. **getKPIMetricsTool** - Get fleet-wide KPI metrics

### Knowledge Base

The agent has deep knowledge of:

- **Friendly One-IoT APIs**: Northbound, Events, and QoE APIs
- **LwM2M Protocol**: Standard objects (/3/0, /4/0, /5/0, /6/0)
- **Device Types**: Smart meters, sensors, actuators, gateways
- **Communication Protocols**: NB-IoT, LTE-M, LoRaWAN, Sigfox
- **Telemetry Patterns**: Periodic, event-driven, on-demand, observation

### LLM Configuration

- **Provider**: Anthropic
- **Model**: Claude Opus 4.6 (configured via AgentRole.IOT_DOMAIN)
- **Temperature**: 0.4 (precise, factual responses)
- **Max Tokens**: 4096

### Usage Example

```typescript
import { createIoTDomainNode } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';
import type { AEPAgentState } from '@friendly-tech/core/agent-runtime';

// Create the IoT domain node
const iotDomainNode = createIoTDomainNode();

// Prepare state with user query
const state: AEPAgentState = {
  messages: [
    new HumanMessage('Show me all online devices')
  ],
  currentAgent: 'supervisor',
  projectId: 'project-123',
  tenantId: 'tenant-456',
  buildPlan: [],
  completedTasks: [],
  generatedAssets: [],
  errors: [],
  approvals: [],
};

// Execute the agent
const result = await iotDomainNode(state);

// Result contains updated state with agent's response
console.log(result.messages); // Includes AIMessage with answer
console.log(result.currentAgent); // 'iot_domain'
```

### Error Handling

The IoT Domain Agent implements comprehensive error handling:

1. **Tool Execution Errors**: If a tool call fails (e.g., API timeout), the agent:
   - Logs the error for debugging
   - Provides a user-friendly error message
   - Falls back to general knowledge to continue helping the user

2. **LLM Provider Errors**: If the LLM provider fails:
   - Returns a graceful error message
   - Adds error details to state.errors
   - Marks the error as recoverable

3. **Missing Dependencies**: If required tools are not available:
   - Agent can still answer questions based on its knowledge
   - Informs the user when live data queries are unavailable

### Integration with LangGraph

This agent is designed to be used as a node in a LangGraph StateGraph:

```typescript
import { StateGraph } from '@langchain/langgraph';
import { createIoTDomainNode } from '@friendly-tech/core/agent-runtime';

const graph = new StateGraph({
  channels: {
    messages: { reducer: (left, right) => [...left, ...right] },
    currentAgent: { default: () => 'supervisor' },
    // ... other state channels
  }
});

// Add the IoT domain node
graph.addNode('iot_domain', createIoTDomainNode());

// Add edges for routing
graph.addEdge('supervisor', 'iot_domain');
graph.addEdge('iot_domain', 'supervisor');
```

### Testing

Tests are located in `iot-domain.spec.ts` and cover:

- Node creation and initialization
- Query processing and response generation
- Error handling scenarios
- State updates and message history
- Tool integration (mocked)

Run tests with:
```bash
pnpm nx test agent-runtime
```

### Future Enhancements

Planned improvements for Phase 2+:

1. **Streaming Responses**: Real-time token streaming for better UX
2. **Tool Result Caching**: Redis-based caching of frequent queries
3. **Multi-Turn Conversations**: Context retention for complex queries
4. **Proactive Suggestions**: Agent recommends relevant queries based on context
5. **Advanced Analytics**: Integration with Grafana for visualization suggestions
