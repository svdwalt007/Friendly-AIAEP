import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  MessageStreamEvent,
  Tool as AnthropicTool,
} from '@anthropic-ai/sdk/resources/messages';
import type {
  LLMProviderInterface,
  ProviderConfig,
  CompletionOptions,
  CompletionResponse,
  StreamDelta,
  ContentBlock,
  TokenUsage,
  Tool,
} from '../types';
import {
  LLMProvider as ProviderEnum,
  AgentRole,
  trackTokenUsage,
} from '../usage-tracker';

/**
 * Custom error types for better error handling
 */
export class AnthropicProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AnthropicProviderError';
  }
}

export class AnthropicConfigurationError extends AnthropicProviderError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'CONFIGURATION_ERROR', undefined, originalError);
    this.name = 'AnthropicConfigurationError';
  }
}

export class AnthropicAPIError extends AnthropicProviderError {
  constructor(message: string, statusCode?: number, originalError?: unknown) {
    super(message, 'API_ERROR', statusCode, originalError);
    this.name = 'AnthropicAPIError';
  }
}

export class AnthropicValidationError extends AnthropicProviderError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'VALIDATION_ERROR', undefined, originalError);
    this.name = 'AnthropicValidationError';
  }
}

export class AnthropicStreamError extends AnthropicProviderError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'STREAM_ERROR', undefined, originalError);
    this.name = 'AnthropicStreamError';
  }
}

/**
 * Anthropic-specific configuration options
 */
export interface AnthropicProviderConfig extends ProviderConfig {
  type: 'anthropic';
  apiKey: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  tenantId?: string;
  agentRole?: AgentRole;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  defaultModel: 'claude-3-5-sonnet-20241022',
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  agentRole: AgentRole.CUSTOM,
} as const;

/**
 * Anthropic Claude provider implementation with comprehensive error handling
 */
export class AnthropicProvider implements LLMProviderInterface {
  readonly type = 'anthropic' as const;
  readonly config: AnthropicProviderConfig;
  private client: Anthropic;

  constructor(config: AnthropicProviderConfig) {
    this.validateConstructorConfig(config);
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.client = this.createClient();
  }

  /**
   * Validate configuration during construction
   */
  private validateConstructorConfig(config: AnthropicProviderConfig): void {
    if (!config) {
      throw new AnthropicConfigurationError('Configuration is required');
    }

    if (config.type !== 'anthropic') {
      throw new AnthropicConfigurationError(
        `Invalid provider type: ${config.type}. Expected 'anthropic'`
      );
    }

    if (!config.apiKey) {
      throw new AnthropicConfigurationError(
        'API key is required. Please provide config.apiKey'
      );
    }

    if (typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new AnthropicConfigurationError(
        'API key must be a non-empty string'
      );
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      throw new AnthropicConfigurationError('Timeout must be positive');
    }

    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new AnthropicConfigurationError(
        'Max retries must be non-negative'
      );
    }
  }

  /**
   * Create Anthropic client instance
   */
  private createClient(): Anthropic {
    try {
      return new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      });
    } catch (error) {
      throw new AnthropicConfigurationError(
        'Failed to create Anthropic client',
        error
      );
    }
  }

  /**
   * Validate completion options
   */
  private validateCompletionOptions(options: CompletionOptions): void {
    if (!options) {
      throw new AnthropicValidationError('Completion options are required');
    }

    if (!options.model) {
      throw new AnthropicValidationError('Model is required');
    }

    if (!options.messages || !Array.isArray(options.messages)) {
      throw new AnthropicValidationError(
        'Messages must be a non-empty array'
      );
    }

    if (options.messages.length === 0) {
      throw new AnthropicValidationError('At least one message is required');
    }

    if (options.max_tokens === undefined || options.max_tokens <= 0) {
      throw new AnthropicValidationError('max_tokens must be positive');
    }

    if (options.temperature !== undefined) {
      if (options.temperature < 0 || options.temperature > 1) {
        throw new AnthropicValidationError(
          'Temperature must be between 0 and 1'
        );
      }
    }

    if (options.top_p !== undefined) {
      if (options.top_p < 0 || options.top_p > 1) {
        throw new AnthropicValidationError('top_p must be between 0 and 1');
      }
    }

    if (options.top_k !== undefined && options.top_k < 0) {
      throw new AnthropicValidationError('top_k must be non-negative');
    }
  }

  /**
   * Convert our Tool format to Anthropic's format
   */
  private convertTools(tools?: Tool[]): AnthropicTool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        ...tool.parameters,
        type: 'object' as const,
      },
    })) as AnthropicTool[];
  }


  /**
   * Create a non-streaming completion
   */
  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    this.validateCompletionOptions(options);

    try {
      const params: MessageCreateParamsNonStreaming = {
        model: options.model,
        max_tokens: options.max_tokens,
        messages: this.convertMessages(options.messages),
        system: options.system,
        temperature: options.temperature,
        top_p: options.top_p,
        top_k: options.top_k,
        tools: this.convertTools(options.tools),
        stop_sequences: options.stop_sequences,
        stream: false,
      };

      const response = await this.client.messages.create(params);

      // Track token usage
      if (this.config.tenantId) {
        trackTokenUsage({
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          model: options.model,
          provider: ProviderEnum.ANTHROPIC,
          agentRole: this.config.agentRole || DEFAULT_CONFIG.agentRole,
          tenantId: this.config.tenantId,
        });
      }

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a streaming completion
   */
  async *streamComplete(
    options: CompletionOptions
  ): AsyncGenerator<StreamDelta, CompletionResponse, undefined> {
    this.validateCompletionOptions(options);

    let accumulatedInputTokens = 0;
    let accumulatedOutputTokens = 0;
    let messageId = '';
    let model = options.model;
    let role: 'user' | 'assistant' | 'system' = 'assistant';
    let stopReason: string | null = null;
    let stopSequence: string | null = null;
    const contentBlocks: ContentBlock[] = [];

    try {
      const params: MessageCreateParamsStreaming = {
        model: options.model,
        max_tokens: options.max_tokens,
        messages: this.convertMessages(options.messages),
        system: options.system,
        temperature: options.temperature,
        top_p: options.top_p,
        top_k: options.top_k,
        tools: this.convertTools(options.tools),
        stop_sequences: options.stop_sequences,
        stream: true,
      };

      const stream = this.client.messages.stream(params);

      for await (const event of stream) {
        try {
          const delta = this.handleStreamEvent(
            event,
            contentBlocks,
            (tokens) => {
              accumulatedInputTokens += tokens.input_tokens || 0;
              accumulatedOutputTokens += tokens.output_tokens || 0;
            }
          );

          if (delta) {
            // Capture message metadata
            if (delta.type === 'message_start' && 'message' in delta) {
              messageId = delta.message.id;
              model = delta.message.model;
              role = delta.message.role as 'assistant';
            }

            // Capture stop reason
            if (delta.type === 'message_delta' && 'delta' in delta) {
              if (delta.delta.stop_reason) {
                stopReason = delta.delta.stop_reason;
              }
              if (delta.delta.stop_sequence) {
                stopSequence = delta.delta.stop_sequence;
              }
            }

            yield delta;
          }
        } catch (error) {
          throw new AnthropicStreamError(
            'Error processing stream event',
            error
          );
        }
      }

      // Track token usage for the entire stream
      if (this.config.tenantId) {
        trackTokenUsage({
          inputTokens: accumulatedInputTokens,
          outputTokens: accumulatedOutputTokens,
          model: options.model,
          provider: ProviderEnum.ANTHROPIC,
          agentRole: this.config.agentRole || DEFAULT_CONFIG.agentRole,
          tenantId: this.config.tenantId,
        });
      }

      // Return final completion response
      return {
        id: messageId,
        model,
        role,
        content: contentBlocks,
        stop_reason: stopReason,
        stop_sequence: stopSequence,
        usage: {
          input_tokens: accumulatedInputTokens,
          output_tokens: accumulatedOutputTokens,
          total_tokens: accumulatedInputTokens + accumulatedOutputTokens,
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle individual stream events
   */
  private handleStreamEvent(
    event: MessageStreamEvent,
    contentBlocks: ContentBlock[],
    onUsage: (usage: Partial<TokenUsage>) => void
  ): StreamDelta | null {
    switch (event.type) {
      case 'message_start':
        if (event.message.usage) {
          onUsage({
            input_tokens: event.message.usage.input_tokens,
            output_tokens: event.message.usage.output_tokens,
          });
        }
        return {
          type: 'message_start',
          message: {
            id: event.message.id,
            role: event.message.role,
            model: event.message.model,
          },
        };

      case 'content_block_start':
        if (event.content_block.type === 'text') {
          const textBlock: ContentBlock = {
            type: 'text',
            text: '',
          };
          contentBlocks[event.index] = textBlock;
          return {
            type: 'content_block_start',
            index: event.index,
            content_block: textBlock,
          };
        } else if (event.content_block.type === 'tool_use') {
          const toolBlock: ContentBlock = {
            type: 'tool_use',
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          };
          contentBlocks[event.index] = toolBlock;
          return {
            type: 'content_block_start',
            index: event.index,
            content_block: toolBlock,
          };
        }
        return null;

      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          const block = contentBlocks[event.index];
          if (block && block.type === 'text') {
            block.text += event.delta.text;
          }
          return {
            type: 'content_block_delta',
            index: event.index,
            delta: {
              type: 'text_delta',
              text: event.delta.text,
            },
          };
        } else if (event.delta.type === 'input_json_delta') {
          const block = contentBlocks[event.index];
          if (block && block.type === 'tool_use') {
            try {
              // Accumulate JSON and parse when complete
              const partialJson = event.delta.partial_json;
              // Attempt to parse incrementally (this is a simplified approach)
              // In production, you'd use a streaming JSON parser
              Object.assign(block.input, JSON.parse(partialJson));
            } catch {
              // Ignore parse errors during streaming
            }
          }
          return {
            type: 'content_block_delta',
            index: event.index,
            delta: {
              type: 'tool_use_delta',
              partial_json: event.delta.partial_json,
            },
          };
        }
        return null;

      case 'content_block_stop':
        return {
          type: 'content_block_stop',
          index: event.index,
        };

      case 'message_delta':
        if (event.usage) {
          onUsage({
            output_tokens: event.usage.output_tokens,
          });
        }
        return {
          type: 'message_delta',
          delta: {
            stop_reason: event.delta.stop_reason || undefined,
            stop_sequence: event.delta.stop_sequence || undefined,
          },
          usage: event.usage
            ? {
                input_tokens: 0,
                output_tokens: event.usage.output_tokens,
                total_tokens: event.usage.output_tokens,
              }
            : undefined,
        };

      case 'message_stop':
        return {
          type: 'message_stop',
        };

      default:
        // Ignore unknown event types
        return null;
    }
  }

  /**
   * Validate provider configuration
   */
  async validateConfig(): Promise<boolean> {
    try {
      // Attempt a minimal API call to validate credentials
      await this.client.messages.create({
        model: this.config.defaultModel || DEFAULT_CONFIG.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        if (error.status === 401) {
          throw new AnthropicConfigurationError('Invalid API key', error);
        }
        throw new AnthropicAPIError(
          `API validation failed: ${error.message}`,
          error.status,
          error
        );
      }
      throw new AnthropicConfigurationError(
        'Failed to validate configuration',
        error
      );
    }
  }

  /**
   * Convert our message format to Anthropic format
   */
  private convertMessages(
    messages: CompletionOptions['messages']
  ): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system') // System messages handled separately
      .map((message) => {
        if (typeof message.content === 'string') {
          return {
            role: message.role as 'user' | 'assistant',
            content: message.content,
          };
        }

        return {
          role: message.role as 'user' | 'assistant',
          content: message.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            } else if (block.type === 'tool_use') {
              return {
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: block.input,
              };
            } else if (block.type === 'tool_result') {
              return {
                type: 'tool_result',
                tool_use_id: block.tool_use_id,
                content: block.content,
                is_error: block.is_error,
              };
            }
            throw new Error(`Unknown content block type: ${(block as ContentBlock).type}`);
          }) as Anthropic.ContentBlock[],
        };
      });
  }

  /**
   * Convert Anthropic response to our format
   */
  private convertResponse(response: Anthropic.Message): CompletionResponse {
    const content: ContentBlock[] = response.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      } else if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      throw new Error(`Unknown content block type: ${(block as any).type}`);
    });

    const usage: TokenUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    return {
      id: response.id,
      model: response.model,
      role: response.role,
      content,
      stop_reason: response.stop_reason,
      stop_sequence: response.stop_sequence ?? null,
      usage,
    };
  }


  /**
   * Handle errors and convert to our error types
   */
  private handleError(error: unknown): Error {
    if (
      error instanceof AnthropicProviderError ||
      error instanceof AnthropicConfigurationError ||
      error instanceof AnthropicAPIError ||
      error instanceof AnthropicValidationError ||
      error instanceof AnthropicStreamError
    ) {
      return error;
    }

    if (error instanceof Anthropic.APIError) {
      const statusCode = error.status;
      let message = error.message;

      // Enhance error messages based on status code
      if (statusCode === 400) {
        message = `Bad request: ${message}`;
      } else if (statusCode === 401) {
        message = `Authentication failed: Invalid API key`;
      } else if (statusCode === 403) {
        message = `Access forbidden: ${message}`;
      } else if (statusCode === 404) {
        message = `Resource not found: ${message}`;
      } else if (statusCode === 429) {
        message = `Rate limit exceeded: ${message}`;
      } else if (statusCode && statusCode >= 500) {
        message = `Server error: ${message}`;
      }

      return new AnthropicAPIError(message, statusCode, error);
    }

    if (error instanceof Error) {
      return new AnthropicProviderError(
        `Unexpected error: ${error.message}`,
        'UNEXPECTED_ERROR',
        undefined,
        error
      );
    }

    return new AnthropicProviderError(
      'An unknown error occurred',
      'UNKNOWN_ERROR',
      undefined,
      error
    );
  }

  /**
   * Get the underlying Anthropic client (for advanced use cases)
   */
  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Update the API key (useful for tenant-switching scenarios)
   */
  updateApiKey(apiKey: string): void {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new AnthropicConfigurationError(
        'API key must be a non-empty string'
      );
    }

    this.config.apiKey = apiKey;
    this.client = this.createClient();
  }

  /**
   * Update tenant ID for usage tracking
   */
  updateTenantId(tenantId: string): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new AnthropicValidationError(
        'Tenant ID must be a non-empty string'
      );
    }
    this.config.tenantId = tenantId;
  }

  /**
   * Update agent role for usage tracking
   */
  updateAgentRole(agentRole: AgentRole): void {
    if (!Object.values(AgentRole).includes(agentRole)) {
      throw new AnthropicValidationError(`Invalid agent role: ${agentRole}`);
    }
    this.config.agentRole = agentRole;
  }
}
