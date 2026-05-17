# LLM Provider Factory Implementation

## Overview

The LLM Provider Factory has been implemented in `libs/core/llm-providers/src/lib/factory.ts`. This factory manages the creation and configuration of LLM providers for different agent roles with support for tenant-specific configurations, environment variable overrides, and fallback chains.

## Features Implemented

### 1. AGENT_LLM_MAP Configuration

A comprehensive mapping of agent roles to default LLM configurations:

```typescript
export const AGENT_LLM_MAP: Partial<Record<AgentRole, LLMConfig>>
```

- All roles default to `claude-opus-4-6` as specified
- Each role has tailored `maxTokens` and `temperature` settings
- Covers all agent roles including:
  - Core Orchestration (SUPERVISOR, ORCHESTRATOR, PLANNING)
  - Builder Agents (PAGE_COMPOSER, WIDGET_BUILDER, CODEGEN, etc.)
  - IoT Agents (IOT_ADAPTER, SWAGGER_ANALYZER, SDK_GENERATOR, etc.)
  - Data & Analytics (QUERY_BUILDER, DASHBOARD_DESIGNER, GRAFANA, DATABASE)
  - Deployment (DOCKER_GENERATOR, HELM_GENERATOR, DEPLOYMENT)
  - Security & Compliance (SECURITY, POLICY_ENFORCER)
  - Quality Assurance (QA_TEST)
  - General Purpose (ASSISTANT, BUILDER, CODE_GENERATOR, CUSTOM)

### 2. getProvider() Method

Main entry point for obtaining configured LLM providers:

```typescript
function getProvider(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): LLMProviderInterface
```

**Features:**
- Resolves configuration from multiple sources
- Applies priority order: env variables > tenant overrides > role defaults
- Returns cached provider instances for performance
- Creates appropriate provider (Anthropic or Ollama)

### 3. Configuration Resolution

`resolveLLMConfig()` implements a priority-based configuration system:

**Priority Order (highest to lowest):**
1. Environment variables (LLM_PROVIDER, LLM_MODEL, etc.)
2. Tenant-specific role overrides
3. Tenant default config
4. Agent role defaults from AGENT_LLM_MAP

**Supported Environment Variables:**
- `LLM_PROVIDER` - Primary provider type ('anthropic' | 'ollama')
- `LLM_MODEL` - Model identifier
- `LLM_FALLBACK_PROVIDER` - Fallback provider type
- `LLM_FALLBACK_MODEL` - Fallback model identifier
- `LLM_MAX_TOKENS` - Maximum tokens for generation
- `LLM_TEMPERATURE` - Sampling temperature (0-1)
- `ANTHROPIC_API_KEY` - Anthropic API key
- `ANTHROPIC_API_URL` - Anthropic API URL
- `OLLAMA_BASE_URL` - Ollama base URL

### 4. Fallback Chain

`executeWithFallback()` provides automatic fallback support:

```typescript
async function executeWithFallback<T>(
  agentRole: AgentRole,
  requestFn: (provider: LLMProviderInterface) => Promise<T>,
  tenantConfig?: TenantLLMConfig
): Promise<T>
```

**Features:**
- Tries primary provider first
- Automatically falls back to secondary provider on failure
- Logs fallback events via event system
- Propagates errors if both providers fail

### 5. Provider Caching

Singleton pattern implementation for provider instances:

**Benefits:**
- Reduces provider initialization overhead
- Reuses HTTP clients and connections
- Memory efficient

**Cache Management:**
- Key format: `"provider:model"`
- Can be cleared with `clearProviderCache()`
- Automatic cache hits emit events for monitoring

### 6. Configuration Validation

`validateConfig()` ensures configuration correctness:

```typescript
async function validateConfig(
  agentRole: AgentRole,
  tenantConfig?: TenantLLMConfig
): Promise<ConfigValidationResult>
```

**Validates:**
- Provider type (must be 'anthropic' or 'ollama')
- Model identifier presence
- Token limits (warns on >200k, errors on <=0)
- Temperature range (must be 0-1)
- Fallback configuration consistency
- Provider accessibility (via health check)

**Returns:**
- `valid`: boolean indicating if config is valid
- `errors`: array of error messages
- `warnings`: array of warning messages

### 7. Event System

Comprehensive event emission for monitoring:

```typescript
function onProviderEvent(
  listener: (event: ProviderEvent) => void
): () => void
```

**Event Types:**
- `provider_created` - New provider instance created
- `cache_hit` - Provider retrieved from cache
- `fallback` - Fallback provider activated
- `error` - Provider operation failed
- `rate_limit` - Rate limit encountered

**Event Data:**
- `timestamp` - When event occurred
- `eventType` - Type of event
- `agentRole` - Agent role involved (if applicable)
- `provider` - Provider type
- `message` - Human-readable description
- `metadata` - Additional context data

### 8. Utility Functions

Additional helper functions:

- `getAvailableRoles()` - Lists all available agent roles
- `getDefaultConfig(agentRole)` - Gets default config for a role
- `isProviderSupported(provider)` - Checks if provider type is supported
- `getConfigSummary()` - Returns detailed configuration breakdown for debugging

## Type System

### AgentRole Enum

Consolidated enum covering all agent types (from `usage-tracker.ts`):
- Prevents type conflicts
- Single source of truth
- Used consistently across the codebase

### LLMConfig Interface

```typescript
interface LLMConfig {
  provider: ProviderType;
  model: string;
  fallbackProvider?: ProviderType;
  fallbackModel?: string;
  maxTokens?: number;
  temperature?: number;
  // ... additional options
}
```

### TenantLLMConfig Interface

```typescript
interface TenantLLMConfig {
  tenantId: string;
  roleOverrides?: Partial<Record<AgentRole, Partial<LLMConfig>>>;
  defaultConfig?: Partial<LLMConfig>;
  premiumAccess?: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  // ... legacy fields for backward compatibility
}
```

## Usage Examples

### Basic Usage

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

// Get provider for a specific role
const provider = getProvider(AgentRole.CODEGEN);

// Use the provider
const response = await provider.complete({
  model: 'claude-opus-4-6',
  messages: [{ role: 'user', content: 'Generate a React component' }],
  max_tokens: 4096
});
```

### With Tenant Configuration

```typescript
const tenantConfig: TenantLLMConfig = {
  tenantId: 'tenant-123',
  premiumAccess: true,
  roleOverrides: {
    [AgentRole.CODEGEN]: {
      model: 'claude-opus-4-6',
      maxTokens: 8192,
      temperature: 0.2
    }
  }
};

const provider = getProvider(AgentRole.CODEGEN, tenantConfig);
```

### With Fallback

```typescript
const result = await executeWithFallback(
  AgentRole.SWAGGER_ANALYZER,
  async (provider) => {
    return await provider.complete({
      model: provider.config.defaultModel!,
      messages: [{ role: 'user', content: 'Analyze this OpenAPI spec' }],
      max_tokens: 4096
    });
  },
  tenantConfig
);
```

### Event Monitoring

```typescript
import { onProviderEvent } from '@friendly-tech/core/llm-providers';

const unsubscribe = onProviderEvent((event) => {
  console.log(`[${event.eventType}] ${event.message}`, {
    provider: event.provider,
    agentRole: event.agentRole,
    timestamp: event.timestamp
  });
});

// Later: unsubscribe()
```

## Error Handling

The factory includes comprehensive error handling:

1. **Configuration Errors**: Invalid provider types, missing required fields
2. **Provider Creation Errors**: Failed to instantiate provider
3. **Validation Errors**: Configuration doesn't meet requirements
4. **Runtime Errors**: Provider operations fail (with fallback support)

All errors are logged via the event system and propagated appropriately.

## Integration with Existing Code

The factory integrates seamlessly with:

1. **Usage Tracking**: Uses `AgentRole` enum from `usage-tracker.ts`
2. **Provider Implementations**: Works with existing Anthropic and Ollama providers
3. **Type System**: Uses consolidated types from `types.ts`
4. **Environment Config**: Respects all existing environment variables

## Future Enhancements

Potential improvements:

1. Rate limiting enforcement at factory level
2. Circuit breaker pattern for failing providers
3. Metrics collection (latency, success rates)
4. Dynamic model selection based on task complexity
5. Cost optimization hints
6. Provider health monitoring dashboard

## Testing

The factory should be tested with:

1. Unit tests for configuration resolution
2. Integration tests with real providers
3. Fallback scenario tests
4. Cache behavior tests
5. Event emission tests
6. Tenant configuration tests

## Known Limitations

1. Ollama provider requires updating to implement `LLMProviderInterface` (currently implements different interface)
2. Provider cache is in-memory only (not distributed)
3. No built-in rate limiting enforcement
4. Event listeners are not persisted

## Exports

All factory functionality is exported from `@friendly-tech/core/llm-providers`:

```typescript
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
```
