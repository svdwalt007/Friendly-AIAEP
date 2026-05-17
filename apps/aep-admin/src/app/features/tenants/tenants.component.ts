/**
 * @file Tenant Directory (E1) — read-only table + create dialog.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export type TenantPlan = 'Starter' | 'Pro' | 'Enterprise';
export type TenantStatus = 'active' | 'trial' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
  mrr: number;
  apiCalls: number;
  status: TenantStatus;
  adminEmail: string;
}

const SEED_TENANTS: Tenant[] = [
  { id: 'tnt-001', name: 'Friendly Technologies', plan: 'Enterprise', mrr: 18500, apiCalls: 4_812_445, status: 'active', adminEmail: 'admin@friendly-tech.com' },
  { id: 'tnt-002', name: 'Vodafone IoT',          plan: 'Enterprise', mrr: 24000, apiCalls: 7_124_902, status: 'active', adminEmail: 'iot.ops@vodafone.com' },
  { id: 'tnt-003', name: 'AWS IoT Core',          plan: 'Enterprise', mrr: 32000, apiCalls: 12_408_133, status: 'active', adminEmail: 'partner@aws.example' },
  { id: 'tnt-004', name: 'Telstra Smart Spaces',  plan: 'Pro',        mrr: 6800,  apiCalls: 1_204_788, status: 'active', adminEmail: 'devops@telstra.example' },
  { id: 'tnt-005', name: 'Optus Enterprise IoT',  plan: 'Pro',        mrr: 7200,  apiCalls: 1_488_120, status: 'active', adminEmail: 'iot@optus.example' },
  { id: 'tnt-006', name: 'Acme Sensors GmbH',     plan: 'Pro',        mrr: 4400,  apiCalls: 612_335,    status: 'trial', adminEmail: 'devops@acme-sensors.de' },
  { id: 'tnt-007', name: 'Pelican Water Co',      plan: 'Starter',    mrr: 990,   apiCalls: 84_212,     status: 'active', adminEmail: 'ops@pelicanwater.example' },
  { id: 'tnt-008', name: 'Northwind Logistics',   plan: 'Starter',    mrr: 990,   apiCalls: 102_004,    status: 'suspended', adminEmail: 'it@northwind.example' },
  { id: 'tnt-009', name: 'Helios Energy SA',      plan: 'Pro',        mrr: 5400,  apiCalls: 911_402,    status: 'active', adminEmail: 'cloud@helios.example' },
];

@Component({
  selector: 'app-create-tenant-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Create Tenant</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Tenant name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="e.g. Acme Sensors GmbH" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Plan</mat-label>
        <mat-select [(ngModel)]="plan">
          <mat-option value="Starter">Starter</mat-option>
          <mat-option value="Pro">Pro</mat-option>
          <mat-option value="Enterprise">Enterprise</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Initial admin email</mat-label>
        <input matInput type="email" [(ngModel)]="adminEmail" placeholder="admin@example.com" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!name.trim() || !adminEmail.trim()"
        (click)="submit()"
      >
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.full { width: 100%; display: block; }`],
})
export class CreateTenantDialogComponent {
  readonly dialogRef = inject(
    MatDialogRef<CreateTenantDialogComponent, Partial<Tenant> | null>,
  );

  name = '';
  plan: TenantPlan = 'Starter';
  adminEmail = '';

  submit(): void {
    this.dialogRef.close({
      name: this.name.trim(),
      plan: this.plan,
      adminEmail: this.adminEmail.trim(),
    });
  }
}

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDialogModule,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Tenant Directory</h1>
          <p class="sub">{{ tenants().length }} tenants across all regions.</p>
        </div>
        <button mat-flat-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          Create Tenant
        </button>
      </header>

      <mat-card class="table-card">
        <table mat-table [dataSource]="tenants()" class="full-width">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>Tenant ID</th>
            <td mat-cell *matCellDef="let t"><code>{{ t.id }}</code></td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let t">{{ t.name }}</td>
          </ng-container>
          <ng-container matColumnDef="plan">
            <th mat-header-cell *matHeaderCellDef>Plan</th>
            <td mat-cell *matCellDef="let t">
              <span class="plan-pill" [attr.data-plan]="t.plan">{{ t.plan }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="mrr">
            <th mat-header-cell *matHeaderCellDef class="num">MRR</th>
            <td mat-cell *matCellDef="let t" class="num">
              {{ t.mrr | currency: 'USD' : 'symbol' : '1.0-0' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="apiCalls">
            <th mat-header-cell *matHeaderCellDef class="num">API calls (MTD)</th>
            <td mat-cell *matCellDef="let t" class="num">
              {{ t.apiCalls | number }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let t">
              <span class="badge" [attr.data-status]="t.status">{{ t.status }}</span>
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
      .page { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
      .page-header { display: flex; justify-content: space-between; align-items: center; }
      h1 { margin: 0; }
      .sub { margin: 4px 0 0; color: var(--ft-text-secondary, #616161); }
      .table-card { padding: 0; overflow: hidden; }
      .full-width { width: 100%; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      th.num, td.num { text-align: right; }
      code {
        font-family: var(--ft-font-family-mono, 'Roboto Mono', monospace);
        font-size: 12px;
      }
      .plan-pill {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--ft-neutral-200, #eee);
        color: var(--ft-text-primary, #212121);
      }
      .plan-pill[data-plan='Pro'] {
        background: var(--ft-info-50, #e3f2fd);
        color: var(--ft-info-700, #1976d2);
      }
      .plan-pill[data-plan='Enterprise'] {
        background: var(--ft-accent-50, #fce4ec);
        color: var(--ft-accent-700, #c2185b);
      }
      .badge {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--ft-neutral-200, #eee);
        color: var(--ft-text-secondary, #616161);
      }
      .badge[data-status='active'] {
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
      }
      .badge[data-status='trial'] {
        background: var(--ft-warning-50, #fff3e0);
        color: var(--ft-warning-700, #f57c00);
      }
      .badge[data-status='suspended'] {
        background: var(--ft-error-50, #ffebee);
        color: var(--ft-error-700, #d32f2f);
      }
    `,
  ],
})
export class TenantsComponent {
  private readonly dialog = inject(MatDialog);

  readonly columns = ['id', 'name', 'plan', 'mrr', 'apiCalls', 'status'];
  readonly tenants = signal<Tenant[]>([...SEED_TENANTS]);

  openCreate(): void {
    const ref = this.dialog.open(CreateTenantDialogComponent, {
      width: '420px',
    });
    ref.afterClosed().subscribe((result) => {
      if (!result || !result.name) return;
      const next: Tenant = {
        id: `tnt-${(this.tenants().length + 1).toString().padStart(3, '0')}`,
        name: result.name,
        plan: (result.plan as TenantPlan) ?? 'Starter',
        mrr: result.plan === 'Enterprise' ? 15000 : result.plan === 'Pro' ? 5000 : 990,
        apiCalls: 0,
        status: 'trial',
        adminEmail: result.adminEmail ?? '',
      };
      this.tenants.update((list) => [...list, next]);
    });
  }
}
