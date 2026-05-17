/**
 * @file Deploy Pipeline (D2) — sequential stage indicator with mock build logs.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

export type DeployStageStatus = 'pending' | 'running' | 'done' | 'failed';

export interface DeployStage {
  id: string;
  label: string;
  icon: string;
  status: DeployStageStatus;
  durationMs: number;
  logs: string[];
}

const STAGE_DELAY_MS = 1500;

const INITIAL_STAGES: DeployStage[] = [
  {
    id: 'generate',
    label: 'Generate',
    icon: 'auto_awesome',
    status: 'pending',
    durationMs: 0,
    logs: [
      '[generate] Resolving widget registry…',
      '[generate] Composing pages from manifest (3 pages)',
      '[generate] Emitting Angular standalone components',
      '[generate] Wrote 14 .ts / 14 .html / 14 .scss files',
      '[generate] OK in 1480ms',
    ],
  },
  {
    id: 'build',
    label: 'Build',
    icon: 'build',
    status: 'pending',
    durationMs: 0,
    logs: [
      '[build] nx run generated-templates:build',
      '[build] Application bundle generation complete',
      '[build] Initial chunk files | Names | Raw size',
      '[build] main.js                  | main  | 412.34 kB',
      '[build] polyfills.js             | poly  |  34.12 kB',
      '[build] OK in 1492ms',
    ],
  },
  {
    id: 'deploy',
    label: 'Deploy',
    icon: 'rocket_launch',
    status: 'pending',
    durationMs: 0,
    logs: [
      '[deploy] Pushing artefact to preview-host://tenants/friendly/projects',
      '[deploy] Image: aep-app@sha256:c4f3…d2',
      '[deploy] Container started — port 46001',
      '[deploy] OK in 1497ms',
    ],
  },
  {
    id: 'verify',
    label: 'Verify',
    icon: 'verified',
    status: 'pending',
    durationMs: 0,
    logs: [
      '[verify] HTTP 200 GET /healthz',
      '[verify] HTTP 200 GET /readyz',
      '[verify] Smoke: dashboard route renders 1240ms',
      '[verify] Smoke: device list renders   980ms',
      '[verify] OK in 1499ms',
    ],
  },
];

@Component({
  selector: 'app-deploy-pipeline',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <section class="deploy-page">
      <header class="deploy-header">
        <div>
          <h1 class="deploy-title">Deploy Pipeline</h1>
          <p class="deploy-sub">
            Project <code>{{ id() }}</code> — sequential stage execution.
          </p>
        </div>
        <button
          mat-flat-button
          color="primary"
          (click)="trigger()"
          [disabled]="running()"
        >
          <mat-icon>play_arrow</mat-icon>
          {{ running() ? 'Deploying…' : 'Trigger Deploy' }}
        </button>
      </header>

      <mat-card class="stepper-card">
        <ol class="stepper">
          @for (stage of stages(); track stage.id; let i = $index) {
            <li class="stage" [attr.data-status]="stage.status">
              <div class="stage-icon-wrap">
                <mat-icon class="stage-icon">{{ stage.icon }}</mat-icon>
              </div>
              <div class="stage-meta">
                <div class="stage-label">{{ stage.label }}</div>
                <div class="stage-row">
                  <span class="badge" [attr.data-status]="stage.status">
                    {{ stage.status }}
                  </span>
                  <span class="duration">
                    {{ stage.durationMs > 0 ? (stage.durationMs + 'ms') : '—' }}
                  </span>
                </div>
              </div>
              @if (i < stages().length - 1) {
                <span class="connector" [attr.data-status]="stage.status"></span>
              }
            </li>
          }
        </ol>
      </mat-card>

      <mat-card class="log-card">
        <div class="log-header">
          <mat-icon>terminal</mat-icon>
          <span>Build Logs</span>
          <span class="spacer"></span>
          <span class="log-count">{{ visibleLogs().length }} lines</span>
        </div>
        <mat-divider></mat-divider>
        <pre class="log-output"><code>{{ logText() }}</code></pre>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .deploy-page {
        padding: var(--ft-spacing-lg, 24px);
        display: flex;
        flex-direction: column;
        gap: var(--ft-spacing-lg, 24px);
      }
      .deploy-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .deploy-title {
        margin: 0;
      }
      .deploy-sub {
        margin: 4px 0 0;
        color: var(--ft-text-secondary, #616161);
      }
      .stepper-card {
        padding: 24px;
      }
      .stepper {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        align-items: flex-start;
        gap: 0;
      }
      .stage {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        gap: 8px;
      }
      .stage-icon-wrap {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ft-neutral-200, #eee);
        color: var(--ft-text-secondary, #616161);
        border: 2px solid var(--ft-neutral-300, #e0e0e0);
        transition: all 0.25s ease;
      }
      .stage[data-status='running'] .stage-icon-wrap {
        background: var(--ft-warning-50, #fff3e0);
        color: var(--ft-warning-700, #f57c00);
        border-color: var(--ft-warning-500, #ff9800);
        animation: pulse 1.2s ease-in-out infinite;
      }
      .stage[data-status='done'] .stage-icon-wrap {
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
        border-color: var(--ft-success-500, #4caf50);
      }
      .stage[data-status='failed'] .stage-icon-wrap {
        background: var(--ft-error-50, #ffebee);
        color: var(--ft-error-700, #d32f2f);
        border-color: var(--ft-error-500, #f44336);
      }
      .stage-meta {
        text-align: center;
      }
      .stage-label {
        font-weight: 600;
        font-size: 14px;
      }
      .stage-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 4px;
      }
      .badge {
        font-size: 11px;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--ft-neutral-200, #eee);
        color: var(--ft-text-secondary, #616161);
        font-weight: 600;
        letter-spacing: 0.04em;
      }
      .badge[data-status='running'] {
        background: var(--ft-warning-50, #fff3e0);
        color: var(--ft-warning-700, #f57c00);
      }
      .badge[data-status='done'] {
        background: var(--ft-success-50, #e8f5e9);
        color: var(--ft-success-700, #388e3c);
      }
      .badge[data-status='failed'] {
        background: var(--ft-error-50, #ffebee);
        color: var(--ft-error-700, #d32f2f);
      }
      .duration {
        font-size: 12px;
        color: var(--ft-text-secondary, #616161);
        font-variant-numeric: tabular-nums;
      }
      .connector {
        position: absolute;
        top: 28px;
        left: calc(50% + 32px);
        right: calc(-50% + 32px);
        height: 2px;
        background: var(--ft-neutral-300, #e0e0e0);
        z-index: -1;
      }
      .connector[data-status='done'] {
        background: var(--ft-success-500, #4caf50);
      }
      .log-card {
        padding: 0;
        overflow: hidden;
      }
      .log-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        font-weight: 600;
        font-size: 14px;
      }
      .spacer {
        flex: 1;
      }
      .log-count {
        font-size: 12px;
        color: var(--ft-text-secondary, #616161);
      }
      .log-output {
        margin: 0;
        padding: 16px;
        max-height: 400px;
        min-height: 200px;
        overflow: auto;
        background: var(--ft-neutral-900, #212121);
        color: var(--ft-neutral-100, #f5f5f5);
        font-family: var(--ft-font-family-mono, 'Roboto Mono', monospace);
        font-size: 12.5px;
        line-height: 1.5;
        white-space: pre-wrap;
        border-left: none;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
    `,
  ],
})
export class DeployPipelineComponent {
  readonly id = input<string>('');

  readonly stages = signal<DeployStage[]>(this.cloneStages(INITIAL_STAGES));
  readonly running = signal(false);

  readonly visibleLogs = computed<string[]>(() => {
    const lines: string[] = [];
    for (const stage of this.stages()) {
      if (stage.status === 'pending') continue;
      lines.push(...stage.logs);
    }
    return lines;
  });

  readonly logText = computed(() => {
    const lines = this.visibleLogs();
    return lines.length > 0
      ? lines.join('\n')
      : '[idle] Press "Trigger Deploy" to begin.';
  });

  trigger(): void {
    if (this.running()) return;
    this.running.set(true);
    this.stages.set(this.cloneStages(INITIAL_STAGES));
    this.runStage(0);
  }

  private runStage(index: number): void {
    const stages = this.stages();
    if (index >= stages.length) {
      this.running.set(false);
      return;
    }
    this.updateStage(index, { status: 'running' });
    setTimeout(() => {
      this.updateStage(index, {
        status: 'done',
        durationMs: STAGE_DELAY_MS,
      });
      this.runStage(index + 1);
    }, STAGE_DELAY_MS);
  }

  private updateStage(index: number, patch: Partial<DeployStage>): void {
    this.stages.update((list) =>
      list.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  private cloneStages(src: DeployStage[]): DeployStage[] {
    return src.map((s) => ({ ...s, logs: [...s.logs] }));
  }
}
