/**
 * @file AirgapComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';

import { AirgapComponent } from './airgap.component';

describe('AirgapComponent', () => {
  let component: AirgapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AirgapComponent, NoopAnimationsModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(AirgapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('seeds the table with four air-gap bundles in a representative status mix', () => {
    expect(component.bundles().length).toBe(4);
    const statuses = component.bundles().map((b) => b.status).sort();
    expect(statuses).toEqual(['failed', 'mirroring', 'sealed', 'stale']);
  });

  it('totalSizeMb sums every bundle\'s on-disk footprint', () => {
    const expected = component
      .bundles()
      .reduce((acc, b) => acc + b.sizeMb, 0);
    expect(component.totalSizeMb()).toBe(expected);
  });

  it('sealedCount and staleCount track their respective statuses', () => {
    expect(component.sealedCount()).toBe(1);
    expect(component.staleCount()).toBe(1);
  });

  it('starts with enforcement ON and the licence vault armed', () => {
    expect(component.enforced()).toBe(true);
    expect(component.vaultArmed()).toBe(true);
    expect(component.enforcementInput).toBe(true);
  });

  it('onEnforcementToggle(false) disarms both enforcement and the vault', () => {
    component.onEnforcementToggle(false);
    expect(component.enforced()).toBe(false);
    expect(component.vaultArmed()).toBe(false);
  });

  it('onEnforcementToggle(true) re-arms both flags after a disarm', () => {
    component.onEnforcementToggle(false);
    component.onEnforcementToggle(true);
    expect(component.enforced()).toBe(true);
    expect(component.vaultArmed()).toBe(true);
  });

  it('resync() flips the target bundle into a mirroring state', () => {
    const sealed = component.bundles().find((b) => b.status === 'sealed')!;
    component.resync(sealed.id);
    const after = component.bundles().find((b) => b.id === sealed.id);
    expect(after?.status).toBe('mirroring');
  });

  it('resync() is a no-op for an unknown id (no exceptions, identical list)', () => {
    const before = JSON.stringify(component.bundles());
    component.resync('bnd-does-not-exist');
    expect(JSON.stringify(component.bundles())).toBe(before);
  });

  it.each([
    ['sealed', 'Sealed'],
    ['mirroring', 'Mirroring'],
    ['stale', 'Stale'],
    ['failed', 'Failed'],
  ] as const)('statusLabel(%s) → %s', (status, label) => {
    expect(component.statusLabel(status)).toBe(label);
  });

  it('exposes the configured stale threshold for the template summary tile', () => {
    expect(component.staleDays).toBe(14);
  });
});
