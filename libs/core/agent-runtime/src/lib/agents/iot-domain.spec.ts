/**
 * @fileoverview Tests for IoT Domain Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import { createIoTDomainNode } from './iot-domain';
import type { AEPAgentState } from '../types';
import { AgentRole } from '../types';

// Mock the dependencies
vi.mock('@friendly-tech/core/llm-providers', () => ({
  getProvider: vi.fn(() => ({
    config: {
      defaultModel: 'claude-opus-4-6',
    },
    complete: vi.fn(async () => ({
      content: [
        {
          type: 'text',
          text: 'This is a test response about IoT devices.',
        },
      ],
    })),
  })),
  AgentRole: {
    IOT_DOMAIN: 'iot_domain',
  },
}));

vi.mock('@friendly-tech/iot/iot-tool-functions', () => ({
  createGetDeviceListTool: vi.fn(() => ({
    name: 'getDeviceList',
    description: 'Get list of devices',
    schema: {},
    _call: vi.fn(async () => ({ devices: [] })),
  })),
  createGetDeviceDetailsTool: vi.fn(() => ({
    name: 'getDeviceDetails',
    description: 'Get device details',
    schema: {},
    _call: vi.fn(async () => ({ device: {} })),
  })),
  createGetDeviceTelemetryTool: vi.fn(() => ({
    name: 'getDeviceTelemetry',
    description: 'Get device telemetry',
    schema: {},
    _call: vi.fn(async () => ({ telemetry: [] })),
  })),
  createRegisterWebhookTool: vi.fn(() => ({
    name: 'registerWebhook',
    description: 'Register webhook',
    schema: {},
    _call: vi.fn(async () => ({ success: true })),
  })),
  createGetKPIMetricsTool: vi.fn(() => ({
    name: 'getKPIMetrics',
    description: 'Get KPI metrics',
    schema: {},
    _call: vi.fn(async () => ({ metrics: {} })),
  })),
}));

describe('IoT Domain Agent', () => {
  let mockState: AEPAgentState;

  beforeEach(() => {
    mockState = {
      messages: [new HumanMessage('What devices are available?')],
      currentAgent: AgentRole.SUPERVISOR,
      projectId: 'test-project',
      tenantId: 'test-tenant',
      buildPlan: [],
      completedTasks: [],
      generatedAssets: [],
      errors: [],
      approvals: [],
    };
  });

  it('should create an IoT domain node function', () => {
    const node = createIoTDomainNode();
    expect(node).toBeDefined();
    expect(typeof node).toBe('function');
  });

  it('should process a simple IoT query', async () => {
    const node = createIoTDomainNode();
    const result = await node(mockState);

    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
    expect(result.currentAgent).toBe(AgentRole.IOT_DOMAIN);
  });

  it('should add a new message to the state', async () => {
    const node = createIoTDomainNode();
    const result = await node(mockState);

    expect(result.messages).toBeDefined();
    expect(result.messages!.length).toBeGreaterThan(mockState.messages.length);
  });

  it('should handle errors gracefully', async () => {
    // Mock provider to throw an error
    const { getProvider } = await import('@friendly-tech/core/llm-providers');
    vi.mocked(getProvider).mockImplementationOnce(() => {
      throw new Error('Provider error');
    });

    const node = createIoTDomainNode();
    const result = await node(mockState);

    expect(result).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0].agent).toBe(AgentRole.IOT_DOMAIN);
  });

  it('should set current agent to IOT_DOMAIN', async () => {
    const node = createIoTDomainNode();
    const result = await node(mockState);

    expect(result.currentAgent).toBe(AgentRole.IOT_DOMAIN);
  });
});
