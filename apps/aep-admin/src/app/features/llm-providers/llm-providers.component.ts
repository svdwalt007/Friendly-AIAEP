/**
 * @file LLM Provider Management (E3) — provider × tenant matrix + edit panel.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';

type CellState = 'enabled' | 'disabled' | 'locked';

interface ProviderCredential {
  /** Last 4 visible chars only — full key is never stored client-side. */
  last4: string;
  rateLimit: number;
  enabled: boolean;
}

interface ProviderRow {
  id: string;
  name: string;
  cells: Record<string, CellState>;
  credential: ProviderCredential;
}

const TENANTS = [
  { id: 'tnt-001', label: 'Friendly' },
  { id: 'tnt-002', label: 'Vodafone' },
  { id: 'tnt-003', label: 'AWS' },
  { id: 'tnt-004', label: 'Telstra' },
  { id: 'tnt-005', label: 'Optus' },
];

const PROVIDERS: ProviderRow[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    cells: { 'tnt-001': 'enabled', 'tnt-002': 'enabled', 'tnt-003': 'enabled', 'tnt-004': 'enabled', 'tnt-005': 'disabled' },
    credential: { last4: 'a4F2', rateLimit: 5000, enabled: true },
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    cells: { 'tnt-001': 'enabled', 'tnt-002': 'enabled', 'tnt-003': 'locked', 'tnt-004': 'disabled', 'tnt-005': 'enabled' },
    credential: { last4: 'b81X', rateLimit: 3000, enabled: true },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    cells: { 'tnt-001': 'enabled', 'tnt-002': 'disabled', 'tnt-003': 'enabled', 'tnt-004': 'disabled', 'tnt-005': 'disabled' },
    credential: { last4: 'k9PQ', rateLimit: 2000, enabled: true },
  },
  {
    id: 'ollama',
    name: 'Ollama (self-host)',
    cells: { 'tnt-001': 'enabled', 'tnt-002': 'enabled', 'tnt-003': 'disabled', 'tnt-004': 'enabled', 'tnt-005': 'enabled' },
    credential: { last4: 'self', rateLimit: 1000, enabled: true },
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    cells: { 'tnt-001': 'disabled', 'tnt-002': 'locked', 'tnt-003': 'enabled', 'tnt-004': 'disabled', 'tnt-005': 'disabled' },
    credential: { last4: 'zR12', rateLimit: 1500, enabled: false },
  },
];

@Component({
  selector: 'app-llm-providers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>LLM Provider Management</h1>
          <p class="sub">Provider × tenant entitlements. Click <em>Edit</em> to manage credentials.</p>
        </div>
      </header>

      <div class="layout">
        <mat-card class="matrix-card">
          <table mat-table [dataSource]="providers()" class="full-width">
            <ng-container matColumnDef="provider">
              <th mat-header-cell *matHeaderCellDef>Provider</th>
              <td mat-cell *matCellDef="let p">
                <strong>{{ p.name }}</strong>
              </td>
            </ng-container>

            @for (tenant of tenants; track tenant.id) {
              <ng-container [matColumnDef]="tenant.id">
                <th mat-header-cell *matHeaderCellDef class="cell-col">
                  {{ tenant.label }}
                </th>
                <td mat-cell *matCellDef="let p" class="cell-col">
                  <span
                    class="cell"
                    [attr.data-state]="p.cells[tenant.id]"
                    [attr.title]="p.cells[tenant.id]"
                  >
                    @switch (p.cells[tenant.id]) {
                      @case ('enabled')  { <span aria-label="enabled">&#x2705;</span> }
                      @case ('locked')   { <span aria-label="locked">&#x1F512;</span> }
                      @default           { <span aria-label="disabled">&#x274C;</span> }
                    }
                  </span>
                </td>
              </ng-container>
            }

            <ng-container matColumnDef="action">
              <th mat-header-cell *matHeaderCellDef class="num">Action</th>
              <td mat-cell *matCellDef="let p" class="num">
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="edit(p)"
                >
                  <mat-icon>edit</mat-icon>
                  Edit
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns()"></tr>
            <tr mat-row *matRowDef="let row; columns: columns()"></tr>
          </table>
        </mat-card>

        @if (selected(); as sel) {
          <mat-card class="side-panel">
            <div class="panel-header">
              <div>
                <div class="panel-title">{{ sel.name }}</div>
                <div class="panel-sub">Credentials & rate limits</div>
              </div>
              <button mat-icon-button (click)="closePanel()" aria-label="Close">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <mat-divider></mat-divider>

            <div class="panel-body">
              <mat-form-field appearance="outline" class="full">
                <mat-label>API key</mat-label>
                <input
                  matInput
                  type="text"
                  readonly
                  [value]="masked(sel.credential.last4)"
                />
                <mat-icon matSuffix>vpn_key</mat-icon>
              </mat-form-field>
              <p class="hint">
                Full keys are stored in HashiCorp Vault and never returned to the
                browser. Only the last 4 characters are shown.
              </p>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Rate limit (requests / min)</mat-label>
                <input
                  matInput
                  type="number"
                  min="0"
                  [(ngModel)]="sel.credential.rateLimit"
                />
              </mat-form-field>

              <div class="toggle-row">
                <span>Enabled globally</span>
                <mat-slide-toggle [(ngModel)]="sel.credential.enabled"></mat-slide-toggle>
              </div>
            </div>
          </mat-card>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .page { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
      .page-header h1 { margin: 0; }
      .page-header .sub {
        margin: 4px 0 0;
        color: var(--ft-text-secondary, #616161);
      }
      .layout {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 24px;
        align-items: flex-start;
      }
      .matrix-card { padding: 0; overflow: hidden; }
      .full-width { width: 100%; }
      .cell-col { text-align: center; }
      th.cell-col, td.cell-col { text-align: center; }
      .cell { font-size: 18px; }
      .num { text-align: right; }
      .side-panel { padding: 0; }
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
      }
      .panel-title { font-weight: 600; }
      .panel-sub {
        font-size: 12px;
        color: var(--ft-text-secondary, #616161);
      }
      .panel-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
      .full { width: 100%; }
      .hint {
        margin: -4px 0 12px;
        font-size: 12px;
        color: var(--ft-text-secondary, #616161);
      }
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 4px;
      }
    `,
  ],
})
export class LlmProvidersComponent {
  readonly tenants = TENANTS;
  readonly providers = signal<ProviderRow[]>(PROVIDERS);
  readonly selectedId = signal<string | null>(null);

  readonly columns = computed(() => [
    'provider',
    ...this.tenants.map((t) => t.id),
    'action',
  ]);

  readonly selected = computed<ProviderRow | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.providers().find((p) => p.id === id) ?? null;
  });

  edit(p: ProviderRow): void {
    this.selectedId.set(p.id);
  }

  closePanel(): void {
    this.selectedId.set(null);
  }

  masked(last4: string): string {
    return `••••••••••••[${last4}]`;
  }
}
