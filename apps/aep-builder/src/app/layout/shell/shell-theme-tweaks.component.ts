/**
 * @file Shell Theme Tweaks — behind ?dev=1 query flag only.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 *
 * @description
 * Exposes a compact panel for editing CSS custom properties at runtime.
 * Only renders when the URL contains `?dev=1`.  Intended for UX designers
 * and developers to validate token overrides without rebuilding.
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ThemeService } from '../../core/services/theme.service';

type TweakCategory =
  | 'color'
  | 'spacing'
  | 'typography'
  | 'elevation'
  | 'radius'
  | 'transition'
  | 'other';

interface TweakToken {
  name: string;
  value: string;
  category: TweakCategory;
}

/**
 * <app-shell-theme-tweaks>
 *
 * Collapsible theme-token editor gated by `?dev=1`.
 * Appears as a floating panel in the bottom-right of the viewport.
 */
@Component({
  selector: 'app-shell-theme-tweaks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    @if (visible()) {
      <div class="theme-tweaks" [class.expanded]="expanded()">
        <div class="theme-tweaks__header" (click)="toggle()">
          <mat-icon class="theme-tweaks__icon">palette</mat-icon>
          <span class="theme-tweaks__title">Theme Tweaks</span>
          <mat-icon class="theme-tweaks__chevron">{{
            expanded() ? 'expand_more' : 'expand_less'
          }}</mat-icon>
        </div>

        @if (expanded()) {
          <div class="theme-tweaks__body">
            <mat-form-field class="theme-tweaks__field" appearance="outline">
              <mat-label>Search tokens</mat-label>
              <input
                matInput
                [(ngModel)]="filterText"
                placeholder="e.g. accent"
              />
            </mat-form-field>

            <div class="theme-tweaks__grid">
              @for (token of filteredTokens(); track token.name) {
                <div class="theme-tweaks__row">
                  <span class="theme-tweaks__name" [title]="token.name">{{
                    token.name
                  }}</span>
                  <input
                    class="theme-tweaks__input"
                    [(ngModel)]="token.value"
                    (change)="apply(token.name, token.value)"
                    [attr.type]="token.category === 'color' ? 'color' : 'text'"
                    [attr.list]="null"
                  />
                </div>
              }
            </div>

            <div class="theme-tweaks__actions">
              <button mat-stroked-button (click)="reset()">Reset</button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: fixed;
        bottom: var(--ft-density-spacing-lg, 24px);
        right: var(--ft-density-spacing-lg, 24px);
        z-index: var(--ft-z-notification, 1080);
      }

      .theme-tweaks {
        width: 320px;
        background-color: var(--ft-surface-primary);
        border: 1px solid var(--ft-border-color);
        border-radius: var(--ft-radius-lg);
        box-shadow: var(--ft-shadow-lg);
        overflow: hidden;
        transition: box-shadow var(--ft-transition-fast);
      }

      .theme-tweaks:hover {
        box-shadow: var(--ft-shadow-xl);
      }

      .theme-tweaks__header {
        display: flex;
        align-items: center;
        gap: var(--ft-density-spacing-sm, 8px);
        padding: var(--ft-density-spacing-sm, 8px)
          var(--ft-density-spacing-md, 16px);
        cursor: pointer;
        background-color: var(--ft-surface-secondary);
        border-bottom: 1px solid var(--ft-border-color);
        user-select: none;
      }

      .theme-tweaks__icon {
        color: var(--ft-accent-current, var(--ft-accent));
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }

      .theme-tweaks__title {
        flex: 1;
        font-size: var(--ft-density-font-sm, 0.875rem);
        font-weight: var(--ft-font-weight-semibold);
      }

      .theme-tweaks__chevron {
        font-size: 1.25rem;
        width: 1.25rem;
        height: 1.25rem;
      }

      .theme-tweaks__body {
        padding: var(--ft-density-spacing-md, 16px);
        display: flex;
        flex-direction: column;
        gap: var(--ft-density-spacing-md, 16px);
      }

      .theme-tweaks__field {
        width: 100%;
      }

      .theme-tweaks__field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      .theme-tweaks__grid {
        display: flex;
        flex-direction: column;
        gap: var(--ft-density-spacing-xs, 4px);
        max-height: 300px;
        overflow-y: auto;
      }

      .theme-tweaks__row {
        display: flex;
        align-items: center;
        gap: var(--ft-density-spacing-sm, 8px);
        padding: var(--ft-density-spacing-xs, 4px) 0;
        border-bottom: 1px solid var(--ft-border-color);
      }

      .theme-tweaks__name {
        flex: 1;
        font-family: var(--ft-font-family-mono);
        font-size: 0.75rem;
        color: var(--ft-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .theme-tweaks__input {
        width: 100px;
        padding: var(--ft-density-spacing-xs, 4px)
          var(--ft-density-spacing-sm, 8px);
        border: 1px solid var(--ft-border-color);
        border-radius: var(--ft-radius-sm);
        font-family: var(--ft-font-family-mono);
        font-size: 0.75rem;
        background-color: var(--ft-surface-primary);
        color: var(--ft-text-primary);
      }

      .theme-tweaks__input:focus {
        outline: 2px solid var(--ft-accent-current, var(--ft-accent));
        outline-offset: 1px;
      }

      .theme-tweaks__actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ShellThemeTweaksComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly theme = inject(ThemeService);

  protected readonly visible = signal(false);
  protected readonly expanded = signal(true);
  protected readonly filterText = signal('');
  protected readonly tokens = signal<TweakToken[]>([]);

  protected readonly filteredTokens = computed(() => {
    const q = this.filterText().toLowerCase();
    if (!q) return this.tokens();
    return this.tokens().filter((t) => t.name.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.visible.set(params['dev'] === '1');
    });

    if (typeof window !== 'undefined') {
      this.refreshTokens();
    }
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  apply(name: string, value: string): void {
    this.theme.setDesignToken(name, value);
  }

  reset(): void {
    this.theme.resetToDefaults();
    this.refreshTokens();
  }

  private refreshTokens(): void {
    const raw = this.theme.getAllDesignTokens();
    this.tokens.set(
      raw.map((t) => ({
        name: t.name,
        value: t.value,
        category: t.category as TweakCategory,
      })),
    );
  }
}
