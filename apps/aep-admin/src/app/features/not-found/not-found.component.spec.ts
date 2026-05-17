/**
 * @file NotFoundComponent (403) unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, NoopAnimationsModule, RouterTestingModule],
    }).compileComponents();
  });

  it('renders the 403 forbidden message and a back-to-tenants link', () => {
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('h1')?.textContent).toContain('403');
    expect(host.querySelector('h1')?.textContent).toContain('Forbidden');
    expect(host.querySelector('p')?.textContent).toContain('sysadmin');
    const link = host.querySelector('a[mat-flat-button]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/tenants');
  });
});
