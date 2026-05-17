/**
 * @file sysadminGuard unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sysadminGuard } from './sysadmin.guard';

const USER_KEY = 'aep_user';

const emptyRoute = {} as ActivatedRouteSnapshot;
const emptyState = { url: '/tenants' } as RouterStateSnapshot;

function runGuard(): boolean | UrlTree {
  return runInInjectionContext(
    TestBed.inject(EnvironmentInjector),
    () => sysadminGuard(emptyRoute, emptyState) as boolean | UrlTree,
  );
}

describe('sysadminGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('permits navigation when no user is stored (dev-friendly default)', () => {
    expect(runGuard()).toBe(true);
  });

  it('permits navigation when the stored user role is sysadmin', () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: 'u1',
        username: 'root',
        tenantId: 'tnt-001',
        role: 'sysadmin',
      }),
    );
    expect(runGuard()).toBe(true);
  });

  it('redirects non-sysadmin users to /403', () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: 'u2',
        username: 'jane',
        tenantId: 'tnt-002',
        role: 'tenant_admin',
      }),
    );
    const result = runGuard();
    expect(result).not.toBe(true);
    expect(result).not.toBe(false);
    const tree = result as UrlTree;
    expect(tree.toString()).toBe('/403');
  });

  it('treats malformed JSON in storage as "no user" and permits navigation', () => {
    localStorage.setItem(USER_KEY, '{not json');
    expect(runGuard()).toBe(true);
  });
});
