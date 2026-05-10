import { Route } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        data: { breadcrumb: { label: 'Dashboard', icon: 'dashboard' } },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'projects',
        data: { breadcrumb: { label: 'Projects', icon: 'folder' } },
        loadComponent: () =>
          import('./features/projects/project-list/project-list.component').then(
            (m) => m.ProjectListComponent,
          ),
      },
      {
        path: 'projects/:id',
        data: { breadcrumb: { label: 'Project Detail' } },
        loadComponent: () =>
          import('./features/projects/project-detail/project-detail.component').then(
            (m) => m.ProjectDetailComponent,
          ),
      },
      {
        path: 'projects/:id/builder',
        data: { breadcrumb: { label: 'Builder', icon: 'build' } },
        loadComponent: () =>
          import('./features/builder/builder.component').then(
            (m) => m.BuilderComponent,
          ),
      },
      {
        path: 'projects/:id/workspace',
        data: { breadcrumb: { label: 'Workspace', icon: 'edit_square' } },
        loadComponent: () =>
          import('./features/builder/builder-workspace.component').then(
            (m) => m.BuilderWorkspaceComponent,
          ),
      },
      {
        path: 'settings',
        data: { breadcrumb: { label: 'Settings', icon: 'settings' } },
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
