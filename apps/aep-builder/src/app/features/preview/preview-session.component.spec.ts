/**
 * @file PreviewSessionComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PreviewSessionComponent } from './preview-session.component';

const SESSION_SECONDS = 30 * 60;

async function createFixture(
  id = 'proj-7',
): Promise<ComponentFixture<PreviewSessionComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PreviewSessionComponent, NoopAnimationsModule],
  }).compileComponents();
  const fixture = TestBed.createComponent(PreviewSessionComponent);
  fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  return fixture;
}

describe('PreviewSessionComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with a fresh 30:00 session and no active mode', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;
    expect(cmp.secondsRemaining()).toBe(SESSION_SECONDS);
    expect(cmp.formatted()).toBe('30:00');
    expect(cmp.expired()).toBe(false);
    expect(cmp.mode()).toBeNull();
    expect(cmp.tabIndex()).toBe(-1);
  });

  it('ticks the countdown down by one second each interval', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    vi.advanceTimersByTime(1000);
    expect(cmp.secondsRemaining()).toBe(SESSION_SECONDS - 1);
    expect(cmp.formatted()).toBe('29:59');

    vi.advanceTimersByTime(4000);
    expect(cmp.secondsRemaining()).toBe(SESSION_SECONDS - 5);
    expect(cmp.formatted()).toBe('29:55');
  });

  it('formats arbitrary remaining seconds as mm:ss with padding', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.secondsRemaining.set(65);
    expect(cmp.formatted()).toBe('01:05');

    cmp.secondsRemaining.set(9);
    expect(cmp.formatted()).toBe('00:09');

    cmp.secondsRemaining.set(0);
    expect(cmp.formatted()).toBe('00:00');
  });

  it('marks the session expired and stops decrementing once at zero', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.secondsRemaining.set(0);
    expect(cmp.expired()).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(cmp.secondsRemaining()).toBe(0);
  });

  it('resets the timer to a fresh session on extend()', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.secondsRemaining.set(120);
    cmp.extend();
    expect(cmp.secondsRemaining()).toBe(SESSION_SECONDS);
    expect(cmp.expired()).toBe(false);
  });

  it('restart() clears the active mode and tab index alongside resetting the timer', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.onTabChange(1);
    cmp.secondsRemaining.set(0);
    expect(cmp.mode()).toBe('live');

    cmp.restart();
    expect(cmp.secondsRemaining()).toBe(SESSION_SECONDS);
    expect(cmp.mode()).toBeNull();
    expect(cmp.tabIndex()).toBe(-1);
  });

  it.each([
    [0, 'mock'],
    [1, 'live'],
    [2, 'sim'],
  ] as const)(
    'maps tab index %i to the %s preview mode',
    async (index, expected) => {
      const fixture = await createFixture();
      const cmp = fixture.componentInstance;
      cmp.onTabChange(index);
      expect(cmp.tabIndex()).toBe(index);
      expect(cmp.mode()).toBe(expected);
    },
  );

  it('falls back to null for out-of-range tab indices', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;
    cmp.onTabChange(99);
    expect(cmp.mode()).toBeNull();
  });

  it('renders the loading overlay until a mode is chosen', async () => {
    const fixture = await createFixture();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.overlay')).toBeTruthy();
    expect(host.querySelector('.overlay')?.textContent).toContain(
      'Preview loading',
    );

    fixture.componentInstance.onTabChange(0);
    fixture.detectChanges();
    expect(host.querySelector('.overlay-expired')).toBeNull();
  });

  it('renders the expired overlay once the session ends', async () => {
    const fixture = await createFixture();
    fixture.componentInstance.secondsRemaining.set(0);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.overlay-expired')).toBeTruthy();
    expect(host.querySelector('.overlay-expired')?.textContent).toContain(
      'Session expired',
    );
  });

  it('exposes the project id input on the rendered header', async () => {
    const fixture = await createFixture('proj-zzz');
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.preview-sub code')?.textContent).toContain(
      'proj-zzz',
    );
  });
});
