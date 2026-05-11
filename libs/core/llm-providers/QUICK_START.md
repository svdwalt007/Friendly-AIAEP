# LLM Providers - Quick Start Guide

Get started with the Friendly AI AEP LLM providers library in 5 minutes.

## Prerequisites

- Node.js 20.x or later
- pnpm 10.x or later
- Anthropic API key (for Claude) or Ollama installed locally

## Step 1: Installation (1 minute)

The library is already included in the Nx monorepo. Import it using the path alias:

```typescript
import {
  getProvider,
  AgentRole,
  onTokenUsage
} from '@friendly-tech/core/llm-providers';
```

## Step 2: Set Up Environment Variables (30 seconds)

Add to your `.env` file:

```bash
# Anthropic Claude (recommended for production)
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# OR Ollama (for local development)
OLLAMA_BASE_URL=http://localhost:11434
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
```

## Step 3: Basic Usage (2 minutes)

### Simple Chat Request

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

async function main() {
  // Get a provider for the Angular composer agent
  const provider = getProvider(AgentRole.ANGULAR_COMPOSER);

  // Send a chat request
  const response = await provider.chat([
    { role: 'user', content: 'Create a login form component in Angular' }
  ]);

  console.log(response.message.content);
}

main().catch(console.error);
```

### Streaming Response

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

async function streamExample() {
  const provider = getProvider(AgentRole.ASSISTANT);

  const stream = await provider.chat(
    [{ role: 'user', content: 'Write a short story about AI' }],
    { stream: true }
  );

  for await (const chunk of stream) {
    if (chunk.delta.content) {
      process.stdout.write(chunk.delta.content);
    }
  }

  console.log('\n\nDone!');
}

streamExample().catch(console.error);
```

## Step 4: Enable Token Tracking (1 minute)

Track token usage for billing and analytics:

```typescript
import { onTokenUsage } from '@friendly-tech/core/llm-providers';

// Set up token tracking
onTokenUsage((event) => {
  console.log(`
    Provider: ${event.provider}
    Model: ${event.model}
    Tokens: ${event.totalTokens}
    Cost: $${event.estimatedCost?.toFixed(4) || 0}
    Agent: ${event.agentRole}
  `);
});

// Now all chat requests will emit usage events
const provider = getProvider(AgentRole.IOT_DOMAIN);
await provider.chat([
  { role: 'user', content: 'List IoT device types' }
]);
```

## Step 5: Use Tool Calling (Optional)

Enable function/tool calling for advanced use cases:

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

const tools = [{
  name: 'getDeviceData',
  description: 'Retrieves data from an IoT device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: {
        type: 'string',
        description: 'The unique identifier of the device'
      }
    },
    required: ['deviceId']
  }
}];

const provider = getProvider(AgentRole.IOT_DOMAIN);

const response = await provider.chat(
  [{ role: 'user', content: 'Show me temperature data for device xyz123' }],
  { tools }
);

// Check if the model wants to call a tool
if (response.message.tool_calls) {
  for (const toolCall of response.message.tool_calls) {
    console.log(`Tool: ${toolCall.name}`);
    console.log(`Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`);

    // Execute the tool and send result back
    const toolResult = await executeToolCall(toolCall);

    const followUp = await provider.chat([
      { role: 'user', content: 'Show me temperature data for device xyz123' },
      { role: 'assistant', content: '', tool_calls: response.message.tool_calls },
      { role: 'tool', content: JSON.stringify(toolResult), tool_call_id: toolCall.id }
    ]);

    console.log(followUp.message.content);
  }
}
```

## Common Use Cases

### 1. Code Generation

```typescript
const provider = getProvider(AgentRole.ANGULAR_COMPOSER);

const response = await provider.chat([
  {
    role: 'system',
    content: 'You are an expert Angular developer. Generate clean, production-ready code.'
  },
  {
    role: 'user',
    content: 'Create a data table component with sorting and filtering'
  }
]);
```

### 2. IoT Integration

```typescript
const provider = getProvider(AgentRole.IOT_DOMAIN);

const response = await provider.chat([
  {
    role: 'user',
    content: 'Generate a Swagger API definition for a smart thermostat device'
  }
]);
```

### 3. Multi-Turn Conversation

```typescript
const provider = getProvider(AgentRole.ASSISTANT);

const messages = [
  { role: 'user', content: 'What is Grafana?' }
];

const firstResponse = await provider.chat(messages);
messages.push(firstResponse.message);

messages.push({
  role: 'user',
  content: 'How can I create a dashboard for IoT metrics?'
});

const secondResponse = await provider.chat(messages);
console.log(secondResponse.message.content);
```

### 4. Tenant-Specific Configuration

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

const tenantConfig = {
  tenantId: 'acme-corp',
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-5-sonnet-20241022',
  roleOverrides: {
    [AgentRole.IOT_DOMAIN]: {
      provider: 'ollama',
      model: 'llama3.1:8b' // Use local model for IoT tasks
    }
  },
  maxTokensPerMinute: 50000
};

const provider = getProvider(AgentRole.IOT_DOMAIN, tenantConfig);
```

### 5. Error Handling with Fallback

```typescript
import { getProviderWithFallback, executeWithFallback, AgentRole } from '@friendly-tech/core/llm-providers';

const { primary, fallback } = getProviderWithFallback(AgentRole.SUPERVISOR);

try {
  const result = await executeWithFallback(
    primary,
    fallback,
    async (provider) => {
      return await provider.chat([
        { role: 'user', content: 'Plan a deployment strategy' }
      ]);
    }
  );

  console.log(result.message.content);
} catch (error) {
  console.error('Both providers failed:', error);
}
```

## Available Agent Roles

The library provides 13 specialized agent roles, each optimized for specific tasks:

| Role | Use Case | Default Model |
|------|----------|---------------|
| `ORCHESTRATOR` | Multi-agent workflow coordination | claude-opus-4-6 |
| `PLANNING` | High-level planning and analysis | claude-opus-4-6 |
| `PAGE_COMPOSER` | Page layout and UI composition | claude-opus-4-6 |
| `WIDGET_BUILDER` | Widget/component generation | claude-opus-4-6 |
| `CODEGEN` | Code generation | claude-opus-4-6 |
| `TEMPLATE_DESIGNER` | Template creation | claude-opus-4-6 |
| `IOT_ADAPTER` | IoT device integration | claude-opus-4-6 |
| `SWAGGER_ANALYZER` | API analysis and SDK generation | claude-opus-4-6 |
| `SDK_GENERATOR` | SDK code generation | claude-opus-4-6 |
| `QUERY_BUILDER` | Database query generation | claude-opus-4-6 |
| `DASHBOARD_DESIGNER` | Dashboard creation | claude-opus-4-6 |
| `DOCKER_GENERATOR` | Docker config generation | claude-opus-4-6 |
| `HELM_GENERATOR` | Helm chart generation | claude-opus-4-6 |

Use `AgentRole.ASSISTANT` for general-purpose tasks.

## Environment Configuration

### For Development (Local)

```bash
# Use Ollama for free local testing
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
OLLAMA_BASE_URL=http://localhost:11434

# Fallback to Claude if needed
LLM_FALLBACK_PROVIDER=anthropic
LLM_FALLBACK_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...
```

### For Production (Cloud)

```bash
# Use Claude Opus for best results
LLM_PROVIDER=anthropic
LLM_MODEL=claude-opus-4-6
ANTHROPIC_API_KEY=sk-ant-your-production-key

# Fallback to Sonnet for cost savings
LLM_FALLBACK_PROVIDER=anthropic
LLM_FALLBACK_MODEL=claude-3-5-sonnet-20241022
```

## Monitoring and Debugging

### View Usage Statistics

```typescript
import { tokenUsageTracker } from '@friendly-tech/core/llm-providers';

// Get tenant usage
const tenantUsage = tokenUsageTracker.getTenantAggregation('tenant-123');
console.log(`Total cost: $${tenantUsage.totalCost.toFixed(2)}`);
console.log(`Total tokens: ${tenantUsage.totalTokens}`);
console.log(`Total requests: ${tenantUsage.totalRequests}`);

// Get usage by time range
const monthlyUsage = tokenUsageTracker.getTimeRangeAggregation(
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
```

### Listen to Provider Events

```typescript
import { onProviderEvent } from '@friendly-tech/core/llm-providers';

const unsubscribe = onProviderEvent((event) => {
  console.log(`Provider Event: ${event.type}`);
  console.log(`Agent: ${event.agentRole}`);
  console.log(`Provider: ${event.provider}`);

  if (event.type === 'fallback') {
    console.warn('Primary provider failed, using fallback');
  }
});

// Later: unsubscribe()
```

## Troubleshooting

### Issue: "Provider not found" Error

**Solution**: Make sure you've set the appropriate environment variable:
```bash
ANTHROPIC_API_KEY=sk-ant-...
# OR
OLLAMA_BASE_URL=http://localhost:11434
```

### Issue: Ollama Connection Failed

**Solution**:
1. Check if Ollama is running: `ollama serve`
2. Verify the base URL: `curl http://localhost:11434/api/tags`
3. Pull the model if not available: `ollama pull llama3.1:8b`

### Issue: Rate Limit Errors

**Solution**: Configure rate limiting in tenant config:
```typescript
const tenantConfig = {
  maxTokensPerMinute: 10000,
  maxTokensPerDay: 100000
};
```

### Issue: High Costs

**Solutions**:
1. Use cheaper models for simple tasks:
   ```typescript
   LLM_MODEL=claude-3-haiku-20240307  // Instead of opus
   ```
2. Reduce max_tokens:
   ```typescript
   const response = await provider.chat(messages, {
     max_tokens: 1000  // Instead of default 4096
   });
   ```
3. Enable caching for repeated requests
4. Monitor usage with `onTokenUsage()`

## Next Steps

1. **Read Full Documentation**: Check [README.md](./README.md) for comprehensive API reference
2. **Explore Examples**: See [EXAMPLES.md](./EXAMPLES.md) for advanced patterns
3. **Configure for Production**: Review [CONFIGURATION.md](./CONFIGURATION.md) for optimization
4. **Integrate Billing**: See [USAGE_TRACKER_INTEGRATION.md](./USAGE_TRACKER_INTEGRATION.md)

## Quick Reference

### Import Everything You Need

```typescript
import {
  // Provider management
  getProvider,
  getProviderWithFallback,
  executeWithFallback,

  // Configuration
  resolveLLMConfig,
  validateConfig,
  clearProviderCache,

  // Usage tracking
  trackTokenUsage,
  onTokenUsage,
  onTenantUsage,
  onProviderUsage,
  onRoleUsage,
  tokenUsageTracker,

  // Events
  onProviderEvent,

  // Types
  AgentRole,
  type LLMConfig,
  type TokenUsageEvent,
  type Message,
  type ToolDef,
} from '@friendly-tech/core/llm-providers';
```

### Minimal Working Example

```typescript
import { getProvider, AgentRole } from '@friendly-tech/core/llm-providers';

// Set ANTHROPIC_API_KEY in .env first
const provider = getProvider(AgentRole.ASSISTANT);

const response = await provider.chat([
  { role: 'user', content: 'Hello, AI!' }
]);

console.log(response.message.content);
```

---

**You're ready to go! 🚀**

Start building AI-powered features with the Friendly AI AEP LLM providers library.
