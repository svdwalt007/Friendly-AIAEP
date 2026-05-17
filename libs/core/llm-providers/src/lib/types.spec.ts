import { describe, it, expect } from 'vitest';
import type {
  ProviderType,
  MessageRole,
  Tool,
  ToolUse,
  ToolResult,
  ContentBlock,
  Message,
  TokenUsage,
  StreamDelta,
  CompletionResponse,
  CompletionOptions,
  ProviderConfig,
  TenantLLMConfig,
  UsageEvent,
  CostParams,
  UsageAggregation,
} from './types';

describe('types', () => {
  describe('ProviderType', () => {
    it('should accept valid provider types', () => {
      const providers: ProviderType[] = ['anthropic', 'ollama'];
      expect(providers).toHaveLength(2);
      expect(providers).toContain('anthropic');
      expect(providers).toContain('ollama');
    });
  });

  describe('MessageRole', () => {
    it('should accept valid message roles', () => {
      const roles: MessageRole[] = ['user', 'assistant', 'system'];
      expect(roles).toHaveLength(3);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
      expect(roles).toContain('system');
    });
  });

  describe('Tool', () => {
    it('should validate tool structure', () => {
      const tool: Tool = {
        name: 'get_weather',
        description: 'Get the weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City and state',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
            },
          },
          required: ['location'],
        },
      };

      expect(tool.name).toBe('get_weather');
      expect(tool.description).toBeTruthy();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeDefined();
      expect(tool.parameters.required).toEqual(['location']);
    });

    it('should support nested parameter schemas', () => {
      const tool: Tool = {
        name: 'create_user',
        description: 'Create a new user',
        parameters: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
              required: ['name'],
            },
          },
        },
      };

      expect(tool.parameters.properties?.user.type).toBe('object');
      expect(tool.parameters.properties?.user.properties).toBeDefined();
    });
  });

  describe('ToolUse', () => {
    it('should validate tool use structure', () => {
      const toolUse: ToolUse = {
        id: 'toolu_123',
        name: 'get_weather',
        input: {
          location: 'San Francisco, CA',
          unit: 'celsius',
        },
      };

      expect(toolUse.id).toBe('toolu_123');
      expect(toolUse.name).toBe('get_weather');
      expect(toolUse.input.location).toBe('San Francisco, CA');
    });
  });

  describe('ToolResult', () => {
    it('should validate successful tool result', () => {
      const result: ToolResult = {
        tool_use_id: 'toolu_123',
        content: 'The weather is sunny',
      };

      expect(result.tool_use_id).toBe('toolu_123');
      expect(result.content).toBe('The weather is sunny');
      expect(result.is_error).toBeUndefined();
    });

    it('should validate error tool result', () => {
      const result: ToolResult = {
        tool_use_id: 'toolu_123',
        content: 'Failed to fetch weather',
        is_error: true,
      };

      expect(result.is_error).toBe(true);
    });
  });

  describe('ContentBlock', () => {
    it('should validate text content block', () => {
      const block: ContentBlock = {
        type: 'text',
        text: 'Hello, world!',
      };

      expect(block.type).toBe('text');
      if (block.type === 'text') {
        expect(block.text).toBe('Hello, world!');
      }
    });

    it('should validate tool_use content block', () => {
      const block: ContentBlock = {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'get_weather',
        input: { location: 'SF' },
      };

      expect(block.type).toBe('tool_use');
      if (block.type === 'tool_use') {
        expect(block.id).toBe('toolu_123');
        expect(block.name).toBe('get_weather');
      }
    });

    it('should validate tool_result content block', () => {
      const block: ContentBlock = {
        type: 'tool_result',
        tool_use_id: 'toolu_123',
        content: 'Result data',
      };

      expect(block.type).toBe('tool_result');
      if (block.type === 'tool_result') {
        expect(block.tool_use_id).toBe('toolu_123');
        expect(block.content).toBe('Result data');
      }
    });
  });

  describe('Message', () => {
    it('should validate message with string content', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello!',
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
    });

    it('should validate message with content blocks', () => {
      const message: Message = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check that.' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_weather',
            input: { location: 'SF' },
          },
        ],
      };

      expect(message.role).toBe('assistant');
      expect(Array.isArray(message.content)).toBe(true);
      if (Array.isArray(message.content)) {
        expect(message.content).toHaveLength(2);
        expect(message.content[0].type).toBe('text');
        expect(message.content[1].type).toBe('tool_use');
      }
    });
  });

  describe('TokenUsage', () => {
    it('should validate token usage structure', () => {
      const usage: TokenUsage = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      };

      expect(usage.input_tokens).toBe(100);
      expect(usage.output_tokens).toBe(50);
      expect(usage.total_tokens).toBe(150);
    });
  });

  describe('StreamDelta', () => {
    it('should validate content_block_start delta', () => {
      const delta: StreamDelta = {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      };

      expect(delta.type).toBe('content_block_start');
      if (delta.type === 'content_block_start') {
        expect(delta.index).toBe(0);
      }
    });

    it('should validate content_block_delta with text', () => {
      const delta: StreamDelta = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      };

      expect(delta.type).toBe('content_block_delta');
      if (delta.type === 'content_block_delta') {
        expect(delta.delta.type).toBe('text_delta');
      }
    });

    it('should validate message_start delta', () => {
      const delta: StreamDelta = {
        type: 'message_start',
        message: {
          id: 'msg_123',
          role: 'assistant',
          model: 'claude-3-opus',
        },
      };

      expect(delta.type).toBe('message_start');
      if (delta.type === 'message_start') {
        expect(delta.message.id).toBe('msg_123');
      }
    });

    it('should validate message_delta', () => {
      const delta: StreamDelta = {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 50 },
      };

      expect(delta.type).toBe('message_delta');
      if (delta.type === 'message_delta') {
        expect(delta.delta.stop_reason).toBe('end_turn');
      }
    });

    it('should validate message_stop delta', () => {
      const delta: StreamDelta = {
        type: 'message_stop',
      };

      expect(delta.type).toBe('message_stop');
    });
  });

  describe('CompletionResponse', () => {
    it('should validate completion response structure', () => {
      const response: CompletionResponse = {
        id: 'msg_123',
        model: 'claude-3-opus-20240229',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      };

      expect(response.id).toBe('msg_123');
      expect(response.model).toBe('claude-3-opus-20240229');
      expect(response.content).toHaveLength(1);
      expect(response.usage.total_tokens).toBe(15);
    });
  });

  describe('CompletionOptions', () => {
    it('should validate minimal completion options', () => {
      const options: CompletionOptions = {
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
      };

      expect(options.model).toBe('claude-3-opus-20240229');
      expect(options.messages).toHaveLength(1);
      expect(options.max_tokens).toBe(1024);
    });

    it('should validate full completion options', () => {
      const options: CompletionOptions = {
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'You are a helpful assistant',
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} },
          },
        ],
        stream: true,
        stop_sequences: ['END'],
      };

      expect(options.system).toBe('You are a helpful assistant');
      expect(options.temperature).toBe(0.7);
      expect(options.top_p).toBe(0.9);
      expect(options.top_k).toBe(40);
      expect(options.tools).toHaveLength(1);
      expect(options.stream).toBe(true);
      expect(options.stop_sequences).toEqual(['END']);
    });
  });

  describe('ProviderConfig', () => {
    it('should validate anthropic provider config', () => {
      const config: ProviderConfig = {
        type: 'anthropic',
        apiKey: 'sk-ant-123',
        defaultModel: 'claude-3-opus-20240229',
        timeout: 30000,
        maxRetries: 3,
      };

      expect(config.type).toBe('anthropic');
      expect(config.apiKey).toBe('sk-ant-123');
      expect(config.timeout).toBe(30000);
    });

    it('should validate ollama provider config', () => {
      const config: ProviderConfig = {
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama2',
      };

      expect(config.type).toBe('ollama');
      expect(config.baseUrl).toBe('http://localhost:11434');
    });
  });

  describe('TenantLLMConfig', () => {
    it('should validate tenant config structure', () => {
      const config: TenantLLMConfig = {
        tenantId: 'tenant-123',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        apiKey: 'sk-ant-456',
        maxTokens: 4096,
        temperature: 0.7,
      };

      expect(config.tenantId).toBe('tenant-123');
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('UsageEvent', () => {
    it('should validate usage event structure', () => {
      const event: UsageEvent = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        tenantId: 'tenant-123',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.015,
        requestId: 'req_123',
      };

      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.tenantId).toBe('tenant-123');
      expect(event.totalTokens).toBe(150);
      expect(event.estimatedCost).toBe(0.015);
    });
  });

  describe('CostParams', () => {
    it('should validate cost calculation parameters', () => {
      const params: CostParams = {
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 100,
        outputTokens: 50,
      };

      expect(params.provider).toBe('anthropic');
      expect(params.model).toBe('claude-3-opus-20240229');
      expect(params.inputTokens).toBe(100);
      expect(params.outputTokens).toBe(50);
    });
  });

  describe('UsageAggregation', () => {
    it('should validate usage aggregation structure', () => {
      const aggregation: UsageAggregation = {
        totalRequests: 10,
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalTokens: 1500,
        totalCost: 0.15,
        byModel: {
          'claude-3-opus-20240229': {
            requests: 5,
            inputTokens: 500,
            outputTokens: 250,
            totalTokens: 750,
            cost: 0.075,
          },
          'claude-3-sonnet-20240229': {
            requests: 5,
            inputTokens: 500,
            outputTokens: 250,
            totalTokens: 750,
            cost: 0.075,
          },
        },
      };

      expect(aggregation.totalRequests).toBe(10);
      expect(aggregation.totalTokens).toBe(1500);
      expect(aggregation.byModel['claude-3-opus-20240229'].requests).toBe(5);
      expect(Object.keys(aggregation.byModel)).toHaveLength(2);
    });
  });
});
