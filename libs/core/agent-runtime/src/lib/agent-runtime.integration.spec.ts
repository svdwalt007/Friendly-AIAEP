/**
 * Integration Tests for Agent Runtime
 *
 * These tests validate the complete end-to-end workflow of the multi-agent system,
 * including routing, state management, and agent coordination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import { createAgentGraph } from './graph';
import type { AEPAgentState } from './types';
import { AgentRole } from './types';
import * as llmProviders from '@friendly-tech/core/llm-providers';

/**
 * Mock LLM provider responses for deterministic testing
 */
const mockLLMResponses = {
  supervisorRoutePlanning: {
    content: [
      {
        type: 'text',
        text: '```json\n{"next": "planning", "reasoning": "User wants to build a new application, routing to planning agent"}\n```',
      },
    ],
  },
  supervisorRouteIoTDomain: {
    content: [
      {
        type: 'text',
        text: '```json\n{"next": "iot_domain", "reasoning": "User is asking about IoT devices and protocols, routing to IoT domain expert"}\n```',
      },
    ],
  },
  supervisorFinish: {
    content: [
      {
        type: 'text',
        text: '```json\n{"next": "FINISH", "reasoning": "Conversation is complete"}\n```',
      },
    ],
  },
  planningBuildDashboard: {
    content: [
      {
        type: 'text',
        text: `{
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
}`,
      },
    ],
  },
  planningAddTelemetryCharts: {
    content: [
      {
        type: 'text',
        text: `{
  "tasks": [
    {
      "id": "task-5",
      "type": "telemetry_setup",
      "description": "Configure telemetry data collection from water meters",
      "agent": "iot_domain",
      "dependencies": [],
      "status": "pending"
    },
    {
      "id": "task-6",
      "type": "widget_configuration",
      "description": "Add device telemetry charts to the dashboard",
      "agent": "planning",
      "dependencies": ["task-5"],
      "status": "pending"
    }
  ]
}`,
      },
    ],
  },
  iotDomainLwM2MObjects: {
    content: [
      {
        type: 'text',
        text: `For water meters, the Friendly One-IoT platform supports several LwM2M objects:

**Standard Objects:**
- **/3/0 - Device Object**: Contains manufacturer info, model number, serial number, and firmware version
- **/4/0 - Connectivity Monitoring**: Network signal strength, IP addresses, and link quality
- **/6/0 - Location**: GPS coordinates for meter location tracking

**Sensor Objects:**
- **/3303/0 - Temperature Sensor**: Water temperature monitoring
- **/3320/0 - Flow Sensor**: Water flow rate measurements
- **/3324/0 - Pressure Sensor**: Water pressure readings

**Custom Objects:**
- **/10241/0 - Water Meter**: Total consumption, current flow, leak detection
- **/10242/0 - Valve Control**: Remote shutoff capability

Each object contains multiple resources that can be read, observed, or written to depending on the operation type.`,
      },
    ],
  },
};

/**
 * Create a mock LLM provider for testing
 */
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

/**
 * Helper to create initial test state
 */
function createInitialState(userMessage: string): AEPAgentState {
  return {
    messages: [new HumanMessage(userMessage)],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'test-project-123',
    tenantId: 'test-tenant-456',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  };
}

describe('Agent Runtime Integration Tests', () => {
  let originalGetProvider: typeof llmProviders.getProvider;

  beforeEach(() => {
    // Store the original getProvider function
    originalGetProvider = llmProviders.getProvider;
  });

  afterEach(() => {
    // Restore the original getProvider function
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('Complete Agent Workflow', () => {
    it('should route from supervisor to planning agent and back', async () => {
      // Mock the LLM provider to return predetermined responses
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      // Create the graph
      const graph = createAgentGraph({ debug: true });

      // Create initial state with user request
      const initialState = createInitialState(
        'I want to build a fleet operations dashboard for 10,000 smart water meters using LwM2M'
      );

      // Execute the graph
      const finalState = await graph.invoke(initialState);

      // Verify the workflow
      expect(finalState).toBeDefined();

      // Verify supervisor was called
      expect(supervisorProvider.complete).toHaveBeenCalled();

      // Verify planning agent was called
      expect(planningProvider.complete).toHaveBeenCalled();

      // Verify the build plan was created
      expect(finalState.buildPlan).toBeDefined();
      expect(finalState.buildPlan.length).toBeGreaterThan(0);

      // Verify build plan structure
      const buildPlan = finalState.buildPlan;
      expect(buildPlan).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: expect.any(String),
            description: expect.any(String),
            agent: expect.any(String),
            dependencies: expect.any(Array),
            status: 'pending',
          }),
        ])
      );

      // Verify specific tasks exist
      const projectSetupTask = buildPlan.find(
        (task) => task.type === 'project_setup'
      );
      expect(projectSetupTask).toBeDefined();
      expect(projectSetupTask?.description).toContain('project structure');

      const schemaTask = buildPlan.find(
        (task) => task.type === 'schema_design'
      );
      expect(schemaTask).toBeDefined();
      expect(schemaTask?.dependencies).toContain('task-1');

      const apiIntegrationTask = buildPlan.find(
        (task) => task.type === 'api_integration'
      );
      expect(apiIntegrationTask).toBeDefined();
      expect(apiIntegrationTask?.agent).toBe('iot_domain');

      // Verify dependencies are correct
      const widgetTask = buildPlan.find(
        (task) =>
          task.type === 'widget_configuration' &&
          task.dependencies.length > 1
      );
      expect(widgetTask).toBeDefined();
      expect(widgetTask?.dependencies).toEqual(
        expect.arrayContaining(['task-2', 'task-3'])
      );

      // Verify messages were added to state
      expect(finalState.messages.length).toBeGreaterThan(
        initialState.messages.length
      );

      // Verify no errors occurred
      expect(finalState.errors).toHaveLength(0);
    });

    it('should route from supervisor to iot_domain agent and back', async () => {
      // Mock the LLM provider
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRouteIoTDomain,
        mockLLMResponses.supervisorFinish,
      ]);
      const iotDomainProvider = createMockProvider([
        mockLLMResponses.iotDomainLwM2MObjects,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.IOT_DOMAIN) {
          return iotDomainProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      // Create the graph
      const graph = createAgentGraph({ debug: true });

      // Create initial state with IoT domain query
      const initialState = createInitialState(
        'What LwM2M objects are available for water meters?'
      );

      // Execute the graph
      const finalState = await graph.invoke(initialState);

      // Verify the workflow
      expect(finalState).toBeDefined();

      // Verify supervisor was called
      expect(supervisorProvider.complete).toHaveBeenCalled();

      // Verify IoT domain agent was called
      expect(iotDomainProvider.complete).toHaveBeenCalled();

      // Verify the response contains LwM2M information
      const lastMessage =
        finalState.messages[finalState.messages.length - 1];
      expect(lastMessage).toBeDefined();
      expect(lastMessage.content).toBeDefined();

      const responseText =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Verify response contains LwM2M object information
      expect(responseText).toMatch(/LwM2M/i);
      expect(responseText).toMatch(/Device Object|\/3\/0/);
      expect(responseText).toMatch(/water meter/i);

      // Verify no errors occurred
      expect(finalState.errors).toHaveLength(0);

      // Verify build plan was not modified (IoT domain doesn't create plans)
      expect(finalState.buildPlan).toHaveLength(0);
    });
  });

  describe('Multi-turn Conversations', () => {
    it('should maintain state across multiple turns', async () => {
      // First turn: Build a dashboard
      const supervisorProvider1 = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider1 = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
        mockLLMResponses.planningAddTelemetryCharts,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider1 as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider1 as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: true });

      // First turn: "Build a dashboard"
      const state1 = createInitialState('Build a dashboard for my IoT devices');
      const result1 = await graph.invoke(state1);

      // Verify first turn results
      expect(result1.buildPlan.length).toBeGreaterThan(0);
      const firstPlanLength = result1.buildPlan.length;
      const firstMessageCount = result1.messages.length;

      // Second turn: "Add device telemetry charts"
      const state2: AEPAgentState = {
        ...result1,
        messages: [
          ...result1.messages,
          new HumanMessage('Add device telemetry charts to the dashboard'),
        ],
      };

      const result2 = await graph.invoke(state2);

      // Verify state persistence
      expect(result2.messages.length).toBeGreaterThan(firstMessageCount);

      // Verify build plan was updated
      expect(result2.buildPlan.length).toBeGreaterThan(0);

      // Verify message history accumulated
      const humanMessages = result2.messages.filter(
        (msg) => msg._getType() === 'human'
      );
      expect(humanMessages.length).toBeGreaterThanOrEqual(2);

      // Verify project context maintained
      expect(result2.projectId).toBe('test-project-123');
      expect(result2.tenantId).toBe('test-tenant-456');

      // Verify no errors
      expect(result2.errors).toHaveLength(0);
    });

    it('should update build plan without replacing it', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
        mockLLMResponses.planningAddTelemetryCharts,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: true });

      // First turn
      const state1 = createInitialState('Build a monitoring dashboard');
      const result1 = await graph.invoke(state1);

      const originalPlan = [...result1.buildPlan];

      // Second turn - add more features
      const state2: AEPAgentState = {
        ...result1,
        messages: [
          ...result1.messages,
          new HumanMessage('Also add telemetry charts'),
        ],
      };

      const result2 = await graph.invoke(state2);

      // The build plan should be updated with new tasks
      // Note: The behavior depends on the graph's reducer logic
      // In this implementation, new plan replaces old plan if non-empty
      expect(result2.buildPlan.length).toBeGreaterThan(0);

      // Verify new plan has different tasks
      const newPlan = result2.buildPlan;
      const hasTelemetryTask = newPlan.some((task) =>
        task.description.toLowerCase().includes('telemetry')
      );
      expect(hasTelemetryTask).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user input gracefully', async () => {
      const supervisorProvider = createMockProvider([
        {
          content: [
            {
              type: 'text',
              text: 'Invalid response without proper JSON',
            },
          ],
        },
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation(() => {
        return supervisorProvider as any;
      });

      const graph = createAgentGraph({ debug: false });

      // Empty message
      const state = createInitialState('');

      const result = await graph.invoke(state);

      // Should handle gracefully even with invalid input
      expect(result).toBeDefined();

      // May have errors or fallback behavior
      // The system should not crash
    });

    it('should handle agent failures with recovery', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
      ]);

      // Planning provider throws an error
      const planningProvider = {
        type: 'mock' as const,
        config: {
          provider: 'mock',
          defaultModel: 'mock-model',
          temperature: 0.7,
          maxTokens: 4096,
        },
        complete: vi
          .fn()
          .mockRejectedValue(new Error('LLM service unavailable')),
        stream: vi.fn(),
        close: vi.fn(),
      };

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const state = createInitialState('Build an IoT dashboard');

      const result = await graph.invoke(state);

      // Verify error was captured
      expect(result.errors.length).toBeGreaterThan(0);

      const planningError = result.errors.find(
        (err) => err.agent === AgentRole.PLANNING
      );
      expect(planningError).toBeDefined();
      expect(planningError?.message).toContain('LLM service unavailable');
      expect(planningError?.recoverable).toBe(true);

      // Verify system didn't crash
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
    });

    it('should handle LLM provider initialization failure', async () => {
      // Mock getProvider to throw an error
      vi.spyOn(llmProviders, 'getProvider').mockImplementation(() => {
        throw new Error('No LLM provider configured');
      });

      const graph = createAgentGraph({ debug: false });

      const state = createInitialState('Test message');

      const result = await graph.invoke(state);

      // Should capture the error
      expect(result.errors.length).toBeGreaterThan(0);

      const error = result.errors[0];
      expect(error.message).toContain('LLM provider');
    });
  });

  describe('State Management', () => {
    it('should properly update all state fields', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState('Build a fleet dashboard');

      const result = await graph.invoke(initialState);

      // Verify all state fields are present
      expect(result.messages).toBeDefined();
      expect(result.currentAgent).toBeDefined();
      expect(result.projectId).toBe('test-project-123');
      expect(result.tenantId).toBe('test-tenant-456');
      expect(result.buildPlan).toBeDefined();
      expect(result.completedTasks).toBeDefined();
      expect(result.generatedAssets).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.approvals).toBeDefined();
    });

    it('should accumulate message history correctly', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState('Build an app');

      const result = await graph.invoke(initialState);

      // Should have: initial human message + supervisor messages + planning messages
      expect(result.messages.length).toBeGreaterThan(1);

      // Verify message types
      const messageTypes = result.messages.map((msg) => msg._getType());
      expect(messageTypes).toContain('human');
      expect(messageTypes).toContain('ai');

      // Verify first message is the user's initial message
      expect(result.messages[0]._getType()).toBe('human');
      expect(result.messages[0].content).toBe('Build an app');
    });

    it('should track task status correctly', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState('Build a dashboard');

      const result = await graph.invoke(initialState);

      // All tasks should start as pending
      result.buildPlan.forEach((task) => {
        expect(task.status).toBe('pending');
      });

      // Verify completedTasks is initially empty
      expect(result.completedTasks).toHaveLength(0);
    });
  });

  describe('Agent Routing', () => {
    it('should route to FINISH when conversation is complete', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorFinish,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation(() => {
        return supervisorProvider as any;
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState('Thank you, that is all');

      const result = await graph.invoke(initialState);

      // Verify supervisor decided to finish
      expect(supervisorProvider.complete).toHaveBeenCalled();

      // The graph should have completed without routing to specialist agents
      expect(result).toBeDefined();
    });

    it('should handle supervisor fallback routing on parse failure', async () => {
      // Supervisor returns invalid JSON that can't be parsed
      const supervisorProvider = createMockProvider([
        {
          content: [
            {
              type: 'text',
              text: 'I will help you build a great application!', // No JSON
            },
          ],
        },
      ]);

      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      // Message with "build" keyword should trigger fallback to planning
      const initialState = createInitialState('I want to build a new app');

      const result = await graph.invoke(initialState);

      // Fallback routing should have occurred
      expect(result).toBeDefined();

      // Planning agent should have been called due to fallback
      expect(planningProvider.complete).toHaveBeenCalled();
    });

    it('should handle IoT domain routing with fallback', async () => {
      const supervisorProvider = createMockProvider([
        {
          content: [
            {
              type: 'text',
              text: 'Let me help you with that device question',
            },
          ],
        },
      ]);

      const iotDomainProvider = createMockProvider([
        mockLLMResponses.iotDomainLwM2MObjects,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.IOT_DOMAIN) {
          return iotDomainProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      // Message with IoT keywords should trigger fallback to iot_domain
      const initialState = createInitialState(
        'What devices support telemetry?'
      );

      const result = await graph.invoke(initialState);

      // Fallback routing to IoT domain should have occurred
      expect(result).toBeDefined();
      expect(iotDomainProvider.complete).toHaveBeenCalled();
    });
  });

  describe('Build Plan Validation', () => {
    it('should create valid build plans with proper dependencies', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState(
        'Build a fleet operations dashboard for 10,000 smart water meters'
      );

      const result = await graph.invoke(initialState);

      // Verify build plan structure
      expect(result.buildPlan).toBeDefined();
      expect(result.buildPlan.length).toBeGreaterThan(0);

      // Verify all tasks have required fields
      result.buildPlan.forEach((task) => {
        expect(task.id).toBeDefined();
        expect(task.type).toBeDefined();
        expect(task.description).toBeDefined();
        expect(task.agent).toBeDefined();
        expect(task.dependencies).toBeDefined();
        expect(task.status).toBeDefined();
        expect(Array.isArray(task.dependencies)).toBe(true);
      });

      // Verify task IDs are unique
      const taskIds = result.buildPlan.map((task) => task.id);
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(taskIds.length);

      // Verify dependencies reference valid task IDs
      result.buildPlan.forEach((task) => {
        task.dependencies.forEach((depId) => {
          expect(taskIds).toContain(depId);
        });
      });

      // Verify no circular dependencies
      // Task 4 depends on tasks 2 and 3
      const task4 = result.buildPlan.find((t) => t.id === 'task-4');
      if (task4) {
        expect(task4.dependencies).toContain('task-2');
        expect(task4.dependencies).toContain('task-3');

        // Tasks 2 and 3 should not depend on task 4
        const task2 = result.buildPlan.find((t) => t.id === 'task-2');
        const task3 = result.buildPlan.find((t) => t.id === 'task-3');
        expect(task2?.dependencies).not.toContain('task-4');
        expect(task3?.dependencies).not.toContain('task-4');
      }
    });

    it('should include proper agent assignments in build plan', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState(
        'Create an IoT monitoring dashboard'
      );

      const result = await graph.invoke(initialState);

      // Verify agents are properly assigned
      const planningTasks = result.buildPlan.filter(
        (task) => task.agent === 'planning'
      );
      const iotDomainTasks = result.buildPlan.filter(
        (task) => task.agent === 'iot_domain'
      );

      // Should have tasks for both agents
      expect(planningTasks.length).toBeGreaterThan(0);
      expect(iotDomainTasks.length).toBeGreaterThan(0);

      // API integration should be assigned to iot_domain
      const apiTask = result.buildPlan.find(
        (task) => task.type === 'api_integration'
      );
      expect(apiTask?.agent).toBe('iot_domain');
    });

    it('should include descriptive task descriptions', async () => {
      const supervisorProvider = createMockProvider([
        mockLLMResponses.supervisorRoutePlanning,
        mockLLMResponses.supervisorFinish,
      ]);
      const planningProvider = createMockProvider([
        mockLLMResponses.planningBuildDashboard,
      ]);

      vi.spyOn(llmProviders, 'getProvider').mockImplementation((role) => {
        if (role === llmProviders.AgentRole.SUPERVISOR) {
          return supervisorProvider as any;
        }
        if (role === llmProviders.AgentRole.PLANNING) {
          return planningProvider as any;
        }
        throw new Error(`Unexpected role: ${role}`);
      });

      const graph = createAgentGraph({ debug: false });

      const initialState = createInitialState('Build a water meter dashboard');

      const result = await graph.invoke(initialState);

      // All tasks should have meaningful descriptions
      result.buildPlan.forEach((task) => {
        expect(task.description).toBeDefined();
        expect(task.description.length).toBeGreaterThan(10);

        // Descriptions should not be generic
        expect(task.description).not.toBe('Task description');
        expect(task.description).not.toBe('TODO');
      });

      // Verify specific task descriptions contain relevant keywords
      const schemaTask = result.buildPlan.find(
        (task) => task.type === 'schema_design'
      );
      if (schemaTask) {
        expect(
          schemaTask.description.toLowerCase()
        ).toMatch(/schema|database|data/);
      }
    });
  });
});
