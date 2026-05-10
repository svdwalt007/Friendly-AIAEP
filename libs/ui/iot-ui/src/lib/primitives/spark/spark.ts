/**
 * @file Friendly Spark — 220×40 deterministic sparkline primitive.
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

/**
 * Default render dimensions (px) for an AEP v2 spark.
 *
 * Width/height match the v2 design contract; consumers can override via
 * `width` and `height` inputs but the deterministic seed algorithm and
 * point count remain stable across consumers regardless of size.
 */
const SPARK_DEFAULT_WIDTH = 220;
const SPARK_DEFAULT_HEIGHT = 40;
const SPARK_DEFAULT_POINTS = 32;

/**
 * Mulberry32 — small, fast, deterministic 32-bit PRNG.
 *
 * Given the same 32-bit seed it produces an identical, repeatable sequence
 * of doubles in [0, 1). Used so identical seeds render identical sparklines
 * across server/client and across renders, which is critical for
 * stream-replay and SSR hydration of agentic dashboards.
 *
 * @param seed 32-bit unsigned seed.
 * @returns A nullary function that yields the next pseudo-random value.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a deterministic series of values in [0, 1] for the sparkline.
 *
 * Combines a Mulberry32 stream with a low-frequency biased random walk so
 * that the resulting curve looks plausibly like time-series telemetry
 * rather than white noise.
 */
function generateSeries(seed: number, count: number): number[] {
  const rng = mulberry32(seed);
  const values: number[] = new Array(count);
  let level = rng();
  for (let i = 0; i < count; i++) {
    const drift = (rng() - 0.5) * 0.35;
    level = Math.min(1, Math.max(0, level + drift));
    values[i] = level;
  }
  return values;
}

/**
 * Convert a series of [0, 1] values into an SVG polyline `points` string.
 */
function buildPolyline(
  values: number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return `0,${height / 2} ${width},${height / 2}`;
  }
  const stepX = width / (values.length - 1);
  let out = '';
  for (let i = 0; i < values.length; i++) {
    const x = i * stepX;
    const y = height - values[i] * height;
    out += `${i === 0 ? '' : ' '}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return out;
}

/**
 * <friendly-spark>
 *
 * Inline SVG sparkline rendered deterministically from `seed`. Intended as a
 * light-weight visual KPI primitive embeddable inside `<friendly-stat-card>`
 * or directly in dashboards. Pure presentational component — no I/O, no
 * timers; safe for SSR.
 */
@Component({
  selector: 'friendly-spark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="friendly-spark"
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.viewBox]="viewBox()"
      role="img"
      [attr.aria-label]="ariaLabel()"
      preserveAspectRatio="none"
    >
      <polyline
        class="friendly-spark__line"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        [attr.points]="polyline()"
      />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
        color: var(--ft-accent-current, var(--ft-accent));
      }

      .friendly-spark {
        display: block;
      }
    `,
  ],
})
export class FriendlySpark {
  /** 32-bit deterministic seed; same seed always yields the same curve. */
  readonly seed = input<number>(0);

  /** Render width in pixels. */
  readonly width = input<number>(SPARK_DEFAULT_WIDTH);

  /** Render height in pixels. */
  readonly height = input<number>(SPARK_DEFAULT_HEIGHT);

  /** Number of plotted points; clamped to a sane minimum of 2. */
  readonly pointCount = input<number>(SPARK_DEFAULT_POINTS);

  /** Accessible label exposed to screen readers. */
  readonly ariaLabel = input<string>('Sparkline');

  protected readonly viewBox = computed(
    () => `0 0 ${this.width()} ${this.height()}`,
  );

  /**
   * Polyline point list (`x,y x,y ...`) computed from the deterministic
   * series. Re-derived only when seed/width/height/points change.
   */
  protected readonly polyline = computed<string>(() => {
    const count = Math.max(2, this.pointCount());
    const series = generateSeries(this.seed(), count);
    return buildPolyline(series, this.width(), this.height());
  });
}
