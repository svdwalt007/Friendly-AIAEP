import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BillingService,
  billingService,
  TIER_LIMITS,
  RateLimitExceededError,
  TokenLimitExceededError,
  InvalidTierError,
  TenantNotFoundError,
  type BillingTier,
  type PaymentProvider,
  type UsageRepository,
  type TenantBillingConfig,
  type StripeCustomer,
  type StripeSubscription,
  type StripeInvoice,
  type UsageRecord,
} from './billing-service';

// ============================================================================
// Mock Factories
// ============================================================================

function createMockPaymentProvider(): PaymentProvider {
  return {
    createCustomer: vi.fn(),
    getCustomer: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    getSubscription: vi.fn(),
    createUsageRecord: vi.fn(),
    getInvoices: vi.fn(),
  };
}

function createMockUsageRepository(): UsageRepository {
  return {
    recordUsage: vi.fn(),
    getUsageForPeriod: vi.fn(),
    getTenantConfig: vi.fn(),
    saveTenantConfig: vi.fn(),
  };
}

function makeStripeCustomer(overrides?: Partial<StripeCustomer>): StripeCustomer {
  return {
    id: 'cus_test123',
    email: 'tenant@example.com',
    metadata: { tenantId: 'tenant-001' },
    ...overrides,
  };
}

function makeStripeSubscription(overrides?: Partial<StripeSubscription>): StripeSubscription {
  return {
    id: 'sub_test123',
    customerId: 'cus_test123',
    status: 'active',
    currentPeriodStart: Math.floor(Date.now() / 1000),
    currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    planId: 'price_starter_monthly',
    ...overrides,
  };
}

function makeStripeInvoice(overrides?: Partial<StripeInvoice>): StripeInvoice {
  return {
    id: 'inv_test123',
    customerId: 'cus_test123',
    amount: 2999,
    currency: 'usd',
    status: 'paid',
    ...overrides,
  };
}

function makeTenantConfig(overrides?: Partial<TenantBillingConfig>): TenantBillingConfig {
  return {
    tenantId: 'tenant-001',
    tier: 'starter',
    stripeCustomerId: 'cus_test123',
    active: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeUsageRecord(overrides?: Partial<UsageRecord>): UsageRecord {
  return {
    tenantId: 'tenant-001',
    tokens: 10000,
    requestCount: 1,
    timestamp: new Date(),
    estimatedCost: 0.0001,
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('billingService (legacy stub)', () => {
  it('should return "billing-service"', () => {
    expect(billingService()).toBe('billing-service');
  });
});

describe('TIER_LIMITS', () => {
  it('should define starter tier with correct limits', () => {
    expect(TIER_LIMITS.starter.requestsPerMinute).toBe(100);
    expect(TIER_LIMITS.starter.tokensPerMonth).toBe(1_000_000);
    expect(TIER_LIMITS.starter.costPerToken).toBeGreaterThan(0);
    expect(TIER_LIMITS.starter.monthlyPrice).toBeGreaterThan(0);
  });

  it('should define professional tier with correct limits', () => {
    expect(TIER_LIMITS.professional.requestsPerMinute).toBe(500);
    expect(TIER_LIMITS.professional.tokensPerMonth).toBe(10_000_000);
    expect(TIER_LIMITS.professional.costPerToken).toBeGreaterThan(0);
    expect(TIER_LIMITS.professional.monthlyPrice).toBeGreaterThan(0);
  });

  it('should define enterprise tier with correct limits', () => {
    expect(TIER_LIMITS.enterprise.requestsPerMinute).toBe(2000);
    expect(TIER_LIMITS.enterprise.tokensPerMonth).toBe(Infinity);
    expect(TIER_LIMITS.enterprise.costPerToken).toBeGreaterThan(0);
    expect(TIER_LIMITS.enterprise.monthlyPrice).toBeGreaterThan(0);
  });

  it('should have professional limits higher than starter', () => {
    expect(TIER_LIMITS.professional.requestsPerMinute).toBeGreaterThan(
      TIER_LIMITS.starter.requestsPerMinute
    );
    expect(TIER_LIMITS.professional.tokensPerMonth).toBeGreaterThan(
      TIER_LIMITS.starter.tokensPerMonth
    );
  });

  it('should have enterprise limits higher than professional', () => {
    expect(TIER_LIMITS.enterprise.requestsPerMinute).toBeGreaterThan(
      TIER_LIMITS.professional.requestsPerMinute
    );
  });
});

describe('BillingService', () => {
  let service: BillingService;
  let mockPaymentProvider: PaymentProvider;
  let mockUsageRepository: UsageRepository;

  beforeEach(() => {
    mockPaymentProvider = createMockPaymentProvider();
    mockUsageRepository = createMockUsageRepository();
    service = new BillingService({
      paymentProvider: mockPaymentProvider,
      usageRepository: mockUsageRepository,
      rateLimitWindowMs: 60_000,
    });
  });

  // ============================================================================
  // Tier Management
  // ============================================================================

  describe('getTierLimits', () => {
    it('should return correct limits for starter tier', () => {
      const limits = service.getTierLimits('starter');
      expect(limits.requestsPerMinute).toBe(100);
      expect(limits.tokensPerMonth).toBe(1_000_000);
    });

    it('should return correct limits for professional tier', () => {
      const limits = service.getTierLimits('professional');
      expect(limits.requestsPerMinute).toBe(500);
      expect(limits.tokensPerMonth).toBe(10_000_000);
    });

    it('should return correct limits for enterprise tier', () => {
      const limits = service.getTierLimits('enterprise');
      expect(limits.requestsPerMinute).toBe(2000);
      expect(limits.tokensPerMonth).toBe(Infinity);
    });

    it('should throw InvalidTierError for unknown tier', () => {
      expect(() => service.getTierLimits('invalid' as BillingTier)).toThrow(
        InvalidTierError
      );
      expect(() => service.getTierLimits('invalid' as BillingTier)).toThrow(
        /Invalid billing tier: invalid/
      );
    });
  });

  describe('isValidTier', () => {
    it('should return true for starter', () => {
      expect(service.isValidTier('starter')).toBe(true);
    });

    it('should return true for professional', () => {
      expect(service.isValidTier('professional')).toBe(true);
    });

    it('should return true for enterprise', () => {
      expect(service.isValidTier('enterprise')).toBe(true);
    });

    it('should return false for invalid tier', () => {
      expect(service.isValidTier('free')).toBe(false);
      expect(service.isValidTier('')).toBe(false);
      expect(service.isValidTier('STARTER')).toBe(false);
    });
  });

  // ============================================================================
  // Rate Limit Enforcement
  // ============================================================================

  describe('checkRateLimit — starter (100 req/min)', () => {
    it('should allow first request', () => {
      const result = service.checkRateLimit('tenant-001', 'starter');
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(1);
      expect(result.limit).toBe(100);
      expect(result.remainingRequests).toBe(99);
    });

    it('should allow up to the rate limit', () => {
      for (let i = 0; i < 99; i++) {
        service.checkRateLimit('tenant-001', 'starter');
      }
      // 100th request should still be allowed
      const result = service.checkRateLimit('tenant-001', 'starter');
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(100);
      expect(result.remainingRequests).toBe(0);
    });

    it('should throw RateLimitExceededError on 101st request', () => {
      for (let i = 0; i < 100; i++) {
        service.checkRateLimit('tenant-001', 'starter');
      }
      expect(() => service.checkRateLimit('tenant-001', 'starter')).toThrow(
        RateLimitExceededError
      );
    });

    it('RateLimitExceededError should contain tenant and tier details', () => {
      for (let i = 0; i < 100; i++) {
        service.checkRateLimit('tenant-001', 'starter');
      }
      try {
        service.checkRateLimit('tenant-001', 'starter');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitExceededError);
        const rle = err as RateLimitExceededError;
        expect(rle.tenantId).toBe('tenant-001');
        expect(rle.tier).toBe('starter');
        expect(rle.limit).toBe(100);
        expect(rle.name).toBe('RateLimitExceededError');
      }
    });
  });

  describe('checkRateLimit — professional (500 req/min)', () => {
    it('should allow up to 500 requests per minute', () => {
      for (let i = 0; i < 500; i++) {
        const result = service.checkRateLimit('tenant-pro', 'professional');
        expect(result.allowed).toBe(true);
      }
    });

    it('should reject the 501st request', () => {
      for (let i = 0; i < 500; i++) {
        service.checkRateLimit('tenant-pro', 'professional');
      }
      expect(() => service.checkRateLimit('tenant-pro', 'professional')).toThrow(
        RateLimitExceededError
      );
    });
  });

  describe('checkRateLimit — enterprise (2000 req/min)', () => {
    it('should allow up to 2000 requests per minute', () => {
      for (let i = 0; i < 2000; i++) {
        const result = service.checkRateLimit('tenant-ent', 'enterprise');
        expect(result.allowed).toBe(true);
      }
    });

    it('should reject the 2001st request', () => {
      for (let i = 0; i < 2000; i++) {
        service.checkRateLimit('tenant-ent', 'enterprise');
      }
      expect(() => service.checkRateLimit('tenant-ent', 'enterprise')).toThrow(
        RateLimitExceededError
      );
    });
  });

  describe('checkRateLimit — window expiry', () => {
    it('should reset rate limit after window expires', () => {
      // Use a very short window
      const shortWindowService = new BillingService({
        paymentProvider: mockPaymentProvider,
        usageRepository: mockUsageRepository,
        rateLimitWindowMs: 1, // 1ms window
      });

      // Fill the window
      for (let i = 0; i < 100; i++) {
        shortWindowService.checkRateLimit('tenant-001', 'starter');
      }

      // Wait longer than the window
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // After window expires, should reset
          const result = shortWindowService.checkRateLimit('tenant-001', 'starter');
          expect(result.allowed).toBe(true);
          expect(result.currentCount).toBe(1);
          resolve();
        }, 10);
      });
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status without incrementing', () => {
      const status = service.getRateLimitStatus('tenant-001', 'starter');
      expect(status.currentCount).toBe(0);
      expect(status.limit).toBe(100);
      expect(status.remainingRequests).toBe(100);
      expect(status.allowed).toBe(true);

      // Make a request then check again
      service.checkRateLimit('tenant-001', 'starter');
      const status2 = service.getRateLimitStatus('tenant-001', 'starter');
      expect(status2.currentCount).toBe(1);
    });

    it('should show not-allowed when at limit', () => {
      for (let i = 0; i < 100; i++) {
        service.checkRateLimit('tenant-001', 'starter');
      }
      const status = service.getRateLimitStatus('tenant-001', 'starter');
      expect(status.allowed).toBe(false);
      expect(status.remainingRequests).toBe(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset the rate limit for a tenant', () => {
      for (let i = 0; i < 100; i++) {
        service.checkRateLimit('tenant-001', 'starter');
      }
      service.resetRateLimit('tenant-001');
      // Should be able to make requests again
      const result = service.checkRateLimit('tenant-001', 'starter');
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(1);
    });
  });

  // ============================================================================
  // Token Limit Enforcement
  // ============================================================================

  describe('checkTokenLimit', () => {
    const now = new Date('2025-06-01T00:00:00Z');
    const periodStart = new Date('2025-06-01T00:00:00Z');
    const periodEnd = new Date('2025-06-30T23:59:59Z');

    it('should allow request within starter token limit', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 500_000 }),
      ]);

      const result = await service.checkTokenLimit(
        'tenant-001',
        'starter',
        100_000,
        periodStart,
        periodEnd
      );

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(500_000);
      expect(result.limit).toBe(1_000_000);
    });

    it('should throw TokenLimitExceededError when starter limit is exceeded', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 950_000 }),
      ]);

      await expect(
        service.checkTokenLimit('tenant-001', 'starter', 100_000, periodStart, periodEnd)
      ).rejects.toThrow(TokenLimitExceededError);
    });

    it('TokenLimitExceededError should contain correct details', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 950_000 }),
      ]);

      try {
        await service.checkTokenLimit('tenant-001', 'starter', 100_000, periodStart, periodEnd);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TokenLimitExceededError);
        const tle = err as TokenLimitExceededError;
        expect(tle.tenantId).toBe('tenant-001');
        expect(tle.tier).toBe('starter');
        expect(tle.limit).toBe(1_000_000);
        expect(tle.name).toBe('TokenLimitExceededError');
      }
    });

    it('should allow professional tier up to 10M tokens', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 9_000_000 }),
      ]);

      const result = await service.checkTokenLimit(
        'tenant-pro',
        'professional',
        500_000,
        periodStart,
        periodEnd
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10_000_000);
    });

    it('should throw for professional when exceeding 10M tokens', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 9_900_000 }),
      ]);

      await expect(
        service.checkTokenLimit('tenant-pro', 'professional', 200_000, periodStart, periodEnd)
      ).rejects.toThrow(TokenLimitExceededError);
    });

    it('should always allow enterprise (unlimited tokens)', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 999_999_999 }),
      ]);

      const result = await service.checkTokenLimit(
        'tenant-ent',
        'enterprise',
        999_999_999,
        periodStart,
        periodEnd
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
      // getUsageForPeriod should NOT be called for enterprise (short-circuits)
      expect(mockUsageRepository.getUsageForPeriod).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Usage Recording
  // ============================================================================

  describe('recordUsage', () => {
    it('should record usage and return a UsageRecord', async () => {
      vi.mocked(mockUsageRepository.recordUsage).mockResolvedValue(undefined);

      const record = await service.recordUsage({
        tenantId: 'tenant-001',
        tier: 'starter',
        tokens: 5000,
        model: 'claude-opus-4-6',
        agentRole: 'CODEGEN',
      });

      expect(record.tenantId).toBe('tenant-001');
      expect(record.tokens).toBe(5000);
      expect(record.requestCount).toBe(1);
      expect(record.model).toBe('claude-opus-4-6');
      expect(record.agentRole).toBe('CODEGEN');
      expect(record.estimatedCost).toBeGreaterThan(0);
      expect(record.timestamp).toBeInstanceOf(Date);
    });

    it('should call usageRepository.recordUsage with the record', async () => {
      vi.mocked(mockUsageRepository.recordUsage).mockResolvedValue(undefined);

      await service.recordUsage({
        tenantId: 'tenant-001',
        tier: 'starter',
        tokens: 1000,
      });

      expect(mockUsageRepository.recordUsage).toHaveBeenCalledOnce();
      expect(mockUsageRepository.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-001',
          tokens: 1000,
        })
      );
    });

    it('should use provided timestamp if given', async () => {
      vi.mocked(mockUsageRepository.recordUsage).mockResolvedValue(undefined);
      const ts = new Date('2025-06-15T10:00:00Z');

      const record = await service.recordUsage({
        tenantId: 'tenant-001',
        tier: 'professional',
        tokens: 100,
        timestamp: ts,
      });

      expect(record.timestamp).toBe(ts);
    });

    it('should accept optional requestCount', async () => {
      vi.mocked(mockUsageRepository.recordUsage).mockResolvedValue(undefined);

      const record = await service.recordUsage({
        tenantId: 'tenant-001',
        tier: 'starter',
        tokens: 100,
        requestCount: 5,
      });

      expect(record.requestCount).toBe(5);
    });
  });

  // ============================================================================
  // Cost Calculation
  // ============================================================================

  describe('calculateCost', () => {
    it('should calculate cost correctly for starter tier', () => {
      const cost = service.calculateCost(1_000_000, 'starter');
      expect(cost).toBeCloseTo(TIER_LIMITS.starter.costPerToken * 1_000_000, 5);
    });

    it('should calculate cost correctly for professional tier', () => {
      const cost = service.calculateCost(1_000_000, 'professional');
      expect(cost).toBeCloseTo(TIER_LIMITS.professional.costPerToken * 1_000_000, 5);
    });

    it('should calculate cost correctly for enterprise tier', () => {
      const cost = service.calculateCost(1_000_000, 'enterprise');
      expect(cost).toBeCloseTo(TIER_LIMITS.enterprise.costPerToken * 1_000_000, 5);
    });

    it('should return 0 for 0 tokens', () => {
      expect(service.calculateCost(0, 'starter')).toBe(0);
    });

    it('should have lower per-token cost for higher tiers', () => {
      const starterCost = service.calculateCost(1000, 'starter');
      const proCost = service.calculateCost(1000, 'professional');
      const entCost = service.calculateCost(1000, 'enterprise');
      expect(proCost).toBeLessThan(starterCost);
      expect(entCost).toBeLessThan(proCost);
    });

    it('should throw for invalid tier', () => {
      expect(() => service.calculateCost(1000, 'invalid' as BillingTier)).toThrow(
        InvalidTierError
      );
    });
  });

  describe('calculateMonthlyBill', () => {
    const periodStart = new Date('2025-06-01T00:00:00Z');
    const periodEnd = new Date('2025-06-30T23:59:59Z');

    it('should calculate total monthly bill including subscription', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 500_000 }),
        makeUsageRecord({ tokens: 200_000 }),
      ]);

      const bill = await service.calculateMonthlyBill(
        'tenant-001',
        'starter',
        periodStart,
        periodEnd
      );

      expect(bill.totalTokens).toBe(700_000);
      expect(bill.subscriptionCost).toBe(TIER_LIMITS.starter.monthlyPrice);
      expect(bill.usageCost).toBeGreaterThan(0);
      expect(bill.totalCost).toBe(bill.subscriptionCost + bill.usageCost);
    });

    it('should show zero overage for usage within limit', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 500_000 }),
      ]);

      const bill = await service.calculateMonthlyBill(
        'tenant-001',
        'starter',
        periodStart,
        periodEnd
      );

      expect(bill.overageTokens).toBe(0);
    });

    it('should show overage tokens when usage exceeds limit', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 1_500_000 }),
      ]);

      const bill = await service.calculateMonthlyBill(
        'tenant-001',
        'starter',
        periodStart,
        periodEnd
      );

      expect(bill.totalTokens).toBe(1_500_000);
      expect(bill.overageTokens).toBe(500_000);
    });

    it('should have zero overage for enterprise (unlimited)', async () => {
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 99_000_000 }),
      ]);

      const bill = await service.calculateMonthlyBill(
        'tenant-ent',
        'enterprise',
        periodStart,
        periodEnd
      );

      expect(bill.overageTokens).toBe(0);
    });
  });

  // ============================================================================
  // Tenant Usage Summary
  // ============================================================================

  describe('getTenantUsageSummary', () => {
    const periodStart = new Date('2025-06-01T00:00:00Z');
    const periodEnd = new Date('2025-06-30T23:59:59Z');

    it('should return correct summary for a tenant', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(
        makeTenantConfig({ tenantId: 'tenant-001', tier: 'starter' })
      );
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 100_000, requestCount: 10, estimatedCost: 1.0 }),
        makeUsageRecord({ tokens: 200_000, requestCount: 20, estimatedCost: 2.0 }),
      ]);

      const summary = await service.getTenantUsageSummary(
        'tenant-001',
        periodStart,
        periodEnd
      );

      expect(summary.tenantId).toBe('tenant-001');
      expect(summary.tier).toBe('starter');
      expect(summary.totalTokens).toBe(300_000);
      expect(summary.totalRequests).toBe(30);
      expect(summary.totalCost).toBe(3.0);
      expect(summary.remainingTokens).toBe(700_000);
      expect(summary.isOverLimit).toBe(false);
    });

    it('should mark as over limit when usage exceeds token limit', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(
        makeTenantConfig({ tier: 'starter' })
      );
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 1_500_000, requestCount: 100, estimatedCost: 15.0 }),
      ]);

      const summary = await service.getTenantUsageSummary(
        'tenant-001',
        periodStart,
        periodEnd
      );

      expect(summary.isOverLimit).toBe(true);
      expect(summary.remainingTokens).toBe(0);
    });

    it('should show Infinity remaining tokens for enterprise', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(
        makeTenantConfig({ tier: 'enterprise' })
      );
      vi.mocked(mockUsageRepository.getUsageForPeriod).mockResolvedValue([
        makeUsageRecord({ tokens: 50_000_000, requestCount: 5000, estimatedCost: 300.0 }),
      ]);

      const summary = await service.getTenantUsageSummary(
        'tenant-ent',
        periodStart,
        periodEnd
      );

      expect(summary.remainingTokens).toBe(Infinity);
      expect(summary.isOverLimit).toBe(false);
    });

    it('should throw TenantNotFoundError when tenant config is null', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(null);

      await expect(
        service.getTenantUsageSummary('unknown-tenant', periodStart, periodEnd)
      ).rejects.toThrow(TenantNotFoundError);
    });

    it('TenantNotFoundError should contain tenant ID', () => {
      const err = new TenantNotFoundError('missing-tenant');
      expect(err.message).toContain('missing-tenant');
      expect(err.name).toBe('TenantNotFoundError');
    });
  });

  // ============================================================================
  // Stripe Integration
  // ============================================================================

  describe('createStripeCustomer', () => {
    it('should call paymentProvider.createCustomer and return customer', async () => {
      const customer = makeStripeCustomer();
      vi.mocked(mockPaymentProvider.createCustomer).mockResolvedValue(customer);

      const result = await service.createStripeCustomer('tenant@example.com', 'tenant-001');

      expect(result).toBe(customer);
      expect(mockPaymentProvider.createCustomer).toHaveBeenCalledWith(
        'tenant@example.com',
        'tenant-001'
      );
    });
  });

  describe('createSubscription', () => {
    it('should call paymentProvider.createSubscription', async () => {
      const subscription = makeStripeSubscription();
      vi.mocked(mockPaymentProvider.createSubscription).mockResolvedValue(subscription);

      const result = await service.createSubscription('cus_test123', 'price_starter_monthly');

      expect(result).toBe(subscription);
      expect(mockPaymentProvider.createSubscription).toHaveBeenCalledWith(
        'cus_test123',
        'price_starter_monthly'
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should call paymentProvider.cancelSubscription', async () => {
      const canceledSub = makeStripeSubscription({ status: 'canceled' });
      vi.mocked(mockPaymentProvider.cancelSubscription).mockResolvedValue(canceledSub);

      const result = await service.cancelSubscription('sub_test123');

      expect(result.status).toBe('canceled');
      expect(mockPaymentProvider.cancelSubscription).toHaveBeenCalledWith('sub_test123');
    });
  });

  describe('getInvoices', () => {
    it('should call paymentProvider.getInvoices and return invoices', async () => {
      const invoices = [makeStripeInvoice(), makeStripeInvoice({ id: 'inv_456', amount: 9999 })];
      vi.mocked(mockPaymentProvider.getInvoices).mockResolvedValue(invoices);

      const result = await service.getInvoices('cus_test123');

      expect(result).toHaveLength(2);
      expect(mockPaymentProvider.getInvoices).toHaveBeenCalledWith('cus_test123');
    });
  });

  describe('reportUsageToStripe', () => {
    it('should call paymentProvider.createUsageRecord', async () => {
      vi.mocked(mockPaymentProvider.createUsageRecord).mockResolvedValue(undefined);

      await service.reportUsageToStripe('si_test123', 50000);

      expect(mockPaymentProvider.createUsageRecord).toHaveBeenCalledWith('si_test123', 50000);
    });
  });

  // ============================================================================
  // Tenant Setup
  // ============================================================================

  describe('setupTenant', () => {
    it('should create customer, save config, and return TenantBillingConfig', async () => {
      const customer = makeStripeCustomer();
      vi.mocked(mockPaymentProvider.createCustomer).mockResolvedValue(customer);
      vi.mocked(mockUsageRepository.saveTenantConfig).mockResolvedValue(undefined);

      const config = await service.setupTenant({
        tenantId: 'tenant-001',
        tier: 'starter',
        email: 'tenant@example.com',
      });

      expect(config.tenantId).toBe('tenant-001');
      expect(config.tier).toBe('starter');
      expect(config.stripeCustomerId).toBe('cus_test123');
      expect(config.active).toBe(true);
      expect(mockUsageRepository.saveTenantConfig).toHaveBeenCalledOnce();
    });

    it('should create subscription if priceId is provided', async () => {
      const customer = makeStripeCustomer();
      const subscription = makeStripeSubscription();
      vi.mocked(mockPaymentProvider.createCustomer).mockResolvedValue(customer);
      vi.mocked(mockPaymentProvider.createSubscription).mockResolvedValue(subscription);
      vi.mocked(mockUsageRepository.saveTenantConfig).mockResolvedValue(undefined);

      const config = await service.setupTenant({
        tenantId: 'tenant-001',
        tier: 'professional',
        email: 'tenant@example.com',
        priceId: 'price_pro_monthly',
      });

      expect(config.stripeSubscriptionId).toBe('sub_test123');
      expect(mockPaymentProvider.createSubscription).toHaveBeenCalledWith(
        'cus_test123',
        'price_pro_monthly'
      );
    });

    it('should throw InvalidTierError for invalid tier', async () => {
      await expect(
        service.setupTenant({
          tenantId: 'tenant-001',
          tier: 'invalid' as BillingTier,
          email: 'tenant@example.com',
        })
      ).rejects.toThrow(InvalidTierError);
    });
  });

  // ============================================================================
  // Tier Change
  // ============================================================================

  describe('changeTier', () => {
    it('should upgrade tenant tier from starter to professional', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(
        makeTenantConfig({ tier: 'starter' })
      );
      vi.mocked(mockUsageRepository.saveTenantConfig).mockResolvedValue(undefined);

      const updated = await service.changeTier('tenant-001', 'professional');

      expect(updated.tier).toBe('professional');
      expect(mockUsageRepository.saveTenantConfig).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'professional' })
      );
    });

    it('should throw TenantNotFoundError when tenant does not exist', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(null);

      await expect(service.changeTier('unknown-tenant', 'professional')).rejects.toThrow(
        TenantNotFoundError
      );
    });

    it('should throw InvalidTierError for invalid tier', async () => {
      vi.mocked(mockUsageRepository.getTenantConfig).mockResolvedValue(
        makeTenantConfig()
      );

      await expect(service.changeTier('tenant-001', 'invalid' as BillingTier)).rejects.toThrow(
        InvalidTierError
      );
    });
  });

  // ============================================================================
  // Error Classes
  // ============================================================================

  describe('Error classes', () => {
    it('InvalidTierError should have correct properties', () => {
      const err = new InvalidTierError('bogus');
      expect(err.name).toBe('InvalidTierError');
      expect(err.message).toContain('bogus');
      expect(err).toBeInstanceOf(Error);
    });

    it('RateLimitExceededError should have correct properties', () => {
      const err = new RateLimitExceededError('t1', 'starter', 100, 101);
      expect(err.name).toBe('RateLimitExceededError');
      expect(err.tenantId).toBe('t1');
      expect(err.tier).toBe('starter');
      expect(err.limit).toBe(100);
      expect(err.current).toBe(101);
      expect(err).toBeInstanceOf(Error);
    });

    it('TokenLimitExceededError should have correct properties', () => {
      const err = new TokenLimitExceededError('t1', 'professional', 10_000_000, 10_100_000);
      expect(err.name).toBe('TokenLimitExceededError');
      expect(err.tenantId).toBe('t1');
      expect(err.tier).toBe('professional');
      expect(err.limit).toBe(10_000_000);
      expect(err.current).toBe(10_100_000);
      expect(err).toBeInstanceOf(Error);
    });

    it('TenantNotFoundError should have correct properties', () => {
      const err = new TenantNotFoundError('missing');
      expect(err.name).toBe('TenantNotFoundError');
      expect(err.message).toContain('missing');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
