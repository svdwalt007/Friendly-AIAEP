import { Route } from '@angular/router';
import { sysadminGuard } from './guards/sysadmin.guard';

export const appRoutes: Route[] = [
  { path: '', redirectTo: 'tenants', pathMatch: 'full' },
  {
    path: 'tenants',
    canActivate: [sysadminGuard],
    loadComponent: () =>
      import('./features/tenants/tenants.component').then(
        (m) => m.TenantsComponent,
      ),
  },
  {
    path: 'token-spend',
    canActivate: [sysadminGuard],
    loadComponent: () =>
      import('./features/token-spend/token-spend.component').then(
        (m) => m.TokenSpendComponent,
      ),
  },
  {
    path: 'llm-providers',
    canActivate: [sysadminGuard],
    loadComponent: () =>
      import('./features/llm-providers/llm-providers.component').then(
        (m) => m.LlmProvidersComponent,
      ),
  },
  {
    path: 'airgap',
    canActivate: [sysadminGuard],
    loadComponent: () =>
      import('./features/airgap/airgap.component').then(
        (m) => m.AirgapComponent,
      ),
  },
  {
    path: '403',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
  { path: '**', redirectTo: '403' },
];
