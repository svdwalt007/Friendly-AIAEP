/**
 * @file authInterceptor unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let logoutSpy: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let getToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getToken = vi.fn();
    logoutSpy = vi.fn();
    navigateSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getToken, logout: logoutSpy },
        },
        {
          provide: Router,
          useValue: { navigate: navigateSpy },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds a Bearer Authorization header when the token is present', () => {
    getToken.mockReturnValue('tok-xyz');
    http.get('/api/x').subscribe();
    const req = httpMock.expectOne('/api/x');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-xyz');
    req.flush({});
  });

  it('omits the Authorization header when no token is stored', () => {
    getToken.mockReturnValue(null);
    http.get('/api/x').subscribe();
    const req = httpMock.expectOne('/api/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('calls logout + navigates to /login on a 401 response', () => {
    getToken.mockReturnValue('expired');
    let err: unknown;
    http.get('/api/x').subscribe({
      next: () => undefined,
      error: (e) => (err = e),
    });
    const req = httpMock.expectOne('/api/x');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalledOnce();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(err).toBeTruthy();
  });

  it('propagates non-401 errors without triggering logout', () => {
    getToken.mockReturnValue('tok');
    let err: unknown;
    http.get('/api/x').subscribe({
      next: () => undefined,
      error: (e) => (err = e),
    });
    const req = httpMock.expectOne('/api/x');
    req.flush('Server error', { status: 500, statusText: 'Server Error' });

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(err).toBeTruthy();
  });
});
