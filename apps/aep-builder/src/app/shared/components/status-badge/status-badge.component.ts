import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

type BadgeStatus = 'online' | 'offline' | 'warning' | 'error' | 'unknown';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [class]="'badge--' + status()">
      <span class="dot"></span>
      <span class="label">{{ label() || (status() | titlecase) }}</span>
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: var(--ft-radius-full);
      font-size: var(--ft-text-xs);
      font-weight: 500;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .badge--online  { background: var(--ft-status-online-bg);  color: var(--ft-status-online-text); }
    .badge--online .dot  { background: var(--ft-status-online-dot); }
    .badge--offline { background: var(--ft-status-offline-bg); color: var(--ft-status-offline-text); }
    .badge--offline .dot { background: var(--ft-status-offline-dot); }
    .badge--warning { background: var(--ft-status-warning-bg); color: var(--ft-status-warning-text); }
    .badge--warning .dot { background: var(--ft-status-warning-dot); }
    .badge--error   { background: var(--ft-status-error-bg);   color: var(--ft-status-error-text); }
    .badge--error .dot   { background: var(--ft-status-error-dot); }
    .badge--unknown { background: var(--ft-surface-secondary); color: var(--ft-text-secondary); }
    .badge--unknown .dot { background: var(--ft-text-muted); }
  `],
})
export class StatusBadgeComponent {
  status = input<BadgeStatus>('unknown');
  label = input<string>('');
}
