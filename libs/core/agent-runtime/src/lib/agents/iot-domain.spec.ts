/**
 * @fileoverview Tests for IoT Domain Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import { createIoTDomainNode } from './iot-domain';
import type { AEPAgentState } from '../types';
import { AgentRole } from '../types';
import type { ToolConfig } from '@friendly-tech/iot/iot-tool-functions';

// Note: vi.mock is hoisted — no module-scope variables may be referenced inside
// the factory.  Each mock function is defined inline.
vi.mock('@friendly-tech/core/llm-providers', () => ({
  getProvider: vi.fn(() => ({
    type: 'anthropic',
    config: { defaultModel: 'claude-opus-4-6' },
    complete: vi.fn(async () => ({
      id: 'msg-1',
      model: 'claude-opus-4-6',
      role: 'assistant',
      content: [{ type: 'text', text: 'This is a test response about IoT devices.' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    })),
    streamComplete: vi.fn(),
    validateConfig: vi.fn(async () => true),
  })),
  getProviderInterface: vi.fn(() => ({
    type: 'anthropic',
    config: { defaultModel: 'claude-opus-4-6' },
    complete: vi.fn(async () => ({
      id: 'msg-1',
      model: 'claude-opus-4-6',
      role: 'assistant',
      content: [{ type: 'text', text: 'This is a test response about IoT devices.' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    })),
    streamComplete: vi.fn(),
    validateConfig: vi.fn(async () => true),
  })),
  AgentRole: {
    SUPERVISOR: 'SUPERVISOR',
    PLANNING: 'PLANNING',
    IOT_DOMAIN: 'IOT_DOMAIN',
  },
}));

vi.mock('@friendly-tech/iot/iot-tool-functions', () => ({
  createGetDeviceListTool: vi.fn(() => ({
    name: 'getDeviceList',
    description: 'Get list of devices',
    schema: { type: 'object', properties: {}, required: [] },
    invoke: vi.fn(async () => JSON.stringify({ devices: [] })),
  })),
  createGetDeviceDetailsTool: vi.fn(() => ({
    name: 'getDeviceDetails',
    description: 'Get device details',
    schema: { type: 'object', properties: {}, required: [] },
    invoke: vi.fn(async () => JSON.stringify({ device: {} })),
  })),
  createGetDeviceTelemetryTool: vi.fn(() => ({
    name: 'getDeviceTelemetry',
    description: 'Get device telemetry',
    schema: { type: 'object', properties: {}, required: [] },
    invoke: vi.fn(async () => JSON.stringify({ telemetry: [] })),
  })),
  createRegisterWebhookTool: vi.fn(() => ({
    name: 'registerWebhook',
    description: 'Register webhook',
    schema: { type: 'object', properties: {}, required: [] },
    invoke: vi.fn(async () => JSON.stringify({ success: true })),
  })),
  createGetKPIMetricsTool: vi.fn(() => ({
    name: 'getKPIMetrics',
    description: 'Get KPI metrics',
    schema: { type: 'object', properties: {}, required: [] },
    invoke: vi.fn(async () => JSON.stringify({ metrics: {} })),
  })),
}));

// Minimal ToolConfig stub — methods are unused; the tools themselves are mocked.
const mockToolConfig: ToolConfig = {
  sdk: {
    getDeviceList: vi.fn(async () => ({ devices: [], total: 0, limit: 20, offset: 0 })),
    getDeviceById: vi.fn(async () => ({
      deviceId: 'd1',
      name: 'Test',
      type: 'sensor',
      status: 'online',
    })),
    getDeviceTelemetry: vi.fn(async () => ({
      deviceId: 'd1',
      startTime: new Date(),
      endTime: new Date(),
      dataPoints: [],
    })),
    subscribeToEvents: vi.fn(async () => ({
      subscriptionId: 'sub-1',
      eventTypes: [],
      createdAt: new Date(),
    })),
    getFleetKpis: vi.fn(async () => ({
      totalDevices: 0,
      onlineDevices: 0,
      offlineDevices: 0,
      degradedDevices: 0,
      averageUptime: 100,
      alertCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      timestamp: new Date(),
    })),
  },
  redis: undefined,
};

describe('IoT Domain Agent', () => {
  let mockState: AEPAgentState;

  beforeEach(() => {
    vi.clearAllMocks();

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
    const node = createIoTDomainNode(mockToolConfig);
    expect(node).toBeDefined();
    expect(typeof node).toBe('function');
  });

  it('should process a simple IoT query', async () => {
    const node = createIoTDomainNode(mockToolConfig);
    const result = await node(mockState);

    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
    expect(result.currentAgent).toBe(AgentRole.IOT_DOMAIN);
  });

  it('should add a new message to the state', async () => {
    const node = createIoTDomainNode(mockToolConfig);
    const result = await node(mockState);

    expect(result.messages).toBeDefined();
    expect(result.messages!.length).toBeGreaterThan(mockState.messages.length);
  });

  it('should handle errors gracefully', async () => {
    // Override the provider mock to throw
    const { getProviderInterface } = await import('@friendly-tech/core/llm-providers');
    vi.mocked(getProviderInterface).mockImplementationOnce(() => {
      throw new Error('Provider error');
    });

    const node = createIoTDomainNode(mockToolConfig);
    const result = await node(mockState);

    expect(result).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0].agent).toBe(AgentRole.IOT_DOMAIN);
  });

  it('should set current agent to IOT_DOMAIN', async () => {
    const node = createIoTDomainNode(mockToolConfig);
    const result = await node(mockState);

    expect(result.currentAgent).toBe(AgentRole.IOT_DOMAIN);
  });
});
