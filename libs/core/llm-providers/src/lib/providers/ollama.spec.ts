import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaProvider,
  OllamaError,
  OllamaTimeoutError,
  OllamaConnectionError,
  SSEParser,
} from './ollama';
import {
  ChatOptions,
  LLMConfig,
  LLMErrorType,
  Message,
  ChatResponse,
  StreamChunk,
} from '../types';
import { AgentRole } from '../usage-tracker';

describe('SSEParser', () => {
  let parser: SSEParser;

  beforeEach(() => {
    parser = new SSEParser();
  });

  it('should parse simple SSE event', () => {
    const chunk = new TextEncoder().encode('data: {"test": "value"}\n\n');
    const events = Array.from(parser.parse(chunk));

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('{"test": "value"}');
  });

  it('should parse multiple events', () => {
    const chunk = new TextEncoder().encode(
      'data: event1\n\ndata: event2\n\n'
    );
    const events = Array.from(parser.parse(chunk));

    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('event1');
    expect(events[1].data).toBe('event2');
  });

  it('should handle partial events', () => {
    const chunk1 = new TextEncoder().encode('data: partial');
    const chunk2 = new TextEncoder().encode(' event\n\n');

    const events1 = Array.from(parser.parse(chunk1));
    expect(events1).toHaveLength(0);

    const events2 = Array.from(parser.parse(chunk2));
    expect(events2).toHaveLength(1);
    expect(events2[0].data).toBe('partial event');
  });

  it('should ignore comment lines', () => {
    const chunk = new TextEncoder().encode(
      ': this is a comment\ndata: real data\n\n'
    );
    const events = Array.from(parser.parse(chunk));

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('real data');
  });

  it('should parse event fields', () => {
    const chunk = new TextEncoder().encode(
      'event: message\ndata: test\nid: 123\n\n'
    );
    const events = Array.from(parser.parse(chunk));

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('message');
    expect(events[0].data).toBe('test');
    expect(events[0].id).toBe('123');
  });

  it('should flush remaining data', () => {
    const chunk = new TextEncoder().encode('data: incomplete');
    Array.from(parser.parse(chunk));

    const events = Array.from(parser.flush());
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('incomplete');
  });

  it('should reset parser state', () => {
    const chunk = new TextEncoder().encode('data: test');
    Array.from(parser.parse(chunk));

    parser.reset();
    const events = Array.from(parser.flush());
    expect(events).toHaveLength(0);
  });
});

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  // OllamaProvider takes LLMConfig (provider/model based) at runtime; we cast to
  // any to match the historical 'type' shape some existing tests use.
  let config: any;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      type: 'ollama',
      provider: 'ollama',
      model: 'llama2',
      baseUrl: 'http://localhost:11434',
      timeout: 5000,
    };

    provider = new OllamaProvider(config, {
      tenantId: 'test-tenant',
      agentRole: AgentRole.CUSTOM,
    });

    // Mock fetch globally
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default baseUrl if not provided', () => {
      const p = new OllamaProvider({ type: 'ollama' } as any);
      expect((p as any).config.baseUrl).toBe('http://localhost:11434');
    });

    it('should use custom baseUrl if provided', () => {
      const p = new OllamaProvider({
        type: 'ollama',
        baseUrl: 'http://custom:8080',
      } as any);
      expect((p as any).config.baseUrl).toBe('http://custom:8080');
    });

    it('should use default timeout if not provided', () => {
      const p = new OllamaProvider({ type: 'ollama' } as any);
      expect((p as any).config.timeout).toBe(30000);
    });
  });

  describe('validateConfig', () => {
    it('should return true when Ollama is accessible', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
      });

      const result = await provider.validateConfig();
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.any(Object)
      );
    });

    it('should throw OllamaTimeoutError on timeout', async () => {
      fetchMock.mockImplementationOnce(function () {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(provider.validateConfig()).rejects.toThrow(
        OllamaTimeoutError
      );
    });

    it('should throw OllamaConnectionError on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.validateConfig()).rejects.toThrow(
        OllamaConnectionError
      );
    });
  });

  // OllamaProvider exposes a `chat(messages, options)` API (LLMProvider interface),
  // returning ChatResponse for non-streaming and AsyncGenerator<StreamChunk> for streaming.
  describe('chat (non-streaming)', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const options: ChatOptions = {
      model: 'llama2',
      max_tokens: 100,
    };

    it('should make non-streaming completion request', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hi there!',
            },
            finish_reason: 'stop' as const,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => '',
      });

      const result = (await provider.chat(messages, options)) as ChatResponse;

      expect(result.message.content).toBe('Hi there!');
      expect(result.message.role).toBe('assistant');
      expect(result.finish_reason).toBe('stop');
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(5);
      expect(result.usage.total_tokens).toBe(15);
    });

    it('should propagate tool_calls from response', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function' as const,
                  function: {
                    name: 'test_function',
                    arguments: '{"arg": "value"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls' as const,
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => '',
      });

      const result = (await provider.chat(messages, options)) as ChatResponse;

      expect(result.message.tool_calls).toHaveLength(1);
      expect(result.message.tool_calls?.[0].function.name).toBe('test_function');
      expect(result.finish_reason).toBe('tool_calls');
    });

    it('should throw OllamaError on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(provider.chat(messages, options)).rejects.toThrow(OllamaError);
    });

    it('should throw OllamaTimeoutError on timeout', async () => {
      fetchMock.mockImplementationOnce(function () {
        const err = new Error('Timeout');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      await expect(provider.chat(messages, options)).rejects.toThrow(
        OllamaTimeoutError
      );
    });

    it('should send user messages in OpenAI request shape', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: 'Response' },
            finish_reason: 'stop' as const,
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => '',
      });

      const systemMessages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];
      await provider.chat(systemMessages, options);

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      // JSON serialization drops undefined fields, so only role/content remain.
      expect(requestBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
      expect(requestBody.messages[1].role).toBe('user');
      expect(requestBody.model).toBe('llama2');
      expect(requestBody.stream).toBe(false);
    });

    it('should serialize tools (ToolDef) into OpenAI tools field', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: 'Response' },
            finish_reason: 'stop' as const,
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => '',
      });

      await provider.chat(messages, {
        ...options,
        tools: [
          {
            type: 'function',
            function: {
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
          },
        ],
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0]).toEqual({
        type: 'function',
        function: {
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
      });
    });
  });

  describe('chat (streaming)', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const options: ChatOptions = {
      model: 'llama2',
      max_tokens: 100,
      stream: true,
    };

    it('should yield StreamChunk values for streaming response', async () => {
      const streamData = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama2","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama2","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama2","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1234567890,"model":"llama2","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const data of streamData) {
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        },
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: stream,
        text: async () => '',
      });

      const generator = (await provider.chat(
        messages,
        options
      )) as AsyncGenerator<StreamChunk, void, unknown>;

      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      // First chunk should announce the assistant role.
      expect(chunks[0].delta.role).toBe('assistant');
      // Some intermediate chunk should carry content text.
      expect(chunks.some((c) => c.delta.content === 'Hello')).toBe(true);
      // Final chunk should carry the stop finish_reason.
      expect(chunks[chunks.length - 1].finish_reason).toBe('stop');
    });

    it('should throw OllamaError on streaming API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      const generator = (await provider.chat(
        messages,
        options
      )) as AsyncGenerator<StreamChunk, void, unknown>;

      await expect(generator.next()).rejects.toThrow(OllamaError);
    });

    it('should throw error when no response body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: null,
        text: async () => '',
      });

      const generator = (await provider.chat(
        messages,
        options
      )) as AsyncGenerator<StreamChunk, void, unknown>;

      await expect(generator.next()).rejects.toThrow('No response body');
    });
  });

  describe('tool format conversion', () => {
    it('should serialize ToolDef arguments faithfully through buildOpenAIRequest', () => {
      // OllamaProvider.buildOpenAIRequest is private; reach it via cast for unit test.
      const tool = {
        type: 'function' as const,
        function: {
          name: 'calculate',
          description: 'Perform calculation',
          parameters: {
            type: 'object' as const,
            properties: {
              expression: {
                type: 'string',
                description: 'Math expression',
              },
            },
            required: ['expression'],
          },
        },
      };

      const request = (provider as any).buildOpenAIRequest(
        [{ role: 'user', content: 'Hi' }],
        { model: 'llama2', tools: [tool] },
        false
      );

      expect(request.tools).toHaveLength(1);
      expect(request.tools[0]).toEqual({
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Perform calculation',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Math expression',
              },
            },
            required: ['expression'],
          },
        },
      });
    });
  });

  describe('error handling', () => {
    it('should create OllamaError with type and status', () => {
      const error = new OllamaError('Test error', LLMErrorType.INTERNAL_ERROR, 500);
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(LLMErrorType.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('OllamaError');
    });

    it('should create OllamaTimeoutError', () => {
      const error = new OllamaTimeoutError('Timeout occurred');
      expect(error.message).toBe('Timeout occurred');
      expect(error.type).toBe(LLMErrorType.TIMEOUT);
      expect(error.name).toBe('OllamaTimeoutError');
    });

    it('should create OllamaConnectionError', () => {
      const error = new OllamaConnectionError('Connection failed');
      expect(error.message).toBe('Connection failed');
      expect(error.type).toBe(LLMErrorType.NETWORK_ERROR);
      expect(error.name).toBe('OllamaConnectionError');
    });
  });
});
