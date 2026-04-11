/**
 * @fileoverview Tests for the LangGraph StateGraph workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { createAgentGraph } from './graph';
import type { AEPAgentState } from './types';
import { AgentRole } from './types';

// Mock the agent node creators
vi.mock('./agents/supervisor', () => ({
  createSupervisorNode: vi.fn(() => {
    return async (state: AEPAgentState) => {
      // Mock supervisor behavior: route to planning for build requests
      const lastMessage = state.messages[state.messages.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : String(lastMessage.content);

      let next: 'planning' | 'iot_domain' | 'FINISH' = 'FINISH';

      if (content.toLowerCase().includes('build')) {
        next = 'planning';
      } else if (content.toLowerCase().includes('device')) {
        next = 'iot_domain';
      }

      const decision = {
        next,
        reasoning: `Mock routing to ${next}`,
      };

      return {
        currentAgent: next === 'FINISH' ? AgentRole.SUPERVISOR : AgentRole[next.toUpperCase() as keyof typeof AgentRole],
        messages: [
          ...state.messages,
          new AIMessage({
            content: JSON.stringify(decision),
            additional_kwargs: {
              supervisor_decision: decision,
            },
          }),
        ],
      };
    };
  }),
}));

vi.mock('./agents/planning', () => ({
  createPlanningNode: vi.fn(() => {
    return async (state: AEPAgentState) => {
      return {
        currentAgent: AgentRole.PLANNING,
        messages: [
          ...state.messages,
          new AIMessage('Mock planning response: Created build plan'),
        ],
        buildPlan: [
          {
            id: 'task-1',
            type: 'project_setup',
            description: 'Mock setup task',
            agent: AgentRole.PLANNING,
            dependencies: [],
            status: 'pending' as const,
          },
        ],
      };
    };
  }),
}));

vi.mock('./agents/iot-domain', () => ({
  createIoTDomainNode: vi.fn(() => {
    return async (state: AEPAgentState) => {
      return {
        currentAgent: AgentRole.IOT_DOMAIN,
        messages: [
          ...state.messages,
          new AIMessage('Mock IoT domain response: Here is device information'),
        ],
      };
    };
  }),
}));

describe('createAgentGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a compiled graph', () => {
    const graph = createAgentGraph();
    expect(graph).toBeDefined();
    expect(graph.invoke).toBeInstanceOf(Function);
  });

  it('should create a graph with debug mode enabled', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const graph = createAgentGraph({ debug: true });

    expect(graph).toBeDefined();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should route to planning agent for build requests', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('I want to build a dashboard')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    expect(result).toBeDefined();
    expect(result.buildPlan).toBeDefined();
    expect(result.buildPlan.length).toBeGreaterThan(0);

    // Should have messages from user, supervisor, planning, and supervisor again
    expect(result.messages.length).toBeGreaterThanOrEqual(3);
  });

  it('should route to IoT domain agent for device queries', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('Show me my device list')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    expect(result).toBeDefined();

    // Should have messages from user, supervisor, iot_domain, and supervisor again
    expect(result.messages.length).toBeGreaterThanOrEqual(3);

    // Check that IoT domain response is present
    const lastMessage = result.messages[result.messages.length - 2]; // Second to last (before final supervisor)
    expect(lastMessage.content).toContain('device information');
  });

  it('should handle FINISH routing', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [new HumanMessage("That's all, thank you")],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    expect(result).toBeDefined();

    // Should complete after supervisor routes to FINISH
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('should preserve state across agent transitions', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('Build an IoT app')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'preserve-test',
      tenantId: 'tenant-preserve',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    // Project ID and tenant ID should be preserved
    expect(result.projectId).toBe('preserve-test');
    expect(result.tenantId).toBe('tenant-preserve');
  });

  it('should accumulate messages in order', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('First message')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    // Messages should be in order: user, supervisor decision, agent response, supervisor decision
    expect(result.messages.length).toBeGreaterThan(1);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
  });

  it('should support streaming', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('Build a device manager')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'stream-test',
      tenantId: 'tenant-stream',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const events: any[] = [];

    // Collect all streamed events
    for await (const event of graph.stream(initialState)) {
      events.push(event);
    }

    // Should have multiple events (one for each node execution)
    expect(events.length).toBeGreaterThan(0);
  });

  it('should handle empty messages array', async () => {
    const graph = createAgentGraph();

    const initialState: AEPAgentState = {
      messages: [],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    // Should handle gracefully without throwing
    await expect(graph.invoke(initialState)).resolves.toBeDefined();
  });

  it('should merge build plans correctly', async () => {
    const graph = createAgentGraph();

    const existingTask = {
      id: 'existing-task',
      type: 'existing',
      description: 'Pre-existing task',
      agent: AgentRole.PLANNING,
      dependencies: [],
      status: 'completed' as const,
    };

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('Build something')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [existingTask],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    // New build plan should replace the old one (as per reducer logic)
    expect(result.buildPlan).toBeDefined();
    expect(result.buildPlan.length).toBeGreaterThan(0);
  });

  it('should accumulate errors correctly', async () => {
    const graph = createAgentGraph();

    const existingError = {
      agent: AgentRole.PLANNING,
      message: 'Pre-existing error',
      timestamp: new Date(),
      recoverable: true,
    };

    const initialState: AEPAgentState = {
      messages: [new HumanMessage('Test')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [existingError],
      approvals: [],
    };

    const result = await graph.invoke(initialState);

    // Errors should be preserved
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});
