/**
 * @file Friendly Spark — unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FriendlySpark } from './spark';

function getSvg(fixture: ComponentFixture<FriendlySpark>): SVGSVGElement {
  const svg = fixture.nativeElement.querySelector('svg.friendly-spark');
  expect(svg).toBeTruthy();
  return svg as SVGSVGElement;
}

function getPolyline(
  fixture: ComponentFixture<FriendlySpark>,
): SVGPolylineElement {
  const line = fixture.nativeElement.querySelector(
    'polyline.friendly-spark__line',
  );
  expect(line).toBeTruthy();
  return line as SVGPolylineElement;
}

describe('FriendlySpark', () => {
  let fixture: ComponentFixture<FriendlySpark>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendlySpark],
    }).compileComponents();
    fixture = TestBed.createComponent(FriendlySpark);
    await fixture.whenStable();
  });

  it('renders default 220x40 SVG with sparkline polyline', async () => {
    await fixture.whenStable();
    const svg = getSvg(fixture);
    expect(svg.getAttribute('width')).toBe('220');
    expect(svg.getAttribute('height')).toBe('40');
    expect(svg.getAttribute('viewBox')).toBe('0 0 220 40');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Sparkline');

    const points = getPolyline(fixture).getAttribute('points') ?? '';
    expect(points.length).toBeGreaterThan(0);
    // Default point count is 32 → 32 "x,y" tokens.
    expect(points.split(' ').length).toBe(32);
  });

  it('produces an identical polyline for the same seed (deterministic)', async () => {
    fixture.componentRef.setInput('seed', 12345);
    await fixture.whenStable();
    const first = getPolyline(fixture).getAttribute('points');

    fixture.componentRef.setInput('seed', 999);
    await fixture.whenStable();
    const interim = getPolyline(fixture).getAttribute('points');

    fixture.componentRef.setInput('seed', 12345);
    await fixture.whenStable();
    const second = getPolyline(fixture).getAttribute('points');

    expect(second).toBe(first);
    expect(interim).not.toBe(first);
  });

  it('produces different polylines for different seeds', async () => {
    fixture.componentRef.setInput('seed', 1);
    await fixture.whenStable();
    const a = getPolyline(fixture).getAttribute('points');

    fixture.componentRef.setInput('seed', 2);
    await fixture.whenStable();
    const b = getPolyline(fixture).getAttribute('points');

    expect(a).not.toBe(b);
  });

  it('clamps point count to a minimum of 2', async () => {
    fixture.componentRef.setInput('pointCount', 0);
    await fixture.whenStable();
    const points = getPolyline(fixture).getAttribute('points') ?? '';
    expect(points.split(' ').length).toBe(2);
  });

  it('renders two points even when caller asks for one', async () => {
    fixture.componentRef.setInput('pointCount', 1);
    await fixture.whenStable();
    const points = getPolyline(fixture).getAttribute('points') ?? '';
    expect(points.split(' ').length).toBe(2);
  });

  it('honours custom width/height/aria-label', async () => {
    fixture.componentRef.setInput('width', 300);
    fixture.componentRef.setInput('height', 80);
    fixture.componentRef.setInput('ariaLabel', 'Latency last hour');
    await fixture.whenStable();

    const svg = getSvg(fixture);
    expect(svg.getAttribute('width')).toBe('300');
    expect(svg.getAttribute('height')).toBe('80');
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 80');
    expect(svg.getAttribute('aria-label')).toBe('Latency last hour');
  });

  it('keeps all plotted points within the rendered bounding box', async () => {
    fixture.componentRef.setInput('seed', 7);
    fixture.componentRef.setInput('width', 220);
    fixture.componentRef.setInput('height', 40);
    fixture.componentRef.setInput('pointCount', 32);
    await fixture.whenStable();

    const points = (getPolyline(fixture).getAttribute('points') ?? '')
      .split(' ')
      .map((p) => p.split(',').map(Number));

    expect(points.length).toBe(32);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(220);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(40);
    }
  });
});
