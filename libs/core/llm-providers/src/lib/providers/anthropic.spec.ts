import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages';
import {
  AnthropicProvider,
  AnthropicConfigurationError,
  AnthropicValidationError,
  AnthropicAPIError,
  type AnthropicProviderConfig,
} from './anthropic';
import type { CompletionOptions } from '../types';
import { AgentRole } from '../usage-tracker';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk');

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockClient: {
    messages: {
      create: ReturnType<typeof vi.fn>;
      stream: ReturnType<typeof vi.fn>;
    };
  };

  const config: AnthropicProviderConfig = {
    type: 'anthropic',
    apiKey: 'sk-ant-test-key-12345678901234567890',
    defaultModel: 'claude-3-5-sonnet-20241022',
    timeout: 30000,
    maxRetries: 3,
    tenantId: 'test-tenant',
    agentRole: AgentRole.CUSTOM,
  };

  beforeEach(() => {
    mockClient = {
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    };

    // Mock the Anthropic constructor
    vi.mocked(Anthropic).mockImplementation(function () { return mockClient as unknown as Anthropic; });

    provider = new AnthropicProvider(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with correct config', () => {
      expect(provider.type).toBe('anthropic');
      expect(provider.config.type).toBe('anthropic');
      expect(provider.config.apiKey).toBe(config.apiKey);
    });

    it('should throw error for missing config', () => {
      expect(() => new AnthropicProvider(null as unknown as AnthropicProviderConfig)).toThrow(
        AnthropicConfigurationError
      );
    });

    it('should throw error for invalid provider type', () => {
      const invalidConfig = { ...config, type: 'ollama' as const };
      expect(() => new AnthropicProvider(invalidConfig as unknown as AnthropicProviderConfig)).toThrow(
        AnthropicConfigurationError
      );
    });

    it('should throw error for missing API key', () => {
      const invalidConfig = { ...config, apiKey: undefined };
      expect(() => new AnthropicProvider(invalidConfig as unknown as AnthropicProviderConfig)).toThrow(
        AnthropicConfigurationError
      );
      expect(() => new AnthropicProvider(invalidConfig as unknown as AnthropicProviderConfig)).toThrow(
        /API key is required/
      );
    });

    it('should throw error for empty API key', () => {
      const invalidConfig = { ...config, apiKey: '   ' };
      expect(() => new AnthropicProvider(invalidConfig)).toThrow(
        AnthropicConfigurationError
      );
    });

    it('should throw error for negative timeout', () => {
      const invalidConfig = { ...config, timeout: -1 };
      expect(() => new AnthropicProvider(invalidConfig)).toThrow(
        AnthropicConfigurationError
      );
      expect(() => new AnthropicProvider(invalidConfig)).toThrow(/Timeout must be positive/);
    });

    it('should throw error for negative maxRetries', () => {
      const invalidConfig = { ...config, maxRetries: -1 };
      expect(() => new AnthropicProvider(invalidConfig)).toThrow(
        AnthropicConfigurationError
      );
    });

    it('should initialize Anthropic client with config', () => {
      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
      });
    });

    it('should merge with default config', () => {
      const minimalConfig: AnthropicProviderConfig = {
        type: 'anthropic',
        apiKey: 'test-key',
      };
      const minimalProvider = new AnthropicProvider(minimalConfig);
      expect(minimalProvider.config.defaultModel).toBe('claude-3-5-sonnet-20241022');
      expect(minimalProvider.config.timeout).toBe(60000);
      expect(minimalProvider.config.maxRetries).toBe(3);
    });
  });

  describe('validateCompletionOptions', () => {
    it('should validate missing options', async () => {
      await expect(provider.complete(null as unknown as CompletionOptions)).rejects.toThrow(
        AnthropicValidationError
      );
    });

    it('should validate missing model', async () => {
      const invalidOptions = {
        messages: [{ role: 'user' as const, content: 'test' }],
        max_tokens: 100,
      } as CompletionOptions;
      await expect(provider.complete(invalidOptions)).rejects.toThrow(
        AnthropicValidationError
      );
    });

    it('should validate empty messages array', async () => {
      const invalidOptions: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [],
        max_tokens: 100,
      };
      await expect(provider.complete(invalidOptions)).rejects.toThrow(
        /At least one message is required/
      );
    });

    it('should validate max_tokens', async () => {
      const invalidOptions: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: -1,
      };
      await expect(provider.complete(invalidOptions)).rejects.toThrow(
        /max_tokens must be positive/
      );
    });

    it('should validate temperature range', async () => {
      const invalidOptions: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 100,
        temperature: 2.5,
      };
      await expect(provider.complete(invalidOptions)).rejects.toThrow(
        /Temperature must be between 0 and 1/
      );
    });

    it('should validate top_p range', async () => {
      const invalidOptions: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 100,
        top_p: 1.5,
      };
      await expect(provider.complete(invalidOptions)).rejects.toThrow(
        /top_p must be between 0 and 1/
      );
    });

    it('should validate top_k', async () => {
      const invalidOptions: CompletionOptions = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 100,
        top_k: -5,
      };
      await expect(provider.complete(invalidOptions)).rejects.toThrow(
        /top_k must be non-negative/
      );
    });
  });

  describe('complete', () => {
    const options: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hello!' }],
      max_tokens: 1024,
    };

    it('should make successful completion request', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.complete(options);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: options.model,
          max_tokens: options.max_tokens,
          messages: [{ role: 'user', content: 'Hello!' }],
          stream: false,
        })
      );

      expect(result).toEqual({
        id: 'msg_123',
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
        },
      });
    });

    it('should handle system messages correctly', async () => {
      const optionsWithSystem: CompletionOptions = {
        ...options,
        system: 'You are a helpful assistant',
        messages: [
          { role: 'system', content: 'System instruction' },
          { role: 'user', content: 'Hello!' },
        ],
      };

      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Hi!' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      await provider.complete(optionsWithSystem);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
          messages: [{ role: 'user', content: 'Hello!' }], // System message filtered out
        })
      );
    });

    it('should handle tool calling', async () => {
      const optionsWithTools: CompletionOptions = {
        ...options,
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        ],
      };

      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-opus-20240229',
        content: [
          { type: 'text', text: 'Let me check the weather.' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_weather',
            input: { location: 'San Francisco' },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 30 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.complete(optionsWithTools);

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Let me check the weather.' });
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'toolu_123',
        name: 'get_weather',
        input: { location: 'San Francisco' },
      });
      expect(result.stop_reason).toBe('tool_use');
    });

    it('should handle complex messages with content blocks', async () => {
      const complexOptions: CompletionOptions = {
        ...options,
        messages: [
          { role: 'user', content: 'What is the weather?' },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me check.' },
              {
                type: 'tool_use',
                id: 'toolu_123',
                name: 'get_weather',
                input: { location: 'SF' },
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_123',
                content: 'Sunny, 72°F',
              },
            ],
          },
        ],
      };

      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'The weather is sunny and 72°F.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.complete(complexOptions);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Let me check.' },
                {
                  type: 'tool_use',
                  id: 'toolu_123',
                  name: 'get_weather',
                  input: { location: 'SF' },
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_123',
                  content: 'Sunny, 72°F',
                  is_error: undefined,
                },
              ],
            },
          ],
        })
      );

      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'The weather is sunny and 72°F.',
      });
    });

    it('should handle API errors', async () => {
      const apiError = new Anthropic.APIError(
        401,
        { error: { type: 'authentication_error', message: 'Invalid API key' } },
        'Invalid API key',
        {}
      );
      // Auto-mock leaves these unset; production reads error.status / error.message
      Object.assign(apiError, { status: 401, message: 'Invalid API key' });

      mockClient.messages.create.mockRejectedValue(apiError);

      await expect(provider.complete(options)).rejects.toThrow(
        AnthropicAPIError
      );
      await expect(provider.complete(options)).rejects.toThrow(
        /Authentication failed/
      );
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Anthropic.APIError(
        429,
        { error: { type: 'rate_limit_error', message: 'Rate limit exceeded' } },
        'Rate limit exceeded',
        {}
      );
      Object.assign(rateLimitError, { status: 429, message: 'Rate limit exceeded' });

      mockClient.messages.create.mockRejectedValue(rateLimitError);

      await expect(provider.complete(options)).rejects.toThrow(
        AnthropicAPIError
      );
      await expect(provider.complete(options)).rejects.toThrow(
        /Rate limit exceeded/
      );
    });

    it('should handle 400 errors', async () => {
      const badRequestError = new Anthropic.APIError(
        400,
        { error: { type: 'invalid_request_error', message: 'Invalid request' } },
        'Invalid request',
        {}
      );
      Object.assign(badRequestError, { status: 400, message: 'Invalid request' });

      mockClient.messages.create.mockRejectedValue(badRequestError);

      await expect(provider.complete(options)).rejects.toThrow(
        /Bad request/
      );
    });

    it('should handle 500 errors', async () => {
      const serverError = new Anthropic.APIError(
        500,
        { error: { type: 'server_error', message: 'Server error' } },
        'Server error',
        {}
      );
      Object.assign(serverError, { status: 500, message: 'Server error' });

      mockClient.messages.create.mockRejectedValue(serverError);

      await expect(provider.complete(options)).rejects.toThrow(
        /Server error/
      );
    });

    it('should handle generic errors', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Network error'));

      await expect(provider.complete(options)).rejects.toThrow(
        /Unexpected error/
      );
    });

    it('should calculate token usage correctly', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 123, output_tokens: 456 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.complete(options);

      expect(result.usage).toEqual({
        input_tokens: 123,
        output_tokens: 456,
        total_tokens: 579,
      });
    });
  });

  describe('streamComplete', () => {
    const options: CompletionOptions = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hello!' }],
      max_tokens: 1024,
      stream: true,
    };

    it('should stream completion successfully', async () => {
      const mockEvents: MessageStreamEvent[] = [
        {
          type: 'message_start',
          message: {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            model: 'claude-3-5-sonnet-20241022',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 0 },
          },
        },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: '!' },
        },
        {
          type: 'content_block_stop',
          index: 0,
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 5 },
        },
        {
          type: 'message_stop',
        },
      ];

      // Create async generator
      async function* mockAsyncGenerator() {
        for (const event of mockEvents) {
          yield event;
        }
      }

      mockClient.messages.stream.mockReturnValue(mockAsyncGenerator());

      const deltas: unknown[] = [];
      let finalResponse;

      for await (const delta of provider.streamComplete(options)) {
        deltas.push(delta);
        finalResponse = delta;
      }

      // Verify deltas were yielded correctly
      expect(deltas.length).toBeGreaterThan(0);
      expect(deltas[0]).toHaveProperty('type');
    });

    it('should handle streaming errors', async () => {
      const error = new Error('Stream error');

      async function* mockErrorGenerator() {
        throw error;
      }

      mockClient.messages.stream.mockReturnValue(mockErrorGenerator());

      const generator = provider.streamComplete(options);
      await expect(async () => {
        for await (const _ of generator) {
          // Will throw
        }
      }).rejects.toThrow();
    });

    it('should validate streaming options', async () => {
      const invalidOptions = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [],
        max_tokens: 100,
      };

      await expect(async () => {
        for await (const _ of provider.streamComplete(invalidOptions)) {
          // Will throw during validation
        }
      }).rejects.toThrow(AnthropicValidationError);
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const mockResponse: Anthropic.Message = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 't' }],
        stop_reason: 'max_tokens',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.validateConfig();

      expect(result).toBe(true);
      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
    });

    it('should throw AnthropicConfigurationError for invalid API key', async () => {
      const authError = new Anthropic.APIError(
        401,
        { error: { type: 'authentication_error', message: 'Invalid API key' } },
        'Invalid API key',
        {}
      );
      Object.assign(authError, { status: 401, message: 'Invalid API key' });

      mockClient.messages.create.mockRejectedValue(authError);

      await expect(provider.validateConfig()).rejects.toThrow(
        AnthropicConfigurationError
      );
      await expect(provider.validateConfig()).rejects.toThrow(/Invalid API key/);
    });

    it('should throw AnthropicAPIError for other API errors', async () => {
      const serverError = new Anthropic.APIError(
        500,
        { error: { type: 'server_error', message: 'Internal error' } },
        'Internal error',
        {}
      );
      Object.assign(serverError, { status: 500, message: 'Internal error' });

      mockClient.messages.create.mockRejectedValue(serverError);

      await expect(provider.validateConfig()).rejects.toThrow(
        AnthropicAPIError
      );
      await expect(provider.validateConfig()).rejects.toThrow(/API validation failed/);
    });
  });

  describe('utility methods', () => {
    it('should return the underlying client', () => {
      const client = provider.getClient();
      expect(client).toBe(mockClient);
    });

    it('should update API key', () => {
      const newApiKey = 'sk-ant-new-key-12345678901234567890';
      provider.updateApiKey(newApiKey);
      expect(provider.config.apiKey).toBe(newApiKey);
    });

    it('should throw error for empty API key update', () => {
      expect(() => provider.updateApiKey('')).toThrow(
        AnthropicConfigurationError
      );
    });

    it('should update tenant ID', () => {
      provider.updateTenantId('new-tenant');
      expect(provider.config.tenantId).toBe('new-tenant');
    });

    it('should throw error for empty tenant ID', () => {
      expect(() => provider.updateTenantId('')).toThrow(
        AnthropicValidationError
      );
    });

    it('should update agent role', () => {
      provider.updateAgentRole(AgentRole.BUILDER);
      expect(provider.config.agentRole).toBe(AgentRole.BUILDER);
    });

    it('should throw error for invalid agent role', () => {
      expect(() => provider.updateAgentRole('INVALID_ROLE' as AgentRole)).toThrow(
        AnthropicValidationError
      );
    });
  });

  describe('error types', () => {
    it('should create AnthropicProviderError with correct properties', () => {
      const error = new AnthropicAPIError('Test error', 404);
      expect(error.name).toBe('AnthropicAPIError');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Test error');
    });

    it('should create AnthropicConfigurationError', () => {
      const error = new AnthropicConfigurationError('Config error');
      expect(error.name).toBe('AnthropicConfigurationError');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });

    it('should create AnthropicValidationError', () => {
      const error = new AnthropicValidationError('Validation error');
      expect(error.name).toBe('AnthropicValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });
});
