/**
 * @file Air-gap Mode (E4) — registry mirror, license vault and offline bundle
 * controls for tenants running AEP behind a sealed network boundary.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

export type AirgapBundleStatus = 'sealed' | 'mirroring' | 'stale' | 'failed';

export interface AirgapBundle {
  id: string;
  tenant: string;
  region: string;
  registryHash: string;
  sizeMb: number;
  lastSyncedIso: string;
  status: AirgapBundleStatus;
}

const SEED_BUNDLES: AirgapBundle[] = [
  {
    id: 'bnd-001',
    tenant: 'Helios Energy SA',
    region: 'eu-west-2',
    registryHash: 'sha256:9c4f…a712',
    sizeMb: 1842,
    lastSyncedIso: '2026-05-14T08:22:00.000Z',
    status: 'sealed',
  },
  {
    id: 'bnd-002',
    tenant: 'Vodafone IoT',
    region: 'eu-central-1',
    registryHash: 'sha256:7e21…b034',
    sizeMb: 2204,
    lastSyncedIso: '2026-05-15T14:05:00.000Z',
    status: 'mirroring',
  },
  {
    id: 'bnd-003',
    tenant: 'Northwind Logistics',
    region: 'us-east-1',
    registryHash: 'sha256:c4f3…d201',
    sizeMb: 1612,
    lastSyncedIso: '2026-04-29T03:14:00.000Z',
    status: 'stale',
  },
  {
    id: 'bnd-004',
    tenant: 'Pelican Water Co',
    region: 'ap-southeast-2',
    registryHash: 'sha256:18ab…41ce',
    sizeMb: 1418,
    lastSyncedIso: '2026-05-12T22:48:00.000Z',
    status: 'failed',
  },
];

const STATUS_LABEL: Record<AirgapBundleStatus, string> = {
  sealed: 'Sealed',
  mirroring: 'Mirroring',
  stale: 'Stale',
  failed: 'Failed',
};

const STALE_THRESHOLD_DAYS = 14;

@Component({
  selector: 'app-airgap',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Air-gap Mode</h1>
          <p class="sub">
            Registry mirrors and offline licence vaults for sealed deployments.
          </p>
        </div>
        <div class="mode-pill" [attr.data-on]="enforced()">
          <mat-icon>{{ enforced() ? 'lock' : 'lock_open' }}</mat-icon>
          <span>Enforcement {{ enforced() ? 'ON' : 'OFF' }}</span>
        </div>
      </header>

      <mat-card class="settings-card">
        <div class="setting-row">
          <div>
            <strong>Block egress to public registries</strong>
            <p class="muted">
              When ON, all tenants must pull container images from the local
              mirror; outbound calls to <code>ghcr.io</code>,
              <code>docker.io</code> and <code>npmjs.com</code> are denied.
            </p>
          </div>
          <mat-slide-toggle
            [(ngModel)]="enforcementInput"
            (change)="onEnforcementToggle($event.checked)"
            aria-label="Block egress to public registries"
          ></mat-slide-toggle>
        </div>

        <mat-divider></mat-divider>

        <div class="setting-row">
          <div>
            <strong>Offline licence vault</strong>
            <p class="muted">
              Pre-issued tenant licences are signed with the customer KMS root
              and pushed inside the bundle. No phone-home is required.
            </p>
          </div>
          <span class="badge" [attr.data-on]="vaultArmed()">
            {{ vaultArmed() ? 'Armed' : 'Disarmed' }}
          </span>
        </div>
      </mat-card>

      <mat-card class="summary-card">
        <div class="summary-grid">
          <div class="summary-tile">
            <div class="summary-label">Bundles</div>
            <div class="summary-value">{{ bundles().length }}</div>
          </div>
          <div class="summary-tile">
            <div class="summary-label">Sealed</div>
            <div class="summary-value">{{ sealedCount() }}</div>
          </div>
          <div class="summary-tile">
            <div class="summary-label">Stale (&gt; {{ staleDays }} days)</div>
            <div class="summary-value">{{ staleCount() }}</div>
          </div>
          <div class="summary-tile">
            <div class="summary-label">Total size</div>
            <div class="summary-value">{{ totalSizeMb() }} MB</div>
          </div>
        </div>
      </mat-card>

      <mat-card class="table-card">
        <table mat-table [dataSource]="bundles()" class="full-width">
          <ng-container matColumnDef="tenant">
            <th mat-header-cell *matHeaderCellDef>Tenant</th>
            <td mat-cell *matCellDef="let b">
              <strong>{{ b.tenant }}</strong>
              <div class="muted">{{ b.id }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="region">
            <th mat-header-cell *matHeaderCellDef>Region</th>
            <td mat-cell *matCellDef="let b">{{ b.region }}</td>
          </ng-container>
          <ng-container matColumnDef="hash">
            <th mat-header-cell *matHeaderCellDef>Registry hash</th>
            <td mat-cell *matCellDef="let b">
              <code>{{ b.registryHash }}</code>
            </td>
          </ng-container>
          <ng-container matColumnDef="size">
            <th mat-header-cell *matHeaderCellDef class="num">Size</th>
            <td mat-cell *matCellDef="let b" class="num">
              {{ b.sizeMb | number }} MB
            </td>
          </ng-container>
          <ng-container matColumnDef="lastSynced">
            <th mat-header-cell *matHeaderCellDef>Last sync</th>
            <td mat-cell *matCellDef="let b">
              {{ b.lastSyncedIso | date: 'medium' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let b">
              <span class="badge" [attr.data-status]="b.status">
                {{ statusLabel(b.status) }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let b">
              <button
                mat-stroked-button
                color="primary"
                (click)="resync(b.id)"
                [disabled]="b.status === 'mirroring'"
                [attr.aria-label]="'Resync ' + b.tenant"
              >
                <mat-icon>refresh</mat-icon>
                Resync
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h1 { margin: 0; }
      .sub { margin: 4px 0 0; color: var(--ft-text-secondary, #616161); }
      .mode-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 999px;
        background: var(--ft-neutral-200, #eee);
        color: var(--ft-text-secondary, #616161);
        font-weight: 600;
      }
      .mode-pill[data-on='true'] {
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
      }
      .settings-card { padding: 16px 20px; }
      .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 24px;
        padding: 8px 0;
      }
      .summary-card { padding: 0; overflow: hidden; }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0;
      }
      .summary-tile {
        padding: 20px;
        text-align: center;
        border-right: 1px solid var(--ft-neutral-200, #eee);
      }
      .summary-tile:last-child { border-right: none; }
      .summary-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ft-text-secondary, #616161);
        margin-bottom: 8px;
      }
      .summary-value {
        font-size: 28px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .table-card { padding: 0; overflow: hidden; }
      .full-width { width: 100%; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      th.num, td.num { text-align: right; }
      code {
        font-family: var(--ft-font-family-mono, 'Roboto Mono', monospace);
        font-size: 12px;
      }
      .muted { font-size: 11px; color: var(--ft-text-secondary, #616161); }
      .badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--ft-neutral-200, #eee);
        color: var(--ft-text-secondary, #616161);
      }
      .badge[data-on='true'] {
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
      }
      .badge[data-status='sealed'] {
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
      }
      .badge[data-status='mirroring'] {
        background: var(--ft-info-50, #e3f2fd);
        color: var(--ft-info-700, #1976d2);
      }
      .badge[data-status='stale'] {
        background: var(--ft-warning-50, #fff3e0);
        color: var(--ft-warning-700, #f57c00);
      }
      .badge[data-status='failed'] {
        background: var(--ft-error-50, #ffebee);
        color: var(--ft-error-700, #d32f2f);
      }
    `,
  ],
})
export class AirgapComponent {
  readonly columns = [
    'tenant',
    'region',
    'hash',
    'size',
    'lastSynced',
    'status',
    'actions',
  ];
  readonly staleDays = STALE_THRESHOLD_DAYS;

  readonly bundles = signal<AirgapBundle[]>([...SEED_BUNDLES]);
  readonly enforced = signal(true);
  readonly vaultArmed = signal(true);

  enforcementInput = true;

  readonly totalSizeMb = computed(() =>
    this.bundles().reduce((acc, b) => acc + b.sizeMb, 0),
  );

  readonly sealedCount = computed(
    () => this.bundles().filter((b) => b.status === 'sealed').length,
  );

  readonly staleCount = computed(
    () => this.bundles().filter((b) => b.status === 'stale').length,
  );

  statusLabel(status: AirgapBundleStatus): string {
    return STATUS_LABEL[status];
  }

  onEnforcementToggle(value: boolean): void {
    this.enforced.set(value);
    this.vaultArmed.set(value);
  }

  resync(id: string): void {
    this.bundles.update((list) =>
      list.map((b) =>
        b.id === id
          ? { ...b, status: 'mirroring' satisfies AirgapBundleStatus }
          : b,
      ),
    );
  }
}
