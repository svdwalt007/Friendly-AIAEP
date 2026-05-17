import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';
import { BillingComponent } from './billing.component';

describe('BillingComponent', () => {
  let component: BillingComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BillingComponent],
      providers: [provideNoopAnimations()],
    });
    component = TestBed.createComponent(BillingComponent).componentInstance;
  });

  it('defaults to the Professional tier', () => {
    expect(component.currentTier()).toBe('Professional');
    expect(component.plan().tier).toBe('Professional');
  });

  it('apiCallPercent reflects usage / limit', () => {
    component.currentTier.set('Starter');
    component.apiCallsUsed.set(5_000);
    // Starter limit is 10_000 → 50%
    expect(component.apiCallPercent()).toBe(50);
  });

  it('tokenPercent reflects usage / limit', () => {
    component.currentTier.set('Starter');
    component.tokensUsed.set(2_500_000);
    expect(component.tokenPercent()).toBe(50);
  });

  it('caps percentages at 100 when over-quota', () => {
    component.currentTier.set('Starter');
    component.apiCallsUsed.set(99_999_999);
    expect(component.apiCallPercent()).toBe(100);
  });

  it('returns 0% for Enterprise (unlimited)', () => {
    component.currentTier.set('Enterprise');
    component.apiCallsUsed.set(99_999_999);
    expect(component.apiCallPercent()).toBe(0);
    expect(component.tokenPercent()).toBe(0);
  });

  it('isUnlimited is true only for Enterprise tier', () => {
    component.currentTier.set('Starter');
    expect(component.isUnlimited()).toBe(false);
    component.currentTier.set('Professional');
    expect(component.isUnlimited()).toBe(false);
    component.currentTier.set('Enterprise');
    expect(component.isUnlimited()).toBe(true);
  });

  it('formatNumber returns "Unlimited" for negative limits', () => {
    expect(component.formatNumber(-1)).toBe('Unlimited');
  });

  it('formatNumber uses en-AU locale grouping', () => {
    expect(component.formatNumber(1_234_567)).toMatch(/1[\s,. ]234[\s,. ]567/);
  });
});
