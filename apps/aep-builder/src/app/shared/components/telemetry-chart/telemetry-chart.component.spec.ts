import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TelemetryChartComponent,
  TelemetryPoint,
} from './telemetry-chart.component';

function makeSeries(n: number, startMs = 0, step = 60_000): TelemetryPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(startMs + i * step).toISOString(),
    value: i * 10,
  }));
}

describe('TelemetryChartComponent', () => {
  let fixture: ComponentFixture<TelemetryChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TelemetryChartComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TelemetryChartComponent);
    fixture.componentRef.setInput('data', makeSeries(5));
    await fixture.whenStable();
  });

  it('renders an empty state when there are fewer than 2 points', async () => {
    fixture.componentRef.setInput('data', makeSeries(1));
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('.tc__empty')?.textContent,
    ).toContain('Insufficient data');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('renders SVG once there are >= 2 points', () => {
    expect(fixture.nativeElement.querySelector('svg.tc__svg')).toBeTruthy();
    expect(fixture.componentInstance.points().length).toBe(5);
  });

  it('linePath starts with M and contains LineTo commands', () => {
    const d = fixture.componentInstance.linePath();
    expect(d.startsWith('M')).toBe(true);
    expect(d.split(' ').filter((s) => s.startsWith('L')).length).toBe(4);
  });

  it('areaPath closes the polygon with Z', () => {
    expect(fixture.componentInstance.areaPath().endsWith('Z')).toBe(true);
  });

  it('points x-coords span left-pad to right-edge', () => {
    const pts = fixture.componentInstance.points();
    const c = fixture.componentInstance;
    expect(pts[0].x).toBeCloseTo(c.padLeft);
    expect(pts[pts.length - 1].x).toBeCloseTo(c.svgW - c.padRight);
  });

  it('clearTooltip clears hoveredPoint', () => {
    fixture.componentInstance.hoveredPoint.set(
      fixture.componentInstance.points()[0],
    );
    fixture.componentInstance.clearTooltip();
    expect(fixture.componentInstance.hoveredPoint()).toBeNull();
  });

  it('ngOnChanges resets hover', () => {
    fixture.componentInstance.hoveredPoint.set(
      fixture.componentInstance.points()[0],
    );
    fixture.componentInstance.ngOnChanges();
    expect(fixture.componentInstance.hoveredPoint()).toBeNull();
  });

  it('formatValue includes unit when set', () => {
    expect(fixture.componentInstance.formatValue(42)).toBe('42.0');
    fixture.componentRef.setInput('unit', '°C');
    expect(fixture.componentInstance.formatValue(42)).toBe('42.0 °C');
  });

  it('formatTime renders HH:MM in en-AU locale', () => {
    const iso = '2026-01-01T08:05:00Z';
    expect(fixture.componentInstance.formatTime(iso)).toMatch(/\d{2}:\d{2}/);
  });

  it('viewBox is "0 0 <svgW> <svgH>"', () => {
    const c = fixture.componentInstance;
    expect(c.viewBox()).toBe(`0 0 ${c.svgW} ${c.svgH}`);
  });

  it('points are empty when input has fewer than 2 records', async () => {
    fixture.componentRef.setInput('data', makeSeries(1));
    await fixture.whenStable();
    expect(fixture.componentInstance.points().length).toBe(0);
    expect(fixture.componentInstance.linePath()).toBe('');
    expect(fixture.componentInstance.areaPath()).toBe('');
  });

  it('points y-coords stay within padded vertical range', () => {
    const c = fixture.componentInstance;
    const pts = c.points();
    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(c.padTop);
      expect(p.y).toBeLessThanOrEqual(c.svgH - c.padBottom);
    }
  });

  it('onMouseMove with no SVG ref does nothing', () => {
    const c = fixture.componentInstance;
    // Force missing svgEl
    (c as unknown as { svgEl: undefined }).svgEl = undefined;
    expect(() =>
      c.onMouseMove(new MouseEvent('mousemove', { clientX: 0 })),
    ).not.toThrow();
    expect(c.hoveredPoint()).toBeNull();
  });

  it('generates a unique gradient id per instance', () => {
    const other = TestBed.createComponent(TelemetryChartComponent);
    expect(fixture.componentInstance.gradientId).not.toBe(
      other.componentInstance.gradientId,
    );
  });
});
