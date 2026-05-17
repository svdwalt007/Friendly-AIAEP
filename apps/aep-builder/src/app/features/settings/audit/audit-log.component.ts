/**
 * @file AuditLogComponent — B7 workspace surface.
 * Child route: /settings/audit
 * Shows paginated, filterable, sortable audit events.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import {
  AuditEvent,
  AuditAction,
  AuditStatus,
  AUDIT_LOG_FIXTURE,
} from './audit-log.fixture';

type SortField = 'timestamp' | 'user' | 'action' | 'status';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.scss',
})
export class AuditLogComponent {
  readonly allEvents: AuditEvent[] = AUDIT_LOG_FIXTURE;

  /** Unique action types for the filter dropdown */
  readonly actionOptions: Array<{ value: AuditAction | 'all'; label: string }> = [
    { value: 'all',               label: 'All actions' },
    { value: 'login',             label: 'Login' },
    { value: 'logout',            label: 'Logout' },
    { value: 'project.created',   label: 'Project created' },
    { value: 'project.deleted',   label: 'Project deleted' },
    { value: 'page.saved',        label: 'Page saved' },
    { value: 'deploy.triggered',  label: 'Deploy triggered' },
    { value: 'deploy.completed',  label: 'Deploy completed' },
    { value: 'deploy.failed',     label: 'Deploy failed' },
    { value: 'settings.changed',  label: 'Settings changed' },
    { value: 'api_key.rotated',   label: 'API key rotated' },
    { value: 'user.invited',      label: 'User invited' },
    { value: 'user.removed',      label: 'User removed' },
  ];

  readonly columns = ['timestamp', 'user', 'action', 'resource', 'status'];

  readonly filterAction = signal<AuditAction | 'all'>('all');
  readonly sortField = signal<SortField>('timestamp');
  readonly sortDir = signal<SortDir>('desc');

  readonly filteredEvents = computed(() => {
    const action = this.filterAction();
    const field = this.sortField();
    const dir = this.sortDir();

    const filtered =
      action === 'all'
        ? [...this.allEvents]
        : this.allEvents.filter((e) => e.action === action);

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case 'timestamp': cmp = a.timestamp.localeCompare(b.timestamp); break;
        case 'user':      cmp = a.user.localeCompare(b.user); break;
        case 'action':    cmp = a.action.localeCompare(b.action); break;
        case 'status':    cmp = a.status.localeCompare(b.status); break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  });

  onSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'timestamp' ? 'desc' : 'asc');
    }
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'expand_less' : 'expand_more';
  }

  statusIcon(status: AuditStatus): string {
    switch (status) {
      case 'success': return 'check_circle';
      case 'failure': return 'error';
      case 'pending': return 'schedule';
    }
  }

  statusClass(status: AuditStatus): string {
    switch (status) {
      case 'success': return 'status-success';
      case 'failure': return 'status-failure';
      case 'pending': return 'status-pending';
    }
  }

  actionLabel(action: AuditAction): string {
    return this.actionOptions.find((o) => o.value === action)?.label ?? action;
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('en-AU', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  }
}
