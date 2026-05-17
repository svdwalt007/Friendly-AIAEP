/**
 * @file authGuard + loginGuard unit tests.
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authGuard, loginGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

const emptyRoute = {} as ActivatedRouteSnapshot;
const emptyState = { url: '/dashboard' } as RouterStateSnapshot;

function fakeAuth(isAuthed: boolean): Partial<AuthService> {
  return {
    isAuthenticated: vi.fn(() => isAuthed),
  } as unknown as Partial<AuthService>;
}

function runGuard(
  guard: typeof authGuard | typeof loginGuard,
): boolean | UrlTree {
  return runInInjectionContext(
    TestBed.inject(EnvironmentInjector),
    () => guard(emptyRoute, emptyState) as boolean | UrlTree,
  );
}

describe('authGuard', () => {
  it('returns true when the user is authenticated', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: fakeAuth(true) }],
    });
    expect(runGuard(authGuard)).toBe(true);
  });

  it('redirects unauthenticated users to /login', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: fakeAuth(false) }],
    });
    const result = runGuard(authGuard);
    expect(result).not.toBe(true);
    expect((result as UrlTree).toString()).toBe('/login');
  });
});

describe('loginGuard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns true for unauthenticated visitors (lets them see /login)', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: fakeAuth(false) }],
    });
    expect(runGuard(loginGuard)).toBe(true);
  });

  it('redirects authenticated users away to /dashboard', () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: fakeAuth(true) }],
    });
    const result = runGuard(loginGuard);
    expect(result).not.toBe(true);
    expect((result as UrlTree).toString()).toBe('/dashboard');
  });
});
