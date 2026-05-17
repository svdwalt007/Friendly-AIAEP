# Ollama Provider Example Usage

## Quick Start

### 1. Install and Start Ollama

```bash
# Install Ollama (if not already installed)
curl https://ollama.ai/install.sh | sh

# Start the Ollama service
ollama serve

# Pull a model (in another terminal)
ollama pull llama2
```

### 2. Basic Usage Example

```typescript
import { OllamaProvider, AgentRole } from '@friendly-aiaep/llm-providers';

// Create the provider
const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '', // Not required for Ollama
    baseUrl: 'http://localhost:11434',
  },
  {
    tenantId: 'example-tenant',
    agentRole: AgentRole.SUPERVISOR,
  }
);

// Validate connection
try {
  const isValid = await provider.validateConfig();
  console.log('Ollama is accessible:', isValid);
} catch (error) {
  console.error('Cannot connect to Ollama:', error.message);
  process.exit(1);
}

// Send a simple message
const response = await provider.chat([
  {
    role: 'user',
    content: 'What is TypeScript?',
  },
]);

console.log('Response:', response.message.content);
console.log('Tokens used:', response.usage.total_tokens);
```

### 3. Streaming Example

```typescript
import { OllamaProvider, AgentRole } from '@friendly-aiaep/llm-providers';

const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '',
  },
  {
    tenantId: 'streaming-example',
    agentRole: AgentRole.PLANNING,
  }
);

// Stream a response
const stream = await provider.chat(
  [
    {
      role: 'system',
      content: 'You are a creative writer.',
    },
    {
      role: 'user',
      content: 'Write a short poem about artificial intelligence.',
    },
  ],
  {
    stream: true,
    temperature: 0.8,
    max_tokens: 500,
  }
);

console.log('Poem:');
for await (const chunk of stream) {
  if (chunk.delta.content) {
    process.stdout.write(chunk.delta.content);
  }

  if (chunk.finish_reason) {
    console.log('\n\nFinish reason:', chunk.finish_reason);
  }

  if (chunk.usage) {
    console.log('Usage:', chunk.usage);
  }
}
```

### 4. Function/Tool Calling Example

```typescript
import { OllamaProvider, AgentRole, ToolDef } from '@friendly-aiaep/llm-providers';

const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '',
  },
  {
    tenantId: 'tool-example',
    agentRole: AgentRole.IOT_DOMAIN,
  }
);

// Define tools
const tools: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_device_status',
      description: 'Get the current status of an IoT device',
      parameters: {
        type: 'object',
        properties: {
          device_id: {
            type: 'string',
            description: 'The unique identifier of the device',
          },
        },
        required: ['device_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'control_device',
      description: 'Send a command to control an IoT device',
      parameters: {
        type: 'object',
        properties: {
          device_id: {
            type: 'string',
            description: 'The unique identifier of the device',
          },
          command: {
            type: 'string',
            description: 'The command to send',
            enum: ['on', 'off', 'reset'],
          },
        },
        required: ['device_id', 'command'],
      },
    },
  },
];

// Send message with tools
const response = await provider.chat(
  [
    {
      role: 'user',
      content: 'Check the status of device-123 and turn it on if it is off',
    },
  ],
  {
    tools,
    tool_choice: 'auto',
  }
);

// Check if tools were called
if (response.message.tool_calls && response.message.tool_calls.length > 0) {
  console.log('Tools called:');

  for (const toolCall of response.message.tool_calls) {
    console.log(`- ${toolCall.function.name}`);
    console.log(`  Arguments: ${toolCall.function.arguments}`);

    // Execute the tool
    const args = JSON.parse(toolCall.function.arguments);

    if (toolCall.function.name === 'get_device_status') {
      console.log(`  Checking status of device: ${args.device_id}`);
      // Your implementation here
    } else if (toolCall.function.name === 'control_device') {
      console.log(`  Controlling device: ${args.device_id}, command: ${args.command}`);
      // Your implementation here
    }
  }

  // Continue conversation with tool results
  const followUpResponse = await provider.chat([
    {
      role: 'user',
      content: 'Check the status of device-123 and turn it on if it is off',
    },
    {
      role: 'assistant',
      content: '',
      tool_calls: response.message.tool_calls,
    },
    {
      role: 'tool',
      content: JSON.stringify({ status: 'off', device_id: 'device-123' }),
      tool_call_id: response.message.tool_calls[0].id,
    },
  ]);

  console.log('\nFinal response:', followUpResponse.message.content);
} else {
  console.log('Response:', response.message.content);
}
```

### 5. Multi-Turn Conversation Example

```typescript
import { OllamaProvider, AgentRole, Message } from '@friendly-aiaep/llm-providers';

const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '',
  },
  {
    tenantId: 'conversation-example',
    agentRole: AgentRole.PLANNING,
  }
);

// Maintain conversation history
const conversationHistory: Message[] = [
  {
    role: 'system',
    content: 'You are a helpful project planning assistant.',
  },
];

async function sendMessage(userMessage: string) {
  // Add user message to history
  conversationHistory.push({
    role: 'user',
    content: userMessage,
  });

  // Get response
  const response = await provider.chat(conversationHistory, {
    temperature: 0.7,
    max_tokens: 1000,
  });

  // Add assistant response to history
  conversationHistory.push({
    role: 'assistant',
    content: response.message.content,
  });

  return response.message.content;
}

// Have a conversation
console.log('User: I need to build a web application.');
const response1 = await sendMessage('I need to build a web application.');
console.log('Assistant:', response1);

console.log('\nUser: What technology stack would you recommend?');
const response2 = await sendMessage('What technology stack would you recommend?');
console.log('Assistant:', response2);

console.log('\nUser: How long would it take to build?');
const response3 = await sendMessage('How long would it take to build?');
console.log('Assistant:', response3);

console.log('\nConversation history length:', conversationHistory.length);
```

### 6. Error Handling Example

```typescript
import {
  OllamaProvider,
  OllamaError,
  OllamaTimeoutError,
  OllamaConnectionError,
  AgentRole,
} from '@friendly-aiaep/llm-providers';

const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    timeout: 10000, // 10 second timeout
  },
  {
    tenantId: 'error-handling-example',
    agentRole: AgentRole.SUPERVISOR,
  }
);

async function chatWithRetry(
  messages: Message[],
  maxRetries = 3
): Promise<ChatResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);

      const response = await provider.chat(messages);
      console.log('Success!');
      return response;

    } catch (error) {
      lastError = error as Error;

      if (error instanceof OllamaTimeoutError) {
        console.error(`Timeout on attempt ${attempt}:`, error.message);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } else if (error instanceof OllamaConnectionError) {
        console.error(`Connection error on attempt ${attempt}:`, error.message);

        // Check if Ollama is running
        console.log('Checking if Ollama is accessible...');
        try {
          await provider.validateConfig();
          console.log('Ollama is accessible, retrying...');
        } catch {
          console.error('Ollama is not accessible. Please start Ollama service.');
          throw error;
        }

      } else if (error instanceof OllamaError) {
        console.error(`Ollama error on attempt ${attempt}:`, {
          type: error.type,
          message: error.message,
          statusCode: error.statusCode,
          retryable: error.retryable,
        });

        // Don't retry if error is not retryable
        if (!error.retryable) {
          throw error;
        }

      } else {
        // Unknown error, don't retry
        console.error('Unknown error:', error);
        throw error;
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// Use with retry logic
try {
  const response = await chatWithRetry([
    {
      role: 'user',
      content: 'What is the meaning of life?',
    },
  ]);

  console.log('Response:', response.message.content);
} catch (error) {
  console.error('All retry attempts failed:', error);
}
```

### 7. Token Usage Tracking Example

```typescript
import {
  OllamaProvider,
  onTokenUsage,
  onTenantUsage,
  tokenUsageTracker,
  AgentRole,
} from '@friendly-aiaep/llm-providers';

// Set up usage tracking
let totalTokens = 0;
let totalCost = 0;

// Listen to all token usage events
onTokenUsage((event) => {
  console.log('Token usage event:', {
    provider: event.provider,
    model: event.model,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    totalTokens: event.totalTokens,
    cost: event.cost, // Always $0 for Ollama
    tenantId: event.tenantId,
    agentRole: event.agentRole,
  });

  totalTokens += event.totalTokens;
  totalCost += event.cost;
});

// Listen to tenant-specific usage
onTenantUsage('my-tenant', (event) => {
  console.log('Tenant usage:', event.totalTokens, 'tokens');
});

// Create provider
const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '',
  },
  {
    tenantId: 'my-tenant',
    agentRole: AgentRole.DATABASE,
  }
);

// Make some API calls
await provider.chat([
  { role: 'user', content: 'Design a database schema for a blog.' },
]);

await provider.chat([
  { role: 'user', content: 'Add user authentication tables.' },
]);

// Get aggregated usage for tenant
const tenantAggregation = tokenUsageTracker.getTenantAggregation('my-tenant');
console.log('Total usage for tenant:', {
  totalTokens: tenantAggregation.totalTokens,
  totalCost: tenantAggregation.totalCost,
  eventCount: tenantAggregation.eventCount,
});

// Get usage by provider
const byProvider = Array.from(tenantAggregation.byProvider.entries());
console.log('Usage by provider:', byProvider);

// Get usage by agent role
const byRole = Array.from(tenantAggregation.byRole.entries());
console.log('Usage by role:', byRole);

console.log(`\nSession totals: ${totalTokens} tokens, $${totalCost.toFixed(4)}`);
```

### 8. Complete Application Example

```typescript
import {
  OllamaProvider,
  AgentRole,
  Message,
  onTokenUsage,
} from '@friendly-aiaep/llm-providers';

class ChatApplication {
  private provider: OllamaProvider;
  private conversationHistory: Message[] = [];
  private totalTokens = 0;

  constructor(tenantId: string) {
    this.provider = new OllamaProvider(
      {
        provider: 'ollama',
        model: 'llama2',
        apiKey: '',
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        temperature: 0.7,
      },
      {
        tenantId,
        agentRole: AgentRole.SUPERVISOR,
      }
    );

    // Track token usage
    onTokenUsage((event) => {
      this.totalTokens += event.totalTokens;
    });
  }

  async initialize() {
    try {
      const isValid = await this.provider.validateConfig();
      if (!isValid) {
        throw new Error('Cannot connect to Ollama');
      }
      console.log('Chat application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      // Get response
      const response = await this.provider.chat(this.conversationHistory, {
        max_tokens: 2000,
      });

      // Add assistant response
      this.conversationHistory.push({
        role: 'assistant',
        content: response.message.content,
      });

      return response.message.content;
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  async streamChat(userMessage: string): Promise<string> {
    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    let fullResponse = '';

    try {
      // Get streaming response
      const stream = await this.provider.chat(this.conversationHistory, {
        stream: true,
        max_tokens: 2000,
      });

      // Process stream
      for await (const chunk of stream) {
        if (chunk.delta.content) {
          process.stdout.write(chunk.delta.content);
          fullResponse += chunk.delta.content;
        }
      }

      console.log(); // New line after stream

      // Add assistant response
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      return fullResponse;
    } catch (error) {
      console.error('Stream chat error:', error);
      throw error;
    }
  }

  reset() {
    this.conversationHistory = [];
    console.log('Conversation reset');
  }

  getStats() {
    return {
      messageCount: this.conversationHistory.length,
      totalTokens: this.totalTokens,
    };
  }
}

// Usage
async function main() {
  const app = new ChatApplication('demo-tenant');

  await app.initialize();

  console.log('Chat with Ollama (type "exit" to quit, "reset" to clear history):\n');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    readline.question('You: ', async (input: string) => {
      const message = input.trim();

      if (message.toLowerCase() === 'exit') {
        const stats = app.getStats();
        console.log(`\nGoodbye! Messages: ${stats.messageCount}, Tokens: ${stats.totalTokens}`);
        readline.close();
        return;
      }

      if (message.toLowerCase() === 'reset') {
        app.reset();
        askQuestion();
        return;
      }

      if (!message) {
        askQuestion();
        return;
      }

      try {
        console.log('\nAssistant: ');
        await app.streamChat(message);
        console.log();
      } catch (error) {
        console.error('Error:', error.message);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
```

## Additional Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Ollama Model Library](https://ollama.ai/library)
- [OpenAI API Compatibility](https://github.com/ollama/ollama/blob/main/docs/openai.md)
- [Provider README](./src/lib/providers/README.md)

## Troubleshooting

See the [Provider README](./src/lib/providers/README.md#troubleshooting) for common issues and solutions.
