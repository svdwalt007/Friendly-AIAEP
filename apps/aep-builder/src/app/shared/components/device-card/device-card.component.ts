/**
 * @file DeviceCardComponent — compact card showing device identity and telemetry state.
 * Standalone, signals-based (Angular 17+).
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

export interface DeviceCardData {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'unknown';
  battery: number;   // 0–100
  signal: number;    // 0–100
  lastSeen: string;  // ISO 8601
}

@Component({
  selector: 'app-device-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  template: `
    <article
      class="device-card"
      [class.device-card--clickable]="true"
      (click)="select.emit(device())"
      (keydown.enter)="select.emit(device())"
      (keydown.space)="select.emit(device())"
      tabindex="0"
      [attr.aria-label]="'Device ' + device().name"
      role="button"
    >
      <header class="device-card__header">
        <span class="device-card__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
            <line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </span>
        <div class="device-card__title-group">
          <span class="device-card__name">{{ device().name }}</span>
          <span class="device-card__id">{{ device().id }}</span>
        </div>
        <app-status-badge [status]="device().status" />
      </header>

      <dl class="device-card__metrics">
        <div class="device-card__metric">
          <dt class="device-card__metric-label">Battery</dt>
          <dd class="device-card__metric-value">
            <span class="device-card__bar-wrap" aria-hidden="true">
              <span
                class="device-card__bar"
                [class.device-card__bar--low]="device().battery < 20"
                [style.width.%]="device().battery"
              ></span>
            </span>
            <span>{{ device().battery }}%</span>
          </dd>
        </div>

        <div class="device-card__metric">
          <dt class="device-card__metric-label">Signal</dt>
          <dd class="device-card__metric-value">
            <span class="device-card__bar-wrap" aria-hidden="true">
              <span
                class="device-card__bar"
                [style.width.%]="device().signal"
              ></span>
            </span>
            <span>{{ device().signal }}%</span>
          </dd>
        </div>
      </dl>

      <footer class="device-card__footer">
        <span class="device-card__last-seen">Last seen {{ formatRelative(device().lastSeen) }}</span>
      </footer>
    </article>
  `,
  styles: [`
    .device-card {
      background: var(--ft-surface-primary);
      border: 1px solid var(--ft-border-color);
      border-radius: var(--ft-radius-lg);
      padding: 16px;
      box-shadow: var(--ft-shadow-md);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
      outline: none;
    }

    .device-card--clickable {
      cursor: pointer;
    }

    .device-card--clickable:hover {
      box-shadow: var(--ft-elevation-3, 0 10px 20px rgba(0,0,0,.1));
      transform: translateY(-1px);
    }

    .device-card--clickable:focus-visible {
      box-shadow: var(--ft-focus-ring, 0 0 0 3px rgba(33,150,243,.3));
    }

    .device-card__header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .device-card__icon {
      color: var(--ft-text-secondary);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .device-card__title-group {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .device-card__name {
      font-size: var(--ft-font-size-sm, 0.875rem);
      font-weight: var(--ft-font-weight-semibold, 600);
      color: var(--ft-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .device-card__id {
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
      font-family: var(--ft-font-family-mono, monospace);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .device-card__metrics {
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .device-card__metric {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .device-card__metric-label {
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
      width: 48px;
      flex-shrink: 0;
    }

    .device-card__metric-value {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-primary);
      margin: 0;
    }

    .device-card__bar-wrap {
      flex: 1;
      height: 6px;
      background: var(--ft-surface-tertiary, var(--ft-neutral-200, #eee));
      border-radius: var(--ft-radius-pill, 9999px);
      overflow: hidden;
    }

    .device-card__bar {
      display: block;
      height: 100%;
      background: var(--ft-primary, #1e88e5);
      border-radius: var(--ft-radius-pill, 9999px);
      transition: width 0.3s ease;
    }

    .device-card__bar--low {
      background: var(--ft-error, #f44336);
    }

    .device-card__footer {
      border-top: 1px solid var(--ft-border-light, var(--ft-border-color));
      padding-top: 8px;
    }

    .device-card__last-seen {
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
    }
  `],
})
export class DeviceCardComponent {
  device = input.required<DeviceCardData>();
  select = output<DeviceCardData>();

  formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }
}
