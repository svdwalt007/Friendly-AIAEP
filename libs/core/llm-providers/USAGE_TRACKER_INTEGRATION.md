# Token Usage Tracker - Integration Guide

The Token Usage Tracker provides comprehensive event-based tracking of LLM token usage with built-in cost calculation and aggregation capabilities.

## Features

- Event-driven architecture using EventEmitter
- Automatic cost calculation based on model pricing
- Real-time usage tracking and aggregation
- Multi-dimensional filtering (tenant, provider, role, time range)
- Built-in support for major LLM providers (Anthropic, OpenAI, Google, Ollama)
- Easy integration with billing services

## Basic Usage

### Track Token Usage

```typescript
import {
  trackTokenUsage,
  LLMProvider,
  AgentRole,
} from '@friendly-aiaep/llm-providers';

// Track a single usage event
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
```

### Listen to Usage Events

```typescript
import { onTokenUsage } from '@friendly-aiaep/llm-providers';

// Listen to all usage events
onTokenUsage((event) => {
  console.log(
    `Tenant ${event.tenantId} used ${event.totalTokens} tokens, cost: $${event.cost}`
  );

  // Send to billing service
  billingService.recordUsage(event);
});
```

### Tenant-Specific Tracking

```typescript
import { onTenantUsage } from '@friendly-aiaep/llm-providers';

// Listen to usage for a specific tenant
onTenantUsage('tenant-123', (event) => {
  console.log(`Tenant 123 usage: ${event.totalTokens} tokens`);

  // Check if tenant is approaching quota
  if (shouldAlertQuota(event)) {
    notificationService.send({
      tenantId: event.tenantId,
      message: 'Approaching usage quota',
    });
  }
});
```

### Provider-Specific Tracking

```typescript
import { onProviderUsage, LLMProvider } from '@friendly-aiaep/llm-providers';

// Track Anthropic-specific usage
onProviderUsage(LLMProvider.ANTHROPIC, (event) => {
  console.log(`Anthropic usage: $${event.cost}`);
});
```

### Role-Specific Tracking

```typescript
import { onRoleUsage, AgentRole } from '@friendly-aiaep/llm-providers';

// Track builder agent usage
onRoleUsage(AgentRole.BUILDER, (event) => {
  console.log(`Builder agent used ${event.totalTokens} tokens`);
});
```

## Usage Aggregation

### Get Tenant Aggregation

```typescript
import { tokenUsageTracker } from '@friendly-aiaep/llm-providers';

// Get aggregated usage for a tenant
const aggregation = tokenUsageTracker.getTenantAggregation('tenant-123');

console.log(`Total tokens: ${aggregation.totalTokens}`);
console.log(`Total cost: $${aggregation.totalCost.toFixed(2)}`);
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

### Time Range Aggregation

```typescript
// Get usage for the last 24 hours
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const dailyUsage = tokenUsageTracker.getTimeRangeAggregation(yesterday, now);

// Get usage for specific tenant in time range
const tenantDailyUsage = tokenUsageTracker.getTimeRangeAggregation(
  yesterday,
  now,
  'tenant-123'
);
```

## Billing Service Integration

### Example 1: Real-time Billing Updates

```typescript
import {
  onTokenUsage,
  type TokenUsageEvent,
} from '@friendly-aiaep/llm-providers';

class BillingService {
  constructor(private prisma: PrismaClient) {
    // Subscribe to all usage events
    onTokenUsage(this.handleUsageEvent.bind(this));
  }

  private async handleUsageEvent(event: TokenUsageEvent) {
    // Record usage in database
    await this.prisma.usageRecord.create({
      data: {
        tenantId: event.tenantId,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        totalTokens: event.totalTokens,
        cost: event.cost,
        model: event.model,
        provider: event.provider,
        agentRole: event.agentRole,
        timestamp: event.timestamp,
        metadata: event.metadata,
      },
    });

    // Update tenant's running total
    await this.updateTenantBalance(event.tenantId, event.cost);

    // Check quota limits
    await this.checkQuotaLimits(event.tenantId);
  }

  private async updateTenantBalance(tenantId: string, cost: number) {
    await this.prisma.tenantBalance.update({
      where: { tenantId },
      data: {
        totalCost: { increment: cost },
        lastUpdated: new Date(),
      },
    });
  }

  private async checkQuotaLimits(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { balance: true },
    });

    if (!tenant || !tenant.balance) return;

    const usagePercent =
      (tenant.balance.totalCost / tenant.quotaLimit) * 100;

    if (usagePercent >= 90) {
      await this.sendQuotaAlert(tenantId, usagePercent);
    }

    if (usagePercent >= 100) {
      await this.suspendTenantAccess(tenantId);
    }
  }
}
```

### Example 2: Batch Processing for Analytics

```typescript
import { tokenUsageTracker } from '@friendly-aiaep/llm-providers';

class AnalyticsService {
  async generateDailyReport(date: Date) {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Get all events for the day
    const events = tokenUsageTracker.getEventsByTimeRange(
      startOfDay,
      endOfDay
    );

    // Aggregate by tenant
    const tenantUsage = new Map<string, number>();
    events.forEach((event) => {
      const current = tenantUsage.get(event.tenantId) || 0;
      tenantUsage.set(event.tenantId, current + event.cost);
    });

    // Generate report
    const report = {
      date: date.toISOString(),
      totalEvents: events.length,
      totalCost: events.reduce((sum, e) => sum + e.cost, 0),
      totalTokens: events.reduce((sum, e) => sum + e.totalTokens, 0),
      tenants: Array.from(tenantUsage.entries()).map(([id, cost]) => ({
        tenantId: id,
        cost,
      })),
    };

    return report;
  }

  async generateMonthlyInvoice(tenantId: string, month: Date) {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const aggregation = tokenUsageTracker.getTimeRangeAggregation(
      startOfMonth,
      endOfMonth,
      tenantId
    );

    return {
      tenantId,
      period: {
        start: startOfMonth,
        end: endOfMonth,
      },
      summary: {
        totalTokens: aggregation.totalTokens,
        totalCost: aggregation.totalCost,
        eventCount: aggregation.eventCount,
      },
      breakdown: {
        byProvider: Array.from(aggregation.byProvider.values()),
        byModel: Array.from(aggregation.byModel.values()),
        byRole: Array.from(aggregation.byRole.values()),
      },
    };
  }
}
```

### Example 3: Quota Management

```typescript
import {
  onTenantUsage,
  tokenUsageTracker,
} from '@friendly-aiaep/llm-providers';

class QuotaManager {
  private tenantQuotas = new Map<string, number>();
  private tenantUsage = new Map<string, number>();

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners() {
    // This would typically be done per tenant when they're loaded
    // For demo purposes, showing the pattern
  }

  setTenantQuota(tenantId: string, quotaInUSD: number) {
    this.tenantQuotas.set(tenantId, quotaInUSD);

    // Set up listener for this tenant
    onTenantUsage(tenantId, (event) => {
      this.updateUsageAndCheckQuota(tenantId, event.cost);
    });
  }

  private updateUsageAndCheckQuota(tenantId: string, cost: number) {
    const currentUsage = this.tenantUsage.get(tenantId) || 0;
    const newUsage = currentUsage + cost;
    this.tenantUsage.set(tenantId, newUsage);

    const quota = this.tenantQuotas.get(tenantId);
    if (!quota) return;

    const percentUsed = (newUsage / quota) * 100;

    if (percentUsed >= 80 && percentUsed < 90) {
      this.sendWarning(tenantId, 'approaching quota', percentUsed);
    } else if (percentUsed >= 90 && percentUsed < 100) {
      this.sendWarning(tenantId, 'nearing quota limit', percentUsed);
    } else if (percentUsed >= 100) {
      this.blockTenantAccess(tenantId);
    }
  }

  async resetMonthlyUsage(tenantId: string) {
    this.tenantUsage.set(tenantId, 0);
  }
}
```

## Cost Calculator

### Calculate Cost Before API Call

```typescript
import { calculateCost, LLMProvider } from '@friendly-aiaep/llm-providers';

// Estimate cost before making the call
const estimatedInputTokens = 1000;
const estimatedOutputTokens = 500;

const estimatedCost = calculateCost(
  'claude-3-5-sonnet-20241022',
  estimatedInputTokens,
  estimatedOutputTokens,
  LLMProvider.ANTHROPIC
);

console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);

// Check if within budget before proceeding
if (estimatedCost > maxCostPerRequest) {
  throw new Error('Request exceeds cost limit');
}
```

## Model Pricing

Current pricing (as of implementation):

```typescript
import { MODEL_PRICING } from '@friendly-aiaep/llm-providers';

// Access pricing for any model
const claudePricing = MODEL_PRICING['claude-3-5-sonnet-20241022'];
console.log(`Input: $${claudePricing.inputPricePerMillion} per 1M tokens`);
console.log(`Output: $${claudePricing.outputPricePerMillion} per 1M tokens`);
```

## Advanced Usage

### Custom Event Handling

```typescript
import { tokenUsageTracker } from '@friendly-aiaep/llm-providers';

// Direct access to tracker for advanced scenarios
class CustomUsageHandler {
  constructor() {
    // Listen to raw 'usage' events
    tokenUsageTracker.on('usage', this.handleEvent.bind(this));

    // Multiple specific listeners
    tokenUsageTracker.on('usage:tenant-123', this.handleTenant123);
    tokenUsageTracker.on('usage:anthropic', this.handleAnthropic);
  }

  private handleEvent(event: TokenUsageEvent) {
    // Custom handling logic
  }
}
```

### Event History Management

```typescript
// Limit memory usage by controlling event history
tokenUsageTracker.setMaxEventHistory(5000); // Keep last 5k events

// Clear history if needed (e.g., after persisting to database)
tokenUsageTracker.clearHistory();

// Check current history size
const size = tokenUsageTracker.getEventHistorySize();
console.log(`Current event history: ${size} events`);
```

### Filtering and Querying

```typescript
// Get all events
const allEvents = tokenUsageTracker.getEvents();

// Filter manually
const expensiveEvents = allEvents.filter((e) => e.cost > 0.01);
const claudeEvents = allEvents.filter(
  (e) => e.provider === LLMProvider.ANTHROPIC
);

// Custom aggregation
const customAgg = tokenUsageTracker.aggregateUsage(expensiveEvents);
```

## TypeScript Types

All types are fully typed for TypeScript:

```typescript
import type {
  TokenUsageEvent,
  UsageAggregation,
  ProviderUsage,
  ModelUsage,
  RoleUsage,
  ModelPricing,
} from '@friendly-aiaep/llm-providers';

// Use in your interfaces
interface BillingRecord extends TokenUsageEvent {
  invoiceId: string;
  paid: boolean;
}
```

## Best Practices

1. **Event Persistence**: Don't rely solely on in-memory storage. Listen to events and persist them to a database.

2. **Quota Enforcement**: Implement quota checks before making LLM calls, not just after.

3. **Cost Monitoring**: Set up alerts for unusual spending patterns.

4. **Aggregation**: For reporting, use the built-in aggregation helpers rather than manual calculations.

5. **Memory Management**: Set appropriate `maxEventHistory` based on your traffic and persistence strategy.

6. **Error Handling**: Wrap usage tracking in try-catch to prevent failures from affecting LLM calls:

```typescript
try {
  const event = trackTokenUsage({
    /* ... */
  });
  await billingService.record(event);
} catch (error) {
  // Log error but don't fail the main operation
  logger.error('Failed to track usage', error);
}
```

7. **Multi-Tenant Isolation**: Use tenant-specific listeners for better performance in multi-tenant scenarios.

## Migration from Direct Tracking

If you're currently tracking usage manually:

```typescript
// Before
class LLMService {
  async call(prompt: string, tenantId: string) {
    const response = await llm.generate(prompt);
    await this.recordUsage(response.usage, tenantId); // Manual tracking
    return response;
  }
}

// After
import { trackTokenUsage, LLMProvider, AgentRole } from '@friendly-aiaep/llm-providers';

class LLMService {
  async call(prompt: string, tenantId: string) {
    const response = await llm.generate(prompt);

    // Automatic tracking with cost calculation
    trackTokenUsage({
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      model: response.model,
      provider: LLMProvider.ANTHROPIC,
      agentRole: AgentRole.BUILDER,
      tenantId,
    });

    return response;
  }
}
```

## Testing

The usage tracker is fully testable:

```typescript
import { TokenUsageTracker, LLMProvider, AgentRole } from '@friendly-aiaep/llm-providers';

describe('My Billing Integration', () => {
  let tracker: TokenUsageTracker;

  beforeEach(() => {
    // Create isolated tracker for testing
    tracker = new TokenUsageTracker();
  });

  it('should record usage correctly', () => {
    const listener = vi.fn();
    tracker.on('usage', listener);

    tracker.trackUsage({
      inputTokens: 1000,
      outputTokens: 500,
      model: 'claude-3-5-sonnet-20241022',
      provider: LLMProvider.ANTHROPIC,
      agentRole: AgentRole.BUILDER,
      tenantId: 'test-tenant',
    });

    expect(listener).toHaveBeenCalled();
  });
});
```
