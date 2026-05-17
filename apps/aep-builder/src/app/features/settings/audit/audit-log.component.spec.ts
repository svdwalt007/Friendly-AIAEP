import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditLogComponent } from './audit-log.component';

describe('AuditLogComponent', () => {
  let component: AuditLogComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [provideNoopAnimations()],
    });
    component = TestBed.createComponent(AuditLogComponent).componentInstance;
  });

  it('default sort is timestamp desc, filter is "all"', () => {
    expect(component.sortField()).toBe('timestamp');
    expect(component.sortDir()).toBe('desc');
    expect(component.filterAction()).toBe('all');
    expect(component.filteredEvents().length).toBe(component.allEvents.length);
  });

  it('filters to a single action when one is selected', () => {
    component.filterAction.set('login');
    expect(component.filteredEvents().every((e) => e.action === 'login')).toBe(
      true,
    );
  });

  it('onSort toggles direction when clicking the same field', () => {
    component.sortField.set('user');
    component.sortDir.set('asc');
    component.onSort('user');
    expect(component.sortDir()).toBe('desc');
    component.onSort('user');
    expect(component.sortDir()).toBe('asc');
  });

  it('onSort to a new field defaults dir to asc (or desc for timestamp)', () => {
    component.sortField.set('timestamp');
    component.onSort('user');
    expect(component.sortField()).toBe('user');
    expect(component.sortDir()).toBe('asc');

    component.onSort('timestamp');
    expect(component.sortField()).toBe('timestamp');
    expect(component.sortDir()).toBe('desc');
  });

  it('sortIcon returns expand_more for active-desc, expand_less for active-asc', () => {
    component.sortField.set('user');
    component.sortDir.set('desc');
    expect(component.sortIcon('user')).toBe('expand_more');
    component.sortDir.set('asc');
    expect(component.sortIcon('user')).toBe('expand_less');
    expect(component.sortIcon('action')).toBe('unfold_more');
  });

  it.each([
    ['success', 'check_circle', 'status-success'],
    ['failure', 'error', 'status-failure'],
    ['pending', 'schedule', 'status-pending'],
  ] as const)('maps status %s → icon %s / class %s', (status, icon, klass) => {
    expect(component.statusIcon(status)).toBe(icon);
    expect(component.statusClass(status)).toBe(klass);
  });

  it('actionLabel returns the human label for known actions', () => {
    expect(component.actionLabel('project.created')).toBe('Project created');
  });

  it('actionLabel falls back to raw action when not in options', () => {
    expect(component.actionLabel('unknown.action' as never)).toBe(
      'unknown.action',
    );
  });

  it('formatTimestamp produces a non-empty locale string', () => {
    const formatted = component.formatTimestamp('2026-05-11T07:02:14Z');
    expect(formatted).toMatch(/2026|11/);
  });

  it('sort by user asc orders alphabetically', () => {
    component.sortField.set('user');
    component.sortDir.set('asc');
    const users = component.filteredEvents().map((e) => e.user);
    expect(users).toEqual([...users].sort());
  });

  it('sort by status desc reverses the ascending order', () => {
    component.sortField.set('status');
    component.sortDir.set('asc');
    const asc = component.filteredEvents().map((e) => e.status);
    component.sortDir.set('desc');
    const desc = component.filteredEvents().map((e) => e.status);
    expect(desc).toEqual([...asc].reverse());
  });
});
