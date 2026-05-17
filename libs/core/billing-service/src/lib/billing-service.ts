/**
 * @fileoverview Billing service with Stripe integration, usage tracking, and tier enforcement
 * @module @friendly-aiaep/billing-service
 */

// ============================================================================
// Tier Definitions
// ============================================================================

/**
 * Supported billing tiers
 */
export type BillingTier = 'starter' | 'professional' | 'enterprise';

/**
 * Limits for each billing tier
 */
export interface TierLimits {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum tokens per month (Infinity = unlimited) */
  tokensPerMonth: number;
  /** Price per token in USD */
  costPerToken: number;
  /** Monthly subscription price in USD */
  monthlyPrice: number;
}

/**
 * Tier limits as per spec:
 * - Starter: 100 req/min, 1M tokens/month
 * - Professional: 500 req/min, 10M tokens/month
 * - Enterprise: 2000 req/min, unlimited tokens
 */
export const TIER_LIMITS: Record<BillingTier, TierLimits> = {
  starter: {
    requestsPerMinute: 100,
    tokensPerMonth: 1_000_000,
    costPerToken: 0.00001,
    monthlyPrice: 29.99,
  },
  professional: {
    requestsPerMinute: 500,
    tokensPerMonth: 10_000_000,
    costPerToken: 0.000008,
    monthlyPrice: 99.99,
  },
  enterprise: {
    requestsPerMinute: 2000,
    tokensPerMonth: Infinity,
    costPerToken: 0.000006,
    monthlyPrice: 499.99,
  },
};

// ============================================================================
// Usage Types
// ============================================================================

/**
 * A single usage record
 */
export interface UsageRecord {
  tenantId: string;
  tokens: number;
  requestCount: number;
  timestamp: Date;
  model?: string;
  agentRole?: string;
  estimatedCost: number;
}

/**
 * Aggregated usage for a tenant in a billing period
 */
export interface TenantUsageSummary {
  tenantId: string;
  tier: BillingTier;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  totalTokens: number;
  totalRequests: number;
  totalCost: number;
  subscriptionCost: number;
  remainingTokens: number;
  isOverLimit: boolean;
}

/**
 * Rate limit tracking entry
 */
interface RateLimitEntry {
  requestCount: number;
  windowStart: Date;
}

// ============================================================================
// Stripe Payment Provider Interface (abstractable for testing)
// ============================================================================

/**
 * Stripe customer data
 */
export interface StripeCustomer {
  id: string;
  email: string;
  metadata?: Record<string, string>;
}

/**
 * Stripe subscription data
 */
export interface StripeSubscription {
  id: string;
  customerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  planId: string;
}

/**
 * Stripe invoice data
 */
export interface StripeInvoice {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'draft' | 'uncollectible' | 'void';
}

/**
 * Abstract interface for payment processing (allows mocking Stripe)
 */
export interface PaymentProvider {
  createCustomer(email: string, tenantId: string): Promise<StripeCustomer>;
  getCustomer(customerId: string): Promise<StripeCustomer | null>;
  createSubscription(customerId: string, priceId: string): Promise<StripeSubscription>;
  cancelSubscription(subscriptionId: string): Promise<StripeSubscription>;
  getSubscription(subscriptionId: string): Promise<StripeSubscription | null>;
  createUsageRecord(subscriptionItemId: string, quantity: number): Promise<void>;
  getInvoices(customerId: string): Promise<StripeInvoice[]>;
}

// ============================================================================
// Usage Storage Interface (abstractable for testing)
// ============================================================================

/**
 * Abstract interface for usage data persistence
 */
export interface UsageRepository {
  recordUsage(record: UsageRecord): Promise<void>;
  getUsageForPeriod(tenantId: string, start: Date, end: Date): Promise<UsageRecord[]>;
  getTenantConfig(tenantId: string): Promise<TenantBillingConfig | null>;
  saveTenantConfig(config: TenantBillingConfig): Promise<void>;
}

// ============================================================================
// Tenant Billing Configuration
// ============================================================================

/**
 * Per-tenant billing configuration
 */
export interface TenantBillingConfig {
  tenantId: string;
  tier: BillingTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionItemId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Billing Errors
// ============================================================================

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly tier: BillingTier,
    public readonly limit: number,
    public readonly current: number
  ) {
    super(
      `Rate limit exceeded for tenant ${tenantId} (tier: ${tier}). ` +
        `Limit: ${limit} req/min, Current: ${current} req/min`
    );
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Token limit exceeded error
 */
export class TokenLimitExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly tier: BillingTier,
    public readonly limit: number,
    public readonly current: number
  ) {
    super(
      `Token limit exceeded for tenant ${tenantId} (tier: ${tier}). ` +
        `Limit: ${limit} tokens/month, Used: ${current}`
    );
    this.name = 'TokenLimitExceededError';
  }
}

/**
 * Invalid tier error
 */
export class InvalidTierError extends Error {
  constructor(tier: string) {
    super(`Invalid billing tier: ${tier}`);
    this.name = 'InvalidTierError';
  }
}

/**
 * Tenant not found error
 */
export class TenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = 'TenantNotFoundError';
  }
}

// ============================================================================
// Main Billing Service
// ============================================================================

/**
 * Options for BillingService construction
 */
export interface BillingServiceOptions {
  paymentProvider: PaymentProvider;
  usageRepository: UsageRepository;
  /** Rate limit window in milliseconds (default: 60000 = 1 minute) */
  rateLimitWindowMs?: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remainingRequests: number;
  windowResetAt: Date;
}

/**
 * Core billing service implementing tier enforcement, usage tracking, and cost calculation
 */
export class BillingService {
  private paymentProvider: PaymentProvider;
  private usageRepository: UsageRepository;
  private rateLimitWindowMs: number;

  /** In-memory rate limit tracking: tenantId → rate limit entry */
  private rateLimitMap = new Map<string, RateLimitEntry>();

  constructor(options: BillingServiceOptions) {
    this.paymentProvider = options.paymentProvider;
    this.usageRepository = options.usageRepository;
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? 60_000;
  }

  // ============================================================================
  // Tier Management
  // ============================================================================

  /**
   * Get limits for a billing tier
   */
  getTierLimits(tier: BillingTier): TierLimits {
    const limits = TIER_LIMITS[tier];
    if (!limits) {
      throw new InvalidTierError(tier);
    }
    return limits;
  }

  /**
   * Validate that a tier is valid
   */
  isValidTier(tier: string): tier is BillingTier {
    return tier === 'starter' || tier === 'professional' || tier === 'enterprise';
  }

  // ============================================================================
  // Rate Limit Enforcement
  // ============================================================================

  /**
   * Check and enforce rate limit for a tenant
   * @throws {RateLimitExceededError} when the tenant has exceeded their rate limit
   */
  checkRateLimit(tenantId: string, tier: BillingTier): RateLimitCheckResult {
    const limits = this.getTierLimits(tier);
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.rateLimitWindowMs);

    const entry = this.rateLimitMap.get(tenantId);

    if (!entry || entry.windowStart < windowStart) {
      // New window or window expired — reset
      const newEntry: RateLimitEntry = {
        requestCount: 1,
        windowStart: now,
      };
      this.rateLimitMap.set(tenantId, newEntry);

      return {
        allowed: true,
        currentCount: 1,
        limit: limits.requestsPerMinute,
        remainingRequests: limits.requestsPerMinute - 1,
        windowResetAt: new Date(now.getTime() + this.rateLimitWindowMs),
      };
    }

    const newCount = entry.requestCount + 1;

    if (newCount > limits.requestsPerMinute) {
      throw new RateLimitExceededError(tenantId, tier, limits.requestsPerMinute, newCount);
    }

    entry.requestCount = newCount;

    return {
      allowed: true,
      currentCount: newCount,
      limit: limits.requestsPerMinute,
      remainingRequests: limits.requestsPerMinute - newCount,
      windowResetAt: new Date(entry.windowStart.getTime() + this.rateLimitWindowMs),
    };
  }

  /**
   * Get current rate limit status without incrementing
   */
  getRateLimitStatus(tenantId: string, tier: BillingTier): RateLimitCheckResult {
    const limits = this.getTierLimits(tier);
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.rateLimitWindowMs);

    const entry = this.rateLimitMap.get(tenantId);

    if (!entry || entry.windowStart < windowStart) {
      return {
        allowed: true,
        currentCount: 0,
        limit: limits.requestsPerMinute,
        remainingRequests: limits.requestsPerMinute,
        windowResetAt: new Date(now.getTime() + this.rateLimitWindowMs),
      };
    }

    const remaining = Math.max(0, limits.requestsPerMinute - entry.requestCount);
    return {
      allowed: remaining > 0,
      currentCount: entry.requestCount,
      limit: limits.requestsPerMinute,
      remainingRequests: remaining,
      windowResetAt: new Date(entry.windowStart.getTime() + this.rateLimitWindowMs),
    };
  }

  /**
   * Reset rate limit tracking for a tenant (useful for testing)
   */
  resetRateLimit(tenantId: string): void {
    this.rateLimitMap.delete(tenantId);
  }

  // ============================================================================
  // Token Limit Enforcement
  // ============================================================================

  /**
   * Check and enforce token limit for a tenant
   * @throws {TokenLimitExceededError} when the tenant has exceeded their token limit
   */
  async checkTokenLimit(
    tenantId: string,
    tier: BillingTier,
    newTokens: number,
    billingPeriodStart: Date,
    billingPeriodEnd: Date
  ): Promise<{ allowed: boolean; currentUsage: number; limit: number }> {
    const limits = this.getTierLimits(tier);

    // Enterprise has unlimited tokens
    if (limits.tokensPerMonth === Infinity) {
      return {
        allowed: true,
        currentUsage: 0,
        limit: Infinity,
      };
    }

    const records = await this.usageRepository.getUsageForPeriod(
      tenantId,
      billingPeriodStart,
      billingPeriodEnd
    );

    const currentUsage = records.reduce((sum, r) => sum + r.tokens, 0);
    const projectedUsage = currentUsage + newTokens;

    if (projectedUsage > limits.tokensPerMonth) {
      throw new TokenLimitExceededError(
        tenantId,
        tier,
        limits.tokensPerMonth,
        projectedUsage
      );
    }

    return {
      allowed: true,
      currentUsage,
      limit: limits.tokensPerMonth,
    };
  }

  // ============================================================================
  // Usage Recording
  // ============================================================================

  /**
   * Record a usage event for a tenant
   */
  async recordUsage(params: {
    tenantId: string;
    tier: BillingTier;
    tokens: number;
    requestCount?: number;
    model?: string;
    agentRole?: string;
    timestamp?: Date;
  }): Promise<UsageRecord> {
    const limits = this.getTierLimits(params.tier);
    const estimatedCost = this.calculateCost(params.tokens, params.tier);

    const record: UsageRecord = {
      tenantId: params.tenantId,
      tokens: params.tokens,
      requestCount: params.requestCount ?? 1,
      timestamp: params.timestamp ?? new Date(),
      model: params.model,
      agentRole: params.agentRole,
      estimatedCost,
    };

    await this.usageRepository.recordUsage(record);

    return record;
  }

  // ============================================================================
  // Cost Calculation
  // ============================================================================

  /**
   * Calculate cost for token usage given a tier
   */
  calculateCost(tokens: number, tier: BillingTier): number {
    const limits = this.getTierLimits(tier);
    return tokens * limits.costPerToken;
  }

  /**
   * Calculate monthly bill for a tenant including subscription + usage overage
   */
  async calculateMonthlyBill(
    tenantId: string,
    tier: BillingTier,
    billingPeriodStart: Date,
    billingPeriodEnd: Date
  ): Promise<{
    subscriptionCost: number;
    usageCost: number;
    totalCost: number;
    totalTokens: number;
    includedTokens: number;
    overageTokens: number;
  }> {
    const limits = this.getTierLimits(tier);
    const records = await this.usageRepository.getUsageForPeriod(
      tenantId,
      billingPeriodStart,
      billingPeriodEnd
    );

    const totalTokens = records.reduce((sum, r) => sum + r.tokens, 0);
    const includedTokens = Math.min(totalTokens, limits.tokensPerMonth === Infinity ? totalTokens : limits.tokensPerMonth);
    const overageTokens = limits.tokensPerMonth === Infinity ? 0 : Math.max(0, totalTokens - limits.tokensPerMonth);
    const usageCost = this.calculateCost(totalTokens, tier);

    return {
      subscriptionCost: limits.monthlyPrice,
      usageCost,
      totalCost: limits.monthlyPrice + usageCost,
      totalTokens,
      includedTokens,
      overageTokens,
    };
  }

  /**
   * Get tenant usage summary for a billing period
   */
  async getTenantUsageSummary(
    tenantId: string,
    billingPeriodStart: Date,
    billingPeriodEnd: Date
  ): Promise<TenantUsageSummary> {
    const config = await this.usageRepository.getTenantConfig(tenantId);
    if (!config) {
      throw new TenantNotFoundError(tenantId);
    }

    const tier = config.tier;
    const limits = this.getTierLimits(tier);

    const records = await this.usageRepository.getUsageForPeriod(
      tenantId,
      billingPeriodStart,
      billingPeriodEnd
    );

    const totalTokens = records.reduce((sum, r) => sum + r.tokens, 0);
    const totalRequests = records.reduce((sum, r) => sum + r.requestCount, 0);
    const totalCost = records.reduce((sum, r) => sum + r.estimatedCost, 0);

    const remainingTokens =
      limits.tokensPerMonth === Infinity
        ? Infinity
        : Math.max(0, limits.tokensPerMonth - totalTokens);

    const isOverLimit =
      limits.tokensPerMonth !== Infinity && totalTokens > limits.tokensPerMonth;

    return {
      tenantId,
      tier,
      billingPeriodStart,
      billingPeriodEnd,
      totalTokens,
      totalRequests,
      totalCost,
      subscriptionCost: limits.monthlyPrice,
      remainingTokens,
      isOverLimit,
    };
  }

  // ============================================================================
  // Stripe Integration
  // ============================================================================

  /**
   * Create a Stripe customer for a new tenant
   */
  async createStripeCustomer(email: string, tenantId: string): Promise<StripeCustomer> {
    return this.paymentProvider.createCustomer(email, tenantId);
  }

  /**
   * Create a Stripe subscription for a tenant
   */
  async createSubscription(customerId: string, priceId: string): Promise<StripeSubscription> {
    return this.paymentProvider.createSubscription(customerId, priceId);
  }

  /**
   * Cancel a tenant's subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return this.paymentProvider.cancelSubscription(subscriptionId);
  }

  /**
   * Get invoices for a tenant
   */
  async getInvoices(customerId: string): Promise<StripeInvoice[]> {
    return this.paymentProvider.getInvoices(customerId);
  }

  /**
   * Report usage to Stripe (for metered billing)
   */
  async reportUsageToStripe(subscriptionItemId: string, quantity: number): Promise<void> {
    return this.paymentProvider.createUsageRecord(subscriptionItemId, quantity);
  }

  // ============================================================================
  // Tenant Configuration
  // ============================================================================

  /**
   * Set up a new tenant with billing configuration
   */
  async setupTenant(params: {
    tenantId: string;
    tier: BillingTier;
    email: string;
    priceId?: string;
  }): Promise<TenantBillingConfig> {
    if (!this.isValidTier(params.tier)) {
      throw new InvalidTierError(params.tier);
    }

    // Create Stripe customer
    const customer = await this.paymentProvider.createCustomer(params.email, params.tenantId);

    const now = new Date();
    const config: TenantBillingConfig = {
      tenantId: params.tenantId,
      tier: params.tier,
      stripeCustomerId: customer.id,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    // Create subscription if price ID provided
    if (params.priceId) {
      const subscription = await this.paymentProvider.createSubscription(
        customer.id,
        params.priceId
      );
      config.stripeSubscriptionId = subscription.id;
    }

    await this.usageRepository.saveTenantConfig(config);

    return config;
  }

  /**
   * Upgrade or downgrade a tenant's tier
   */
  async changeTier(tenantId: string, newTier: BillingTier): Promise<TenantBillingConfig> {
    if (!this.isValidTier(newTier)) {
      throw new InvalidTierError(newTier);
    }

    const config = await this.usageRepository.getTenantConfig(tenantId);
    if (!config) {
      throw new TenantNotFoundError(tenantId);
    }

    const updatedConfig: TenantBillingConfig = {
      ...config,
      tier: newTier,
      updatedAt: new Date(),
    };

    await this.usageRepository.saveTenantConfig(updatedConfig);

    return updatedConfig;
  }
}

// ============================================================================
// Backward-compatible stub export (kept, not removed)
// ============================================================================

/**
 * @deprecated Use BillingService class instead
 */
export function billingService(): string {
  return 'billing-service';
}
