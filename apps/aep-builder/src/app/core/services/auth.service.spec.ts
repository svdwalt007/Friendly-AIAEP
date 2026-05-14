import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, LoginResponse } from './auth.service';
import { environment } from '../../../environments/environment';

const RESPONSE: LoginResponse = {
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresIn: 3600,
  user: {
    id: 'u1',
    username: 'sean',
    tenantId: 't1',
    role: 'admin',
  },
};

describe('AuthService', () => {
  let svc: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
      ],
    });
    svc = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts unauthenticated when no user is persisted', () => {
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.user()).toBeNull();
  });

  it('login stores tokens + user on success', () => {
    svc.login('sean', 'pw').subscribe((res) => {
      expect(res.accessToken).toBe('access-123');
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(RESPONSE);

    expect(svc.getToken()).toBe('access-123');
    expect(svc.getRefreshToken()).toBe('refresh-456');
    expect(svc.user()?.username).toBe('sean');
    expect(svc.isAuthenticated()).toBe(true);
  });

  it('login propagates HTTP errors', () => {
    let captured: unknown;
    svc.login('a', 'b').subscribe({
      error: (err) => (captured = err),
    });
    httpMock
      .expectOne(`${environment.apiUrl}/api/v1/auth/login`)
      .flush('nope', { status: 401, statusText: 'Unauthorized' });
    expect(captured).toBeTruthy();
    expect(svc.isAuthenticated()).toBe(false);
  });

  it('logout clears storage + navigates to /login', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    localStorage.setItem('aep_access_token', 'x');
    localStorage.setItem('aep_refresh_token', 'y');
    localStorage.setItem('aep_user', JSON.stringify(RESPONSE.user));
    svc.logout();
    expect(localStorage.getItem('aep_access_token')).toBeNull();
    expect(localStorage.getItem('aep_refresh_token')).toBeNull();
    expect(localStorage.getItem('aep_user')).toBeNull();
    expect(svc.user()).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });

  it('rehydrates user from localStorage on construction', () => {
    localStorage.setItem('aep_user', JSON.stringify(RESPONSE.user));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
      ],
    });
    const rehydrated = TestBed.inject(AuthService);
    expect(rehydrated.user()?.username).toBe('sean');
    expect(rehydrated.isAuthenticated()).toBe(true);
  });

  it('returns null user when stored JSON is malformed', () => {
    localStorage.setItem('aep_user', 'not-json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
      ],
    });
    expect(TestBed.inject(AuthService).user()).toBeNull();
  });
});
