/**
 * @file Shell Context — reactive tenant / project state for the AEP v2 editorial chrome.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Injectable, signal, computed } from '@angular/core';

/**
 * Tenant entity surfaced in the top-bar identity region.
 */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly logoUrl?: string | null;
}

/**
 * Project entity surfaced in breadcrumbs and the project switcher.
 */
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly tenantId: string;
}

/**
 * Breadcrumb node used by the editorial chrome trail.
 */
export interface BreadcrumbNode {
  readonly label: string;
  readonly route?: string | null;
  readonly icon?: string | null;
}

/**
 * ShellStateService
 *
 * Central reactive store for the authenticated editorial chrome.
 * Consumers (shell components, breadcrumb bar, project switcher)
 * read from readonly signals; feature pages or resolvers push updates.
 *
 * @example
 * shellState.setTenant({ id: 't-42', name: 'Friendly Technologies' });
 * shellState.setProject({ id: 'p-7', name: 'NB-IoT Gateway', tenantId: 't-42' });
 * shellState.setBreadcrumbs([
 *   { label: 'Projects', route: '/projects', icon: 'folder' },
 *   { label: 'NB-IoT Gateway' },
 * ]);
 */
@Injectable({ providedIn: 'root' })
export class ShellStateService {
  private readonly tenantSignal = signal<Tenant | null>(null);
  private readonly projectSignal = signal<Project | null>(null);
  private readonly breadcrumbsSignal = signal<readonly BreadcrumbNode[]>([]);
  private readonly railCollapsedSignal = signal<boolean>(false);

  /** Currently active tenant; null when unauthenticated or multi-tenant mode. */
  readonly tenant = this.tenantSignal.asReadonly();

  /** Currently active project; null outside project-scoped routes. */
  readonly project = this.projectSignal.asReadonly();

  /** Ordered breadcrumb trail for the current route. */
  readonly breadcrumbs = this.breadcrumbsSignal.asReadonly();

  /** Whether the left rail is in collapsed (icon-only) mode. */
  readonly railCollapsed = this.railCollapsedSignal.asReadonly();

  /** True when a project is actively selected. */
  readonly hasProject = computed(() => this.projectSignal() !== null);

  /** True when a tenant is actively resolved. */
  readonly hasTenant = computed(() => this.tenantSignal() !== null);

  /** Label for the active project, or a safe fallback. */
  readonly projectLabel = computed<string>(
    () => this.projectSignal()?.name ?? '',
  );

  /** Label for the active tenant, or a safe fallback. */
  readonly tenantLabel = computed<string>(
    () => this.tenantSignal()?.name ?? '',
  );

  /** The effective page title derived from the last breadcrumb node. */
  readonly pageTitle = computed<string | null>(() => {
    const trail = this.breadcrumbsSignal();
    return trail.length > 0 ? trail[trail.length - 1].label : null;
  });

  setTenant(tenant: Tenant | null): void {
    this.tenantSignal.set(tenant);
  }

  setProject(project: Project | null): void {
    this.projectSignal.set(project);
  }

  setBreadcrumbs(nodes: readonly BreadcrumbNode[]): void {
    this.breadcrumbsSignal.set(nodes);
  }

  pushBreadcrumb(node: BreadcrumbNode): void {
    this.breadcrumbsSignal.update((prev) => [...prev, node]);
  }

  popBreadcrumb(): BreadcrumbNode | null {
    let removed: BreadcrumbNode | null = null;
    this.breadcrumbsSignal.update((prev) => {
      if (prev.length === 0) return prev;
      removed = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return removed;
  }

  clearBreadcrumbs(): void {
    this.breadcrumbsSignal.set([]);
  }

  toggleRail(): void {
    this.railCollapsedSignal.update((v) => !v);
  }

  setRailCollapsed(collapsed: boolean): void {
    this.railCollapsedSignal.set(collapsed);
  }

  reset(): void {
    this.tenantSignal.set(null);
    this.projectSignal.set(null);
    this.breadcrumbsSignal.set([]);
    this.railCollapsedSignal.set(false);
  }
}
