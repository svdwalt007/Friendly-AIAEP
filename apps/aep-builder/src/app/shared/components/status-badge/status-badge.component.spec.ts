import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StatusBadgeComponent } from './status-badge.component';

function getBadge(fixture: ComponentFixture<StatusBadgeComponent>): HTMLElement {
  const el = fixture.nativeElement.querySelector('.badge');
  expect(el).toBeTruthy();
  return el as HTMLElement;
}

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StatusBadgeComponent);
    await fixture.whenStable();
  });

  it('renders default "unknown" status with titlecased fallback label', async () => {
    await fixture.whenStable();
    const badge = getBadge(fixture);
    expect(badge.classList.contains('badge--unknown')).toBe(true);
    expect(badge.querySelector('.label')?.textContent).toContain('Unknown');
    expect(badge.querySelector('.dot')).toBeTruthy();
  });

  it.each([
    ['online', 'badge--online'],
    ['offline', 'badge--offline'],
    ['warning', 'badge--warning'],
    ['error', 'badge--error'],
  ] as const)('applies status modifier class for %s', async (status, expectedClass) => {
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    expect(getBadge(fixture).classList.contains(expectedClass)).toBe(true);
  });

  it('uses provided label verbatim instead of titlecased status', async () => {
    fixture.componentRef.setInput('status', 'online');
    fixture.componentRef.setInput('label', 'All systems go');
    await fixture.whenStable();
    expect(getBadge(fixture).querySelector('.label')?.textContent).toContain(
      'All systems go',
    );
  });

  it('falls back to titlecased status when label is empty string', async () => {
    fixture.componentRef.setInput('status', 'warning');
    fixture.componentRef.setInput('label', '');
    await fixture.whenStable();
    expect(getBadge(fixture).querySelector('.label')?.textContent).toContain(
      'Warning',
    );
  });
});
