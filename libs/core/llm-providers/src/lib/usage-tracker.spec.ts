import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TokenUsageTracker,
  LLMProvider,
  AgentRole,
  calculateCost,
  MODEL_PRICING,
  trackTokenUsage,
  onTokenUsage,
  onTenantUsage,
  onProviderUsage,
  onRoleUsage,
  tokenUsageTracker,
  type TokenUsageEvent,
} from './usage-tracker';

describe('TokenUsageTracker', () => {
  let tracker: TokenUsageTracker;

  beforeEach(() => {
    tracker = new TokenUsageTracker();
  });

  describe('calculateCost', () => {
    it('should calculate cost for Claude models correctly', () => {
      const cost = calculateCost(
        'claude-3-5-sonnet-20241022',
        1_000_000,
        500_000,
        LLMProvider.ANTHROPIC
      );

      const expectedInputCost = 1.0 * 3.0; // 1M tokens * $3
      const expectedOutputCost = 0.5 * 15.0; // 0.5M tokens * $15
      expect(cost).toBe(expectedInputCost + expectedOutputCost);
    });

    it('should return 0 cost for Ollama models', () => {
      const cost = calculateCost(
        'llama2',
        1_000_000,
        500_000,
        LLMProvider.OLLAMA
      );
      expect(cost).toBe(0);
    });

    it('should handle model prefix matching', () => {
      const cost = calculateCost(
        'claude-3-5-sonnet-20241022-v2',
        1_000_000,
        0,
        LLMProvider.ANTHROPIC
      );
      expect(cost).toBeGreaterThan(0);
    });

    it('should use default pricing for unknown models', () => {
      const cost = calculateCost(
        'unknown-model',
        1_000_000,
        0,
        LLMProvider.ANTHROPIC
      );
      expect(cost).toBeGreaterThan(0);
    });

    it('should calculate cost for small token counts accurately', () => {
      const cost = calculateCost(
        'claude-3-5-sonnet-20241022',
        1000,
        500,
        LLMProvider.ANTHROPIC
      );

      const expectedInputCost = (1000 / 1_000_000) * 3.0;
      const expectedOutputCost = (500 / 1_000_000) * 15.0;
      expect(cost).toBeCloseTo(expectedInputCost + expectedOutputCost);
    });
  });

  describe('trackUsage', () => {
    it('should track token usage and emit events', () => {
      const listener = vi.fn();
      tracker.on('usage', listener);

      const result = tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
      expect(result.totalTokens).toBe(1500);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.tenantId).toBe('tenant-123');
      expect(listener).toHaveBeenCalledWith(result);
    });

    it('should emit tenant-specific events', () => {
      const listener = vi.fn();
      tracker.on('usage:tenant-123', listener);

      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should emit provider-specific events', () => {
      const listener = vi.fn();
      tracker.on('usage:anthropic', listener);

      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should emit role-specific events', () => {
      const listener = vi.fn();
      tracker.on('usage:builder', listener);

      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      expect(listener).toHaveBeenCalled();
    });

    it('should include metadata in events', () => {
      const metadata = {
        projectId: 'proj-123',
        sessionId: 'session-456',
        requestId: 'req-789',
      };

      const result = tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('getEvents', () => {
    it('should return all tracked events', () => {
      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      tracker.trackUsage({
        inputTokens: 2000,
        outputTokens: 1000,
        model: 'gpt-4-turbo',
        provider: LLMProvider.OPENAI,
        agentRole: AgentRole.CODE_GENERATOR,
        tenantId: 'tenant-456',
      });

      const events = tracker.getEvents();
      expect(events).toHaveLength(2);
    });
  });

  describe('getEventsByTenant', () => {
    beforeEach(() => {
      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      tracker.trackUsage({
        inputTokens: 2000,
        outputTokens: 1000,
        model: 'gpt-4-turbo',
        provider: LLMProvider.OPENAI,
        agentRole: AgentRole.CODE_GENERATOR,
        tenantId: 'tenant-456',
      });

      tracker.trackUsage({
        inputTokens: 1500,
        outputTokens: 750,
        model: 'claude-3-5-haiku-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });
    });

    it('should return events for specific tenant', () => {
      const events = tracker.getEventsByTenant('tenant-123');
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.tenantId === 'tenant-123')).toBe(true);
    });

    it('should return empty array for non-existent tenant', () => {
      const events = tracker.getEventsByTenant('tenant-999');
      expect(events).toHaveLength(0);
    });
  });

  describe('getEventsByTimeRange', () => {
    it('should return events within time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      const events = tracker.getEventsByTimeRange(twoHoursAgo, now);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('aggregateUsage', () => {
    beforeEach(() => {
      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      tracker.trackUsage({
        inputTokens: 2000,
        outputTokens: 1000,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.CODE_GENERATOR,
        tenantId: 'tenant-123',
      });

      tracker.trackUsage({
        inputTokens: 1500,
        outputTokens: 750,
        model: 'gpt-4-turbo',
        provider: LLMProvider.OPENAI,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });
    });

    it('should aggregate total usage correctly', () => {
      const events = tracker.getEvents();
      const aggregation = tracker.aggregateUsage(events);

      expect(aggregation.totalInputTokens).toBe(4500);
      expect(aggregation.totalOutputTokens).toBe(2250);
      expect(aggregation.totalTokens).toBe(6750);
      expect(aggregation.totalCost).toBeGreaterThan(0);
      expect(aggregation.eventCount).toBe(3);
    });

    it('should aggregate by provider', () => {
      const events = tracker.getEvents();
      const aggregation = tracker.aggregateUsage(events);

      expect(aggregation.byProvider.size).toBe(2);

      const anthropicUsage = aggregation.byProvider.get(LLMProvider.ANTHROPIC);
      expect(anthropicUsage?.inputTokens).toBe(3000);
      expect(anthropicUsage?.eventCount).toBe(2);

      const openaiUsage = aggregation.byProvider.get(LLMProvider.OPENAI);
      expect(openaiUsage?.inputTokens).toBe(1500);
      expect(openaiUsage?.eventCount).toBe(1);
    });

    it('should aggregate by model', () => {
      const events = tracker.getEvents();
      const aggregation = tracker.aggregateUsage(events);

      expect(aggregation.byModel.size).toBe(2);

      const claudeUsage = aggregation.byModel.get(
        'claude-3-5-sonnet-20241022'
      );
      expect(claudeUsage?.inputTokens).toBe(3000);
      expect(claudeUsage?.eventCount).toBe(2);
    });

    it('should aggregate by role', () => {
      const events = tracker.getEvents();
      const aggregation = tracker.aggregateUsage(events);

      expect(aggregation.byRole.size).toBe(2);

      const builderUsage = aggregation.byRole.get(AgentRole.BUILDER);
      expect(builderUsage?.inputTokens).toBe(2500);
      expect(builderUsage?.eventCount).toBe(2);

      const codeGenUsage = aggregation.byRole.get(AgentRole.CODE_GENERATOR);
      expect(codeGenUsage?.inputTokens).toBe(2000);
      expect(codeGenUsage?.eventCount).toBe(1);
    });
  });

  describe('getTenantAggregation', () => {
    beforeEach(() => {
      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      tracker.trackUsage({
        inputTokens: 2000,
        outputTokens: 1000,
        model: 'gpt-4-turbo',
        provider: LLMProvider.OPENAI,
        agentRole: AgentRole.CODE_GENERATOR,
        tenantId: 'tenant-456',
      });
    });

    it('should aggregate usage for specific tenant', () => {
      const aggregation = tracker.getTenantAggregation('tenant-123');

      expect(aggregation.totalInputTokens).toBe(1000);
      expect(aggregation.totalOutputTokens).toBe(500);
      expect(aggregation.eventCount).toBe(1);
    });
  });

  describe('getTimeRangeAggregation', () => {
    it('should aggregate usage for time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      const aggregation = tracker.getTimeRangeAggregation(oneHourAgo, now);
      expect(aggregation.eventCount).toBeGreaterThan(0);
    });

    it('should filter by tenant in time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      tracker.trackUsage({
        inputTokens: 2000,
        outputTokens: 1000,
        model: 'gpt-4-turbo',
        provider: LLMProvider.OPENAI,
        agentRole: AgentRole.CODE_GENERATOR,
        tenantId: 'tenant-456',
      });

      const aggregation = tracker.getTimeRangeAggregation(
        oneHourAgo,
        now,
        'tenant-123'
      );
      expect(aggregation.totalInputTokens).toBe(1000);
    });
  });

  describe('event history management', () => {
    it('should limit event history size', () => {
      tracker.setMaxEventHistory(5);

      for (let i = 0; i < 10; i++) {
        tracker.trackUsage({
          inputTokens: 1000,
          outputTokens: 500,
          model: 'claude-3-5-sonnet-20241022',
          provider: LLMProvider.ANTHROPIC,
          agentRole: AgentRole.BUILDER,
          tenantId: 'tenant-123',
        });
      }

      expect(tracker.getEventHistorySize()).toBe(5);
    });

    it('should clear history', () => {
      tracker.trackUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      tracker.clearHistory();
      expect(tracker.getEventHistorySize()).toBe(0);
    });
  });

  describe('helper functions', () => {
    it('should track usage via helper function', () => {
      const event = trackTokenUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      expect(event.totalTokens).toBe(1500);
    });

    it('should add listeners via helper functions', () => {
      const generalListener = vi.fn();
      const tenantListener = vi.fn();
      const providerListener = vi.fn();
      const roleListener = vi.fn();

      onTokenUsage(generalListener);
      onTenantUsage('tenant-123', tenantListener);
      onProviderUsage(LLMProvider.ANTHROPIC, providerListener);
      onRoleUsage(AgentRole.BUILDER, roleListener);

      trackTokenUsage({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-5-sonnet-20241022',
        provider: LLMProvider.ANTHROPIC,
        agentRole: AgentRole.BUILDER,
        tenantId: 'tenant-123',
      });

      expect(generalListener).toHaveBeenCalled();
      expect(tenantListener).toHaveBeenCalled();
      expect(providerListener).toHaveBeenCalled();
      expect(roleListener).toHaveBeenCalled();
    });
  });

  describe('model pricing coverage', () => {
    it('should have pricing for all major Claude models', () => {
      expect(MODEL_PRICING['claude-opus-4-5']).toBeDefined();
      expect(MODEL_PRICING['claude-3-5-sonnet-20241022']).toBeDefined();
      expect(MODEL_PRICING['claude-3-5-haiku-20241022']).toBeDefined();
    });

    it('should have pricing for OpenAI models', () => {
      expect(MODEL_PRICING['gpt-4-turbo']).toBeDefined();
      expect(MODEL_PRICING['gpt-4']).toBeDefined();
      expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
    });

    it('should have pricing for Google models', () => {
      expect(MODEL_PRICING['gemini-pro']).toBeDefined();
    });
  });
});
