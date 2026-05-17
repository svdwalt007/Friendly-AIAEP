# llm-providers

Multi-provider LLM integration library with support for Anthropic Claude and Ollama models, featuring role-based agent configurations, comprehensive token tracking, and automatic fallback handling.

## Overview

This library provides a unified interface for interacting with LLM providers in the Friendly AI AEP platform. It handles provider abstraction, cost tracking, tenant configuration, and automatic failover.

### Key Features

- **Multi-Provider Support**: Seamless integration with Anthropic Claude and Ollama (self-hosted)
- **13 Specialized Agent Roles**: Pre-configured roles for all AEP agents (Orchestrator, Page Composer, Code Generator, etc.)
- **Comprehensive Token Tracking**: Real-time usage tracking with cost calculation and event emission
- **Tenant Configuration**: Per-tenant overrides with role-specific settings
- **Fallback Mechanism**: Automatic failover between providers for high availability
- **Streaming Support**: Real-time streaming responses with async generators
- **Tool/Function Calling**: Native support for function calling and tool integration
- **Cost Calculation**: Automatic cost estimation based on model pricing
- **Event System**: EventEmitter-based usage tracking for billing integration
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```typescript
// Core factory functions
import {
  getProvider,
  getProviderWithFallback,
  executeWithFallback,
  resolveLLMConfig,
  validateConfig,
} from '@friendly-tech/core/llm-providers';

// Types and enums
import {
  AgentRole,
  type Message,
  type ChatResponse,
  type ChatOptions,
  type LLMProvider,
  type LLMConfig,
  type TenantLLMConfig,
} from '@friendly-tech/core/llm-providers';

// Token usage tracking
import {
  trackTokenUsage,
  tokenUsageTracker,
  onTokenUsage,
  onTenantUsage,
  calculateCost,
} from '@friendly-tech/core/llm-providers';
```

## Quick Start

### Basic Usage

```typescript
import { getProvider, AgentRole, trackTokenUsage } from '@friendly-tech/core/llm-providers';

// Get a provider for a specific agent role
const provider = getProvider(AgentRole.PAGE_COMPOSER);

// Send a chat request
const response = await provider.chat(
  [
    { role: 'user', content: 'Create a dashboard layout with three widgets' },
  ],
  {
    temperature: 0.7,
    max_tokens: 4096,
  }
);

// Access the response
console.log(response.message.content);
console.log(`Tokens: ${response.usage.total_tokens}`);

// Track usage (automatically emits events for billing)
trackTokenUsage({
  inputTokens: response.usage.prompt_tokens,
  outputTokens: response.usage.completion_tokens,
  model: provider.defaultModel,
  provider: 'anthropic' as any,
  agentRole: AgentRole.PAGE_COMPOSER,
  tenantId: 'tenant-123',
});
```

### With Tenant Configuration

```typescript
import {
  getProvider,
  AgentRole,
  type TenantLLMConfig,
} from '@friendly-tech/core/llm-providers';

// Define tenant-specific configuration
const tenantConfig: TenantLLMConfig = {
  tenantId: 'tenant-123',
  // Override defaults for all roles
  defaultConfig: {
    provider: 'anthropic',
    temperature: 0.5,
  },
  // Role-specific overrides
  roleOverrides: {
    [AgentRole.CODEGEN]: {
      model: 'claude-opus-4-6',
      maxTokens: 8192,
      temperature: 0.3,
    },
  },
};

// Get provider with tenant config
const provider = getProvider(AgentRole.CODEGEN, tenantConfig);
const response = await provider.chat([
  { role: 'user', content: 'Generate a React component' },
]);
```

### Streaming Responses

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

const provider = getProvider(AgentRole.CODEGEN);

// Request streaming response
const stream = await provider.chat(
  [{ role: 'user', content: 'Generate a TypeScript interface' }],
  {
    stream: true,
    max_tokens: 4096,
  }
);

// Stream is an async generator
if (Symbol.asyncIterator in stream) {
  for await (const chunk of stream) {
    if (chunk.delta.content) {
      process.stdout.write(chunk.delta.content);
    }
    if (chunk.finish_reason) {
      console.log(`\nFinished: ${chunk.finish_reason}`);
      if (chunk.usage) {
        console.log(`Tokens: ${chunk.usage.total_tokens}`);
      }
    }
  }
}
```

### Automatic Fallback

```typescript
import {
  executeWithFallback,
  AgentRole,
  type TenantLLMConfig,
} from '@friendly-tech/core/llm-providers';

// Configure primary and fallback providers
const tenantConfig: TenantLLMConfig = {
  tenantId: 'tenant-123',
  defaultConfig: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    fallbackProvider: 'ollama',
    fallbackModel: 'llama3.1:70b',
  },
};

// Execute with automatic fallback on failure
const response = await executeWithFallback(
  AgentRole.CODEGEN,
  async (provider) => {
    return await provider.chat([
      { role: 'user', content: 'Generate code' },
    ]);
  },
  tenantConfig
);
```

## Supported Providers

### Anthropic Claude

Default provider with support for Claude 3.5 Sonnet and other Claude models.

**Features:**
- Function/tool calling
- Streaming responses
- Vision capabilities (image inputs)
- System prompts
- Token counting
- Message history

**Models:**
- `claude-3-5-sonnet-20241022` (default)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

### Ollama

Self-hosted LLM provider for on-premise deployments.

**Features:**
- Local model hosting
- Custom model support
- Streaming responses
- Function calling (model-dependent)
- No external API calls

**Popular Models:**
- `llama3.1:70b`
- `mistral:latest`
- `codellama:34b`
- `mixtral:8x7b`

## Agent Roles

The library supports 13 specialized agent roles, each with optimized default configurations. All roles default to `claude-opus-4-6` model.

### Core Orchestration

#### ORCHESTRATOR
Manages multi-agent workflows and task delegation.

```typescript
const provider = getProvider(AgentRole.ORCHESTRATOR);
```

**Default Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.7
- Max Tokens: 8192

### Builder Agents

#### PAGE_COMPOSER
Designs and composes complete page layouts.

```typescript
const provider = getProvider(AgentRole.PAGE_COMPOSER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.5
- Max Tokens: 4096

#### WIDGET_BUILDER
Creates individual UI widgets and components.

```typescript
const provider = getProvider(AgentRole.WIDGET_BUILDER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.5
- Max Tokens: 4096

#### CODEGEN
Generates TypeScript/JavaScript code for applications.

```typescript
const provider = getProvider(AgentRole.CODEGEN);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.3
- Max Tokens: 8192

#### TEMPLATE_DESIGNER
Designs reusable application templates.

```typescript
const provider = getProvider(AgentRole.TEMPLATE_DESIGNER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.6
- Max Tokens: 4096

### IoT Integration Agents

#### IOT_ADAPTER
Integrates IoT devices and handles device communication.

```typescript
const provider = getProvider(AgentRole.IOT_ADAPTER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.4
- Max Tokens: 4096

#### SWAGGER_ANALYZER
Analyzes OpenAPI/Swagger specifications.

```typescript
const provider = getProvider(AgentRole.SWAGGER_ANALYZER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.3
- Max Tokens: 4096

#### SDK_GENERATOR
Generates SDKs from API specifications.

```typescript
const provider = getProvider(AgentRole.SDK_GENERATOR);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.3
- Max Tokens: 8192

### Data & Analytics Agents

#### QUERY_BUILDER
Constructs database queries and InfluxDB queries.

```typescript
const provider = getProvider(AgentRole.QUERY_BUILDER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.4
- Max Tokens: 4096

#### DASHBOARD_DESIGNER
Designs Grafana dashboards and visualizations.

```typescript
const provider = getProvider(AgentRole.DASHBOARD_DESIGNER);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.5
- Max Tokens: 4096

### Deployment Agents

#### DOCKER_GENERATOR
Generates Docker configurations and Dockerfiles.

```typescript
const provider = getProvider(AgentRole.DOCKER_GENERATOR);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.3
- Max Tokens: 4096

#### HELM_GENERATOR
Generates Helm charts for Kubernetes deployments.

```typescript
const provider = getProvider(AgentRole.HELM_GENERATOR);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.3
- Max Tokens: 4096

### General Purpose

#### ASSISTANT
General-purpose conversational agent.

```typescript
const provider = getProvider(AgentRole.ASSISTANT);
```

**Configuration:**
- Model: claude-opus-4-6
- Temperature: 0.7
- Max Tokens: 4096

## Configuration Options

### Environment Variables

```bash
# Anthropic Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key-here
ANTHROPIC_API_URL=https://api.anthropic.com/v1
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_MAX_TOKENS=4096

# Ollama Configuration (optional)
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:70b
OLLAMA_MAX_TOKENS=4096

# Provider Fallback
LLM_FALLBACK_ENABLED=true
LLM_PRIMARY_PROVIDER=anthropic
LLM_FALLBACK_PROVIDER=ollama

# Token Tracking
LLM_TRACK_USAGE=true
LLM_BILLING_ENABLED=true
```

### Programmatic Configuration

```typescript
import { createLLMClient, LLMProvider } from '@friendly-tech/core/llm-providers';

const client = createLLMClient({
  // Provider selection
  provider: LLMProvider.ANTHROPIC,
  fallbackProvider: LLMProvider.OLLAMA,

  // Model configuration
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 8192,
  topP: 0.95,

  // Agent role
  role: AgentRole.BUILDER,

  // Multi-tenancy
  tenantId: 'tenant-123',

  // Streaming
  stream: true,

  // Tool calling
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a location',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
    },
  ],

  // Callbacks
  onTokenUsage: (usage) => {
    console.log(`Tokens: ${usage.totalTokens}`);
  },
});
```

## Token Usage Tracking

The library includes a comprehensive token usage tracking system with automatic cost calculation and event emission for billing integration.

### Tracking Usage

```typescript
import {
  trackTokenUsage,
  AgentRole,
  LLMProvider,
} from '@friendly-tech/core/llm-providers';

// Track usage after an LLM request
const event = trackTokenUsage({
  inputTokens: 1000,
  outputTokens: 500,
  model: 'claude-opus-4-6',
  provider: LLMProvider.ANTHROPIC,
  agentRole: AgentRole.CODEGEN,
  tenantId: 'tenant-123',
  metadata: {
    projectId: 'proj-456',
    sessionId: 'sess-789',
  },
});

console.log(`Cost: $${event.cost.toFixed(4)}`);
console.log(`Total tokens: ${event.totalTokens}`);
```

### Event Listeners

Listen to usage events for real-time billing and monitoring:

```typescript
import {
  onTokenUsage,
  onTenantUsage,
  onProviderUsage,
  onRoleUsage,
} from '@friendly-tech/core/llm-providers';

// Listen to all usage events
onTokenUsage((event) => {
  console.log(`Usage: ${event.totalTokens} tokens, $${event.cost}`);
  // Send to billing service, analytics, etc.
});

// Listen to specific tenant usage
onTenantUsage('tenant-123', (event) => {
  console.log(`Tenant 123 used ${event.totalTokens} tokens`);
});

// Listen to specific provider usage
onProviderUsage(LLMProvider.ANTHROPIC, (event) => {
  console.log(`Anthropic request: ${event.totalTokens} tokens`);
});

// Listen to specific role usage
onRoleUsage(AgentRole.CODEGEN, (event) => {
  console.log(`Code generator used ${event.totalTokens} tokens`);
});
```

### Usage Aggregation

Get aggregated usage statistics:

```typescript
import { tokenUsageTracker } from '@friendly-tech/core/llm-providers';

// Get all events for a tenant
const tenantEvents = tokenUsageTracker.getEventsByTenant('tenant-123');

// Get events in a time range
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-01-31');
const monthlyEvents = tokenUsageTracker.getEventsByTimeRange(startDate, endDate);

// Get aggregated statistics
const aggregation = tokenUsageTracker.getTenantAggregation('tenant-123');

console.log(`Total cost: $${aggregation.totalCost}`);
console.log(`Total tokens: ${aggregation.totalTokens}`);
console.log(`Event count: ${aggregation.eventCount}`);

// Breakdown by provider
aggregation.byProvider.forEach((usage, provider) => {
  console.log(`${provider}: ${usage.totalTokens} tokens, $${usage.cost}`);
});

// Breakdown by model
aggregation.byModel.forEach((usage, model) => {
  console.log(`${model}: ${usage.totalTokens} tokens, $${usage.cost}`);
});

// Breakdown by role
aggregation.byRole.forEach((usage, role) => {
  console.log(`${role}: ${usage.totalTokens} tokens, $${usage.cost}`);
});
```

### Cost Calculation

Automatic cost calculation based on model pricing:

```typescript
import { calculateCost, MODEL_PRICING } from '@friendly-tech/core/llm-providers';

// Calculate cost for specific usage
const cost = calculateCost(
  'claude-opus-4-6',
  1000, // input tokens
  500,  // output tokens
  LLMProvider.ANTHROPIC
);

console.log(`Estimated cost: $${cost.toFixed(4)}`);

// View pricing table
console.log('Model pricing (USD per 1M tokens):');
Object.entries(MODEL_PRICING).forEach(([model, pricing]) => {
  console.log(`${model}:`);
  console.log(`  Input: $${pricing.inputPricePerMillion}`);
  console.log(`  Output: $${pricing.outputPricePerMillion}`);
});
```

### Supported Models and Pricing

The library includes up-to-date pricing for:

**Anthropic Claude Models:**
- claude-opus-4-5: $15/$75 per 1M tokens (input/output)
- claude-3-5-sonnet-20241022: $3/$15 per 1M tokens
- claude-3-5-haiku-20241022: $0.8/$4 per 1M tokens
- claude-3-opus-20240229: $15/$75 per 1M tokens
- claude-3-sonnet-20240229: $3/$15 per 1M tokens
- claude-3-haiku-20240307: $0.25/$1.25 per 1M tokens

**Ollama Models:**
- All Ollama models: $0 (self-hosted, infrastructure costs only)

## Fallback Mechanism

Automatic failover between providers:

```typescript
import { createLLMClient, LLMProvider, AgentRole } from '@friendly-tech/core/llm-providers';

const client = createLLMClient({
  role: AgentRole.CODE_GENERATOR,
  provider: LLMProvider.ANTHROPIC,
  fallbackProvider: LLMProvider.OLLAMA,
  tenantId: 'tenant-123',
  onProviderSwitch: (from, to, reason) => {
    console.log(`Switched from ${from} to ${to}: ${reason}`);
  },
});

try {
  // Will automatically fall back to Ollama if Anthropic fails
  const response = await client.chat([
    { role: 'user', content: 'Generate a TypeScript class' },
  ]);

  console.log(response.content);
  console.log(`Provider used: ${response.provider}`);
} catch (error) {
  console.error('All providers failed:', error);
}
```

## Tool/Function Calling

Support for function calling with tools:

```typescript
import { getProvider, AgentRole, type ToolDef } from '@friendly-tech/core/llm-providers';

const provider = getProvider(AgentRole.IOT_ADAPTER);

// Define available tools
const tools: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_sensor_data',
      description: 'Get current readings from a sensor',
      parameters: {
        type: 'object',
        properties: {
          sensorId: {
            type: 'string',
            description: 'The sensor identifier',
          },
          metric: {
            type: 'string',
            enum: ['temperature', 'humidity', 'pressure'],
            description: 'The metric to retrieve',
          },
        },
        required: ['sensorId', 'metric'],
      },
    },
  },
];

// Request with tools
const response = await provider.chat(
  [{ role: 'user', content: 'What is the temperature of sensor-001?' }],
  {
    tools,
    tool_choice: 'auto',
  }
);

// Check if tools were called
if (response.message.tool_calls) {
  for (const toolCall of response.message.tool_calls) {
    console.log(`Tool: ${toolCall.function.name}`);
    const args = JSON.parse(toolCall.function.arguments);
    console.log('Arguments:', args);

    // Execute the tool and send result back
    const result = await getSensorData(args.sensorId, args.metric);

    const finalResponse = await provider.chat([
      { role: 'user', content: 'What is the temperature of sensor-001?' },
      { role: 'assistant', tool_calls: response.message.tool_calls },
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      },
    ]);

    console.log(finalResponse.message.content);
  }
}
```

## Error Handling

```typescript
import {
  createLLMClient,
  LLMError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
} from '@friendly-tech/core/llm-providers';

const client = createLLMClient({
  role: AgentRole.BUILDER,
  tenantId: 'tenant-123',
});

try {
  const response = await client.chat([
    { role: 'user', content: 'Hello' },
  ]);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded:', error.retryAfter);
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof InvalidRequestError) {
    console.error('Invalid request:', error.message);
  } else if (error instanceof LLMError) {
    console.error('LLM error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Documentation

For comprehensive examples and patterns, see:

- [EXAMPLES.md](./EXAMPLES.md) - Usage examples and patterns
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration guide and best practices

## Configuration Validation

Validate configuration before use:

```typescript
import { validateConfig, AgentRole } from '@friendly-tech/core/llm-providers';

const result = await validateConfig(AgentRole.CODEGEN, tenantConfig);

if (result.valid) {
  console.log('Configuration is valid');
} else {
  console.error('Configuration errors:', result.errors);
}

if (result.warnings.length > 0) {
  console.warn('Configuration warnings:', result.warnings);
}
```

## Configuration Summary

Get detailed configuration information for debugging:

```typescript
import { getConfigSummary, AgentRole } from '@friendly-tech/core/llm-providers';

const summary = getConfigSummary(AgentRole.CODEGEN, tenantConfig);

console.log('Agent Role:', summary.agentRole);
console.log('Resolved Config:', summary.resolvedConfig);
console.log('Default Config:', summary.defaultConfig);
console.log('Environment Overrides:', summary.environmentOverrides);
console.log('Tenant Overrides:', summary.tenantOverrides);
```

## API Reference

### Factory Functions

- `getProvider(agentRole, tenantConfig?)` - Get an LLM provider instance
- `getProviderWithFallback(agentRole, tenantConfig?)` - Get provider with fallback
- `executeWithFallback(agentRole, requestFn, tenantConfig?)` - Execute with automatic fallback
- `resolveLLMConfig(agentRole, tenantConfig?)` - Resolve final configuration
- `validateConfig(agentRole, tenantConfig?)` - Validate configuration
- `getDefaultConfig(agentRole)` - Get default configuration for a role
- `getConfigSummary(agentRole, tenantConfig?)` - Get configuration summary
- `clearProviderCache()` - Clear provider cache
- `onProviderEvent(listener)` - Listen to provider events

### Token Tracking Functions

- `trackTokenUsage(params)` - Track token usage
- `calculateCost(model, inputTokens, outputTokens, provider)` - Calculate cost
- `onTokenUsage(listener)` - Listen to all usage events
- `onTenantUsage(tenantId, listener)` - Listen to tenant usage
- `onProviderUsage(provider, listener)` - Listen to provider usage
- `onRoleUsage(role, listener)` - Listen to role usage
- `offTokenUsage(listener)` - Remove usage listener
- `tokenUsageTracker` - Singleton tracker instance

### Core Types

- `LLMProvider` - Provider interface (chat, embed, validateConfig)
- `Message` - Chat message structure
- `ChatResponse` - Response from chat completion
- `ChatOptions` - Options for chat requests
- `StreamChunk` - Streaming response chunk
- `ToolDef` - Tool/function definition
- `ToolCall` - Tool call from LLM

### Configuration Types

- `LLMConfig` - LLM configuration
- `TenantLLMConfig` - Tenant-specific configuration
- `ProviderConfig` - Provider configuration
- `ConfigValidationResult` - Validation result

### Token Tracking Types

- `TokenUsageEvent` - Usage event data
- `UsageAggregation` - Aggregated usage statistics
- `ProviderUsage` - Provider-level usage
- `ModelUsage` - Model-level usage
- `RoleUsage` - Role-level usage
- `ModelPricing` - Model pricing structure

### Enums

- `AgentRole` - 13 specialized agent roles
- `LLMErrorType` - Error types
- `ProviderType` - Supported providers ('anthropic' | 'ollama')
- `MessageRole` - Message roles ('system' | 'user' | 'assistant' | 'tool')

## Building

Run `nx build llm-providers` to build the library.

## Running unit tests

Run `nx test llm-providers` to execute the unit tests via [Vitest](https://vitest.dev/).

## License

UNLICENSED
