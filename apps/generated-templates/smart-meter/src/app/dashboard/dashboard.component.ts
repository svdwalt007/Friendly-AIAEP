/**
 * @file Smart Meter dashboard — energy monitoring view.
 *
 * KPI cards, inline-SVG sparklines, and an alerts table. All data is
 * deterministic — no Math.random at render time so SSR/replay stays stable.
 */
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface AlertRow {
  readonly id: string;
  readonly metric: string;
  readonly threshold: string;
  readonly value: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly timestamp: string;
}

interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly delta: number;
  readonly series: readonly number[];
}

const HOURLY_USAGE: readonly number[] = [
  0.42, 0.38, 0.35, 0.33, 0.32, 0.34, 0.41, 0.55, 0.78, 0.86, 0.79, 0.71,
  0.74, 0.82, 0.88, 0.91, 0.94, 1.12, 1.34, 1.28, 1.05, 0.86, 0.62, 0.51,
];

const ALERTS: readonly AlertRow[] = [
  {
    id: 'A-1042',
    metric: 'Peak Demand',
    threshold: '>= 4.5 kW',
    value: '4.82 kW',
    severity: 'critical',
    timestamp: '2026-05-11 18:42',
  },
  {
    id: 'A-1041',
    metric: 'Voltage Sag',
    threshold: '< 220 V',
    value: '214 V',
    severity: 'warning',
    timestamp: '2026-05-11 17:11',
  },
  {
    id: 'A-1040',
    metric: 'Daily Cost',
    threshold: '> $9.00',
    value: '$9.35',
    severity: 'warning',
    timestamp: '2026-05-11 12:05',
  },
  {
    id: 'A-1039',
    metric: 'Meter Sync',
    threshold: 'Last seen > 5m',
    value: '7m ago',
    severity: 'info',
    timestamp: '2026-05-11 09:23',
  },
];

@Component({
  selector: 'sm-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./dashboard.component.scss'],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  /** Connection state for the realtime indicator. */
  readonly connected = signal(true);

  readonly kpis: readonly Kpi[] = [
    {
      label: "Today's Usage",
      value: '18.4',
      unit: 'kWh',
      delta: 6,
      series: HOURLY_USAGE,
    },
    {
      label: 'Cost',
      value: '$5.21',
      unit: 'USD',
      delta: 3,
      series: HOURLY_USAGE.map((v) => v * 0.28),
    },
    {
      label: 'Peak Demand',
      value: '4.82',
      unit: 'kW',
      delta: 12,
      series: HOURLY_USAGE.map((v) => v * 4.5),
    },
    {
      label: 'Carbon',
      value: '7.36',
      unit: 'kg CO₂',
      delta: -4,
      series: HOURLY_USAGE.map((v) => v * 0.4),
    },
  ];

  readonly alerts = ALERTS;

  /** Hourly usage chart polyline points (0..480 x 0..120). */
  readonly chartPoints = computed(() => this.toPolyline(HOURLY_USAGE, 480, 120));

  /** Same series as a filled area path. */
  readonly chartArea = computed(() => this.toAreaPath(HOURLY_USAGE, 480, 120));

  /** SVG `points` attribute for an embedded card sparkline. */
  spark(series: readonly number[]): string {
    return this.toPolyline(series, 200, 40);
  }

  private toPolyline(values: readonly number[], width: number, height: number): string {
    if (values.length === 0) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * height;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  private toAreaPath(values: readonly number[], width: number, height: number): string {
    if (values.length === 0) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    let d = `M 0 ${height}`;
    values.forEach((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    });
    d += ` L ${width} ${height} Z`;
    return d;
  }
}
