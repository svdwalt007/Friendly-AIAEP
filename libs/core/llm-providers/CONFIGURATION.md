# Configuration Guide

Comprehensive configuration guide for the llm-providers library.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Tenant-Specific Overrides](#tenant-specific-overrides)
- [Model Selection Guide](#model-selection-guide)
- [Performance Tuning](#performance-tuning)
- [Cost Optimization](#cost-optimization)
- [Security Best Practices](#security-best-practices)
- [Deployment Scenarios](#deployment-scenarios)

## Environment Variables

### Core Configuration

```bash
# ============================================================================
# LLM Provider Configuration
# ============================================================================

# Primary provider (anthropic or ollama)
LLM_PRIMARY_PROVIDER=anthropic

# Enable automatic fallback to secondary provider
LLM_FALLBACK_ENABLED=true
LLM_FALLBACK_PROVIDER=ollama

# Default timeout for LLM requests (milliseconds)
LLM_REQUEST_TIMEOUT=120000

# Enable token usage tracking
LLM_TRACK_USAGE=true

# Enable billing integration
LLM_BILLING_ENABLED=true
```

### Anthropic Configuration

```bash
# ============================================================================
# Anthropic Claude Configuration
# ============================================================================

# Anthropic API key (required)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# API endpoint (default: https://api.anthropic.com/v1)
ANTHROPIC_API_URL=https://api.anthropic.com/v1

# Default model
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Maximum tokens per request
ANTHROPIC_MAX_TOKENS=4096

# Request timeout (milliseconds)
ANTHROPIC_TIMEOUT=120000

# Maximum retries on failure
ANTHROPIC_MAX_RETRIES=3

# Base delay for exponential backoff (milliseconds)
ANTHROPIC_RETRY_DELAY=1000
```

### Ollama Configuration

```bash
# ============================================================================
# Ollama Configuration (Self-Hosted)
# ============================================================================

# Ollama API URL
OLLAMA_API_URL=http://localhost:11434

# Default model
OLLAMA_MODEL=llama3.1:70b

# Maximum tokens per request
OLLAMA_MAX_TOKENS=4096

# Request timeout (milliseconds)
OLLAMA_TIMEOUT=180000

# Keep model loaded in memory (recommended for production)
OLLAMA_KEEP_ALIVE=true
```

### Agent Role Defaults

```bash
# ============================================================================
# Agent Role Configuration
# ============================================================================

# Builder Agent
BUILDER_MODEL=claude-3-5-sonnet-20241022
BUILDER_TEMPERATURE=0.7
BUILDER_MAX_TOKENS=4096

# IoT Integration Agent
IOT_INTEGRATION_MODEL=claude-3-5-sonnet-20241022
IOT_INTEGRATION_TEMPERATURE=0.3
IOT_INTEGRATION_MAX_TOKENS=8192

# Orchestration Agent
ORCHESTRATION_MODEL=claude-3-5-sonnet-20241022
ORCHESTRATION_TEMPERATURE=0.5
ORCHESTRATION_MAX_TOKENS=8192

# Code Generator Agent
CODE_GENERATOR_MODEL=claude-3-5-sonnet-20241022
CODE_GENERATOR_TEMPERATURE=0.2
CODE_GENERATOR_MAX_TOKENS=16384
```

### Rate Limiting

```bash
# ============================================================================
# Rate Limiting Configuration
# ============================================================================

# Global rate limit (requests per minute)
LLM_GLOBAL_RATE_LIMIT=100

# Per-tenant rate limit (requests per minute)
LLM_TENANT_RATE_LIMIT=20

# Burst allowance
LLM_RATE_LIMIT_BURST=10

# Enable rate limit headers in responses
LLM_RATE_LIMIT_HEADERS=true
```

### Caching

```bash
# ============================================================================
# Response Caching Configuration
# ============================================================================

# Enable response caching
LLM_CACHE_ENABLED=true

# Cache backend (redis or memory)
LLM_CACHE_BACKEND=redis

# Redis connection URL (if using redis backend)
LLM_CACHE_REDIS_URL=redis://localhost:6379

# Cache TTL (seconds)
LLM_CACHE_TTL=3600

# Maximum cache size (number of entries, memory backend only)
LLM_CACHE_MAX_SIZE=1000
```

### Logging and Monitoring

```bash
# ============================================================================
# Logging Configuration
# ============================================================================

# Log level (debug, info, warn, error)
LLM_LOG_LEVEL=info

# Log format (json or text)
LLM_LOG_FORMAT=json

# Log requests and responses
LLM_LOG_REQUESTS=true

# Log token usage
LLM_LOG_USAGE=true

# Enable performance metrics
LLM_METRICS_ENABLED=true

# Metrics export interval (milliseconds)
LLM_METRICS_INTERVAL=60000
```

## Tenant-Specific Overrides

### Database Schema

Store tenant-specific LLM configurations in the database:

```prisma
model Tenant {
  id              String   @id @default(cuid())
  name            String
  tier            Tier     @default(FREE)

  // LLM Configuration
  llmProvider     String?  @default("anthropic")
  llmModel        String?
  llmMaxTokens    Int?     @default(4096)
  llmTemperature  Float?   @default(0.7)

  // Token limits
  monthlyTokenLimit Int?
  tokenUsageWarningThreshold Int?

  // Feature flags
  streamingEnabled Boolean @default(true)
  toolCallingEnabled Boolean @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Loading Tenant Configuration

```typescript
import { createLLMClient, AgentRole, LLMProvider } from '@friendly-tech/core/llm-providers';
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

async function createTenantClient(tenantId: string, role: AgentRole) {
  // Load tenant configuration from database
  const db = createTenantScopedClient(tenantId);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  // Apply tier-based defaults
  const config = getTierDefaults(tenant.tier);

  // Create client with tenant overrides
  const client = createLLMClient({
    role,
    tenantId,
    provider: (tenant.llmProvider as LLMProvider) || config.provider,
    model: tenant.llmModel || config.model,
    maxTokens: tenant.llmMaxTokens || config.maxTokens,
    temperature: tenant.llmTemperature || config.temperature,
    stream: tenant.streamingEnabled,
  });

  await db.$disconnect();
  return client;
}

function getTierDefaults(tier: string) {
  switch (tier) {
    case 'FREE':
      return {
        provider: LLMProvider.OLLAMA,
        model: 'llama3.1:8b',
        maxTokens: 2048,
        temperature: 0.7,
      };
    case 'STARTER':
      return {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-haiku-20240307',
        maxTokens: 4096,
        temperature: 0.7,
      };
    case 'PROFESSIONAL':
      return {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.7,
      };
    case 'ENTERPRISE':
      return {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-opus-20240229',
        maxTokens: 16384,
        temperature: 0.7,
      };
    default:
      throw new Error(`Unknown tier: ${tier}`);
  }
}
```

### Dynamic Configuration Updates

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

class ConfigurableLLMService {
  private config: Map<string, any> = new Map();

  async updateTenantConfig(tenantId: string, updates: Partial<LLMConfig>) {
    const currentConfig = this.config.get(tenantId) || {};
    this.config.set(tenantId, { ...currentConfig, ...updates });
  }

  async getTenantConfig(tenantId: string) {
    return this.config.get(tenantId) || {};
  }

  async createClient(tenantId: string, role: AgentRole) {
    const tenantConfig = await this.getTenantConfig(tenantId);

    return createLLMClient({
      role,
      tenantId,
      ...tenantConfig,
    });
  }
}

// Usage
const service = new ConfigurableLLMService();

// Update tenant configuration at runtime
await service.updateTenantConfig('tenant-123', {
  temperature: 0.5,
  maxTokens: 8192,
});

const client = await service.createClient('tenant-123', AgentRole.BUILDER);
```

## Model Selection Guide

### Anthropic Models

#### Claude 3.5 Sonnet (Recommended)

**Best For:**
- General-purpose tasks
- Balanced cost and performance
- Production applications
- Real-time interactions

**Specifications:**
- Model: `claude-3-5-sonnet-20241022`
- Context: 200K tokens
- Max Output: 8K tokens
- Cost: $3/MTok input, $15/MTok output

**Use Cases:**
```typescript
// Builder agent
createLLMClient({
  role: AgentRole.BUILDER,
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 4096,
});

// IoT Integration agent
createLLMClient({
  role: AgentRole.IOT_INTEGRATION,
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.3,
  maxTokens: 8192,
});
```

#### Claude 3 Opus

**Best For:**
- Complex reasoning tasks
- Multi-step planning
- High-accuracy requirements
- Enterprise applications

**Specifications:**
- Model: `claude-3-opus-20240229`
- Context: 200K tokens
- Max Output: 4K tokens
- Cost: $15/MTok input, $75/MTok output

**Use Cases:**
```typescript
// Orchestration agent with complex reasoning
createLLMClient({
  role: AgentRole.ORCHESTRATION,
  model: 'claude-3-opus-20240229',
  temperature: 0.5,
  maxTokens: 8192,
});
```

#### Claude 3 Haiku

**Best For:**
- High-volume, simple tasks
- Fast responses
- Cost-sensitive applications
- Batch processing

**Specifications:**
- Model: `claude-3-haiku-20240307`
- Context: 200K tokens
- Max Output: 4K tokens
- Cost: $0.25/MTok input, $1.25/MTok output

**Use Cases:**
```typescript
// Simple UI generation
createLLMClient({
  role: AgentRole.BUILDER,
  model: 'claude-3-haiku-20240307',
  temperature: 0.7,
  maxTokens: 2048,
});
```

### Ollama Models

#### Llama 3.1 (Recommended for Self-Hosted)

**Best For:**
- On-premise deployments
- Data privacy requirements
- Cost control
- Custom fine-tuning

**Specifications:**
- Models: `llama3.1:8b`, `llama3.1:70b`, `llama3.1:405b`
- Context: 128K tokens
- Cost: Infrastructure only (no API costs)

**Use Cases:**
```typescript
// Production on-premise
createLLMClient({
  role: AgentRole.BUILDER,
  provider: LLMProvider.OLLAMA,
  model: 'llama3.1:70b',
  temperature: 0.7,
  maxTokens: 4096,
});

// Development/testing
createLLMClient({
  role: AgentRole.BUILDER,
  provider: LLMProvider.OLLAMA,
  model: 'llama3.1:8b',
  temperature: 0.7,
  maxTokens: 2048,
});
```

#### CodeLlama

**Best For:**
- Code generation
- Code completion
- Technical documentation

**Specifications:**
- Models: `codellama:7b`, `codellama:34b`, `codellama:70b`
- Context: 16K tokens
- Cost: Infrastructure only

**Use Cases:**
```typescript
// Code generation agent
createLLMClient({
  role: AgentRole.CODE_GENERATOR,
  provider: LLMProvider.OLLAMA,
  model: 'codellama:34b',
  temperature: 0.2,
  maxTokens: 8192,
});
```

#### Mistral/Mixtral

**Best For:**
- Balanced performance
- Multi-language support
- Instruction following

**Specifications:**
- Models: `mistral:latest`, `mixtral:8x7b`
- Context: 32K tokens
- Cost: Infrastructure only

**Use Cases:**
```typescript
// General-purpose agent
createLLMClient({
  role: AgentRole.BUILDER,
  provider: LLMProvider.OLLAMA,
  model: 'mixtral:8x7b',
  temperature: 0.7,
  maxTokens: 4096,
});
```

## Performance Tuning

### Temperature Settings

Temperature controls randomness in responses:

```typescript
// Deterministic (code generation, data parsing)
const deterministicClient = createLLMClient({
  role: AgentRole.CODE_GENERATOR,
  temperature: 0.0, // Completely deterministic
  maxTokens: 8192,
});

// Conservative (technical tasks, IoT integration)
const conservativeClient = createLLMClient({
  role: AgentRole.IOT_INTEGRATION,
  temperature: 0.3, // Low randomness
  maxTokens: 8192,
});

// Balanced (general tasks, UI design)
const balancedClient = createLLMClient({
  role: AgentRole.BUILDER,
  temperature: 0.7, // Moderate randomness
  maxTokens: 4096,
});

// Creative (brainstorming, design exploration)
const creativeClient = createLLMClient({
  role: AgentRole.BUILDER,
  temperature: 1.0, // High randomness
  maxTokens: 4096,
});
```

### Token Limits

Optimize token usage based on task complexity:

```typescript
// Simple responses (buttons, forms)
const simpleClient = createLLMClient({
  role: AgentRole.BUILDER,
  maxTokens: 1024,
});

// Medium complexity (components, APIs)
const mediumClient = createLLMClient({
  role: AgentRole.CODE_GENERATOR,
  maxTokens: 4096,
});

// Complex responses (full pages, architectures)
const complexClient = createLLMClient({
  role: AgentRole.ORCHESTRATION,
  maxTokens: 8192,
});

// Very complex (entire applications)
const veryComplexClient = createLLMClient({
  role: AgentRole.CODE_GENERATOR,
  maxTokens: 16384,
});
```

### Streaming for Better UX

Use streaming for long responses:

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function streamResponse() {
  const client = createLLMClient({
    role: AgentRole.CODE_GENERATOR,
    tenantId: 'tenant-123',
    stream: true,
  });

  const startTime = Date.now();
  const stream = await client.chatStream([
    { role: 'user', content: 'Generate a complete React application' },
  ]);

  let firstChunkTime: number | null = null;

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      if (!firstChunkTime) {
        firstChunkTime = Date.now();
        console.log(`Time to first chunk: ${firstChunkTime - startTime}ms`);
      }
      process.stdout.write(chunk.delta);
    }
  }

  console.log(`\nTotal time: ${Date.now() - startTime}ms`);
}
```

### Connection Pooling

Reuse clients when possible:

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

class LLMClientPool {
  private pools: Map<string, any[]> = new Map();
  private maxPoolSize = 10;

  getKey(tenantId: string, role: AgentRole): string {
    return `${tenantId}:${role}`;
  }

  async acquire(tenantId: string, role: AgentRole) {
    const key = this.getKey(tenantId, role);
    const pool = this.pools.get(key) || [];

    if (pool.length > 0) {
      return pool.pop();
    }

    return createLLMClient({ role, tenantId });
  }

  async release(tenantId: string, role: AgentRole, client: any) {
    const key = this.getKey(tenantId, role);
    const pool = this.pools.get(key) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(client);
      this.pools.set(key, pool);
    }
  }
}

// Usage
const pool = new LLMClientPool();

const client = await pool.acquire('tenant-123', AgentRole.BUILDER);
const response = await client.chat([{ role: 'user', content: 'Hello' }]);
await pool.release('tenant-123', AgentRole.BUILDER, client);
```

## Cost Optimization

### Token Usage Monitoring

Track and optimize token usage:

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

class CostAwareClient {
  private totalCost = 0;
  private totalTokens = 0;

  async chat(tenantId: string, role: AgentRole, messages: any[]) {
    const client = createLLMClient({
      role,
      tenantId,
      onTokenUsage: (usage) => {
        this.totalCost += usage.estimatedCost;
        this.totalTokens += usage.totalTokens;

        console.log(`Request cost: $${usage.estimatedCost}`);
        console.log(`Running total: $${this.totalCost}`);

        // Alert on high costs
        if (usage.estimatedCost > 1.0) {
          console.warn('High-cost request detected!');
        }
      },
    });

    return client.chat(messages);
  }

  getStats() {
    return {
      totalCost: this.totalCost,
      totalTokens: this.totalTokens,
      averageCostPerRequest: this.totalCost / this.totalTokens,
    };
  }
}
```

### Prompt Optimization

Reduce token usage with concise prompts:

```typescript
// BAD: Verbose prompt
const verboseResponse = await client.chat([
  {
    role: 'user',
    content: `I would like you to please help me create a user interface component
    that will display information about temperature sensors. The component should
    show the current temperature reading in both Celsius and Fahrenheit units.
    It would be great if you could also include some styling to make it look nice.`,
  },
]);

// GOOD: Concise prompt
const conciseResponse = await client.chat([
  {
    role: 'user',
    content: 'Create a temperature sensor component showing readings in °C and °F with styling.',
  },
]);
```

### Model Selection by Task

Use cheaper models for simple tasks:

```typescript
import { createLLMClient, AgentRole, LLMProvider } from '@friendly-tech/core/llm-providers';

async function costOptimizedSelection(task: string, complexity: 'simple' | 'medium' | 'complex') {
  let model: string;
  let provider: LLMProvider;

  switch (complexity) {
    case 'simple':
      // Use Haiku or small Ollama model
      provider = LLMProvider.ANTHROPIC;
      model = 'claude-3-haiku-20240307';
      break;
    case 'medium':
      // Use Sonnet
      provider = LLMProvider.ANTHROPIC;
      model = 'claude-3-5-sonnet-20241022';
      break;
    case 'complex':
      // Use Opus only when necessary
      provider = LLMProvider.ANTHROPIC;
      model = 'claude-3-opus-20240229';
      break;
  }

  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    provider,
    model,
  });

  return client.chat([{ role: 'user', content: task }]);
}

// Usage
await costOptimizedSelection('Create a button', 'simple');
await costOptimizedSelection('Create a dashboard with charts', 'medium');
await costOptimizedSelection('Design a complete multi-tenant application architecture', 'complex');
```

### Response Caching

Cache frequent queries:

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

async function cachedChat(messages: any[], tenantId: string, cacheTTL = 3600) {
  const cacheKey = `llm:cache:${Buffer.from(JSON.stringify(messages)).toString('base64')}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Cache hit - saved API call!');
    return JSON.parse(cached);
  }

  // Execute request
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
  });

  const response = await client.chat(messages);

  // Cache result
  await redis.setEx(cacheKey, cacheTTL, JSON.stringify(response));

  return response;
}
```

## Security Best Practices

### API Key Management

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

// NEVER hardcode API keys
// BAD:
const badClient = createLLMClient({
  role: AgentRole.BUILDER,
  apiKey: 'sk-ant-api03-1234567890', // Don't do this!
});

// GOOD: Use environment variables
const goodClient = createLLMClient({
  role: AgentRole.BUILDER,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// BETTER: Use secrets management
import { SecretsManager } from 'aws-sdk';

async function getAPIKey() {
  const secretsManager = new SecretsManager();
  const secret = await secretsManager.getSecretValue({ SecretId: 'anthropic-api-key' }).promise();
  return secret.SecretString;
}

const bestClient = createLLMClient({
  role: AgentRole.BUILDER,
  apiKey: await getAPIKey(),
});
```

### Input Validation

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';
import { z } from 'zod';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000),
});

const messagesSchema = z.array(messageSchema).min(1).max(50);

async function safeChat(messages: any[], tenantId: string) {
  // Validate input
  const validatedMessages = messagesSchema.parse(messages);

  // Sanitize content
  const sanitizedMessages = validatedMessages.map((msg) => ({
    ...msg,
    content: sanitizeInput(msg.content),
  }));

  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
  });

  return client.chat(sanitizedMessages);
}

function sanitizeInput(input: string): string {
  // Remove potential injection attempts
  return input.replace(/[<>]/g, '').trim();
}
```

### Rate Limiting per Tenant

```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

const rateLimiter = new RateLimiterMemory({
  points: 20, // Number of requests
  duration: 60, // Per 60 seconds
});

async function rateLimitedChat(tenantId: string, messages: any[]) {
  try {
    await rateLimiter.consume(tenantId);
  } catch (error) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
  });

  return client.chat(messages);
}
```

## Deployment Scenarios

### Cloud Hosted (Anthropic)

**Recommended For:**
- SaaS applications
- Rapid deployment
- Automatic scaling
- Minimal infrastructure

**Configuration:**
```bash
LLM_PRIMARY_PROVIDER=anthropic
LLM_FALLBACK_ENABLED=false
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### On-Premise (Ollama)

**Recommended For:**
- Data privacy requirements
- Air-gapped environments
- Cost control
- Custom models

**Configuration:**
```bash
LLM_PRIMARY_PROVIDER=ollama
LLM_FALLBACK_ENABLED=false
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:70b
OLLAMA_KEEP_ALIVE=true
```

**Docker Compose Setup:**
```yaml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=24h
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama-data:
```

### Hybrid (Primary + Fallback)

**Recommended For:**
- High availability requirements
- Cost optimization
- Gradual migration
- Regional compliance

**Configuration:**
```bash
LLM_PRIMARY_PROVIDER=anthropic
LLM_FALLBACK_ENABLED=true
LLM_FALLBACK_PROVIDER=ollama

ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

OLLAMA_API_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:70b
```

### Multi-Region Setup

```typescript
import { createLLMClient, AgentRole, LLMProvider } from '@friendly-tech/core/llm-providers';

function getRegionalProvider(region: string): LLMProvider {
  const regionalConfig = {
    'us-east-1': LLMProvider.ANTHROPIC,
    'eu-west-1': LLMProvider.ANTHROPIC,
    'ap-southeast-1': LLMProvider.OLLAMA, // Data residency requirements
    'on-premise': LLMProvider.OLLAMA,
  };

  return regionalConfig[region] || LLMProvider.ANTHROPIC;
}

async function createRegionalClient(tenantId: string, region: string) {
  const provider = getRegionalProvider(region);

  return createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
    provider,
  });
}
```

## More Information

For usage examples and patterns, see:

- [README.md](./README.md) - Main documentation
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples
