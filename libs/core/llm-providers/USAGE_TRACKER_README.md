# Token Usage Tracker

Event-driven token usage tracking and cost calculation for LLM API calls.

## Features

- **Real-time Tracking**: Track token usage as it happens with event-driven architecture
- **Automatic Cost Calculation**: Built-in pricing for Anthropic Claude, OpenAI, Google, and Ollama models
- **Multi-dimensional Aggregation**: Aggregate usage by tenant, provider, model, role, and time range
- **Billing Integration**: Easy integration with billing services through event listeners
- **TypeScript Support**: Fully typed for excellent IDE support and type safety

## Quick Start

```typescript
import {
  trackTokenUsage,
  onTokenUsage,
  LLMProvider,
  AgentRole,
} from '@friendly-aiaep/llm-providers';

// Track token usage
const event = trackTokenUsage({
  inputTokens: 1000,
  outputTokens: 500,
  model: 'claude-3-5-sonnet-20241022',
  provider: LLMProvider.ANTHROPIC,
  agentRole: AgentRole.BUILDER,
  tenantId: 'tenant-123',
});

console.log(`Cost: $${event.cost.toFixed(4)}`);

// Listen to events
onTokenUsage((event) => {
  console.log(`Tenant ${event.tenantId} spent $${event.cost}`);
});
```

## API Reference

### Core Functions

#### `trackTokenUsage(params)`

Track a token usage event and emit to listeners.

**Parameters:**
- `inputTokens` (number): Number of input tokens
- `outputTokens` (number): Number of output tokens
- `model` (string): Model identifier (e.g., 'claude-3-5-sonnet-20241022')
- `provider` (LLMProvider): Provider enum value
- `agentRole` (AgentRole): Agent role enum value
- `tenantId` (string): Tenant/organization ID
- `metadata` (optional): Additional metadata object

**Returns:** `TokenUsageEvent` with calculated cost

#### `onTokenUsage(listener)`

Add listener for all token usage events.

```typescript
onTokenUsage((event: TokenUsageEvent) => {
  // Handle event
});
```

#### `onTenantUsage(tenantId, listener)`

Add listener for specific tenant's usage events.

```typescript
onTenantUsage('tenant-123', (event: TokenUsageEvent) => {
  // Handle tenant-specific event
});
```

#### `onProviderUsage(provider, listener)`

Add listener for specific provider's usage events.

```typescript
onProviderUsage(LLMProvider.ANTHROPIC, (event: TokenUsageEvent) => {
  // Handle Anthropic-specific event
});
```

#### `onRoleUsage(role, listener)`

Add listener for specific agent role's usage events.

```typescript
onRoleUsage(AgentRole.BUILDER, (event: TokenUsageEvent) => {
  // Handle builder agent events
});
```

### TokenUsageTracker Class

#### `getTenantAggregation(tenantId)`

Get aggregated usage statistics for a tenant.

```typescript
const aggregation = tokenUsageTracker.getTenantAggregation('tenant-123');
console.log(aggregation.totalCost);
console.log(aggregation.byProvider); // Map of provider usage
console.log(aggregation.byModel);    // Map of model usage
console.log(aggregation.byRole);     // Map of role usage
```

#### `getTimeRangeAggregation(startTime, endTime, tenantId?)`

Get aggregated usage for a time range, optionally filtered by tenant.

```typescript
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const dailyUsage = tokenUsageTracker.getTimeRangeAggregation(
  yesterday,
  now,
  'tenant-123'
);
```

#### `getEvents()`

Get all tracked events.

```typescript
const events = tokenUsageTracker.getEvents();
```

#### `getEventsByTenant(tenantId)`

Get events for a specific tenant.

```typescript
const tenantEvents = tokenUsageTracker.getEventsByTenant('tenant-123');
```

#### `getEventsByTimeRange(startTime, endTime)`

Get events within a time range.

```typescript
const events = tokenUsageTracker.getEventsByTimeRange(
  new Date('2026-01-01'),
  new Date('2026-01-31')
);
```

#### `clearHistory()`

Clear all tracked events from memory.

```typescript
tokenUsageTracker.clearHistory();
```

#### `setMaxEventHistory(max)`

Set maximum number of events to keep in memory.

```typescript
tokenUsageTracker.setMaxEventHistory(5000); // Keep last 5000 events
```

### Cost Calculation

#### `calculateCost(model, inputTokens, outputTokens, provider)`

Calculate cost for token usage.

```typescript
import { calculateCost, LLMProvider } from '@friendly-aiaep/llm-providers';

const cost = calculateCost(
  'claude-3-5-sonnet-20241022',
  1000,
  500,
  LLMProvider.ANTHROPIC
);

console.log(`Estimated cost: $${cost.toFixed(4)}`);
```

## Supported Models and Pricing

### Anthropic Claude

- **claude-opus-4-5**: $15/1M input, $75/1M output
- **claude-3-5-sonnet-20241022**: $3/1M input, $15/1M output
- **claude-3-5-haiku-20241022**: $0.80/1M input, $4/1M output
- **claude-3-opus-20240229**: $15/1M input, $75/1M output
- **claude-3-sonnet-20240229**: $3/1M input, $15/1M output
- **claude-3-haiku-20240307**: $0.25/1M input, $1.25/1M output

### OpenAI

- **gpt-4-turbo**: $10/1M input, $30/1M output
- **gpt-4**: $30/1M input, $60/1M output
- **gpt-3.5-turbo**: $0.50/1M input, $1.50/1M output

### Google

- **gemini-pro**: $0.50/1M input, $1.50/1M output
- **gemini-pro-vision**: $0.50/1M input, $1.50/1M output

### Ollama

- All models: Free (but usage is tracked)

## Types

### TokenUsageEvent

```typescript
interface TokenUsageEvent {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  provider: LLMProvider;
  agentRole: AgentRole;
  timestamp: Date;
  tenantId: string;
  cost: number;
  metadata?: {
    projectId?: string;
    sessionId?: string;
    requestId?: string;
    endpoint?: string;
    [key: string]: unknown;
  };
}
```

### UsageAggregation

```typescript
interface UsageAggregation {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  eventCount: number;
  byProvider: Map<LLMProvider, ProviderUsage>;
  byModel: Map<string, ModelUsage>;
  byRole: Map<AgentRole, RoleUsage>;
}
```

### LLMProvider

```typescript
enum LLMProvider {
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  GOOGLE = 'google',
}
```

### AgentRole

```typescript
enum AgentRole {
  // Core Orchestration
  ORCHESTRATOR = 'orchestrator',

  // Builder Agents
  PAGE_COMPOSER = 'page-composer',
  WIDGET_BUILDER = 'widget-builder',
  CODEGEN = 'codegen',
  TEMPLATE_DESIGNER = 'template-designer',

  // IoT Agents
  IOT_ADAPTER = 'iot-adapter',
  SWAGGER_ANALYZER = 'swagger-analyzer',
  SDK_GENERATOR = 'sdk-generator',

  // Data & Analytics
  QUERY_BUILDER = 'query-builder',
  DASHBOARD_DESIGNER = 'dashboard-designer',

  // Deployment Agents
  DOCKER_GENERATOR = 'docker-generator',
  HELM_GENERATOR = 'helm-generator',

  // General Purpose
  ASSISTANT = 'assistant',

  // Legacy
  BUILDER = 'builder',
  POLICY_ENFORCER = 'policy-enforcer',
  CODE_GENERATOR = 'code-generator',
  CUSTOM = 'custom',
}
```

## Integration Examples

See [USAGE_TRACKER_INTEGRATION.md](./USAGE_TRACKER_INTEGRATION.md) for detailed integration examples including:

- Real-time billing updates
- Batch processing for analytics
- Quota management
- Monthly reporting
- Dashboard integration

## Testing

All functionality is fully tested. Run tests with:

```bash
npm exec nx test llm-providers
```

Or run just the usage tracker tests:

```bash
npx vitest run --config=libs/core/llm-providers/vitest.config.mts src/lib/usage-tracker.spec.ts
```

## Memory Management

By default, the tracker keeps the last 10,000 events in memory. Adjust this based on your needs:

```typescript
// Keep fewer events to reduce memory usage
tokenUsageTracker.setMaxEventHistory(1000);

// For high-volume systems, persist events to database and clear frequently
onTokenUsage(async (event) => {
  await db.save(event);
});

// Clear every 1000 events
if (tokenUsageTracker.getEventHistorySize() >= 1000) {
  tokenUsageTracker.clearHistory();
}
```

## Best Practices

1. **Persist Events**: Don't rely solely on in-memory storage
2. **Set Appropriate History Limits**: Balance memory usage with query needs
3. **Use Specific Listeners**: Use tenant/provider/role-specific listeners for better performance
4. **Handle Errors Gracefully**: Wrap tracking in try-catch to prevent failures
5. **Regular Aggregation**: Aggregate and persist summaries periodically

## License

Part of the Friendly AI AEP system.
