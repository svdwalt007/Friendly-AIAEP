/**
 * @file ProjectListComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, Subject, throwError } from 'rxjs';

import { ProjectListComponent } from './project-list.component';
import {
  ProjectService,
  ProjectListResponse,
  Project,
} from '../../../core/services/project.service';

type ListProjectsFn = (
  limit?: number,
  offset?: number,
) => Observable<ProjectListResponse>;

const makeProject = (id: string): Project => ({
  id,
  name: `Project ${id}`,
  description: '',
  status: 'active',
  createdAt: '',
  updatedAt: '',
});

function build(
  listProjects: ListProjectsFn,
  dialog: { open: ReturnType<typeof vi.fn> },
): ProjectListComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ProjectListComponent, NoopAnimationsModule, RouterTestingModule],
    providers: [{ provide: ProjectService, useValue: { listProjects } }],
  });
  // Component imports MatDialogModule which re-provides the real MatDialog;
  // overrideProvider AFTER module config replaces it with our fake.
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  const fixture = TestBed.createComponent(ProjectListComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('ProjectListComponent', () => {
  let listProjects: ReturnType<typeof vi.fn<ListProjectsFn>>;
  let dialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    listProjects = vi.fn<ListProjectsFn>();
    dialog = { open: vi.fn() };
  });

  it('loads projects on init with limit=50, offset=0', () => {
    listProjects.mockReturnValue(
      of({ projects: [makeProject('a')], total: 1, limit: 50, offset: 0 }),
    );
    const comp = build(listProjects, dialog);
    expect(listProjects).toHaveBeenCalledWith(50, 0);
    expect(comp.projects()).toHaveLength(1);
    expect(comp.loading()).toBe(false);
  });

  it('clears loading on error and leaves the project list empty', () => {
    listProjects.mockReturnValue(throwError(() => new Error('boom')));
    const comp = build(listProjects, dialog);
    expect(comp.loading()).toBe(false);
    expect(comp.projects()).toEqual([]);
  });

  it('opens the create dialog with the 480px width', () => {
    listProjects.mockReturnValue(of({ projects: [], total: 0, limit: 50, offset: 0 }));
    dialog.open.mockReturnValue({
      afterClosed: () => of(null),
    });
    const comp = build(listProjects, dialog);
    comp.openCreateDialog();
    expect(dialog.open).toHaveBeenCalledOnce();
    const [, config] = dialog.open.mock.calls[0];
    expect(config.width).toBe('480px');
  });

  it('reloads projects only when the dialog returns a result', () => {
    listProjects.mockReturnValue(of({ projects: [], total: 0, limit: 50, offset: 0 }));
    dialog.open.mockReturnValue({
      afterClosed: () => of(null), // dialog cancelled
    });
    const comp = build(listProjects, dialog);
    listProjects.mockClear();
    comp.openCreateDialog();
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('reloads projects when the dialog returns a created project', () => {
    listProjects.mockReturnValue(of({ projects: [], total: 0, limit: 50, offset: 0 }));
    const closed = new Subject<Project | null>();
    dialog.open.mockReturnValue({ afterClosed: () => closed.asObservable() });

    const comp = build(listProjects, dialog);
    listProjects.mockClear();
    comp.openCreateDialog();
    closed.next(makeProject('new'));
    expect(listProjects).toHaveBeenCalledWith(50, 0);
  });
});
