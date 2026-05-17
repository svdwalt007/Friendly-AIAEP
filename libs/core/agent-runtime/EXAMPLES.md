# Agent Graph Examples

This file contains practical examples of using the LangGraph StateGraph workflow.

## Example 1: Building an IoT Dashboard

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function buildIoTDashboard() {
  // Create the graph
  const graph = createAgentGraph({ debug: true });

  // Initialize state
  const initialState = {
    messages: [
      new HumanMessage(
        'Build a dashboard for monitoring 1000 smart water meters with real-time telemetry'
      ),
    ],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'water-meter-dashboard',
    tenantId: 'utility-company-123',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  // Execute the graph
  const result = await graph.invoke(initialState);

  // Inspect the results
  console.log('Build Plan Created:');
  result.buildPlan.forEach((task, index) => {
    console.log(`${index + 1}. ${task.description}`);
    console.log(`   Type: ${task.type}`);
    console.log(`   Agent: ${task.agent}`);
    console.log(`   Status: ${task.status}`);
  });

  // Check for errors
  if (result.errors.length > 0) {
    console.error('Errors encountered:', result.errors);
  }

  return result;
}

// Run the example
buildIoTDashboard().catch(console.error);
```

## Example 2: Querying Device Information

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function queryDevices() {
  const graph = createAgentGraph();

  const initialState = {
    messages: [
      new HumanMessage('Show me the list of online devices with battery level below 20%'),
    ],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'device-query',
    tenantId: 'fleet-manager-456',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  const result = await graph.invoke(initialState);

  // Get the IoT domain agent's response
  const lastMessage = result.messages[result.messages.length - 1];
  console.log('IoT Agent Response:', lastMessage.content);

  return result;
}

queryDevices().catch(console.error);
```

## Example 3: Multi-Turn Conversation

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function multiTurnConversation() {
  const graph = createAgentGraph({ debug: true });

  // Start with initial request
  let state = {
    messages: [new HumanMessage('I want to build a fleet management system')],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'fleet-mgmt-001',
    tenantId: 'logistics-corp',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  // First turn: Create initial plan
  state = await graph.invoke(state);
  console.log('\n=== Turn 1: Initial Plan Created ===');
  console.log('Build plan tasks:', state.buildPlan.length);

  // Second turn: Ask about devices
  state = {
    ...state,
    messages: [
      ...state.messages,
      new HumanMessage('What LwM2M objects should I use for vehicle tracking?'),
    ],
  };

  state = await graph.invoke(state);
  console.log('\n=== Turn 2: IoT Domain Question ===');
  const response2 = state.messages[state.messages.length - 1];
  console.log('Response:', response2.content);

  // Third turn: Refine plan
  state = {
    ...state,
    messages: [
      ...state.messages,
      new HumanMessage('Add real-time alerts for vehicles leaving designated zones'),
    ],
  };

  state = await graph.invoke(state);
  console.log('\n=== Turn 3: Plan Refinement ===');
  console.log('Updated build plan tasks:', state.buildPlan.length);

  // Fourth turn: Finish
  state = {
    ...state,
    messages: [...state.messages, new HumanMessage('That looks good, thank you!')],
  };

  state = await graph.invoke(state);
  console.log('\n=== Turn 4: Conversation Completed ===');

  return state;
}

multiTurnConversation().catch(console.error);
```

## Example 4: Streaming Events

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function streamingExample() {
  const graph = createAgentGraph();

  const initialState = {
    messages: [
      new HumanMessage(
        'Create a temperature monitoring system for cold storage facilities'
      ),
    ],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'cold-storage-monitor',
    tenantId: 'warehouse-solutions',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  console.log('Starting streaming execution...\n');

  // Stream events as they occur
  for await (const event of graph.stream(initialState)) {
    const [nodeName, nodeOutput] = Object.entries(event)[0];

    console.log(`\n--- ${nodeName.toUpperCase()} NODE ---`);

    if (nodeOutput.messages && nodeOutput.messages.length > 0) {
      const lastMsg = nodeOutput.messages[nodeOutput.messages.length - 1];
      console.log('Latest message:', lastMsg.content.substring(0, 200) + '...');
    }

    if (nodeOutput.buildPlan && nodeOutput.buildPlan.length > 0) {
      console.log(`Build plan: ${nodeOutput.buildPlan.length} tasks`);
    }

    if (nodeOutput.currentAgent) {
      console.log(`Current agent: ${nodeOutput.currentAgent}`);
    }
  }

  console.log('\n✓ Streaming completed');
}

streamingExample().catch(console.error);
```

## Example 5: Error Recovery

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function errorRecoveryExample() {
  const graph = createAgentGraph({ debug: true });

  const initialState = {
    messages: [
      new HumanMessage('Build something'), // Intentionally vague
    ],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'test-recovery',
    tenantId: 'test-tenant',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  try {
    let state = await graph.invoke(initialState);

    // Check for errors
    if (state.errors.length > 0) {
      console.log('Errors detected:', state.errors);

      // Attempt recovery with clarification
      state = {
        ...state,
        messages: [
          ...state.messages,
          new HumanMessage(
            'I want to build an IoT dashboard for environmental monitoring sensors'
          ),
        ],
      };

      state = await graph.invoke(state);

      if (state.buildPlan.length > 0) {
        console.log('✓ Recovered successfully!');
        console.log('Build plan:', state.buildPlan);
      }
    } else {
      console.log('No errors encountered');
    }

    return state;
  } catch (error) {
    console.error('Unrecoverable error:', error);
    throw error;
  }
}

errorRecoveryExample().catch(console.error);
```

## Example 6: Inspecting Conversation Flow

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function inspectConversationFlow() {
  const graph = createAgentGraph({ debug: true });

  const initialState = {
    messages: [new HumanMessage('Build a device analytics platform')],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'analytics-platform',
    tenantId: 'data-insights-inc',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };

  const result = await graph.invoke(initialState);

  // Analyze the conversation flow
  console.log('\n=== Conversation Flow Analysis ===\n');

  let supervisorCount = 0;
  let planningCount = 0;
  let iotDomainCount = 0;

  result.messages.forEach((msg, index) => {
    const type = msg._getType();
    const content =
      typeof msg.content === 'string'
        ? msg.content.substring(0, 100)
        : JSON.stringify(msg.content).substring(0, 100);

    console.log(`${index + 1}. [${type.toUpperCase()}] ${content}...`);

    // Try to identify agent
    if (msg.additional_kwargs && 'supervisor_decision' in msg.additional_kwargs) {
      supervisorCount++;
      const decision = (msg.additional_kwargs as any).supervisor_decision;
      console.log(`   → Supervisor routed to: ${decision.next}`);
    } else if (content.includes('build plan')) {
      planningCount++;
      console.log(`   → Planning agent response`);
    } else if (content.includes('device') || content.includes('telemetry')) {
      iotDomainCount++;
      console.log(`   → IoT domain agent response`);
    }
  });

  console.log('\n=== Agent Activity Summary ===');
  console.log(`Supervisor decisions: ${supervisorCount}`);
  console.log(`Planning responses: ${planningCount}`);
  console.log(`IoT domain responses: ${iotDomainCount}`);

  return result;
}

inspectConversationFlow().catch(console.error);
```

## Example 7: Batch Processing

```typescript
import { createAgentGraph, AgentRole } from '@friendly-tech/core/agent-runtime';
import { HumanMessage } from '@langchain/core/messages';

async function batchProcessing() {
  const graph = createAgentGraph();

  const requests = [
    'Build a smart parking system',
    'Create a waste management dashboard',
    'Design an air quality monitoring network',
  ];

  const results = await Promise.all(
    requests.map(async (request, index) => {
      const state = {
        messages: [new HumanMessage(request)],
        currentAgent: AgentRole.SUPERVISOR,
        projectId: `batch-project-${index}`,
        tenantId: 'batch-tenant',
        buildPlan: [],
        completedTasks: [],
        generatedAssets: [],
        errors: [],
        approvals: [],
      };

      const result = await graph.invoke(state);

      return {
        request,
        taskCount: result.buildPlan.length,
        errors: result.errors.length,
      };
    })
  );

  console.log('\n=== Batch Processing Results ===\n');
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.request}`);
    console.log(`   Tasks: ${r.taskCount}`);
    console.log(`   Errors: ${r.errors}`);
  });

  return results;
}

batchProcessing().catch(console.error);
```

## Running Examples

Save these examples to separate files and run them:

```bash
# Save to example1.ts
pnpm tsx libs/core/agent-runtime/examples/example1.ts

# Or use ts-node
npx ts-node libs/core/agent-runtime/examples/example1.ts
```

## Environment Setup

Before running examples, ensure you have configured the LLM providers:

```bash
# .env file
ANTHROPIC_API_KEY=your-api-key-here
OPENAI_API_KEY=your-openai-key-here

# For checkpointing examples
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=aep_checkpoints
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password
```

## Next Steps

- Explore the full API in `src/index.ts`
- Read the implementation details in `GRAPH_IMPLEMENTATION.md`
- Review test cases in `src/lib/graph.spec.ts`
- Check agent prompts in `src/lib/constants.ts`
