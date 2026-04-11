import {
  LLMProvider,
  LLMConfig,
  Message,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  AgentRole,
  LLMErrorType,
} from '../types';
import { tokenUsageTracker, LLMProvider as LLMProviderEnum } from '../usage-tracker';

/**
 * SSE (Server-Sent Events) parser for streaming responses
 */
export class SSEParser {
  private buffer = '';
  private decoder = new TextDecoder();

  /**
   * Parse incoming data chunks and yield complete SSE events
   */
  *parse(chunk: Uint8Array): Generator<SSEEvent, void, undefined> {
    // Decode chunk and add to buffer
    this.buffer += this.decoder.decode(chunk, { stream: true });

    // Split by newlines
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    // Parse complete lines
    let currentEvent: Partial<SSEEvent> = {};

    for (const line of lines) {
      if (line.trim() === '') {
        // Empty line signals end of event
        if (currentEvent.data !== undefined) {
          yield currentEvent as SSEEvent;
          currentEvent = {};
        }
        continue;
      }

      if (line.startsWith(':')) {
        // Comment line, ignore
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        // Malformed line, skip
        continue;
      }

      const field = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (field === 'data') {
        currentEvent.data = value;
      } else if (field === 'event') {
        currentEvent.event = value;
      } else if (field === 'id') {
        currentEvent.id = value;
      } else if (field === 'retry') {
        currentEvent.retry = parseInt(value, 10);
      }
    }
  }

  /**
   * Flush any remaining data in the buffer
   */
  *flush(): Generator<SSEEvent, void, undefined> {
    if (this.buffer.trim()) {
      const currentEvent: Partial<SSEEvent> = {};
      if (this.buffer.startsWith('data:')) {
        currentEvent.data = this.buffer.substring(5).trim();
        yield currentEvent as SSEEvent;
      }
    }
    this.buffer = '';
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = '';
  }
}

/**
 * SSE Event structure
 */
export interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 * OpenAI-compatible chat completion request
 */
interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * OpenAI message format
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

/**
 * OpenAI tool definition (equivalent to ToolDef)
 */
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * OpenAI chat completion response
 */
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
}

/**
 * Ollama-specific error class
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public type: LLMErrorType,
    public statusCode?: number,
    public providerCode?: string,
    public originalError?: unknown,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

/**
 * Connection timeout error
 */
export class OllamaTimeoutError extends OllamaError {
  constructor(message: string) {
    super(message, LLMErrorType.TIMEOUT, undefined, undefined, undefined, true);
    this.name = 'OllamaTimeoutError';
  }
}

/**
 * Connection error
 */
export class OllamaConnectionError extends OllamaError {
  constructor(message: string, originalError?: unknown) {
    super(message, LLMErrorType.NETWORK_ERROR, undefined, undefined, originalError, true);
    this.name = 'OllamaConnectionError';
  }
}

/**
 * Ollama LLM Provider implementation
 *
 * Implements the LLMProvider interface for Ollama, using its OpenAI-compatible
 * /v1/chat/completions endpoint. Supports both streaming and non-streaming modes,
 * tool calling via function translation, and proper error handling.
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly defaultModel: string;
  private config: LLMConfig;
  private baseUrl: string;
  private timeout: number;
  private tenantId: string;
  private agentRole: AgentRole;

  constructor(
    config: LLMConfig,
    options?: {
      tenantId?: string;
      agentRole?: AgentRole;
    }
  ) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:11434',
      timeout: config.timeout || 30000,
    };
    this.baseUrl = this.config.baseUrl!;
    this.timeout = this.config.timeout!;
    this.defaultModel = config.model || 'llama2';
    this.tenantId = options?.tenantId || 'default';
    this.agentRole = options?.agentRole || AgentRole.SUPERVISOR;
  }

  /**
   * Validate that the Ollama server is accessible
   */
  async validateConfig(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OllamaTimeoutError(
          `Timeout connecting to Ollama at ${this.baseUrl}`
        );
      }
      throw new OllamaConnectionError(
        `Cannot connect to Ollama at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Send a chat completion request
   * @param messages - Array of conversation messages
   * @param options - Optional configuration for the request
   * @returns Promise resolving to the chat response or async generator for streaming
   */
  async chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse | AsyncGenerator<StreamChunk, void, unknown>> {
    const isStreaming = options?.stream ?? false;

    if (isStreaming) {
      return this.streamChat(messages, options);
    } else {
      return this.completeChat(messages, options);
    }
  }

  /**
   * Create a non-streaming completion
   */
  private async completeChat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const request = this.buildOpenAIRequest(messages, options, false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new OllamaError(
          `Ollama API error: ${errorText}`,
          LLMErrorType.SERVICE_UNAVAILABLE,
          response.status,
          undefined,
          undefined,
          response.status >= 500
        );
      }

      const data = await response.json() as OpenAIChatResponse;
      const result = this.parseOpenAIResponse(data);

      // Track token usage
      this.emitUsageEvent(
        result.usage.prompt_tokens,
        result.usage.completion_tokens,
        options?.model || this.defaultModel,
        options?.stream ?? false,
        (options?.tools?.length ?? 0) > 0
      );

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OllamaTimeoutError(
          `Request timeout after ${this.timeout}ms`
        );
      }
      if (error instanceof OllamaError) {
        throw error;
      }
      throw new OllamaConnectionError(
        `Failed to complete request: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Create a streaming completion
   */
  private async *streamChat(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const request = this.buildOpenAIRequest(messages, options, true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(
        `${this.baseUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new OllamaError(
          `Ollama API error: ${errorText}`,
          LLMErrorType.SERVICE_UNAVAILABLE,
          response.status,
          undefined,
          undefined,
          response.status >= 500
        );
      }

      if (!response.body) {
        throw new OllamaError(
          'No response body received',
          LLMErrorType.UNKNOWN,
          undefined,
          undefined,
          undefined,
          false
        );
      }

      // Parse streaming response
      const parser = new SSEParser();
      const reader = response.body.getReader();

      // Accumulate usage data
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Flush any remaining data
            for (const event of parser.flush()) {
              const chunk = this.processStreamEvent(event);
              if (chunk) {
                if (chunk.usage) {
                  totalPromptTokens = chunk.usage.prompt_tokens;
                  totalCompletionTokens = chunk.usage.completion_tokens;
                }
                yield chunk;
              }
            }
            break;
          }

          // Parse SSE events from chunk
          for (const event of parser.parse(value)) {
            const chunk = this.processStreamEvent(event);
            if (chunk) {
              if (chunk.usage) {
                totalPromptTokens = chunk.usage.prompt_tokens;
                totalCompletionTokens = chunk.usage.completion_tokens;
              }
              yield chunk;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Track token usage
      if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
        this.emitUsageEvent(
          totalPromptTokens,
          totalCompletionTokens,
          options?.model || this.defaultModel,
          true,
          (options?.tools?.length ?? 0) > 0
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OllamaTimeoutError(
          `Stream timeout after ${this.timeout}ms`
        );
      }
      if (error instanceof OllamaError) {
        throw error;
      }
      throw new OllamaConnectionError(
        `Failed to stream completion: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Process a single SSE event and return a StreamChunk
   */
  private processStreamEvent(event: SSEEvent): StreamChunk | null {
    if (event.data === '[DONE]') {
      return null;
    }

    try {
      const chunk: OpenAIStreamChunk = JSON.parse(event.data);
      const choice = chunk.choices[0];

      if (!choice) {
        return null;
      }

      const streamChunk: StreamChunk = {
        delta: {},
        finish_reason: choice.finish_reason,
      };

      if (choice.delta.role) {
        streamChunk.delta.role = choice.delta.role;
      }

      if (choice.delta.content) {
        streamChunk.delta.content = choice.delta.content;
      }

      if (choice.delta.tool_calls) {
        streamChunk.delta.tool_calls = choice.delta.tool_calls.map((tc) => ({
          index: tc.index,
          id: tc.id,
          type: tc.type,
          function: tc.function,
        }));
      }

      return streamChunk;
    } catch (error) {
      // Skip malformed JSON
      console.warn('Failed to parse SSE event:', error);
      return null;
    }
  }

  /**
   * Build OpenAI-compatible request from messages and options
   */
  private buildOpenAIRequest(
    messages: Message[],
    options: ChatOptions | undefined,
    stream: boolean
  ): OpenAIChatRequest {
    const openAIMessages: OpenAIMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_calls: msg.tool_calls,
      tool_call_id: msg.tool_call_id,
    }));

    const request: OpenAIChatRequest = {
      model: options?.model || this.defaultModel,
      messages: openAIMessages,
      stream,
    };

    if (options?.max_tokens) {
      request.max_tokens = options.max_tokens;
    }

    if (options?.temperature !== undefined) {
      request.temperature = options.temperature;
    }

    if (options?.top_p !== undefined) {
      request.top_p = options.top_p;
    }

    if (options?.stop) {
      request.stop = options.stop;
    }

    // Convert tools to OpenAI format
    if (options?.tools?.length) {
      request.tools = options.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));

      if (options.tool_choice) {
        request.tool_choice = options.tool_choice;
      }
    }

    return request;
  }

  /**
   * Parse OpenAI response to ChatResponse format
   */
  private parseOpenAIResponse(
    response: OpenAIChatResponse
  ): ChatResponse {
    const choice = response.choices[0];

    const message: Message = {
      role: 'assistant',
      content: choice.message.content || '',
      tool_calls: choice.message.tool_calls,
    };

    return {
      message,
      finish_reason: choice.finish_reason,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Emit token usage event for tracking
   */
  private emitUsageEvent(
    promptTokens: number,
    completionTokens: number,
    model: string,
    isStreaming: boolean,
    toolsUsed: boolean
  ): void {
    tokenUsageTracker.trackUsage({
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      model,
      provider: LLMProviderEnum.OLLAMA,
      agentRole: this.agentRole,
      tenantId: this.tenantId,
      metadata: {
        isStreaming,
        toolsUsed,
      },
    });
  }
}
