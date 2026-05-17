/**
 * @file LoginComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

type LoginFn = (username: string, password: string) => Observable<unknown>;

function build(
  loginFn: LoginFn,
  navigate: ReturnType<typeof vi.fn>,
): LoginComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [LoginComponent, NoopAnimationsModule, RouterTestingModule],
    providers: [
      { provide: AuthService, useValue: { login: loginFn } },
      { provide: Router, useValue: { navigate } },
    ],
  });
  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('LoginComponent', () => {
  let loginFn: ReturnType<typeof vi.fn<LoginFn>>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loginFn = vi.fn<LoginFn>();
    navigate = vi.fn();
  });

  it('sets an inline error and does not call login when fields are empty', () => {
    const comp = build(loginFn, navigate);
    comp.onSubmit();
    expect(loginFn).not.toHaveBeenCalled();
    expect(comp.error()).toContain('username and password');
    expect(comp.loading()).toBe(false);
  });

  it('calls login + navigates to /dashboard on success', () => {
    loginFn.mockReturnValue(of({ accessToken: 'tok' }));
    const comp = build(loginFn, navigate);
    comp.username = 'demo';
    comp.password = 'demo';
    comp.onSubmit();

    expect(loginFn).toHaveBeenCalledWith('demo', 'demo');
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(comp.loading()).toBe(false);
    expect(comp.error()).toBeNull();
  });

  it('surfaces the API error message on failure', () => {
    loginFn.mockReturnValue(
      throwError(() => ({ error: { message: 'Wrong creds' } })),
    );
    const comp = build(loginFn, navigate);
    comp.username = 'demo';
    comp.password = 'wrong';
    comp.onSubmit();

    expect(comp.error()).toBe('Wrong creds');
    expect(comp.loading()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error has no body message', () => {
    loginFn.mockReturnValue(throwError(() => new Error('network')));
    const comp = build(loginFn, navigate);
    comp.username = 'demo';
    comp.password = 'demo';
    comp.onSubmit();

    expect(comp.error()).toContain('Login failed');
  });

  it('starts with hidePassword=true and exposes a toggle signal', () => {
    const comp = build(loginFn, navigate);
    expect(comp.hidePassword()).toBe(true);
  });
});
