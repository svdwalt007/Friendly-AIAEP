/**
 * @file Predictive Maintenance dashboard — industrial equipment health.
 *
 * KPI cards, three RUL gauges (SVG arcs), work-order table, and a
 * 12-week anomaly line chart with one highlighted spike. All data is
 * deterministic constants — no Math.random.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Gauge {
  readonly id: string;
  readonly label: string;
  readonly percent: number;
  readonly state: 'healthy' | 'warning' | 'danger';
}

type WorkOrderType = 'Preventive' | 'Corrective' | 'Emergency';
type WorkOrderStatus = 'Open' | 'In Progress' | 'Scheduled' | 'Completed';

interface WorkOrder {
  readonly id: string;
  readonly equipment: string;
  readonly type: WorkOrderType;
  readonly status: WorkOrderStatus;
  readonly due: string;
  readonly tech: string;
}

const GAUGES: readonly Gauge[] = [
  { id: 'motor-a', label: 'Motor A', percent: 78, state: 'healthy' },
  { id: 'pump-b', label: 'Pump B', percent: 34, state: 'danger' },
  { id: 'compressor-c', label: 'Compressor C', percent: 91, state: 'healthy' },
];

const WORK_ORDERS: readonly WorkOrder[] = [
  { id: 'WO-2041', equipment: 'Pump B', type: 'Emergency', status: 'In Progress', due: '2026-05-12', tech: 'A. Patel' },
  { id: 'WO-2040', equipment: 'Motor A', type: 'Preventive', status: 'Scheduled', due: '2026-05-18', tech: 'J. Nguyen' },
  { id: 'WO-2039', equipment: 'Compressor C', type: 'Preventive', status: 'Open', due: '2026-05-22', tech: 'M. Dubois' },
  { id: 'WO-2038', equipment: 'Conveyor 4', type: 'Corrective', status: 'Open', due: '2026-05-15', tech: 'S. Okafor' },
  { id: 'WO-2037', equipment: 'Boiler 2', type: 'Preventive', status: 'Completed', due: '2026-05-09', tech: 'L. Rossi' },
];

/** 12 weekly anomaly index values; week 7 is the spike. */
const ANOMALY_SERIES: readonly number[] = [
  0.12, 0.14, 0.13, 0.18, 0.16, 0.21, 0.86, 0.32, 0.24, 0.19, 0.17, 0.15,
];

const CHART_W = 520;
const CHART_H = 160;

@Component({
  selector: 'pm-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  readonly gauges = GAUGES;
  readonly workOrders = WORK_ORDERS;

  readonly anomalyPoints = this.toPolyline(ANOMALY_SERIES, CHART_W, CHART_H);
  readonly chartWidth = CHART_W;
  readonly chartHeight = CHART_H;

  /** Position of the spike marker in chart coordinates. */
  readonly spike = this.markerAt(ANOMALY_SERIES, 6, CHART_W, CHART_H);

  /**
   * Build the SVG `d` attribute for a 270° gauge arc filled to `percent`.
   * Rendered inside a 100×100 viewBox with the arc centred on (50, 55).
   */
  arcPath(percent: number): string {
    const radius = 38;
    const cx = 50;
    const cy = 55;
    const startAngle = 135;
    const sweep = 270 * (percent / 100);
    const endAngle = startAngle + sweep;
    const start = this.polar(cx, cy, radius, startAngle);
    const end = this.polar(cx, cy, radius, endAngle);
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  /** Background full-track 270° arc shared by all gauges. */
  arcTrack(): string {
    const radius = 38;
    const cx = 50;
    const cy = 55;
    const start = this.polar(cx, cy, radius, 135);
    const end = this.polar(cx, cy, radius, 405);
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 1 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  private polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  private toPolyline(values: readonly number[], width: number, height: number): string {
    if (values.length === 0) return '';
    const min = 0;
    const max = 1;
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

  private markerAt(values: readonly number[], index: number, width: number, height: number): { x: number; y: number; value: number } {
    const stepX = width / (values.length - 1);
    const v = values[index];
    return {
      x: index * stepX,
      y: height - v * height,
      value: v,
    };
  }
}
