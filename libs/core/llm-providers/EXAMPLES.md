# Usage Examples

This document provides practical examples for using the llm-providers library.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Streaming Responses](#streaming-responses)
- [Tool Calling](#tool-calling)
- [Custom Configurations](#custom-configurations)
- [Multi-Tenant Scenarios](#multi-tenant-scenarios)
- [Error Handling Patterns](#error-handling-patterns)
- [Integration Patterns](#integration-patterns)
- [Advanced Use Cases](#advanced-use-cases)

## Basic Usage

### Simple Chat Request

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function basicChat() {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
  });

  const response = await client.chat([
    { role: 'user', content: 'Create a login form with email and password fields' },
  ]);

  console.log('Response:', response.content);
  console.log('Tokens used:', response.usage.totalTokens);
  console.log('Cost:', `$${response.usage.estimatedCost}`);
}
```

### Conversational Context

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function conversation() {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
  });

  // Maintain conversation history
  const messages = [
    { role: 'user', content: 'I need to build a dashboard' },
    { role: 'assistant', content: 'I can help you build a dashboard. What data would you like to display?' },
    { role: 'user', content: 'Temperature and humidity from IoT sensors' },
  ];

  const response = await client.chat(messages);
  console.log(response.content);

  // Add response to history for next turn
  messages.push({ role: 'assistant', content: response.content });
}
```

### Using Different Agent Roles

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function differentRoles() {
  // Builder agent for UI/UX
  const builderClient = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
  });

  const uiResponse = await builderClient.chat([
    { role: 'user', content: 'Design a card layout for sensor data' },
  ]);

  // IoT Integration agent for data processing
  const iotClient = createLLMClient({
    role: AgentRole.IOT_INTEGRATION,
    tenantId: 'tenant-123',
  });

  const dataResponse = await iotClient.chat([
    { role: 'user', content: 'Parse this sensor payload: {"temp":23.5,"hum":65.2}' },
  ]);

  // Code Generator agent for implementation
  const codeClient = createLLMClient({
    role: AgentRole.CODE_GENERATOR,
    tenantId: 'tenant-123',
  });

  const codeResponse = await codeClient.chat([
    { role: 'user', content: 'Generate a TypeScript service for sensor data API' },
  ]);

  console.log({ uiResponse, dataResponse, codeResponse });
}
```

## Streaming Responses

### Basic Streaming

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function streamChat() {
  const client = createLLMClient({
    role: AgentRole.CODE_GENERATOR,
    tenantId: 'tenant-123',
    stream: true,
  });

  const stream = await client.chatStream([
    { role: 'user', content: 'Generate a React component for a temperature gauge' },
  ]);

  let fullResponse = '';

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.delta);
      fullResponse += chunk.delta;
    } else if (chunk.type === 'usage') {
      console.log(`\n\nTokens used: ${chunk.usage.totalTokens}`);
    }
  }

  return fullResponse;
}
```

### Streaming with Progress Tracking

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function streamWithProgress() {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    stream: true,
  });

  const stream = await client.chatStream([
    { role: 'user', content: 'Create a complete dashboard layout with multiple widgets' },
  ]);

  let charCount = 0;
  const startTime = Date.now();

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      charCount += chunk.delta.length;
      process.stdout.write(chunk.delta);
    } else if (chunk.type === 'usage') {
      const duration = Date.now() - startTime;
      console.log(`\n\nCompleted in ${duration}ms`);
      console.log(`Characters: ${charCount}`);
      console.log(`Tokens: ${chunk.usage.totalTokens}`);
      console.log(`Speed: ${(charCount / duration * 1000).toFixed(2)} chars/sec`);
    }
  }
}
```

### Streaming to WebSocket

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';
import type { WebSocket } from 'ws';

async function streamToWebSocket(ws: WebSocket, userMessage: string, tenantId: string) {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
    stream: true,
  });

  try {
    const stream = await client.chatStream([
      { role: 'user', content: userMessage },
    ]);

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        ws.send(JSON.stringify({
          type: 'content',
          delta: chunk.delta,
        }));
      } else if (chunk.type === 'usage') {
        ws.send(JSON.stringify({
          type: 'complete',
          usage: chunk.usage,
        }));
      }
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}
```

## Tool Calling

### Simple Tool Function

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function weatherTool() {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    tools: [
      {
        name: 'get_weather',
        description: 'Get current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name or coordinates',
            },
            units: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature units',
            },
          },
          required: ['location'],
        },
      },
    ],
  });

  const response = await client.chat([
    { role: 'user', content: 'What is the weather in San Francisco?' },
  ]);

  if (response.toolCalls && response.toolCalls.length > 0) {
    for (const toolCall of response.toolCalls) {
      console.log('Tool:', toolCall.name);
      console.log('Arguments:', toolCall.arguments);

      // Execute the tool
      if (toolCall.name === 'get_weather') {
        const weatherData = await fetchWeather(toolCall.arguments.location);

        // Send result back to LLM
        const finalResponse = await client.chat([
          { role: 'user', content: 'What is the weather in San Francisco?' },
          { role: 'assistant', toolCalls: response.toolCalls },
          {
            role: 'tool',
            toolCallId: toolCall.id,
            content: JSON.stringify(weatherData),
          },
        ]);

        console.log('Final response:', finalResponse.content);
      }
    }
  }
}

async function fetchWeather(location: string) {
  // Mock implementation
  return {
    location,
    temperature: 72,
    units: 'fahrenheit',
    conditions: 'sunny',
  };
}
```

### IoT Data Query Tools

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function iotQueryTools() {
  const client = createLLMClient({
    role: AgentRole.IOT_INTEGRATION,
    tenantId: 'tenant-123',
    tools: [
      {
        name: 'query_sensor_data',
        description: 'Query historical sensor data from InfluxDB',
        inputSchema: {
          type: 'object',
          properties: {
            sensorId: { type: 'string', description: 'Sensor ID' },
            metric: {
              type: 'string',
              enum: ['temperature', 'humidity', 'pressure'],
              description: 'Metric to query',
            },
            timeRange: {
              type: 'string',
              description: 'Time range (e.g., "1h", "24h", "7d")',
            },
            aggregation: {
              type: 'string',
              enum: ['mean', 'max', 'min', 'sum'],
              description: 'Aggregation function',
            },
          },
          required: ['sensorId', 'metric', 'timeRange'],
        },
      },
      {
        name: 'get_sensor_status',
        description: 'Get current status and metadata of a sensor',
        inputSchema: {
          type: 'object',
          properties: {
            sensorId: { type: 'string', description: 'Sensor ID' },
          },
          required: ['sensorId'],
        },
      },
    ],
  });

  const response = await client.chat([
    {
      role: 'user',
      content: 'Show me the average temperature from sensor-001 over the last 24 hours',
    },
  ]);

  // Handle tool calls...
  console.log(response);
}
```

### Multi-Tool Orchestration

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function multiToolOrchestration() {
  const client = createLLMClient({
    role: AgentRole.ORCHESTRATION,
    tenantId: 'tenant-123',
    tools: [
      {
        name: 'create_project',
        description: 'Create a new project in the system',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name'],
        },
      },
      {
        name: 'add_page',
        description: 'Add a page to a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            pageName: { type: 'string' },
            layout: { type: 'string' },
          },
          required: ['projectId', 'pageName'],
        },
      },
      {
        name: 'add_data_source',
        description: 'Add a data source to a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
            type: { type: 'string', enum: ['REST_API', 'WEBSOCKET', 'MQTT'] },
            endpoint: { type: 'string' },
          },
          required: ['projectId', 'type', 'endpoint'],
        },
      },
    ],
  });

  const response = await client.chat([
    {
      role: 'user',
      content:
        'Create a new IoT dashboard project called "Factory Monitor" with a main page and connect it to the MQTT broker at mqtt://factory.local:1883',
    },
  ]);

  console.log('Agent plan:', response.content);
  console.log('Tools to execute:', response.toolCalls?.map((t) => t.name));
}
```

## Custom Configurations

### Temperature Control

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function temperatureControl() {
  // Creative responses (high temperature)
  const creativeClient = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    temperature: 1.0,
  });

  const creativeResponse = await creativeClient.chat([
    { role: 'user', content: 'Suggest innovative UI designs for a smart home app' },
  ]);

  // Deterministic responses (low temperature)
  const deterministicClient = createLLMClient({
    role: AgentRole.CODE_GENERATOR,
    tenantId: 'tenant-123',
    temperature: 0.0,
  });

  const deterministicResponse = await deterministicClient.chat([
    { role: 'user', content: 'Generate a TypeScript interface for a user object' },
  ]);

  console.log({ creativeResponse, deterministicResponse });
}
```

### Custom Model Selection

```typescript
import { createLLMClient, AgentRole, LLMProvider } from '@friendly-tech/core/llm-providers';

async function customModels() {
  // Use Claude Opus for complex reasoning
  const opusClient = createLLMClient({
    role: AgentRole.ORCHESTRATION,
    tenantId: 'tenant-123',
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-3-opus-20240229',
    maxTokens: 8192,
  });

  // Use Claude Haiku for fast responses
  const haikuClient = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-3-haiku-20240307',
    maxTokens: 2048,
  });

  // Use Ollama for on-premise deployment
  const ollamaClient = createLLMClient({
    role: AgentRole.CODE_GENERATOR,
    tenantId: 'tenant-123',
    provider: LLMProvider.OLLAMA,
    model: 'codellama:34b',
    maxTokens: 4096,
  });

  // Execute different tasks with appropriate models
  const [orchestrationResult, uiResult, codeResult] = await Promise.all([
    opusClient.chat([{ role: 'user', content: 'Plan a multi-step workflow' }]),
    haikuClient.chat([{ role: 'user', content: 'Create a button component' }]),
    ollamaClient.chat([{ role: 'user', content: 'Generate a helper function' }]),
  ]);

  console.log({ orchestrationResult, uiResult, codeResult });
}
```

### System Prompts

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function customSystemPrompt() {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    systemPrompt: `You are an expert UI/UX designer specializing in industrial IoT applications.
Your designs prioritize:
1. Real-time data visibility
2. Accessibility for operators in harsh environments
3. Mobile-first responsive layouts
4. Dark mode for 24/7 operation centers
5. Color-blind friendly palettes

Always provide rationale for your design decisions.`,
  });

  const response = await client.chat([
    { role: 'user', content: 'Design a control panel for a factory production line' },
  ]);

  console.log(response.content);
}
```

## Multi-Tenant Scenarios

### Tenant-Specific Configuration

```typescript
import { createLLMClient, AgentRole, LLMProvider } from '@friendly-tech/core/llm-providers';
import { getTenantConfig } from './tenant-service';

async function tenantSpecificConfig(tenantId: string) {
  // Load tenant configuration
  const tenantConfig = await getTenantConfig(tenantId);

  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
    // Override based on tenant tier
    provider: tenantConfig.tier === 'ENTERPRISE' ? LLMProvider.ANTHROPIC : LLMProvider.OLLAMA,
    model:
      tenantConfig.tier === 'ENTERPRISE'
        ? 'claude-3-5-sonnet-20241022'
        : 'llama3.1:70b',
    maxTokens: tenantConfig.maxTokensPerRequest,
    // Tenant-specific usage tracking
    onTokenUsage: (usage) => {
      console.log(`Tenant ${tenantId} used ${usage.totalTokens} tokens`);
      // Check if tenant is approaching limits
      if (usage.totalTokens > tenantConfig.warningThreshold) {
        console.warn(`Tenant ${tenantId} approaching token limit`);
      }
    },
  });

  return client;
}
```

### Multi-Tenant Rate Limiting

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';
import { RateLimiter } from 'limiter';

class TenantRateLimitedClient {
  private rateLimiters = new Map<string, RateLimiter>();

  private getRateLimiter(tenantId: string): RateLimiter {
    if (!this.rateLimiters.has(tenantId)) {
      // 100 requests per hour per tenant
      this.rateLimiters.set(tenantId, new RateLimiter({ tokensPerInterval: 100, interval: 'hour' }));
    }
    return this.rateLimiters.get(tenantId)!;
  }

  async chat(tenantId: string, messages: any[]) {
    const limiter = this.getRateLimiter(tenantId);

    // Wait for rate limit token
    await limiter.removeTokens(1);

    const client = createLLMClient({
      role: AgentRole.BUILDER,
      tenantId,
    });

    return client.chat(messages);
  }
}
```

### Tenant Usage Reporting

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';
import { createTenantScopedClient } from '@friendly-tech/data/prisma-schema';

async function tenantUsageTracking(tenantId: string) {
  const db = createTenantScopedClient(tenantId);

  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
    onTokenUsage: async (usage) => {
      // Log to database
      await db.billingEvent.create({
        data: {
          eventType: 'LLM_API_CALL',
          metadata: {
            provider: usage.provider,
            model: usage.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            estimatedCost: usage.estimatedCost,
            role: usage.role,
          },
          amount: usage.estimatedCost,
        },
      });
    },
  });

  const response = await client.chat([
    { role: 'user', content: 'Design a dashboard' },
  ]);

  // Get monthly usage
  const monthlyUsage = await db.billingEvent.aggregate({
    where: {
      eventType: 'LLM_API_CALL',
      createdAt: {
        gte: new Date(new Date().setDate(1)), // First of month
      },
    },
    _sum: {
      amount: true,
    },
  });

  console.log(`Monthly cost for ${tenantId}: $${monthlyUsage._sum.amount}`);

  await db.$disconnect();
  return response;
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
import {
  createLLMClient,
  AgentRole,
  LLMError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  NetworkError,
} from '@friendly-tech/core/llm-providers';

async function comprehensiveErrorHandling() {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
  });

  try {
    const response = await client.chat([
      { role: 'user', content: 'Create a dashboard' },
    ]);

    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error('Rate limit exceeded');
      console.error(`Retry after: ${error.retryAfter} seconds`);
      console.error(`Limit: ${error.limit} requests`);

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, error.retryAfter * 1000));
      return client.chat([{ role: 'user', content: 'Create a dashboard' }]);
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication failed:', error.message);
      // Refresh API key or notify admin
      throw error;
    } else if (error instanceof InvalidRequestError) {
      console.error('Invalid request:', error.message);
      console.error('Details:', error.details);
      // Log and notify developers
      throw error;
    } else if (error instanceof NetworkError) {
      console.error('Network error:', error.message);
      // Retry with exponential backoff
      throw error;
    } else if (error instanceof LLMError) {
      console.error('LLM error:', error.message);
      console.error('Provider:', error.provider);
      throw error;
    } else {
      console.error('Unexpected error:', error);
      throw error;
    }
  }
}
```

### Retry with Exponential Backoff

```typescript
import { createLLMClient, AgentRole, LLMError, NetworkError } from '@friendly-tech/core/llm-providers';

async function retryWithBackoff(
  messages: any[],
  maxRetries = 3,
  baseDelay = 1000
) {
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId: 'tenant-123',
  });

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.chat(messages);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof NetworkError || (error instanceof LLMError && error.retryable)) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        // Non-retryable error
        throw error;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError!.message}`);
}
```

### Graceful Degradation

```typescript
import { createLLMClient, AgentRole, LLMProvider } from '@friendly-tech/core/llm-providers';

async function gracefulDegradation(userMessage: string, tenantId: string) {
  try {
    // Try primary provider (Anthropic)
    const primaryClient = createLLMClient({
      role: AgentRole.BUILDER,
      tenantId,
      provider: LLMProvider.ANTHROPIC,
    });

    return await primaryClient.chat([{ role: 'user', content: userMessage }]);
  } catch (primaryError) {
    console.warn('Primary provider failed, trying fallback:', primaryError);

    try {
      // Try fallback provider (Ollama)
      const fallbackClient = createLLMClient({
        role: AgentRole.BUILDER,
        tenantId,
        provider: LLMProvider.OLLAMA,
      });

      return await fallbackClient.chat([{ role: 'user', content: userMessage }]);
    } catch (fallbackError) {
      console.error('Fallback provider also failed:', fallbackError);

      // Return cached or default response
      return {
        content: 'I apologize, but I am temporarily unable to process your request. Please try again later.',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
        provider: 'fallback',
      };
    }
  }
}
```

## Integration Patterns

### Fastify Route Handler

```typescript
import Fastify from 'fastify';
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

const app = Fastify({ logger: true });

app.post('/api/chat', async (request, reply) => {
  const { messages, role = 'BUILDER' } = request.body as any;
  const tenantId = request.user?.tenantId;

  if (!tenantId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const client = createLLMClient({
      role: AgentRole[role as keyof typeof AgentRole],
      tenantId,
    });

    const response = await client.chat(messages);

    return {
      content: response.content,
      usage: response.usage,
      model: response.model,
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

app.listen({ port: 3001 });
```

### Express Streaming Endpoint

```typescript
import express from 'express';
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

const app = express();
app.use(express.json());

app.post('/api/chat/stream', async (req, res) => {
  const { messages, role = 'BUILDER' } = req.body;
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const client = createLLMClient({
      role: AgentRole[role as keyof typeof AgentRole],
      tenantId,
      stream: true,
    });

    const stream = await client.chatStream(messages);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`);
    res.end();
  }
});

app.listen(3001);
```

### WebSocket Real-Time Chat

```typescript
import { WebSocketServer } from 'ws';
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  let conversationHistory: any[] = [];

  ws.on('message', async (data) => {
    try {
      const { message, tenantId, role = 'BUILDER' } = JSON.parse(data.toString());

      conversationHistory.push({ role: 'user', content: message });

      const client = createLLMClient({
        role: AgentRole[role as keyof typeof AgentRole],
        tenantId,
        stream: true,
      });

      const stream = await client.chatStream(conversationHistory);

      let assistantMessage = '';

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          assistantMessage += chunk.delta;
          ws.send(JSON.stringify(chunk));
        } else if (chunk.type === 'usage') {
          ws.send(JSON.stringify(chunk));
        }
      }

      conversationHistory.push({ role: 'assistant', content: assistantMessage });
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  });
});
```

## Advanced Use Cases

### Parallel Agent Execution

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function parallelAgents(tenantId: string) {
  const userRequest = 'Create an IoT dashboard for monitoring factory equipment';

  // Execute multiple agents in parallel
  const [builderResult, iotResult, codeResult] = await Promise.all([
    // Builder designs the UI
    createLLMClient({ role: AgentRole.BUILDER, tenantId }).chat([
      { role: 'user', content: `${userRequest}. Focus on UI/UX design.` },
    ]),

    // IoT agent plans data integration
    createLLMClient({ role: AgentRole.IOT_INTEGRATION, tenantId }).chat([
      { role: 'user', content: `${userRequest}. Focus on data sources and integration.` },
    ]),

    // Code generator creates implementation
    createLLMClient({ role: AgentRole.CODE_GENERATOR, tenantId }).chat([
      { role: 'user', content: `${userRequest}. Focus on TypeScript implementation.` },
    ]),
  ]);

  // Orchestration agent combines results
  const orchestrationClient = createLLMClient({
    role: AgentRole.ORCHESTRATION,
    tenantId,
  });

  const finalPlan = await orchestrationClient.chat([
    {
      role: 'user',
      content: `Combine these agent outputs into a cohesive implementation plan:

UI Design: ${builderResult.content}

IoT Integration: ${iotResult.content}

Implementation: ${codeResult.content}`,
    },
  ]);

  return {
    ui: builderResult.content,
    integration: iotResult.content,
    code: codeResult.content,
    plan: finalPlan.content,
    totalCost:
      builderResult.usage.estimatedCost +
      iotResult.usage.estimatedCost +
      codeResult.usage.estimatedCost +
      finalPlan.usage.estimatedCost,
  };
}
```

### Context-Aware Caching

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

async function cachedChat(messages: any[], tenantId: string) {
  // Create cache key from messages
  const cacheKey = `llm:${tenantId}:${Buffer.from(JSON.stringify(messages)).toString('base64')}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Execute LLM request
  const client = createLLMClient({
    role: AgentRole.BUILDER,
    tenantId,
  });

  const response = await client.chat(messages);

  // Cache for 1 hour
  await redis.setEx(cacheKey, 3600, JSON.stringify(response));

  return response;
}
```

### Batch Processing

```typescript
import { createLLMClient, AgentRole } from '@friendly-tech/core/llm-providers';

async function batchProcess(requests: Array<{ messages: any[]; tenantId: string }>) {
  const results = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (req) => {
        const client = createLLMClient({
          role: AgentRole.BUILDER,
          tenantId: req.tenantId,
        });

        try {
          return {
            success: true,
            response: await client.chat(req.messages),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    results.push(...batchResults);

    // Wait between batches
    if (i + batchSize < requests.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

### Token Usage Tracking and Billing

```typescript
import {
  trackTokenUsage,
  onTokenUsage,
  onTenantUsage,
  tokenUsageTracker,
  LLMProvider,
  AgentRole,
} from '@friendly-aiaep/llm-providers';

// Track token usage
async function trackUsage() {
  const event = trackTokenUsage({
    inputTokens: 1000,
    outputTokens: 500,
    model: 'claude-3-5-sonnet-20241022',
    provider: LLMProvider.ANTHROPIC,
    agentRole: AgentRole.BUILDER,
    tenantId: 'tenant-123',
    metadata: {
      projectId: 'proj-456',
      sessionId: 'session-789',
    },
  });

  console.log(`Cost: $${event.cost.toFixed(4)}`);
}

// Listen to all usage events for billing
onTokenUsage((event) => {
  console.log(`Tenant ${event.tenantId} used ${event.totalTokens} tokens`);
  // Send to billing service
});

// Monitor specific tenant
onTenantUsage('tenant-123', (event) => {
  const aggregation = tokenUsageTracker.getTenantAggregation('tenant-123');
  if (aggregation.totalCost > 100) {
    console.warn('Tenant exceeded quota!');
  }
});

// Generate monthly report
function generateMonthlyReport(tenantId: string, month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const aggregation = tokenUsageTracker.getTimeRangeAggregation(
    start,
    end,
    tenantId
  );

  return {
    tenantId,
    period: { start, end },
    totalCost: aggregation.totalCost,
    totalTokens: aggregation.totalTokens,
    byProvider: Array.from(aggregation.byProvider.values()),
    byModel: Array.from(aggregation.byModel.values()),
  };
}
```

## More Examples

For additional patterns and use cases, see:

- [README.md](./README.md) - Main documentation
- [USAGE_TRACKER_INTEGRATION.md](./USAGE_TRACKER_INTEGRATION.md) - Detailed token tracking and billing integration guide
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration options and tuning
