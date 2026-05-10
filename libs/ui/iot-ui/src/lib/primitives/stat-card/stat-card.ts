/**
 * @file Friendly Stat Card — KPI block primitive with optional spark.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { FriendlySpark } from '../spark/spark';

/** Direction of change displayed alongside the value. */
export type StatCardTrend = 'up' | 'down' | 'flat';

/**
 * <friendly-stat-card>
 *
 * Compact KPI surface used by AEP v2 dashboards. Surfaces a label, a
 * primary value (with optional unit), an optional delta with trend
 * direction, and an optional embedded `<friendly-spark>`. Pure
 * presentational; consumers own the data.
 */
@Component({
  selector: 'friendly-stat-card',
  standalone: true,
  imports: [FriendlySpark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="friendly-stat-card"
      [attr.data-trend]="effectiveTrend()"
      [attr.aria-label]="ariaLabel()"
    >
      <header class="friendly-stat-card__header">
        <span class="friendly-stat-card__label">{{ label() }}</span>
        @if (showSpark()) {
          <friendly-spark
            class="friendly-stat-card__spark"
            [seed]="sparkSeed()"
            [width]="sparkWidth()"
            [height]="sparkHeight()"
            [ariaLabel]="label() + ' trend'"
          ></friendly-spark>
        }
      </header>

      <div class="friendly-stat-card__value">
        <span class="friendly-stat-card__amount">{{ value() }}</span>
        @if (unit()) {
          <span class="friendly-stat-card__unit">{{ unit() }}</span>
        }
      </div>

      @if (delta() !== null && delta() !== undefined) {
        <div
          class="friendly-stat-card__delta"
          [class.friendly-stat-card__delta--up]="effectiveTrend() === 'up'"
          [class.friendly-stat-card__delta--down]="effectiveTrend() === 'down'"
          [class.friendly-stat-card__delta--flat]="effectiveTrend() === 'flat'"
        >
          <span class="friendly-stat-card__delta-icon" aria-hidden="true">
            {{ trendGlyph() }}
          </span>
          <span class="friendly-stat-card__delta-value">{{
            formattedDelta()
          }}</span>
        </div>
      }
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .friendly-stat-card {
        display: flex;
        flex-direction: column;
        gap: var(--ft-density-spacing-sm, 8px);
        padding: var(--ft-density-spacing-md, 16px);
        background-color: var(--ft-surface-primary);
        border: 1px solid var(--ft-border-color);
        border-radius: var(--ft-card-radius);
        box-shadow: var(--ft-shadow-sm);
        color: var(--ft-text-primary);
      }

      .friendly-stat-card__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ft-density-spacing-md, 16px);
      }

      .friendly-stat-card__label {
        font-size: var(--ft-density-font-sm, 0.875rem);
        font-weight: var(--ft-font-weight-medium);
        color: var(--ft-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .friendly-stat-card__spark {
        color: var(--ft-accent-current, var(--ft-accent));
      }

      .friendly-stat-card__value {
        display: flex;
        align-items: baseline;
        gap: var(--ft-density-spacing-xs, 4px);
      }

      .friendly-stat-card__amount {
        font-size: var(--ft-font-size-3xl);
        font-weight: var(--ft-font-weight-bold);
        color: var(--ft-primary);
        line-height: var(--ft-density-line-height, 1.5);
      }

      .friendly-stat-card__unit {
        font-size: var(--ft-density-font-base, 1rem);
        color: var(--ft-text-secondary);
        font-weight: var(--ft-font-weight-medium);
      }

      .friendly-stat-card__delta {
        display: inline-flex;
        align-items: center;
        gap: var(--ft-density-spacing-xs, 4px);
        font-size: var(--ft-density-font-sm, 0.875rem);
        font-weight: var(--ft-font-weight-medium);
      }

      .friendly-stat-card__delta--up {
        color: var(--ft-success);
      }

      .friendly-stat-card__delta--down {
        color: var(--ft-error);
      }

      .friendly-stat-card__delta--flat {
        color: var(--ft-text-secondary);
      }

      .friendly-stat-card__delta-icon {
        font-size: 1em;
        line-height: 1;
      }
    `,
  ],
})
export class FriendlyStatCard {
  /** Short caption describing the metric (e.g. "Active devices"). */
  readonly label = input.required<string>();

  /**
   * Primary metric value. Pre-formatted by the consumer — this primitive
   * does not opine on locale or precision.
   */
  readonly value = input.required<string | number>();

  /** Optional unit suffix (e.g. "ms", "%"). */
  readonly unit = input<string | null>(null);

  /**
   * Optional change-over-period value. `null`/`undefined` hides the row.
   * Formatting follows the consumer's locale conventions.
   */
  readonly delta = input<number | null>(null);

  /** Override automatic trend derivation from `delta`. */
  readonly trend = input<StatCardTrend | null>(null);

  /** When true (default), embed a `<friendly-spark>` in the header. */
  readonly showSpark = input<boolean>(true);

  /** Deterministic seed for the embedded spark. */
  readonly sparkSeed = input<number>(0);

  /** Spark width override; defaults to AEP v2 spec (220px). */
  readonly sparkWidth = input<number>(220);

  /** Spark height override; defaults to AEP v2 spec (40px). */
  readonly sparkHeight = input<number>(40);

  /** Accessible label for the card surface. */
  readonly ariaLabel = input<string>('');

  /**
   * Trend used by the rendered delta. If the consumer supplied an explicit
   * trend it wins; otherwise the sign of `delta` decides.
   */
  protected readonly effectiveTrend = computed<StatCardTrend>(() => {
    const explicit = this.trend();
    if (explicit) {
      return explicit;
    }
    const d = this.delta();
    if (d === null || d === undefined) {
      return 'flat';
    }
    if (d > 0) {
      return 'up';
    }
    if (d < 0) {
      return 'down';
    }
    return 'flat';
  });

  /** Up/down/flat glyph rendered alongside the delta. */
  protected readonly trendGlyph = computed<string>(() => {
    switch (this.effectiveTrend()) {
      case 'up':
        return '▲';
      case 'down':
        return '▼';
      default:
        return '◆';
    }
  });

  /**
   * Delta with a leading sign so screen readers and sighted users perceive
   * direction even when the icon is suppressed by a high-contrast theme.
   */
  protected readonly formattedDelta = computed<string>(() => {
    const d = this.delta();
    if (d === null || d === undefined) {
      return '';
    }
    if (d > 0) {
      return `+${d}`;
    }
    return `${d}`;
  });
}
