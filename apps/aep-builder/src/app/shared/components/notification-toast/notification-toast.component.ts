import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

type ToastType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast" [class]="'toast--' + type()" (click)="dismiss.emit()">
      <span class="icon">{{ icon }}</span>
      <span class="message">{{ message() }}</span>
      <button class="close" (click)="dismiss.emit(); $event.stopPropagation()">×</button>
    </div>
  `,
  styles: [`
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--ft-radius-md);
      background: var(--ft-surface-primary);
      border: 1px solid var(--ft-border-default);
      box-shadow: var(--ft-shadow-md);
      cursor: pointer;
      min-width: 280px;
    }
    .icon { font-size: 18px; flex-shrink: 0; }
    .message { flex: 1; font-size: var(--ft-text-sm); }
    .close {
      background: none; border: none; font-size: 18px; cursor: pointer;
      color: var(--ft-text-muted); padding: 0 4px;
    }
    .toast--success { border-left: 4px solid var(--ft-status-online-dot); }
    .toast--error   { border-left: 4px solid var(--ft-status-error-dot); }
    .toast--warning { border-left: 4px solid var(--ft-status-warning-dot); }
    .toast--info    { border-left: 4px solid var(--ft-accent-primary); }
  `],
})
export class NotificationToastComponent {
  message = input.required<string>();
  type = input<ToastType>('info');
  dismiss = output<void>();

  get icon(): string {
    const map: Record<ToastType, string> = {
      success: '✓',
      error: '✕',
      warning: '▲',
      info: 'ℹ',
    };
    return map[this.type()];
  }
}
