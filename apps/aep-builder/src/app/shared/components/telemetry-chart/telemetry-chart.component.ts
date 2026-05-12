/**
 * @file TelemetryChartComponent — pure-SVG sparkline / line chart with hover tooltip.
 * No charting library dependency. Standalone, signals-based (Angular 17+).
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  Component,
  computed,
  input,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TelemetryPoint {
  timestamp: string; // ISO 8601
  value: number;
}

interface PlottedPoint {
  x: number;
  y: number;
  raw: TelemetryPoint;
}

@Component({
  selector: 'app-telemetry-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <figure class="tc" [style.width]="width()" [style.height]="height()" (mouseleave)="clearTooltip()">
      @if (points().length < 2) {
        <div class="tc__empty">Insufficient data</div>
      } @else {
        <svg
          #svgEl
          class="tc__svg"
          [attr.viewBox]="viewBox()"
          preserveAspectRatio="none"
          aria-label="Telemetry chart"
          role="img"
          (mousemove)="onMouseMove($event)"
        >
          <!-- Gradient fill -->
          <defs>
            <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--ft-primary, #1e88e5)" stop-opacity="0.25" />
              <stop offset="100%" stop-color="var(--ft-primary, #1e88e5)" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- Area fill -->
          <path
            class="tc__area"
            [attr.d]="areaPath()"
            [attr.fill]="'url(#' + gradientId + ')'"
          />

          <!-- Line -->
          <path
            class="tc__line"
            [attr.d]="linePath()"
            fill="none"
            stroke="var(--ft-primary, #1e88e5)"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <!-- Hover crosshair -->
          @if (hoveredPoint()) {
            <line
              class="tc__crosshair"
              [attr.x1]="hoveredPoint()!.x"
              [attr.y1]="padTop"
              [attr.x2]="hoveredPoint()!.x"
              [attr.y2]="svgH - padBottom"
              stroke="var(--ft-text-secondary)"
              stroke-width="1"
              stroke-dasharray="3 3"
            />
            <circle
              class="tc__dot"
              [attr.cx]="hoveredPoint()!.x"
              [attr.cy]="hoveredPoint()!.y"
              r="3.5"
              fill="var(--ft-primary, #1e88e5)"
              stroke="var(--ft-surface-primary, #fff)"
              stroke-width="1.5"
            />
          }
        </svg>

        <!-- Tooltip -->
        @if (hoveredPoint()) {
          <div
            class="tc__tooltip"
            [style.left.px]="tooltipX()"
            [style.top.px]="tooltipY()"
          >
            <span class="tc__tooltip-time">{{ formatTime(hoveredPoint()!.raw.timestamp) }}</span>
            <span class="tc__tooltip-value">{{ formatValue(hoveredPoint()!.raw.value) }}</span>
          </div>
        }
      }
    </figure>
  `,
  styles: [`
    .tc {
      position: relative;
      display: block;
      overflow: visible;
    }

    .tc__svg {
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }

    .tc__area {
      transition: opacity 0.15s;
    }

    .tc__line {
      vector-effect: non-scaling-stroke;
    }

    .tc__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
    }

    .tc__tooltip {
      position: absolute;
      background: var(--ft-surface-primary);
      border: 1px solid var(--ft-border-color);
      border-radius: var(--ft-radius-md, 6px);
      padding: 6px 10px;
      box-shadow: var(--ft-shadow-md, 0 4px 6px rgba(0,0,0,.1));
      pointer-events: none;
      transform: translate(-50%, -110%);
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      gap: 2px;
      z-index: 10;
    }

    .tc__tooltip-time {
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
    }

    .tc__tooltip-value {
      font-size: var(--ft-font-size-sm, 0.875rem);
      font-weight: var(--ft-font-weight-semibold, 600);
      color: var(--ft-text-primary);
    }
  `],
})
export class TelemetryChartComponent implements AfterViewInit, OnChanges {
  data    = input<TelemetryPoint[]>([]);
  width   = input<string>('100%');
  height  = input<string>('80px');
  unit    = input<string>('');

  @ViewChild('svgEl') svgEl!: ElementRef<SVGSVGElement>;

  readonly gradientId = `tc-grad-${Math.random().toString(36).slice(2, 8)}`;

  readonly padTop    = 8;
  readonly padBottom = 8;
  readonly padLeft   = 4;
  readonly padRight  = 4;
  readonly svgW      = 300;
  readonly svgH      = 80;

  readonly viewBox = computed(() =>
    `0 0 ${this.svgW} ${this.svgH}`,
  );

  readonly points = computed((): PlottedPoint[] => {
    const raw = this.data();
    if (raw.length < 2) return [];

    const times = raw.map((d) => new Date(d.timestamp).getTime());
    const values = raw.map((d) => d.value);
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const tRange = tMax - tMin || 1;
    const vRange = vMax - vMin || 1;

    const xRange = this.svgW - this.padLeft - this.padRight;
    const yRange = this.svgH - this.padTop - this.padBottom;

    return raw.map((d) => {
      const t = new Date(d.timestamp).getTime();
      const x = this.padLeft + ((t - tMin) / tRange) * xRange;
      const y = this.padTop + (1 - (d.value - vMin) / vRange) * yRange;
      return { x, y, raw: d };
    });
  });

  readonly linePath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
  });

  readonly areaPath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    const base = this.svgH - this.padBottom;
    const first = pts[0];
    const last  = pts[pts.length - 1];
    return (
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') +
      ` L${last.x.toFixed(2)},${base} L${first.x.toFixed(2)},${base} Z`
    );
  });

  readonly hoveredPoint = signal<PlottedPoint | null>(null);

  readonly tooltipX = computed(() => {
    const p = this.hoveredPoint();
    if (!p || !this.svgEl) return 0;
    const rect = this.svgEl.nativeElement.getBoundingClientRect();
    return (p.x / this.svgW) * rect.width;
  });

  readonly tooltipY = computed(() => {
    const p = this.hoveredPoint();
    if (!p || !this.svgEl) return 0;
    const rect = this.svgEl.nativeElement.getBoundingClientRect();
    return (p.y / this.svgH) * rect.height;
  });

  ngAfterViewInit(): void { /* SVG reference available */ }
  ngOnChanges(): void { this.hoveredPoint.set(null); }

  onMouseMove(event: MouseEvent): void {
    const svg = this.svgEl?.nativeElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * this.svgW;
    const pts = this.points();
    if (pts.length === 0) return;

    let nearest = pts[0];
    let minDist = Math.abs(pts[0].x - mouseX);
    for (const p of pts) {
      const d = Math.abs(p.x - mouseX);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    this.hoveredPoint.set(nearest);
  }

  clearTooltip(): void {
    this.hoveredPoint.set(null);
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }

  formatValue(v: number): string {
    const u = this.unit();
    return u ? `${v.toFixed(1)} ${u}` : v.toFixed(1);
  }
}
