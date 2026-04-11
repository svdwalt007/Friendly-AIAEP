/**
 * Unit tests for the Supervisor Agent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSupervisorNode } from './supervisor';
import type { AEPAgentState } from '../types';
import { AgentRole } from '../types';
import type { BaseMessage } from '@langchain/core/messages';

// Mock the llm-providers factory
vi.mock('@friendly-tech/core/llm-providers', () => ({
  getProvider: vi.fn(() => ({
    type: 'anthropic',
    config: {
      defaultModel: 'claude-opus-4-6',
    },
    complete: vi.fn(),
  })),
  AgentRole: {
    SUPERVISOR: 'SUPERVISOR',
    PLANNING: 'PLANNING',
    IOT_DOMAIN: 'IOT_DOMAIN',
  },
}));

describe('Supervisor Agent', () => {
  let mockProvider: any;
  let getProviderMock: any;

  beforeEach(async () => {
    const { getProvider } = await import('@friendly-tech/core/llm-providers');
    getProviderMock = vi.mocked(getProvider);

    mockProvider = {
      type: 'anthropic',
      config: {
        defaultModel: 'claude-opus-4-6',
      },
      complete: vi.fn(),
    };

    getProviderMock.mockReturnValue(mockProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createTestState = (lastMessage: string): AEPAgentState => ({
    messages: [
      {
        content: lastMessage,
        _getType: () => 'human',
      } as BaseMessage,
    ],
    currentAgent: AgentRole.SUPERVISOR,
    projectId: 'test-project-123',
    tenantId: 'test-tenant-456',
    buildPlan: [],
    completedTasks: [],
    generatedAssets: [],
    errors: [],
    approvals: [],
  });

  it('should route to planning agent for app building requests', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"next": "planning", "reasoning": "User wants to build a new application"}',
        },
      ],
    });

    const state = createTestState('I want to build a fleet operations dashboard');
    const result = await supervisorNode(state);

    expect(result.currentAgent).toBe(AgentRole.PLANNING);
    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBe(2); // Original + AI response
  });

  it('should route to iot_domain agent for device queries', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"next": "iot_domain", "reasoning": "User is asking about device information"}',
        },
      ],
    });

    const state = createTestState('Show me the list of connected devices');
    const result = await supervisorNode(state);

    expect(result.currentAgent).toBe(AgentRole.IOT_DOMAIN);
    expect(result.messages).toBeDefined();
  });

  it('should route to FINISH for conversation completion', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"next": "FINISH", "reasoning": "User indicated completion"}',
        },
      ],
    });

    const state = createTestState('Thank you, that is all I need');
    const result = await supervisorNode(state);

    expect(result.currentAgent).toBe(AgentRole.SUPERVISOR);
    expect(result.messages).toBeDefined();
  });

  it('should handle LLM response wrapped in markdown code blocks', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '```json\n{"next": "planning", "reasoning": "Building new app"}\n```',
        },
      ],
    });

    const state = createTestState('Create a new dashboard');
    const result = await supervisorNode(state);

    expect(result.currentAgent).toBe(AgentRole.PLANNING);
  });

  it('should use fallback routing when LLM output cannot be parsed', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Invalid JSON response that cannot be parsed',
        },
      ],
    });

    const state = createTestState('Build a new IoT application');
    const result = await supervisorNode(state);

    // Should fallback to planning for "build" keyword
    expect(result.currentAgent).toBe(AgentRole.PLANNING);
  });

  it('should handle errors gracefully', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockRejectedValue(new Error('LLM API error'));

    const state = createTestState('Test message');
    const result = await supervisorNode(state);

    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.errors?.[0].agent).toBe(AgentRole.SUPERVISOR);
  });

  it('should throw error when no messages in state', async () => {
    const supervisorNode = createSupervisorNode();

    const state: AEPAgentState = {
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

    const result = await supervisorNode(state);

    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('should include context in LLM prompt', async () => {
    const supervisorNode = createSupervisorNode();

    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"next": "planning", "reasoning": "New project request"}',
        },
      ],
    });

    const state = createTestState('Start a new project');
    state.buildPlan = [
      {
        id: 'task-1',
        type: 'project_setup',
        description: 'Initialize project',
        agent: AgentRole.PLANNING,
        dependencies: [],
        status: 'pending',
      },
    ];

    await supervisorNode(state);

    // Verify that complete was called with messages
    expect(mockProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );
  });

  it('should parse reasoning from supervisor output', async () => {
    const supervisorNode = createSupervisorNode();

    const reasoning = 'User is requesting telemetry data from devices';
    mockProvider.complete.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `{"next": "iot_domain", "reasoning": "${reasoning}"}`,
        },
      ],
    });

    const state = createTestState('Get device telemetry');
    const result = await supervisorNode(state);

    expect(result.messages).toBeDefined();
    const lastMessage = result.messages![result.messages!.length - 1];
    const parsed = JSON.parse(lastMessage.content as string);
    expect(parsed.reasoning).toBe(reasoning);
  });
});
