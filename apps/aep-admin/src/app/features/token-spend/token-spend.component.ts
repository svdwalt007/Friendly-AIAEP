/**
 * @file Token Spend (E2) — 30-day rollup table + inline-SVG bar chart.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';

interface ModelUsage {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Cost (USD) for each of the last 7 days, oldest → newest. */
  daily: number[];
}

const USAGE: ModelUsage[] = [
  {
    model: 'claude-sonnet-4.7',
    provider: 'Anthropic',
    inputTokens: 184_220_000,
    outputTokens: 22_488_000,
    costUsd: 1842.40,
    daily: [220, 245, 198, 312, 280, 295, 292],
  },
  {
    model: 'claude-haiku-4.7',
    provider: 'Anthropic',
    inputTokens: 412_000_000,
    outputTokens: 38_400_000,
    costUsd: 824.00,
    daily: [98, 112, 121, 140, 132, 110, 111],
  },
  {
    model: 'gemini-2.5-pro',
    provider: 'Google',
    inputTokens: 88_120_000,
    outputTokens: 14_220_000,
    costUsd: 612.30,
    daily: [72, 84, 96, 102, 88, 80, 90],
  },
  {
    model: 'gemini-2.5-flash',
    provider: 'Google',
    inputTokens: 220_440_000,
    outputTokens: 19_120_000,
    costUsd: 188.80,
    daily: [22, 25, 28, 30, 26, 28, 29],
  },
  {
    model: 'llama3.3-70b (ollama)',
    provider: 'Ollama (self-host)',
    inputTokens: 64_220_000,
    outputTokens: 8_440_000,
    costUsd: 0.00,
    daily: [0, 0, 0, 0, 0, 0, 0],
  },
];

@Component({
  selector: 'app-token-spend',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatIconModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>Token Spend</h1>
          <p class="sub">30-day rollup across all tenants and models.</p>
        </div>
        <div class="totals-pill">
          <mat-icon>paid</mat-icon>
          <span>Total: {{ total() | currency: 'USD' : 'symbol' : '1.2-2' }}</span>
        </div>
      </header>

      <mat-card class="chart-card">
        <div class="chart-title">Last 7 days (USD per model per day)</div>
        <div class="chart-grid">
          @for (row of usage(); track row.model) {
            <div class="chart-row">
              <div class="chart-row-label">
                <strong>{{ row.model }}</strong>
                <span class="chart-row-provider">{{ row.provider }}</span>
              </div>
              <svg
                class="bar-svg"
                viewBox="0 0 280 80"
                preserveAspectRatio="none"
                role="img"
                [attr.aria-label]="row.model + ' last 7 days bar chart'"
              >
                @for (v of row.daily; track $index; let i = $index) {
                  <rect
                    [attr.x]="i * 40 + 4"
                    [attr.y]="80 - barHeight(v, row.daily)"
                    [attr.width]="32"
                    [attr.height]="barHeight(v, row.daily)"
                    [attr.fill]="barColor(row.provider)"
                    rx="2"
                  ></rect>
                  <text
                    [attr.x]="i * 40 + 20"
                    [attr.y]="78"
                    text-anchor="middle"
                    font-size="9"
                    fill="white"
                    font-family="Roboto Mono, monospace"
                  >
                    {{ v }}
                  </text>
                }
              </svg>
            </div>
          }
        </div>
      </mat-card>

      <mat-card class="table-card">
        <table mat-table [dataSource]="rows()" class="full-width">
          <ng-container matColumnDef="model">
            <th mat-header-cell *matHeaderCellDef>Model</th>
            <td mat-cell *matCellDef="let r">
              <strong>{{ r.model }}</strong>
              @if (!r.isTotal) {
                <div class="muted">{{ r.provider }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="input">
            <th mat-header-cell *matHeaderCellDef class="num">Input tokens</th>
            <td mat-cell *matCellDef="let r" class="num">
              {{ r.inputTokens | number }}
            </td>
          </ng-container>
          <ng-container matColumnDef="output">
            <th mat-header-cell *matHeaderCellDef class="num">Output tokens</th>
            <td mat-cell *matCellDef="let r" class="num">
              {{ r.outputTokens | number }}
            </td>
          </ng-container>
          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef class="num">Total cost</th>
            <td mat-cell *matCellDef="let r" class="num">
              {{ r.costUsd | currency: 'USD' : 'symbol' : '1.2-2' }}
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: columns"
            [class.totals-row]="row.isTotal"
          ></tr>
        </table>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      h1 { margin: 0; }
      .sub { margin: 4px 0 0; color: var(--ft-text-secondary, #616161); }
      .totals-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 8px;
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
        font-weight: 600;
      }
      .chart-card { padding: 16px 20px; }
      .chart-title {
        font-weight: 600;
        font-size: 13px;
        color: var(--ft-text-secondary, #616161);
        margin-bottom: 12px;
      }
      .chart-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .chart-row {
        display: grid;
        grid-template-columns: 220px 1fr;
        align-items: center;
        gap: 16px;
      }
      .chart-row-label {
        display: flex;
        flex-direction: column;
        font-size: 13px;
      }
      .chart-row-provider {
        font-size: 11px;
        color: var(--ft-text-secondary, #616161);
      }
      .bar-svg {
        width: 100%;
        height: 80px;
        background: var(--ft-neutral-100, #f5f5f5);
        border-radius: 4px;
      }
      .table-card { padding: 0; overflow: hidden; }
      .full-width { width: 100%; }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      th.num, td.num { text-align: right; }
      .muted {
        font-size: 11px;
        color: var(--ft-text-secondary, #616161);
      }
      .totals-row {
        background: var(--ft-neutral-100, #f5f5f5);
        font-weight: 700;
      }
    `,
  ],
})
export class TokenSpendComponent {
  readonly columns = ['model', 'input', 'output', 'cost'];
  readonly usage = signal<ModelUsage[]>(USAGE);

  readonly total = computed(() =>
    this.usage().reduce((acc, u) => acc + u.costUsd, 0),
  );

  readonly rows = computed(() => {
    const data = this.usage().map((u) => ({
      model: u.model,
      provider: u.provider,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      costUsd: u.costUsd,
      isTotal: false,
    }));
    const totals = {
      model: 'TOTAL',
      provider: '',
      inputTokens: data.reduce((a, r) => a + r.inputTokens, 0),
      outputTokens: data.reduce((a, r) => a + r.outputTokens, 0),
      costUsd: data.reduce((a, r) => a + r.costUsd, 0),
      isTotal: true,
    };
    return [...data, totals];
  });

  barHeight(v: number, daily: number[]): number {
    const max = Math.max(...daily, 1);
    if (v <= 0) return 2;
    return Math.max(4, Math.round((v / max) * 64));
  }

  barColor(provider: string): string {
    if (provider.startsWith('Anthropic')) return '#d97706';
    if (provider.startsWith('Google')) return '#1976d2';
    if (provider.startsWith('Ollama')) return '#388e3c';
    return '#616161';
  }
}
