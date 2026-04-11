import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaProvider,
  OllamaError,
  OllamaTimeoutError,
  OllamaConnectionError,
  SSEParser,
} from './ollama';
import { CompletionOptions, ProviderConfig } from '../types';
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
  let config: ProviderConfig;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      type: 'ollama',
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
      const p = new OllamaProvider({ type: 'ollama' });
      expect(p.config.baseUrl).toBe('http://localhost:11434');
    });

    it('should use custom baseUrl if provided', () => {
      const p = new OllamaProvider({
        type: 'ollama',
        baseUrl: 'http://custom:8080',
      });
      expect(p.config.baseUrl).toBe('http://custom:8080');
    });

    it('should use default timeout if not provided', () => {
      const p = new OllamaProvider({ type: 'ollama' });
      expect(p.config.timeout).toBe(30000);
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
      fetchMock.mockImplementationOnce(() => {
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

  describe('complete', () => {
    const options: CompletionOptions = {
      model: 'llama2',
      messages: [{ role: 'user', content: 'Hello' }],
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
            finish_reason: 'stop',
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
      });

      const result = await provider.complete(options);

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Hi there!',
      });
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(5);
    });

    it('should handle function calls in response', async () => {
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
              content: null,
              function_call: {
                name: 'test_function',
                arguments: '{"arg": "value"}',
              },
            },
            finish_reason: 'function_call',
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
      });

      const result = await provider.complete(options);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('tool_use');
      if (result.content[0].type === 'tool_use') {
        expect(result.content[0].name).toBe('test_function');
        expect(result.content[0].input).toEqual({ arg: 'value' });
      }
    });

    it('should throw OllamaError on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(provider.complete(options)).rejects.toThrow(OllamaError);
    });

    it('should throw OllamaTimeoutError on timeout', async () => {
      fetchMock.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(provider.complete(options)).rejects.toThrow(
        OllamaTimeoutError
      );
    });

    it('should include system message in request', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.complete({
        ...options,
        system: 'You are a helpful assistant',
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
    });

    it('should convert tools to functions', async () => {
      const mockResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.complete({
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
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.functions).toHaveLength(1);
      expect(requestBody.functions[0]).toEqual({
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        },
      });
    });
  });

  describe('streamComplete', () => {
    const options: CompletionOptions = {
      model: 'llama2',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    };

    it('should handle streaming response', async () => {
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
      });

      const deltas = [];
      let finalResponse;

      for await (const delta of provider.streamComplete(options)) {
        if (typeof delta === 'object' && 'id' in delta) {
          finalResponse = delta;
        } else {
          deltas.push(delta);
        }
      }

      expect(deltas.length).toBeGreaterThan(0);
      expect(deltas[0]).toHaveProperty('type');
      expect(finalResponse).toBeDefined();
    });

    it('should throw OllamaError on streaming API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      const generator = provider.streamComplete(options);

      await expect(generator.next()).rejects.toThrow(OllamaError);
    });

    it('should throw error when no response body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const generator = provider.streamComplete(options);

      await expect(generator.next()).rejects.toThrow('No response body');
    });
  });

  describe('tool format conversion', () => {
    it('should convert Claude tool format to OpenAI function format', () => {
      const tool = {
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
      };

      // Access private method through any
      const func = (provider as any).claudeToolToOpenAIFunction(tool);

      expect(func).toEqual({
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
