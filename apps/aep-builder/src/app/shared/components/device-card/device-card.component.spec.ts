import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeviceCardComponent,
  DeviceCardData,
} from './device-card.component';

const FIXED_NOW = new Date('2026-05-14T12:00:00Z').getTime();

function makeDevice(overrides: Partial<DeviceCardData> = {}): DeviceCardData {
  return {
    id: 'dev-001',
    name: 'Gateway A',
    status: 'online',
    battery: 85,
    signal: 70,
    lastSeen: new Date(FIXED_NOW - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

function getCard(
  fixture: ComponentFixture<DeviceCardComponent>,
): HTMLElement {
  const el = fixture.nativeElement.querySelector('.device-card');
  expect(el).toBeTruthy();
  return el as HTMLElement;
}

describe('DeviceCardComponent', () => {
  let fixture: ComponentFixture<DeviceCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DeviceCardComponent);
    fixture.componentRef.setInput('device', makeDevice());
    await fixture.whenStable();
    // Pin the clock AFTER Angular has bootstrapped so its zone tasks are
    // unaffected; only the formatRelative arithmetic below needs a fixed now.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders device identity, battery and signal', () => {
    const card = getCard(fixture);
    expect(card.querySelector('.device-card__name')?.textContent).toContain(
      'Gateway A',
    );
    expect(card.querySelector('.device-card__id')?.textContent).toContain(
      'dev-001',
    );
    const values = card.querySelectorAll('.device-card__metric-value');
    expect(values[0]?.textContent).toContain('85%');
    expect(values[1]?.textContent).toContain('70%');
  });

  it('applies battery-low modifier when battery < 20', async () => {
    fixture.componentRef.setInput('device', makeDevice({ battery: 12 }));
    await fixture.whenStable();
    const bar = getCard(fixture).querySelector('.device-card__bar');
    expect(bar?.classList.contains('device-card__bar--low')).toBe(true);
  });

  it('does NOT apply battery-low modifier at 20', async () => {
    fixture.componentRef.setInput('device', makeDevice({ battery: 20 }));
    await fixture.whenStable();
    const bar = getCard(fixture).querySelector('.device-card__bar');
    expect(bar?.classList.contains('device-card__bar--low')).toBe(false);
  });

  it('emits select with the device on click', () => {
    const spy = vi.fn();
    fixture.componentInstance.select.subscribe(spy);
    getCard(fixture).dispatchEvent(new Event('click'));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'dev-001' }));
  });

  it('emits select on Enter key', () => {
    const spy = vi.fn();
    fixture.componentInstance.select.subscribe(spy);
    getCard(fixture).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );
    expect(spy).toHaveBeenCalledOnce();
  });

  it('forwards status to <app-status-badge>', async () => {
    fixture.componentRef.setInput('device', makeDevice({ status: 'error' }));
    await fixture.whenStable();
    const badge = getCard(fixture).querySelector('.badge');
    expect(badge?.classList.contains('badge--error')).toBe(true);
  });

  describe('formatRelative', () => {
    it('returns "just now" for < 1 minute', () => {
      expect(
        fixture.componentInstance.formatRelative(
          new Date(FIXED_NOW - 30_000).toISOString(),
        ),
      ).toBe('just now');
    });
    it('returns minutes for 1–59 mins', () => {
      expect(
        fixture.componentInstance.formatRelative(
          new Date(FIXED_NOW - 15 * 60_000).toISOString(),
        ),
      ).toBe('15m ago');
    });
    it('returns hours for 1–23 hours', () => {
      expect(
        fixture.componentInstance.formatRelative(
          new Date(FIXED_NOW - 3 * 3_600_000).toISOString(),
        ),
      ).toBe('3h ago');
    });
    it('returns days for >= 24 hours', () => {
      expect(
        fixture.componentInstance.formatRelative(
          new Date(FIXED_NOW - 2 * 86_400_000).toISOString(),
        ),
      ).toBe('2d ago');
    });
  });
});
