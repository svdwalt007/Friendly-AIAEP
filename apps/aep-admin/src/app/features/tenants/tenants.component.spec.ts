/**
 * @file TenantsComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TenantsComponent,
  Tenant,
  TenantPlan,
} from './tenants.component';

interface FakeDialog {
  open: ReturnType<typeof vi.fn>;
}

function makeAfterClosed<T>(value: T | null) {
  const subject = new Subject<T | null>();
  // Immediately complete with the value so subscribers fire synchronously.
  queueMicrotask(() => {
    subject.next(value);
    subject.complete();
  });
  return subject.asObservable();
}

describe('TenantsComponent', () => {
  let component: TenantsComponent;
  let dialog: FakeDialog;

  beforeEach(async () => {
    dialog = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TenantsComponent, NoopAnimationsModule],
    }).compileComponents();

    // Module-imported MatDialogModule registers the real MatDialog at the
    // standalone-component injector. Override it AFTER configuration so the
    // component-level provider is replaced with our fake.
    TestBed.overrideProvider(MatDialog, { useValue: dialog });

    const fixture = TestBed.createComponent(TenantsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('seeds the table with the nine baseline tenants', () => {
    expect(component.tenants().length).toBe(9);
    const friendly = component
      .tenants()
      .find((t) => t.name === 'Friendly Technologies');
    expect(friendly?.plan).toBe('Enterprise');
  });

  it('opens the create dialog with a 420px width when openCreate is called', () => {
    dialog.open.mockReturnValue({
      afterClosed: () => makeAfterClosed<Partial<Tenant>>(null),
    });

    component.openCreate();

    expect(dialog.open).toHaveBeenCalledOnce();
    const [, config] = dialog.open.mock.calls[0];
    expect(config.width).toBe('420px');
  });

  it('appends a new tenant when the dialog returns a valid result', async () => {
    const result: Partial<Tenant> = {
      name: 'Acme New Corp',
      plan: 'Pro' as TenantPlan,
      adminEmail: 'ops@acme.example',
    };
    dialog.open.mockReturnValue({
      afterClosed: () => makeAfterClosed(result),
    });

    const before = component.tenants().length;
    component.openCreate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(component.tenants().length).toBe(before + 1);
    const last = component.tenants()[component.tenants().length - 1];
    expect(last.name).toBe('Acme New Corp');
    expect(last.plan).toBe('Pro');
    expect(last.status).toBe('trial');
    expect(last.id).toMatch(/^tnt-\d{3}$/);
    expect(last.mrr).toBe(5000);
  });

  it.each([
    ['Enterprise', 15000],
    ['Pro', 5000],
    ['Starter', 990],
  ] as const)('assigns a baseline MRR for plan %s = %i', async (plan, mrr) => {
    dialog.open.mockReturnValue({
      afterClosed: () =>
        makeAfterClosed({
          name: `Tenant ${plan}`,
          plan: plan as TenantPlan,
          adminEmail: 'a@b',
        }),
    });

    component.openCreate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const last = component.tenants()[component.tenants().length - 1];
    expect(last.mrr).toBe(mrr);
  });

  it('does NOT append a tenant when the dialog returns null', async () => {
    dialog.open.mockReturnValue({
      afterClosed: () => makeAfterClosed<Partial<Tenant>>(null),
    });

    const before = component.tenants().length;
    component.openCreate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(component.tenants().length).toBe(before);
  });

  it('does NOT append a tenant when the dialog returns an empty-named result', async () => {
    dialog.open.mockReturnValue({
      afterClosed: () => makeAfterClosed<Partial<Tenant>>({ name: '' }),
    });

    const before = component.tenants().length;
    component.openCreate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(component.tenants().length).toBe(before);
  });
});
