export const MODULE_NAME = 'llm-providers';

// Export all types
export type {
  MessageRole,
  ToolCall,
  Message,
  ToolParameter,
  ToolDef,
  StreamChunk,
  ChatResponse,
  ChatOptions,
  LLMProvider,
  LLMConfig,
  AgentRoleInfo,
  TokenUsageEvent,
  LLMError,
  ProviderType,
  ProviderConfig,
  TenantLLMConfig,
  ProviderEvent,
  ConfigValidationResult,
  // New types for Anthropic provider
  Tool,
  ToolUse,
  ToolResult,
  ToolParameterSchema,
  ContentBlock,
  ProviderMessage,
  TokenUsage,
  StreamDelta,
  CompletionResponse,
  CompletionOptions,
  LLMProviderInterface,
} from './lib/types';

export { AgentRole, LLMErrorType } from './lib/types';

// Export usage tracker functionality
export {
  TokenUsageTracker,
  tokenUsageTracker,
  calculateCost,
  trackTokenUsage,
  onTokenUsage,
  offTokenUsage,
  onTenantUsage,
  onProviderUsage,
  onRoleUsage,
  MODEL_PRICING,
  LLMProvider as ProviderEnum,
  type UsageAggregation,
  type ProviderUsage,
  type ModelUsage,
  type RoleUsage,
  type ModelPricing,
} from './lib/usage-tracker';

// Export Anthropic provider
export {
  AnthropicProvider,
  AnthropicProviderError,
  AnthropicConfigurationError,
  AnthropicAPIError,
  AnthropicValidationError,
  AnthropicStreamError,
  type AnthropicProviderConfig,
} from './lib/providers/anthropic';

// Export Ollama provider
export {
  OllamaProvider,
  OllamaError,
  OllamaTimeoutError,
  OllamaConnectionError,
  SSEParser,
  type SSEEvent,
} from './lib/providers/ollama';

// Export LLM Provider Factory
export {
  AGENT_LLM_MAP,
  getProvider,
  getProviderWithFallback,
  executeWithFallback,
  resolveLLMConfig,
  validateConfig,
  clearProviderCache,
  onProviderEvent,
  getAvailableRoles,
  getDefaultConfig,
  isProviderSupported,
  getConfigSummary,
} from './lib/factory';
