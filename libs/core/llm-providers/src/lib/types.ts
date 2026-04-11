/**
 * @fileoverview TypeScript interfaces and types for LLM provider abstraction layer
 * @module @friendly-aiaep/llm-providers
 */

// Import AgentRole from usage-tracker to avoid duplication
import { AgentRole } from './usage-tracker';
export { AgentRole };

/**
 * Represents the role of a message in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Represents a tool call made by the LLM
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** The type of tool call (currently only 'function' is supported) */
  type: 'function';
  /** Function call details */
  function: {
    /** Name of the function to call */
    name: string;
    /** JSON string containing the function arguments */
    arguments: string;
  };
}

/**
 * Represents a single message in a conversation
 */
export interface Message {
  /** The role of the message sender */
  role: MessageRole;
  /** The content of the message */
  content: string;
  /** Optional name identifier for the message sender */
  name?: string;
  /** Optional tool calls made by the assistant */
  tool_calls?: ToolCall[];
  /** Optional tool call ID when role is 'tool' */
  tool_call_id?: string;
}

/**
 * Represents a parameter definition for a tool function
 */
export interface ToolParameter {
  /** The data type of the parameter */
  type: string;
  /** Description of what the parameter does */
  description?: string;
  /** Enum values if the parameter has a fixed set of options */
  enum?: string[];
  /** Properties for object-type parameters */
  properties?: Record<string, ToolParameter>;
  /** Required fields for object-type parameters */
  required?: string[];
  /** Items definition for array-type parameters */
  items?: ToolParameter;
}

/**
 * Represents a tool/function definition that can be called by the LLM
 */
export interface ToolDef {
  /** The type of tool (currently only 'function' is supported) */
  type: 'function';
  /** Function definition */
  function: {
    /** Name of the function */
    name: string;
    /** Description of what the function does */
    description: string;
    /** JSON Schema defining the function parameters */
    parameters: {
      /** Type should be 'object' for function parameters */
      type: 'object';
      /** Properties defining each parameter */
      properties: Record<string, ToolParameter>;
      /** Array of required parameter names */
      required?: string[];
      /** Whether additional properties are allowed */
      additionalProperties?: boolean;
    };
  };
}

/**
 * Represents a chunk of data from a streaming response
 */
export interface StreamChunk {
  /** The incremental content in this chunk */
  delta: {
    /** The role if this is the first chunk */
    role?: MessageRole;
    /** The incremental text content */
    content?: string;
    /** Tool calls being constructed */
    tool_calls?: Array<{
      /** Index of the tool call */
      index: number;
      /** Tool call ID */
      id?: string;
      /** Type of tool call */
      type?: 'function';
      /** Function details */
      function?: {
        /** Function name */
        name?: string;
        /** Incremental arguments */
        arguments?: string;
      };
    }>;
  };
  /** Reason for finishing the stream (if this is the last chunk) */
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  /** Usage information (typically in the last chunk) */
  usage?: {
    /** Number of tokens in the prompt */
    prompt_tokens: number;
    /** Number of tokens in the completion */
    completion_tokens: number;
    /** Total tokens used */
    total_tokens: number;
  };
}

/**
 * Response from a non-streaming LLM chat completion
 */
export interface ChatResponse {
  /** The generated message */
  message: Message;
  /** Reason for completion */
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  /** Token usage information */
  usage: {
    /** Number of tokens in the prompt */
    prompt_tokens: number;
    /** Number of tokens in the completion */
    completion_tokens: number;
    /** Total tokens used */
    total_tokens: number;
  };
}

/**
 * Options for chat completion requests
 */
export interface ChatOptions {
  /** Override the default model */
  model?: string;
  /** Sampling temperature (0-2, default ~0.7) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Tools/functions available for the LLM to call */
  tools?: ToolDef[];
  /** Control how the model uses tools */
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  /** Number between -2.0 and 2.0 for presence penalty */
  presence_penalty?: number;
  /** Number between -2.0 and 2.0 for frequency penalty */
  frequency_penalty?: number;
  /** Sequences where the API will stop generating */
  stop?: string | string[];
  /** Number of completions to generate */
  n?: number;
  /** Nucleus sampling parameter */
  top_p?: number;
  /** User identifier for tracking */
  user?: string;
}

/**
 * Main interface for LLM provider implementations
 */
export interface LLMProvider {
  /**
   * Send a chat completion request
   * @param messages - Array of conversation messages
   * @param options - Optional configuration for the request
   * @returns Promise resolving to the chat response or async generator for streaming
   */
  chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse | AsyncGenerator<StreamChunk, void, unknown>>;

  /**
   * Generate embeddings for text (optional feature)
   * @param input - Text or array of texts to embed
   * @param model - Optional model override for embeddings
   * @returns Promise resolving to array of embedding vectors
   */
  embed?(input: string | string[], model?: string): Promise<number[][]>;

  /**
   * Get the provider name
   */
  readonly name: string;

  /**
   * Get the default model used by this provider
   */
  readonly defaultModel: string;
}

/**
 * Configuration for initializing an LLM provider
 */
export interface LLMConfig {
  /** The provider to use */
  provider: ProviderType;
  /** The model to use (e.g., 'gpt-4', 'claude-3-opus-20240229') */
  model: string;
  /** Base URL for the API endpoint */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Default temperature for completions (0-2) */
  temperature?: number;
  /** Default maximum tokens to generate */
  maxTokens?: number;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Optional fallback provider */
  fallbackProvider?: ProviderType;
  /** Optional fallback model */
  fallbackModel?: string;
  /** Additional provider-specific options */
  extra?: Record<string, unknown>;
}

// AgentRole is now imported from usage-tracker (see top of file)

/**
 * Metadata about an agent role
 */
export interface AgentRoleInfo {
  /** The agent role */
  role: AgentRole;
  /** Human-readable name */
  name: string;
  /** Description of the agent's responsibilities */
  description: string;
  /** Typical models suitable for this role */
  suggestedModels?: string[];
}

/**
 * Token usage event for billing and audit purposes
 */
export interface TokenUsageEvent {
  /** Unique identifier for this usage event */
  eventId: string;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Tenant identifier */
  tenantId: string;
  /** Project identifier */
  projectId?: string;
  /** User identifier */
  userId?: string;
  /** Agent role that made the request */
  agentRole: AgentRole;
  /** LLM provider used */
  provider: string;
  /** Model used */
  model: string;
  /** Number of prompt tokens used */
  promptTokens: number;
  /** Number of completion tokens generated */
  completionTokens: number;
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
  /** Whether this was a streaming request */
  isStreaming: boolean;
  /** Whether tools/functions were used */
  toolsUsed: boolean;
  /** Estimated cost in USD (if available) */
  estimatedCost?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error types specific to LLM operations
 */
export enum LLMErrorType {
  /** Authentication failed */
  AUTH_ERROR = 'AUTH_ERROR',
  /** Rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Invalid request parameters */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** Model not found or not accessible */
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  /** Network or connection error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Timeout waiting for response */
  TIMEOUT = 'TIMEOUT',
  /** Content filtered by safety systems */
  CONTENT_FILTER = 'CONTENT_FILTER',
  /** Service unavailable or overloaded */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  /** Unknown or unexpected error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class for LLM operations
 */
export interface LLMError extends Error {
  /** The type of error */
  type: LLMErrorType;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Provider-specific error code */
  providerCode?: string;
  /** Original error from the provider */
  originalError?: unknown;
  /** Whether the operation can be retried */
  retryable: boolean;
}

// ============================================================================
// Additional Types for Backward Compatibility
// ============================================================================

/**
 * Supported LLM providers
 */
export type ProviderType = 'anthropic' | 'openai' | 'azure' | 'vertex' | 'ollama';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider type */
  type: ProviderType;
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for the API endpoint */
  baseUrl?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retries */
  maxRetries?: number;
}

/**
 * Tenant-specific LLM configuration
 */
export interface TenantLLMConfig {
  /** Tenant identifier */
  tenantId: string;
  /** Role-specific overrides */
  roleOverrides?: Partial<Record<AgentRole, Partial<LLMConfig>>>;
  /** Global tenant-level defaults */
  defaultConfig?: Partial<LLMConfig>;
  /** Whether this tenant has premium LLM access */
  premiumAccess?: boolean;
  /** Rate limiting configuration */
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  /** Legacy fields for backwards compatibility */
  provider?: ProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  /** Optional fallback provider */
  fallbackProvider?: ProviderType;
  /** Optional fallback model */
  fallbackModel?: string;
}

/**
 * Provider factory events
 */
export interface ProviderEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Event type */
  eventType: 'fallback' | 'error' | 'cache_hit' | 'rate_limit' | 'provider_created';
  /** Agent role (if applicable) */
  agentRole?: AgentRole;
  /** Provider involved */
  provider: ProviderType;
  /** Event message */
  message: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
}

// ============================================================================
// New Types for Anthropic Provider Implementation
// ============================================================================

/**
 * Tool parameter schema following JSON Schema spec
 */
export interface ToolParameterSchema {
  type: string;
  description?: string;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
  items?: ToolParameterSchema;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

/**
 * Tool use in a message
 */
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tool result
 */
export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Content block types
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Message structure for new provider interface
 */
export interface ProviderMessage {
  role: MessageRole;
  content: string | ContentBlock[];
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Streaming delta types
 */
export type StreamDelta =
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'tool_use_delta'; partial_json: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_start'; message: { id: string; role: MessageRole; model: string } }
  | { type: 'message_delta'; delta: { stop_reason?: string; stop_sequence?: string }; usage?: Partial<TokenUsage> }
  | { type: 'message_stop' };

/**
 * LLM completion response
 */
export interface CompletionResponse {
  id: string;
  model: string;
  role: MessageRole;
  content: ContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: TokenUsage;
}

/**
 * LLM completion request options
 */
export interface CompletionOptions {
  model: string;
  messages: ProviderMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  tools?: Tool[];
  stream?: boolean;
  stop_sequences?: string[];
}

/**
 * LLM Provider interface (new implementation)
 */
export interface LLMProviderInterface {
  readonly type: ProviderType;
  readonly config: ProviderConfig;

  /**
   * Create a completion
   */
  complete(options: CompletionOptions): Promise<CompletionResponse>;

  /**
   * Create a streaming completion
   */
  streamComplete(
    options: CompletionOptions
  ): AsyncGenerator<StreamDelta, CompletionResponse, undefined>;

  /**
   * Validate provider configuration
   */
  validateConfig(): Promise<boolean>;
}
