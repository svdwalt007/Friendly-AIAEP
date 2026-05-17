# Agent Runtime Integration Tests

## Overview

The integration tests in `src/lib/agent-runtime.integration.spec.ts` provide comprehensive end-to-end testing of the multi-agent system workflow.

## Test Coverage

### 1. Complete Agent Workflow Tests

#### Test: Route from supervisor to planning agent and back
**Purpose**: Validate the complete workflow: START → supervisor → planning → supervisor → END

**Scenario**:
- User sends: "I want to build a fleet operations dashboard for 10,000 smart water meters using LwM2M"
- Supervisor routes to planning agent
- Planning agent creates structured build plan
- Control returns to supervisor
- Supervisor routes to FINISH

**Validations**:
- ✅ Supervisor agent is called
- ✅ Planning agent is called
- ✅ Build plan is created with multiple tasks
- ✅ All tasks have proper structure (id, type, description, agent, dependencies, status)
- ✅ Specific task types exist (project_setup, schema_design, api_integration, widget_configuration)
- ✅ Task dependencies are correctly set
- ✅ IoT-related tasks are assigned to iot_domain agent
- ✅ Message history is accumulated
- ✅ No errors occurred

#### Test: Route from supervisor to iot_domain agent and back
**Purpose**: Validate IoT domain query workflow: START → supervisor → iot_domain → supervisor → END

**Scenario**:
- User sends: "What LwM2M objects are available for water meters?"
- Supervisor routes to iot_domain agent
- IoT domain agent responds with LwM2M knowledge
- Control returns to supervisor
- Supervisor routes to FINISH

**Validations**:
- ✅ Supervisor agent is called
- ✅ IoT domain agent is called
- ✅ Response contains LwM2M object information
- ✅ Response mentions Device Object (/3/0)
- ✅ Response is relevant to water meters
- ✅ No errors occurred
- ✅ Build plan is not modified

### 2. Multi-turn Conversation Tests

#### Test: Maintain state across multiple turns
**Purpose**: Verify that conversation state persists and accumulates across turns

**Scenario**:
- Turn 1: "Build a dashboard for my IoT devices"
- Turn 2: "Add device telemetry charts to the dashboard"

**Validations**:
- ✅ Build plan is created in first turn
- ✅ Message count increases with each turn
- ✅ At least 2 human messages exist in history
- ✅ Project ID and tenant ID remain consistent
- ✅ No errors occurred

#### Test: Update build plan without replacing it
**Purpose**: Verify that new tasks are added to the build plan incrementally

**Scenario**:
- Turn 1: "Build a monitoring dashboard"
- Turn 2: "Also add telemetry charts"

**Validations**:
- ✅ Build plan exists after first turn
- ✅ Build plan is updated (not replaced) after second turn
- ✅ New plan contains telemetry-related tasks
- ✅ Build plan structure remains valid

### 3. Error Handling Tests

#### Test: Handle invalid user input gracefully
**Purpose**: Verify system doesn't crash on invalid or malformed input

**Scenario**:
- User sends empty message or invalid input
- LLM returns invalid response without proper JSON

**Validations**:
- ✅ System handles gracefully without crashing
- ✅ Errors may be captured but system continues
- ✅ Fallback behavior is triggered

#### Test: Handle agent failures with recovery
**Purpose**: Verify error recovery mechanisms when agents fail

**Scenario**:
- Supervisor routes to planning agent
- Planning agent LLM service throws error: "LLM service unavailable"

**Validations**:
- ✅ Error is captured in state.errors array
- ✅ Error has correct agent (PLANNING)
- ✅ Error message contains "LLM service unavailable"
- ✅ Error is marked as recoverable
- ✅ System doesn't crash
- ✅ State remains valid

#### Test: Handle LLM provider initialization failure
**Purpose**: Verify error handling when LLM provider can't be initialized

**Scenario**:
- getProvider() throws: "No LLM provider configured"

**Validations**:
- ✅ Error is captured in state.errors
- ✅ Error message mentions "LLM provider"
- ✅ System handles gracefully

### 4. State Management Tests

#### Test: Properly update all state fields
**Purpose**: Verify all state fields are correctly initialized and maintained

**Validations**:
- ✅ messages array is defined
- ✅ currentAgent is defined
- ✅ projectId matches initial value
- ✅ tenantId matches initial value
- ✅ buildPlan is defined
- ✅ completedTasks is defined
- ✅ generatedAssets is defined
- ✅ errors is defined
- ✅ approvals is defined

#### Test: Accumulate message history correctly
**Purpose**: Verify message history grows and maintains order

**Validations**:
- ✅ Message count increases through workflow
- ✅ Message types include both 'human' and 'ai'
- ✅ First message is the user's initial message
- ✅ Message content is preserved

#### Test: Track task status correctly
**Purpose**: Verify task status tracking

**Validations**:
- ✅ All new tasks start with status: "pending"
- ✅ completedTasks is initially empty
- ✅ Task status can be updated

### 5. Agent Routing Tests

#### Test: Route to FINISH when conversation is complete
**Purpose**: Verify supervisor can recognize conversation completion

**Scenario**:
- User sends: "Thank you, that is all"

**Validations**:
- ✅ Supervisor is called
- ✅ Supervisor decides to FINISH
- ✅ No specialist agents are called
- ✅ Workflow completes successfully

#### Test: Handle supervisor fallback routing on parse failure
**Purpose**: Verify fallback routing when supervisor can't parse LLM response

**Scenario**:
- Supervisor LLM returns invalid JSON
- User message contains "build" keyword

**Validations**:
- ✅ Fallback routing is triggered
- ✅ Planning agent is called (due to "build" keyword)
- ✅ System doesn't crash

#### Test: Handle IoT domain routing with fallback
**Purpose**: Verify fallback routing for IoT-related queries

**Scenario**:
- Supervisor LLM returns invalid response
- User message contains IoT keywords ("device", "telemetry")

**Validations**:
- ✅ Fallback routing is triggered
- ✅ IoT domain agent is called
- ✅ System handles gracefully

### 6. Build Plan Validation Tests

#### Test: Create valid build plans with proper dependencies
**Purpose**: Verify build plans have valid structure and dependencies

**Validations**:
- ✅ Build plan has multiple tasks
- ✅ All tasks have required fields (id, type, description, agent, dependencies, status)
- ✅ Task IDs are unique
- ✅ Dependencies reference valid task IDs
- ✅ No circular dependencies
- ✅ Tasks form a valid directed acyclic graph (DAG)

#### Test: Include proper agent assignments in build plan
**Purpose**: Verify tasks are assigned to appropriate agents

**Validations**:
- ✅ Build plan includes tasks for both planning and iot_domain agents
- ✅ API integration tasks assigned to iot_domain
- ✅ Widget/UI tasks assigned to planning
- ✅ Agent assignments match task types

#### Test: Include descriptive task descriptions
**Purpose**: Verify task descriptions are meaningful and specific

**Validations**:
- ✅ All descriptions are defined and non-empty
- ✅ Descriptions are longer than 10 characters
- ✅ Descriptions are not generic placeholders
- ✅ Descriptions contain relevant keywords for task type
- ✅ Schema design tasks mention "schema", "database", or "data"

## Test Architecture

### Mock Strategy

All tests use mocked LLM providers to ensure:
- **Deterministic results**: Same input always produces same output
- **Fast execution**: No actual API calls
- **No external dependencies**: Tests run offline
- **Predictable responses**: Complete control over LLM behavior

### Mock Implementation

```typescript
function createMockProvider(responses: Array<any>) {
  let callCount = 0;
  return {
    type: 'mock' as const,
    config: {
      provider: 'mock',
      defaultModel: 'mock-model',
      temperature: 0.7,
      maxTokens: 4096,
    },
    complete: vi.fn(async () => {
      const response = responses[callCount] || responses[responses.length - 1];
      callCount++;
      return response;
    }),
    stream: vi.fn(),
    close: vi.fn(),
  };
}
```

### Test Setup

Each test follows this pattern:

1. **Setup mocks**: Create mock providers for each agent role
2. **Spy on getProvider**: Mock the llm-providers.getProvider function
3. **Create graph**: Initialize the agent graph
4. **Create state**: Build initial state with test data
5. **Execute**: Run graph.invoke() with initial state
6. **Verify**: Assert expectations on final state

### Test Isolation

- **beforeEach**: Store original getProvider function
- **afterEach**: Restore mocks and clear all spies
- Each test creates fresh graph and state instances

## Running the Tests

### Run all agent-runtime tests
```bash
pnpm nx test agent-runtime
```

### Run only integration tests
```bash
pnpm nx test agent-runtime --testPathPattern=integration
```

### Run specific test suite
```bash
pnpm nx test agent-runtime --testNamePattern="Complete Agent Workflow"
```

### Run with coverage
```bash
pnpm nx test agent-runtime --coverage
```

## Test Data

### Mock LLM Responses

The test file defines several mock responses:

- **supervisorRoutePlanning**: Routes to planning agent
- **supervisorRouteIoTDomain**: Routes to IoT domain agent
- **supervisorFinish**: Completes conversation
- **planningBuildDashboard**: Creates 4-task build plan
- **planningAddTelemetryCharts**: Adds 2 telemetry tasks
- **iotDomainLwM2MObjects**: Provides LwM2M object information

### Sample Build Plan Structure

```json
{
  "tasks": [
    {
      "id": "task-1",
      "type": "project_setup",
      "description": "Initialize project structure and configuration for fleet operations dashboard",
      "agent": "planning",
      "dependencies": [],
      "status": "pending"
    },
    {
      "id": "task-2",
      "type": "schema_design",
      "description": "Design database schema for storing water meter telemetry data",
      "agent": "planning",
      "dependencies": ["task-1"],
      "status": "pending"
    },
    {
      "id": "task-3",
      "type": "api_integration",
      "description": "Integrate with Friendly One-IoT DM APIs for LwM2M device management",
      "agent": "iot_domain",
      "dependencies": ["task-1"],
      "status": "pending"
    },
    {
      "id": "task-4",
      "type": "widget_configuration",
      "description": "Configure dashboard widgets for fleet monitoring",
      "agent": "planning",
      "dependencies": ["task-2", "task-3"],
      "status": "pending"
    }
  ]
}
```

## Expected Behavior

### Successful Workflow

1. User sends message
2. Graph starts at START node
3. Supervisor agent analyzes message
4. Supervisor routes to specialist agent (planning or iot_domain)
5. Specialist agent processes request
6. Specialist returns control to supervisor
7. Supervisor evaluates completion
8. If complete, routes to END; otherwise, routes to another specialist
9. Final state contains all accumulated messages, tasks, and metadata

### Error Workflow

1. Error occurs in any agent
2. Error is caught and added to state.errors array
3. Error includes: agent, message, timestamp, recoverable flag
4. User-friendly error message added to state.messages
5. Workflow continues (if error is recoverable)

## Maintenance

### Adding New Tests

When adding new test scenarios:

1. Create mock LLM responses for the scenario
2. Define expected behavior
3. Write test following existing patterns
4. Verify all state fields
5. Include both success and error cases

### Updating Mock Responses

When agent prompts or behavior changes:

1. Update mock responses to match new format
2. Verify response structure matches actual LLM output
3. Update assertions to match new behavior

### Test Coverage Goals

- **Agent routing**: 100% coverage of all routing paths
- **Error handling**: All error scenarios tested
- **State management**: All state fields validated
- **Build plan validation**: All validation rules tested
- **Multi-turn conversations**: State persistence verified

## Known Limitations

1. **LLM Provider Mocking**: Tests mock the LLM provider, so they don't test actual API integration
2. **Tool Execution**: IoT tool functions are mocked, not executed
3. **Database Operations**: Checkpointing is not tested in integration tests
4. **Streaming**: Stream-based execution not covered (separate tests exist)

## Future Enhancements

1. Add tests for approval workflows
2. Add tests for asset generation
3. Add tests for task completion tracking
4. Add performance benchmarks
5. Add stress tests with large build plans
6. Add tests for concurrent multi-user scenarios
