/**
 * @file BillingComponent — B6 workspace surface.
 * Child route: /settings/billing
 * Read-only billing overview; Stripe portal link is a stub.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

export type BillingTier = 'Starter' | 'Professional' | 'Enterprise';

interface PlanDef {
  tier: BillingTier;
  badgeClass: string;
  icon: string;
  apiCallLimit: number;
  tokenLimit: number;
  priceLabel: string;
}

const PLANS: Record<BillingTier, PlanDef> = {
  Starter: {
    tier: 'Starter',
    badgeClass: 'badge-starter',
    icon: 'rocket_launch',
    apiCallLimit: 10_000,
    tokenLimit: 5_000_000,
    priceLabel: 'Free',
  },
  Professional: {
    tier: 'Professional',
    badgeClass: 'badge-professional',
    icon: 'workspace_premium',
    apiCallLimit: 250_000,
    tokenLimit: 50_000_000,
    priceLabel: 'USD 99 / month',
  },
  Enterprise: {
    tier: 'Enterprise',
    badgeClass: 'badge-enterprise',
    icon: 'domain',
    apiCallLimit: -1, // unlimited
    tokenLimit: -1,
    priceLabel: 'Custom — contact sales',
  },
};

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent {
  /** Mock current tenant plan. Replace with auth service plan when available. */
  readonly currentTier = signal<BillingTier>('Professional');

  /** Mock usage this month. Replace with API call when endpoint is ready. */
  readonly apiCallsUsed = signal(87_342);
  readonly tokensUsed = signal(12_450_600);

  readonly plan = computed(() => PLANS[this.currentTier()]);

  readonly apiCallPercent = computed(() => {
    const limit = this.plan().apiCallLimit;
    if (limit < 0) return 0;
    return Math.min(100, Math.round((this.apiCallsUsed() / limit) * 100));
  });

  readonly tokenPercent = computed(() => {
    const limit = this.plan().tokenLimit;
    if (limit < 0) return 0;
    return Math.min(100, Math.round((this.tokensUsed() / limit) * 100));
  });

  readonly isUnlimited = computed(() => this.plan().apiCallLimit < 0);

  formatNumber(n: number): string {
    if (n < 0) return 'Unlimited';
    return new Intl.NumberFormat('en-AU').format(n);
  }
}
