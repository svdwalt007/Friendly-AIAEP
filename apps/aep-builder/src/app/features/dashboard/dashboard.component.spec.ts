/**
 * @file DashboardComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import {
  ProjectService,
  ProjectListResponse,
} from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';

type ListProjectsFn = (
  limit?: number,
  offset?: number,
) => Observable<ProjectListResponse>;

function build(listProjects: ListProjectsFn): DashboardComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DashboardComponent, NoopAnimationsModule, RouterTestingModule],
    providers: [
      { provide: ProjectService, useValue: { listProjects } },
      { provide: AuthService, useValue: { user: () => null } },
    ],
  });
  const fixture = TestBed.createComponent(DashboardComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('DashboardComponent', () => {
  let listProjects: ReturnType<typeof vi.fn<ListProjectsFn>>;

  beforeEach(() => {
    listProjects = vi.fn<ListProjectsFn>();
  });

  it('starts with empty projects + loading=true', () => {
    listProjects.mockReturnValue(of({ projects: [], total: 0, limit: 5, offset: 0 }));
    const dash = build(listProjects);
    expect(dash.projects().length).toBe(0);
  });

  it('loads projects on init and writes the total into the first metric', () => {
    listProjects.mockReturnValue(
      of({
        projects: [
          {
            id: 'p1',
            name: 'A',
            description: '',
            status: 'active',
            createdAt: '',
            updatedAt: '',
          },
        ],
        total: 17,
        limit: 5,
        offset: 0,
      }),
    );
    const dash = build(listProjects);
    expect(listProjects).toHaveBeenCalledWith(5, 0);
    expect(dash.projects().length).toBe(1);
    expect(dash.metrics[0].value).toBe('17');
    expect(dash.loading()).toBe(false);
  });

  it('clears the loading flag even when the project listing fails', () => {
    listProjects.mockReturnValue(throwError(() => new Error('boom')));
    const dash = build(listProjects);
    expect(dash.loading()).toBe(false);
    expect(dash.projects().length).toBe(0);
  });

  it('renders the four documented metric cards', () => {
    listProjects.mockReturnValue(of({ projects: [], total: 0, limit: 5, offset: 0 }));
    const dash = build(listProjects);
    expect(dash.metrics.map((m) => m.label)).toEqual([
      'Total Projects',
      'Active Previews',
      'AI Sessions',
      'Devices Connected',
    ]);
  });
});
