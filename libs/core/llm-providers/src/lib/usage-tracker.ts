import { EventEmitter } from 'events';

/**
 * Supported LLM providers
 */
export enum LLMProvider {
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  GOOGLE = 'google',
}

/**
 * Agent roles for tracking usage by role
 * Based on the Friendly AI AEP system specification
 * Consolidated from multiple sources for consistency
 */
export enum AgentRole {
  // Core Orchestration
  SUPERVISOR = 'SUPERVISOR',
  ORCHESTRATOR = 'orchestrator',
  PLANNING = 'PLANNING',

  // Builder Agents
  PAGE_COMPOSER = 'page-composer',
  WIDGET_BUILDER = 'widget-builder',
  CODEGEN = 'codegen',
  TEMPLATE_DESIGNER = 'template-designer',
  ANGULAR_COMPOSER = 'ANGULAR_COMPOSER',

  // IoT Agents
  IOT_ADAPTER = 'iot-adapter',
  IOT_DOMAIN = 'IOT_DOMAIN',
  SWAGGER_ANALYZER = 'swagger-analyzer',
  SWAGGER_API = 'SWAGGER_API',
  SDK_GENERATOR = 'sdk-generator',

  // Data & Analytics
  QUERY_BUILDER = 'query-builder',
  DASHBOARD_DESIGNER = 'dashboard-designer',
  GRAFANA = 'GRAFANA',
  DATABASE = 'DATABASE',

  // Deployment Agents
  DOCKER_GENERATOR = 'docker-generator',
  HELM_GENERATOR = 'helm-generator',
  DEPLOYMENT = 'DEPLOYMENT',

  // Security & Compliance
  SECURITY = 'SECURITY',
  POLICY_ENFORCER = 'policy-enforcer',

  // Billing & Licensing
  BILLING = 'BILLING',

  // Quality Assurance
  QA_TEST = 'QA_TEST',

  // General Purpose
  ASSISTANT = 'assistant',
  BUILDER = 'builder',
  CODE_GENERATOR = 'code-generator',
  CUSTOM = 'custom',
}

/**
 * Token usage event payload
 */
export interface TokenUsageEvent {
  /** Number of input tokens consumed */
  inputTokens: number;

  /** Number of output tokens generated */
  outputTokens: number;

  /** Total tokens (input + output) */
  totalTokens: number;

  /** Model identifier (e.g., 'claude-3-5-sonnet-20241022') */
  model: string;

  /** LLM provider */
  provider: LLMProvider;

  /** Agent role making the request */
  agentRole: AgentRole;

  /** Timestamp of the event */
  timestamp: Date;

  /** Tenant/organization identifier */
  tenantId: string;

  /** Calculated cost in USD */
  cost: number;

  /** Optional metadata for additional context */
  metadata?: {
    projectId?: string;
    sessionId?: string;
    requestId?: string;
    endpoint?: string;
    [key: string]: unknown;
  };
}

/**
 * Usage aggregation result
 */
export interface UsageAggregation {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  eventCount: number;
  byProvider: Map<LLMProvider, ProviderUsage>;
  byModel: Map<string, ModelUsage>;
  byRole: Map<AgentRole, RoleUsage>;
}

/**
 * Provider-level usage statistics
 */
export interface ProviderUsage {
  provider: LLMProvider;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  eventCount: number;
}

/**
 * Model-level usage statistics
 */
export interface ModelUsage {
  model: string;
  provider: LLMProvider;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  eventCount: number;
}

/**
 * Role-level usage statistics
 */
export interface RoleUsage {
  role: AgentRole;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  eventCount: number;
}

/**
 * Model pricing configuration (USD per 1M tokens)
 */
export interface ModelPricing {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}

/**
 * Pricing table for different models
 * Prices are in USD per 1 million tokens
 * Updated as of April 2026
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude Models
  'claude-opus-4-5': {
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
  },
  'claude-3-5-sonnet-20241022': {
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
  },
  'claude-3-5-haiku-20241022': {
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
  },
  'claude-3-opus-20240229': {
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
  },
  'claude-3-sonnet-20240229': {
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
  },
  'claude-3-haiku-20240307': {
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
  },

  // OpenAI Models
  'gpt-4-turbo': {
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  'gpt-4': {
    inputPricePerMillion: 30.0,
    outputPricePerMillion: 60.0,
  },
  'gpt-3.5-turbo': {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },

  // Google Models
  'gemini-pro': {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  'gemini-pro-vision': {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },

  // Ollama models (free but tracked)
  'ollama-default': {
    inputPricePerMillion: 0.0,
    outputPricePerMillion: 0.0,
  },
};

/**
 * Calculate cost for token usage based on model pricing
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  provider: LLMProvider
): number {
  // Ollama is always free
  if (provider === LLMProvider.OLLAMA) {
    return 0;
  }

  // Find pricing for the model
  let pricing = MODEL_PRICING[model];

  // If model not found, try to find by prefix
  if (!pricing) {
    const modelPrefix = Object.keys(MODEL_PRICING).find((key) =>
      model.startsWith(key)
    );
    if (modelPrefix) {
      pricing = MODEL_PRICING[modelPrefix];
    }
  }

  // If still not found, use a default based on provider
  if (!pricing) {
    pricing = getDefaultPricingForProvider(provider);
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

  return inputCost + outputCost;
}

/**
 * Get default pricing when model is not recognized
 */
function getDefaultPricingForProvider(provider: LLMProvider): ModelPricing {
  switch (provider) {
    case LLMProvider.ANTHROPIC:
      return MODEL_PRICING['claude-3-5-sonnet-20241022'];
    case LLMProvider.OPENAI:
      return MODEL_PRICING['gpt-3.5-turbo'];
    case LLMProvider.GOOGLE:
      return MODEL_PRICING['gemini-pro'];
    case LLMProvider.OLLAMA:
      return MODEL_PRICING['ollama-default'];
    default:
      return { inputPricePerMillion: 0, outputPricePerMillion: 0 };
  }
}

/**
 * Token usage tracker with event emission capabilities
 */
export class TokenUsageTracker extends EventEmitter {
  private events: TokenUsageEvent[] = [];
  private maxEventHistory = 10000; // Keep last 10k events in memory

  constructor() {
    super();
    this.setMaxListeners(50); // Allow multiple listeners for billing integration
  }

  /**
   * Track token usage and emit event
   */
  trackUsage(params: {
    inputTokens: number;
    outputTokens: number;
    model: string;
    provider: LLMProvider;
    agentRole: AgentRole;
    tenantId: string;
    metadata?: TokenUsageEvent['metadata'];
  }): TokenUsageEvent {
    const totalTokens = params.inputTokens + params.outputTokens;
    const cost = calculateCost(
      params.model,
      params.inputTokens,
      params.outputTokens,
      params.provider
    );

    const event: TokenUsageEvent = {
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      model: params.model,
      provider: params.provider,
      agentRole: params.agentRole,
      timestamp: new Date(),
      tenantId: params.tenantId,
      cost,
      metadata: params.metadata,
    };

    // Store event
    this.events.push(event);

    // Trim old events if exceeding max history
    if (this.events.length > this.maxEventHistory) {
      this.events = this.events.slice(-this.maxEventHistory);
    }

    // Emit events
    this.emit('usage', event);
    this.emit(`usage:${params.tenantId}`, event);
    this.emit(`usage:${params.provider}`, event);
    this.emit(`usage:${params.agentRole}`, event);

    return event;
  }

  /**
   * Get all tracked events
   */
  getEvents(): TokenUsageEvent[] {
    return [...this.events];
  }

  /**
   * Get events for a specific tenant
   */
  getEventsByTenant(tenantId: string): TokenUsageEvent[] {
    return this.events.filter((event) => event.tenantId === tenantId);
  }

  /**
   * Get events within a time range
   */
  getEventsByTimeRange(startTime: Date, endTime: Date): TokenUsageEvent[] {
    return this.events.filter(
      (event) =>
        event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Aggregate usage across events
   */
  aggregateUsage(events: TokenUsageEvent[]): UsageAggregation {
    const aggregation: UsageAggregation = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      eventCount: events.length,
      byProvider: new Map(),
      byModel: new Map(),
      byRole: new Map(),
    };

    events.forEach((event) => {
      // Overall totals
      aggregation.totalInputTokens += event.inputTokens;
      aggregation.totalOutputTokens += event.outputTokens;
      aggregation.totalTokens += event.totalTokens;
      aggregation.totalCost += event.cost;

      // By provider
      const providerUsage = aggregation.byProvider.get(event.provider) || {
        provider: event.provider,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        eventCount: 0,
      };
      providerUsage.inputTokens += event.inputTokens;
      providerUsage.outputTokens += event.outputTokens;
      providerUsage.totalTokens += event.totalTokens;
      providerUsage.cost += event.cost;
      providerUsage.eventCount += 1;
      aggregation.byProvider.set(event.provider, providerUsage);

      // By model
      const modelUsage = aggregation.byModel.get(event.model) || {
        model: event.model,
        provider: event.provider,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        eventCount: 0,
      };
      modelUsage.inputTokens += event.inputTokens;
      modelUsage.outputTokens += event.outputTokens;
      modelUsage.totalTokens += event.totalTokens;
      modelUsage.cost += event.cost;
      modelUsage.eventCount += 1;
      aggregation.byModel.set(event.model, modelUsage);

      // By role
      const roleUsage = aggregation.byRole.get(event.agentRole) || {
        role: event.agentRole,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        eventCount: 0,
      };
      roleUsage.inputTokens += event.inputTokens;
      roleUsage.outputTokens += event.outputTokens;
      roleUsage.totalTokens += event.totalTokens;
      roleUsage.cost += event.cost;
      roleUsage.eventCount += 1;
      aggregation.byRole.set(event.agentRole, roleUsage);
    });

    return aggregation;
  }

  /**
   * Get aggregated usage for a tenant
   */
  getTenantAggregation(tenantId: string): UsageAggregation {
    const events = this.getEventsByTenant(tenantId);
    return this.aggregateUsage(events);
  }

  /**
   * Get aggregated usage for a time period
   */
  getTimeRangeAggregation(
    startTime: Date,
    endTime: Date,
    tenantId?: string
  ): UsageAggregation {
    let events = this.getEventsByTimeRange(startTime, endTime);
    if (tenantId) {
      events = events.filter((event) => event.tenantId === tenantId);
    }
    return this.aggregateUsage(events);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.events = [];
  }

  /**
   * Set maximum event history size
   */
  setMaxEventHistory(max: number): void {
    this.maxEventHistory = max;
    if (this.events.length > max) {
      this.events = this.events.slice(-max);
    }
  }

  /**
   * Get current event history size
   */
  getEventHistorySize(): number {
    return this.events.length;
  }
}

/**
 * Singleton instance for global usage tracking
 */
export const tokenUsageTracker = new TokenUsageTracker();

/**
 * Helper function to track usage using the singleton
 */
export function trackTokenUsage(params: {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: LLMProvider;
  agentRole: AgentRole;
  tenantId: string;
  metadata?: TokenUsageEvent['metadata'];
}): TokenUsageEvent {
  return tokenUsageTracker.trackUsage(params);
}

/**
 * Helper to add a listener for all usage events
 */
export function onTokenUsage(
  listener: (event: TokenUsageEvent) => void
): void {
  tokenUsageTracker.on('usage', listener);
}

/**
 * Helper to add a listener for tenant-specific usage
 */
export function onTenantUsage(
  tenantId: string,
  listener: (event: TokenUsageEvent) => void
): void {
  tokenUsageTracker.on(`usage:${tenantId}`, listener);
}

/**
 * Helper to add a listener for provider-specific usage
 */
export function onProviderUsage(
  provider: LLMProvider,
  listener: (event: TokenUsageEvent) => void
): void {
  tokenUsageTracker.on(`usage:${provider}`, listener);
}

/**
 * Helper to add a listener for role-specific usage
 */
export function onRoleUsage(
  role: AgentRole,
  listener: (event: TokenUsageEvent) => void
): void {
  tokenUsageTracker.on(`usage:${role}`, listener);
}

/**
 * Remove a usage listener
 */
export function offTokenUsage(
  listener: (event: TokenUsageEvent) => void
): void {
  tokenUsageTracker.off('usage', listener);
}
