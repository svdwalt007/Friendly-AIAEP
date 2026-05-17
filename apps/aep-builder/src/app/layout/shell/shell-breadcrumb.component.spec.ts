/**
 * @file ShellBreadcrumbComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { ShellStateService } from '@friendly-tech/ui/iot-ui';
import { beforeEach, describe, expect, it } from 'vitest';

import { ShellBreadcrumbComponent } from './shell-breadcrumb.component';

interface BreadcrumbNode {
  label: string;
  route?: string | unknown[];
  icon?: string;
}

function build(trail: readonly BreadcrumbNode[]): ComponentFixture<ShellBreadcrumbComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [
      ShellBreadcrumbComponent,
      NoopAnimationsModule,
      RouterTestingModule,
    ],
    providers: [
      {
        provide: ShellStateService,
        useValue: { breadcrumbs: signal(trail).asReadonly() },
      },
    ],
  });
  const fixture = TestBed.createComponent(ShellBreadcrumbComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ShellBreadcrumbComponent', () => {
  beforeEach(() => undefined);

  it('renders nothing when the breadcrumb trail is empty', () => {
    const fixture = build([]);
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.shell-breadcrumb')).toBeNull();
  });

  it('renders a single non-link item when there is only one node (current)', () => {
    const fixture = build([{ label: 'Dashboard' }]);
    const host: HTMLElement = fixture.nativeElement;
    const items = host.querySelectorAll('.shell-breadcrumb__item');
    expect(items.length).toBe(1);
    expect(items[0].classList).toContain('shell-breadcrumb__item--current');
    expect(host.querySelector('.shell-breadcrumb__link')).toBeNull();
    expect(host.querySelector('.shell-breadcrumb__sep')).toBeNull();
  });

  it('marks the last node as current and emits N-1 separators', () => {
    const fixture = build([
      { label: 'Projects', route: '/projects' },
      { label: 'Acme', route: '/projects/acme' },
      { label: 'Builder' },
    ]);
    const host: HTMLElement = fixture.nativeElement;
    const items = host.querySelectorAll('.shell-breadcrumb__item');
    expect(items.length).toBe(3);
    expect(items[0].classList).not.toContain('shell-breadcrumb__item--current');
    expect(items[1].classList).not.toContain('shell-breadcrumb__item--current');
    expect(items[2].classList).toContain('shell-breadcrumb__item--current');
    expect(host.querySelectorAll('.shell-breadcrumb__sep').length).toBe(2);
  });

  it('emits a routerLink for non-current nodes that have a route', () => {
    const fixture = build([
      { label: 'Projects', route: '/projects' },
      { label: 'Acme' },
    ]);
    const host: HTMLElement = fixture.nativeElement;
    const link = host.querySelector('.shell-breadcrumb__link') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/projects');
  });

  it('renders an icon when a node specifies one', () => {
    const fixture = build([
      { label: 'Projects', route: '/projects', icon: 'folder' },
      { label: 'Builder', icon: 'build' },
    ]);
    const host: HTMLElement = fixture.nativeElement;
    const icons = host.querySelectorAll('.shell-breadcrumb__icon');
    expect(icons.length).toBe(2);
    expect(icons[0].textContent).toContain('folder');
    expect(icons[1].textContent).toContain('build');
  });

  it('renders the label text for every node', () => {
    const fixture = build([
      { label: 'A', route: '/a' },
      { label: 'B' },
    ]);
    const host: HTMLElement = fixture.nativeElement;
    const labels = Array.from(
      host.querySelectorAll('.shell-breadcrumb__label'),
    ).map((el) => (el.textContent ?? '').trim());
    expect(labels).toEqual(['A', 'B']);
  });

  it('exposes the documented aria-label on the nav', () => {
    const fixture = build([{ label: 'Dashboard' }]);
    const host: HTMLElement = fixture.nativeElement;
    const nav = host.querySelector('.shell-breadcrumb');
    expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');
  });

  it('renders a plain text node (no link) when the non-last node has no route', () => {
    const fixture = build([{ label: 'No-route' }, { label: 'Last' }]);
    const host: HTMLElement = fixture.nativeElement;
    const items = host.querySelectorAll('.shell-breadcrumb__item');
    expect(items.length).toBe(2);
    // First item should be plain text (no <a>), even though not last.
    expect(items[0].querySelector('.shell-breadcrumb__link')).toBeNull();
    expect(items[0].querySelector('.shell-breadcrumb__text')).toBeTruthy();
  });
});
