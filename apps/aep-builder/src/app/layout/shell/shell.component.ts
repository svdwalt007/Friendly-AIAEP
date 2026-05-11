/**
 * @file Shell Component — editorial chrome for authenticated AEP v2 screens.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterModule,
  ActivatedRoute,
  NavigationEnd,
  Router,
} from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ShellStateService } from '@friendly-tech/ui/iot-ui';
import { ShellBreadcrumbComponent } from './shell-breadcrumb.component';
import { ShellThemeTweaksComponent } from './shell-theme-tweaks.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

/**
 * <app-shell>
 *
 * Editorial chrome wrapping every authenticated screen in AEP v2.
 *
 * Features:
 * - Left rail (collapsible) with nav items and brand
 * - Top bar with breadcrumb trail, tenant/project context, user menu
 * - Orange singleton enforcement via [friendlyPrimary] directive
 * - Theme tweaks panel behind ?dev=1 query flag
 * - Reactive breadcrumb generation from route data
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatBadgeModule,
    ShellBreadcrumbComponent,
    ShellThemeTweaksComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly shellState = inject(ShellStateService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Projects', icon: 'folder', route: '/projects' },
    { label: 'Settings', icon: 'settings', route: '/settings' },
  ];

  ngOnInit(): void {
    // Derive breadcrumbs from the route tree on every NavigationEnd
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        map(() => this.buildBreadcrumbs(this.activatedRoute)),
      )
      .subscribe((crumbs) => {
        this.shellState.setBreadcrumbs(crumbs);
      });
  }

  toggleSidenav(): void {
    this.shellState.toggleRail();
  }

  onLogout(): void {
    this.authService.logout();
    this.shellState.reset();
  }

  /**
   * Walk the ActivatedRoute snapshot tree and assemble a breadcrumb trail.
   * Respects optional `breadcrumb` data on route configs.
   */
  private buildBreadcrumbs(
    route: ActivatedRoute,
  ): { label: string; route: string | null; icon: string | null }[] {
    const crumbs: {
      label: string;
      route: string | null;
      icon: string | null;
    }[] = [];
    let current: ActivatedRoute | null = route.root;

    while (current) {
      const snapshot = current.snapshot;
      if (snapshot.data && snapshot.data['breadcrumb']) {
        const bc = snapshot.data['breadcrumb'];
        crumbs.push({
          label:
            typeof bc === 'string'
              ? bc
              : (bc.label ??
                snapshot.title ??
                snapshot.url.map((s) => s.path).join('/')),
          route: snapshot.url.map((s) => s.path).join('/') || null,
          icon: bc.icon ?? null,
        });
      } else if (snapshot.url.length > 0) {
        const path = snapshot.url.map((s) => s.path).join('/');
        crumbs.push({
          label: snapshot.title ?? path,
          route: `/${path}`,
          icon: null,
        });
      }
      current = current.firstChild;
    }

    return crumbs;
  }
}
