# LLM Providers

This directory contains implementations of various LLM providers for the Friendly AI AEP system.

## Ollama Provider

The `OllamaProvider` class provides an interface to locally hosted Ollama models through Ollama's OpenAI-compatible API.

### Features

- **OpenAI-Compatible API**: Uses Ollama's `/v1/chat/completions` endpoint
- **Streaming Support**: Implements SSE (Server-Sent Events) parsing for streaming responses
- **Tool Calling**: Translates between Claude tool format and OpenAI function format
- **Error Handling**: Comprehensive error handling with typed exceptions
- **Token Usage Tracking**: Automatic token usage tracking and cost calculation
- **Connection Management**: Built-in timeout and retry logic

### Installation

Ensure Ollama is installed and running:

```bash
# Install Ollama (Linux/Mac)
curl https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull a model
ollama pull llama2
```

### Usage

#### Basic Usage

```typescript
import { OllamaProvider, AgentRole } from '@friendly-aiaep/llm-providers';

// Create provider instance
const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '', // Not required for Ollama
    baseUrl: 'http://localhost:11434', // Optional, defaults to localhost
    timeout: 30000, // Optional, defaults to 30 seconds
  },
  {
    tenantId: 'my-tenant',
    agentRole: AgentRole.SUPERVISOR,
  }
);

// Validate connection
const isValid = await provider.validateConfig();
console.log('Ollama connected:', isValid);

// Send a chat message
const response = await provider.chat([
  { role: 'user', content: 'What is the capital of France?' },
]);

console.log(response.message.content);
```

#### Streaming Responses

```typescript
const stream = await provider.chat(
  [
    { role: 'user', content: 'Write a short story about a robot.' },
  ],
  { stream: true }
);

for await (const chunk of stream) {
  if (chunk.delta.content) {
    process.stdout.write(chunk.delta.content);
  }
}
```

#### Using Tools/Functions

```typescript
const response = await provider.chat(
  [
    { role: 'user', content: 'What is the weather in Paris?' },
  ],
  {
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name',
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'Temperature unit',
              },
            },
            required: ['location'],
          },
        },
      },
    ],
    tool_choice: 'auto',
  }
);

// Check if tool was called
if (response.message.tool_calls) {
  for (const toolCall of response.message.tool_calls) {
    console.log('Function called:', toolCall.function.name);
    console.log('Arguments:', toolCall.function.arguments);
  }
}
```

#### Advanced Configuration

```typescript
const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2:13b', // Specify model variant
    baseUrl: 'http://ollama-server:11434', // Custom server
    timeout: 60000, // 60 second timeout for large responses
    temperature: 0.7,
    maxTokens: 2000,
  },
  {
    tenantId: 'production-tenant',
    agentRole: AgentRole.IOT_DOMAIN,
  }
);

// Send chat with custom options
const response = await provider.chat(
  [
    { role: 'system', content: 'You are a helpful IoT expert.' },
    { role: 'user', content: 'Explain MQTT protocol.' },
  ],
  {
    temperature: 0.8,
    max_tokens: 1500,
    top_p: 0.95,
    stop: ['\n\n', 'END'],
  }
);
```

### Error Handling

The OllamaProvider throws typed errors for different failure scenarios:

```typescript
import {
  OllamaProvider,
  OllamaError,
  OllamaTimeoutError,
  OllamaConnectionError,
} from '@friendly-aiaep/llm-providers';

try {
  const response = await provider.chat([
    { role: 'user', content: 'Hello!' },
  ]);
} catch (error) {
  if (error instanceof OllamaTimeoutError) {
    console.error('Request timed out:', error.message);
    // Retry logic here
  } else if (error instanceof OllamaConnectionError) {
    console.error('Cannot connect to Ollama:', error.message);
    // Check if Ollama is running
  } else if (error instanceof OllamaError) {
    console.error('Ollama error:', error.type, error.message);
    console.error('Status code:', error.statusCode);
    console.error('Retryable:', error.retryable);
  }
}
```

### SSE Parser

The `SSEParser` class is a utility for parsing Server-Sent Events from streaming responses:

```typescript
import { SSEParser } from '@friendly-aiaep/llm-providers';

const parser = new SSEParser();

// Parse chunks as they arrive
for (const event of parser.parse(chunk)) {
  console.log('Event:', event.data);
  console.log('Event type:', event.event);
  console.log('Event ID:', event.id);
}

// Flush any remaining data
for (const event of parser.flush()) {
  console.log('Final event:', event.data);
}

// Reset parser for reuse
parser.reset();
```

### Token Usage Tracking

Token usage is automatically tracked and emitted via the global `tokenUsageTracker`:

```typescript
import { onTokenUsage } from '@friendly-aiaep/llm-providers';

// Listen to all usage events
onTokenUsage((event) => {
  console.log('Provider:', event.provider);
  console.log('Model:', event.model);
  console.log('Prompt tokens:', event.inputTokens);
  console.log('Completion tokens:', event.outputTokens);
  console.log('Cost:', event.cost); // Always $0 for Ollama
  console.log('Tenant:', event.tenantId);
  console.log('Agent role:', event.agentRole);
});

// Make API calls - usage is tracked automatically
await provider.chat([{ role: 'user', content: 'Hello' }]);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `string` | required | Must be 'ollama' |
| `model` | `string` | required | Model name (e.g., 'llama2', 'mistral') |
| `apiKey` | `string` | '' | Not used for Ollama but required by interface |
| `baseUrl` | `string` | `'http://localhost:11434'` | Ollama server URL |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `temperature` | `number` | - | Default sampling temperature |
| `maxTokens` | `number` | - | Default max tokens to generate |

### Chat Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | config.model | Override default model |
| `temperature` | `number` | - | Sampling temperature (0-2) |
| `max_tokens` | `number` | - | Maximum tokens to generate |
| `stream` | `boolean` | `false` | Enable streaming responses |
| `tools` | `ToolDef[]` | - | Available tools/functions |
| `tool_choice` | `string \| object` | `'auto'` | Control tool usage |
| `top_p` | `number` | - | Nucleus sampling parameter |
| `stop` | `string \| string[]` | - | Stop sequences |

### Supported Models

Ollama supports a wide range of models. Some popular options:

- `llama2` - Meta's Llama 2 (7B, 13B, 70B variants)
- `llama2:13b` - Llama 2 13B parameters
- `mistral` - Mistral 7B
- `mixtral` - Mixtral 8x7B
- `codellama` - Code-specialized Llama
- `vicuna` - Vicuna models
- `orca-mini` - Smaller, efficient models
- `phi` - Microsoft's Phi models

Check available models with: `ollama list`

### Performance Tips

1. **Model Selection**: Smaller models (7B) are faster but less capable. Use 13B+ for complex tasks.
2. **Local Deployment**: Run Ollama on a machine with sufficient RAM (8GB+ for 7B models).
3. **GPU Acceleration**: Ollama automatically uses GPU if available (CUDA/Metal).
4. **Context Window**: Be mindful of context window limits when sending long conversations.
5. **Streaming**: Use streaming for better user experience with long responses.

### Troubleshooting

#### Connection Refused

```
Error: Cannot connect to Ollama at http://localhost:11434
```

**Solution**: Ensure Ollama is running:
```bash
ollama serve
```

#### Model Not Found

```
Error: model 'llama2' not found
```

**Solution**: Pull the model first:
```bash
ollama pull llama2
```

#### Timeout Errors

```
Error: Request timeout after 30000ms
```

**Solutions**:
- Increase timeout in config
- Use smaller model
- Reduce max_tokens
- Check server load

#### Out of Memory

```
Error: failed to load model
```

**Solutions**:
- Use smaller model variant
- Close other applications
- Increase system RAM
- Use quantized models

### Architecture

```
┌─────────────────┐
│  OllamaProvider │
└────────┬────────┘
         │
         ├─► validateConfig() ────► /api/tags
         │
         ├─► chat() ─────────────► /v1/chat/completions
         │    │
         │    ├─► completeChat()   (non-streaming)
         │    └─► streamChat()     (streaming)
         │
         ├─► SSEParser ──────────► Parse SSE events
         │
         └─► TokenUsageTracker ──► Track usage
```

### Testing

```bash
# Run tests
npm test libs/core/llm-providers

# Run specific test file
npm test libs/core/llm-providers/src/lib/providers/ollama.spec.ts

# Run with coverage
npm test -- --coverage
```

### Integration Examples

See the `ollama.spec.ts` file for comprehensive test examples covering:
- Basic chat completions
- Streaming responses
- Tool/function calling
- Error handling
- SSE parsing
- Token tracking

### Contributing

When adding new features to OllamaProvider:

1. Update the interface implementation
2. Add comprehensive tests
3. Update this documentation
4. Ensure TypeScript types are correct
5. Test with multiple models
6. Handle errors gracefully

### License

Part of the Friendly AI AEP system.
