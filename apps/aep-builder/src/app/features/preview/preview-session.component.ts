/**
 * @file Preview Session (D3) — countdown timer + mode tabs + preview frame.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

type PreviewMode = 'mock' | 'live' | 'sim' | null;

const SESSION_SECONDS = 30 * 60;

@Component({
  selector: 'app-preview-session',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  template: `
    <section class="preview-page">
      <header class="preview-header">
        <div>
          <h1 class="preview-title">Preview Session</h1>
          <p class="preview-sub">
            Project <code>{{ id() }}</code> — sandboxed runtime preview.
          </p>
        </div>

        <div class="timer-block" [attr.data-expired]="expired()">
          <mat-icon>schedule</mat-icon>
          <div class="timer-text">
            <span class="timer-label">Time remaining</span>
            <span class="timer-value">{{ formatted() }}</span>
          </div>
          <button
            mat-stroked-button
            color="primary"
            (click)="extend()"
            matTooltip="Reset to 30:00"
          >
            <mat-icon>refresh</mat-icon>
            Extend Session
          </button>
        </div>
      </header>

      <mat-tab-group
        [selectedIndex]="tabIndex()"
        (selectedIndexChange)="onTabChange($event)"
      >
        <mat-tab label="Mock"></mat-tab>
        <mat-tab label="Live"></mat-tab>
        <mat-tab label="Sim"></mat-tab>
      </mat-tab-group>

      <mat-card class="frame-card">
        <div class="frame-wrap">
          <iframe
            class="preview-frame"
            src="about:blank"
            title="Preview"
            sandbox="allow-scripts"
          ></iframe>

          @if (!mode() && !expired()) {
            <div class="overlay">
              <mat-icon class="overlay-icon">hourglass_empty</mat-icon>
              <div class="overlay-text">Preview loading…</div>
              <div class="overlay-sub">Select a mode above to begin.</div>
            </div>
          }

          @if (expired()) {
            <div class="overlay overlay-expired">
              <mat-icon class="overlay-icon">timer_off</mat-icon>
              <div class="overlay-text">Session expired</div>
              <div class="overlay-sub">
                Your sandbox has been released to free resources.
              </div>
              <button
                mat-flat-button
                color="primary"
                (click)="restart()"
              >
                <mat-icon>play_arrow</mat-icon>
                Start New Session
              </button>
            </div>
          }
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .preview-page {
        padding: var(--ft-spacing-lg, 24px);
        display: flex;
        flex-direction: column;
        gap: var(--ft-spacing-lg, 24px);
      }
      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .preview-title { margin: 0; }
      .preview-sub {
        margin: 4px 0 0;
        color: var(--ft-text-secondary, #616161);
      }
      .timer-block {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        border-radius: 8px;
        background: var(--ft-surface-secondary, #f5f5f5);
        border: 1px solid var(--ft-neutral-300, #e0e0e0);
      }
      .timer-block[data-expired='true'] {
        background: var(--ft-error-50, #ffebee);
        border-color: var(--ft-error-500, #f44336);
        color: var(--ft-error-700, #d32f2f);
      }
      .timer-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .timer-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ft-text-secondary, #616161);
      }
      .timer-block[data-expired='true'] .timer-label {
        color: inherit;
      }
      .timer-value {
        font-family: var(--ft-font-family-mono, 'Roboto Mono', monospace);
        font-size: 22px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .frame-card { padding: 0; overflow: hidden; }
      .frame-wrap {
        position: relative;
        width: 100%;
        height: 600px;
        background: var(--ft-neutral-100, #f5f5f5);
      }
      .preview-frame {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
        background: white;
      }
      .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(2px);
      }
      .overlay-expired { background: rgba(255, 235, 238, 0.95); }
      .overlay-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: var(--ft-text-secondary, #616161);
      }
      .overlay-expired .overlay-icon { color: var(--ft-error-700, #d32f2f); }
      .overlay-text {
        font-size: 18px;
        font-weight: 600;
      }
      .overlay-sub {
        font-size: 14px;
        color: var(--ft-text-secondary, #616161);
      }
    `,
  ],
})
export class PreviewSessionComponent implements OnInit {
  readonly id = input<string>('');
  private readonly destroyRef = inject(DestroyRef);

  readonly secondsRemaining = signal(SESSION_SECONDS);
  readonly mode = signal<PreviewMode>(null);
  readonly tabIndex = signal<number>(-1);

  readonly expired = computed(() => this.secondsRemaining() <= 0);
  readonly formatted = computed(() => {
    const total = Math.max(0, this.secondsRemaining());
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  ngOnInit(): void {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.expired()) return;
        this.secondsRemaining.update((n) => Math.max(0, n - 1));
      });
  }

  extend(): void {
    this.secondsRemaining.set(SESSION_SECONDS);
  }

  restart(): void {
    this.secondsRemaining.set(SESSION_SECONDS);
    this.mode.set(null);
    this.tabIndex.set(-1);
  }

  onTabChange(index: number): void {
    this.tabIndex.set(index);
    const modes: PreviewMode[] = ['mock', 'live', 'sim'];
    this.mode.set(modes[index] ?? null);
  }
}
