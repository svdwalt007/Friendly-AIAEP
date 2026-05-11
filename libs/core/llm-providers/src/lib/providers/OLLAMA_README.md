# Ollama Provider

## Quick Reference

**Location**: `libs/core/llm-providers/src/lib/providers/ollama.ts`

**Class**: `OllamaProvider`

**Interface**: Implements `LLMProvider` from `../types`

## Installation

```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve

# Pull a model
ollama pull llama2
```

## Basic Usage

```typescript
import { OllamaProvider, AgentRole } from '@friendly-aiaep/llm-providers';

const provider = new OllamaProvider(
  {
    provider: 'ollama',
    model: 'llama2',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
  },
  {
    tenantId: 'my-tenant',
    agentRole: AgentRole.SUPERVISOR,
  }
);

// Non-streaming
const response = await provider.chat([
  { role: 'user', content: 'Hello!' }
]);

// Streaming
const stream = await provider.chat(
  [{ role: 'user', content: 'Hello!' }],
  { stream: true }
);

for await (const chunk of stream) {
  console.log(chunk.delta.content);
}
```

## Features

- ✅ HTTP client using fetch API
- ✅ Implements LLMProvider interface
- ✅ Configurable base URL and timeout
- ✅ Non-streaming and streaming modes
- ✅ SSE (Server-Sent Events) parsing
- ✅ Claude tool → OpenAI function translation
- ✅ Token usage tracking
- ✅ Connection error handling
- ✅ Timeout support
- ✅ TypeScript types
- ✅ Comprehensive tests

## API

### Constructor

```typescript
new OllamaProvider(
  config: LLMConfig,
  options?: {
    tenantId?: string;
    agentRole?: AgentRole;
  }
)
```

### Methods

#### `chat(messages, options?)`

Send a chat completion request.

**Parameters:**
- `messages: Message[]` - Conversation messages
- `options?: ChatOptions` - Optional configuration

**Returns:** `Promise<ChatResponse | AsyncGenerator<StreamChunk>>`

#### `validateConfig()`

Validate that Ollama is accessible.

**Returns:** `Promise<boolean>`

### Properties

- `name: string` - Provider name ('ollama')
- `defaultModel: string` - Default model name

## Configuration

| Option | Type | Default | Required |
|--------|------|---------|----------|
| `provider` | `string` | - | Yes |
| `model` | `string` | - | Yes |
| `apiKey` | `string` | `''` | No |
| `baseUrl` | `string` | `'http://localhost:11434'` | No |
| `timeout` | `number` | `30000` | No |

## Error Types

- `OllamaError` - Base error class
- `OllamaTimeoutError` - Request timeout
- `OllamaConnectionError` - Connection failed

## SSE Parser

Utility class for parsing Server-Sent Events:

```typescript
import { SSEParser } from '@friendly-aiaep/llm-providers';

const parser = new SSEParser();

for (const event of parser.parse(chunk)) {
  console.log(event.data);
}
```

## Documentation

- **Full Documentation**: [README.md](./README.md)
- **Examples**: [OLLAMA_EXAMPLE.md](../../OLLAMA_EXAMPLE.md)
- **Implementation**: [OLLAMA_IMPLEMENTATION.md](../../OLLAMA_IMPLEMENTATION.md)

## Testing

```bash
npm test libs/core/llm-providers
```

## Files

- `ollama.ts` - Implementation (670 lines)
- `ollama.spec.ts` - Tests (506 lines)
- `README.md` - Full documentation
- `OLLAMA_README.md` - This file

## License

Part of Friendly AI AEP system.
