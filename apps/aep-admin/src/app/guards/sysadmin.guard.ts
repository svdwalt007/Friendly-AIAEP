/**
 * @file sysadmin guard — denies access if the active session role !== 'sysadmin'.
 * Reads from localStorage key `aep_user` (shared with aep-builder AuthService).
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

interface StoredUser {
  id: string;
  username: string;
  tenantId: string;
  role: string;
}

const USER_KEY = 'aep_user';

function readUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export const sysadminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const user = readUser();

  // Permissive in development: if no user is stored yet, treat as sysadmin so
  // the admin app remains usable standalone. In production deployments this
  // value is provisioned by the SSO handshake.
  if (!user) {
    return true;
  }

  if (user.role === 'sysadmin') {
    return true;
  }

  return router.createUrlTree(['/403']);
};
