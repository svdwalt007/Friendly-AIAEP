import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

interface AdminNavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
  ],
  template: `
    <mat-sidenav-container class="admin-shell">
      <mat-sidenav mode="side" opened class="admin-rail">
        <div class="brand">
          <mat-icon>shield</mat-icon>
          <div class="brand-text">
            <div class="brand-title">AEP Admin</div>
            <div class="brand-sub">Platform console</div>
          </div>
        </div>
        <mat-nav-list>
          @for (item of navItems; track item.route) {
            <a
              mat-list-item
              [routerLink]="item.route"
              routerLinkActive="active"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="admin-content">
        <mat-toolbar class="admin-topbar">
          <span class="topbar-title">Friendly Technologies</span>
          <span class="topbar-slogan">The IoT and Device Management Company</span>
          <span class="spacer"></span>
          <span class="role-pill">
            <mat-icon>verified_user</mat-icon>
            sysadmin
          </span>
        </mat-toolbar>
        <main class="admin-main">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host { display: block; height: 100vh; width: 100vw; }
      .admin-shell { height: 100vh; }
      .admin-rail {
        width: 240px;
        background: var(--ft-primary, #12174c);
        color: white;
        border-right: none;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .brand mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--ft-accent, #ff6b1a);
      }
      .brand-title { font-weight: 700; font-size: 16px; }
      .brand-sub {
        font-size: 11px;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      ::ng-deep .admin-rail .mat-mdc-list-item {
        color: white !important;
      }
      ::ng-deep .admin-rail .mat-mdc-list-item.active {
        background: rgba(255, 107, 26, 0.18);
        border-left: 3px solid var(--ft-accent, #ff6b1a);
      }
      ::ng-deep .admin-rail .mat-mdc-list-item .mat-icon {
        color: rgba(255, 255, 255, 0.85) !important;
      }
      .admin-topbar {
        display: flex;
        align-items: center;
        gap: 12px;
        background: white;
        border-bottom: 1px solid var(--ft-neutral-300, #e0e0e0);
      }
      .topbar-title { font-weight: 600; }
      .topbar-slogan {
        font-size: 12px;
        color: var(--ft-text-secondary, #616161);
        font-style: italic;
      }
      .spacer { flex: 1; }
      .role-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
        font-size: 12px;
        font-weight: 600;
      }
      .role-pill mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .admin-main {
        height: calc(100vh - 64px);
        overflow: auto;
      }
    `,
  ],
})
export class App {
  readonly navItems: AdminNavItem[] = [
    { label: 'Tenants', icon: 'apartment', route: '/tenants' },
    { label: 'Token Spend', icon: 'paid', route: '/token-spend' },
    { label: 'LLM Providers', icon: 'hub', route: '/llm-providers' },
    { label: 'Air-Gap Mode', icon: 'lock', route: '/airgap' },
  ];
}
