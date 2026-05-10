/**
 * @file Shell Breadcrumb — horizontal trail inside the editorial top bar.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ShellStateService } from '@friendly-tech/ui/iot-ui';

/**
 * <app-shell-breadcrumb>
 *
 * Renders the breadcrumb trail provided by {@link ShellStateService}.
 * Each node with a `route` is a link; the last node is always plain text.
 * Uses Material icons when an `icon` is supplied.
 */
@Component({
  selector: 'app-shell-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    @if (shell.breadcrumbs(); as trail) {
      @if (trail.length > 0) {
        <nav class="shell-breadcrumb" aria-label="Breadcrumb">
          <ol class="shell-breadcrumb__list">
            @for (node of trail; track node.label; let last = $last) {
              <li
                class="shell-breadcrumb__item"
                [class.shell-breadcrumb__item--current]="last"
              >
                @if (!last && node.route) {
                  <a
                    class="shell-breadcrumb__link"
                    [routerLink]="node.route"
                    [attr.aria-current]="null"
                  >
                    @if (node.icon) {
                      <mat-icon
                        class="shell-breadcrumb__icon"
                        aria-hidden="true"
                        >{{ node.icon }}</mat-icon
                      >
                    }
                    <span class="shell-breadcrumb__label">{{
                      node.label
                    }}</span>
                  </a>
                } @else {
                  <span class="shell-breadcrumb__text">
                    @if (node.icon) {
                      <mat-icon
                        class="shell-breadcrumb__icon"
                        aria-hidden="true"
                        >{{ node.icon }}</mat-icon
                      >
                    }
                    <span class="shell-breadcrumb__label">{{
                      node.label
                    }}</span>
                  </span>
                }
                @if (!last) {
                  <span class="shell-breadcrumb__sep" aria-hidden="true"
                    >/</span
                  >
                }
              </li>
            }
          </ol>
        </nav>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .shell-breadcrumb {
        display: flex;
        align-items: center;
      }

      .shell-breadcrumb__list {
        display: flex;
        align-items: center;
        gap: var(--ft-density-spacing-xs, 4px);
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .shell-breadcrumb__item {
        display: flex;
        align-items: center;
        gap: var(--ft-density-spacing-xs, 4px);
        font-size: var(--ft-density-font-sm, 0.875rem);
        color: var(--ft-text-secondary);
      }

      .shell-breadcrumb__item--current {
        font-weight: var(--ft-font-weight-semibold);
        color: var(--ft-text-primary);
      }

      .shell-breadcrumb__link {
        display: inline-flex;
        align-items: center;
        gap: var(--ft-density-spacing-xs, 4px);
        color: var(--ft-text-secondary);
        text-decoration: none;
        transition: color var(--ft-transition-fast);
      }

      .shell-breadcrumb__link:hover {
        color: var(--ft-accent-current, var(--ft-accent));
      }

      .shell-breadcrumb__text {
        display: inline-flex;
        align-items: center;
        gap: var(--ft-density-spacing-xs, 4px);
      }

      .shell-breadcrumb__icon {
        font-size: 1em;
        width: 1em;
        height: 1em;
        line-height: 1;
      }

      .shell-breadcrumb__sep {
        color: var(--ft-border-color);
        margin-inline: var(--ft-density-spacing-xs, 4px);
        user-select: none;
      }
    `,
  ],
})
export class ShellBreadcrumbComponent {
  protected readonly shell = inject(ShellStateService);
}
