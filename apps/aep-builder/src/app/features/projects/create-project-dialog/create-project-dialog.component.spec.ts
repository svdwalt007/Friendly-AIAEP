/**
 * @file CreateProjectDialogComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';

import { CreateProjectDialogComponent } from './create-project-dialog.component';
import {
  Project,
  ProjectService,
} from '../../../core/services/project.service';

type CreateProjectFn = (data: {
  name: string;
  description?: string;
  templateId?: string;
  deploymentMode?: string;
}) => Observable<Project>;

function build(
  createProject: CreateProjectFn,
  dialogClose: ReturnType<typeof vi.fn>,
): CreateProjectDialogComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CreateProjectDialogComponent, NoopAnimationsModule],
    providers: [
      { provide: ProjectService, useValue: { createProject } },
      { provide: MatDialogRef, useValue: { close: dialogClose } },
    ],
  });
  const fixture = TestBed.createComponent(CreateProjectDialogComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('CreateProjectDialogComponent', () => {
  let createProject: ReturnType<typeof vi.fn<CreateProjectFn>>;
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createProject = vi.fn<CreateProjectFn>();
    dialogClose = vi.fn();
  });

  it('blocks submission and shows an error when name is empty', () => {
    const comp = build(createProject, dialogClose);
    comp.onSubmit();
    expect(createProject).not.toHaveBeenCalled();
    expect(comp.error()).toBe('Project name is required');
  });

  it('also blocks submission when name is whitespace-only', () => {
    const comp = build(createProject, dialogClose);
    comp.name = '   ';
    comp.onSubmit();
    expect(createProject).not.toHaveBeenCalled();
    expect(comp.error()).toBe('Project name is required');
  });

  it('submits trimmed fields and closes the dialog with the created project', () => {
    const newProject: Project = {
      id: 'p-new',
      name: 'Acme IoT',
      description: 'desc',
      status: 'active',
      createdAt: '',
      updatedAt: '',
    };
    createProject.mockReturnValue(of(newProject));

    const comp = build(createProject, dialogClose);
    comp.name = '  Acme IoT  ';
    comp.description = '  desc  ';
    comp.deploymentMode = 'dedicated';
    comp.onSubmit();

    expect(createProject).toHaveBeenCalledWith({
      name: 'Acme IoT',
      description: 'desc',
      deploymentMode: 'dedicated',
    });
    expect(dialogClose).toHaveBeenCalledWith(newProject);
    expect(comp.loading()).toBe(false);
  });

  it('surfaces an API error message + clears loading on failure', () => {
    createProject.mockReturnValue(
      throwError(() => ({ error: { message: 'Quota exceeded' } })),
    );
    const comp = build(createProject, dialogClose);
    comp.name = 'X';
    comp.onSubmit();

    expect(comp.error()).toBe('Quota exceeded');
    expect(comp.loading()).toBe(false);
    expect(dialogClose).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the API error has no body', () => {
    createProject.mockReturnValue(throwError(() => new Error('boom')));
    const comp = build(createProject, dialogClose);
    comp.name = 'X';
    comp.onSubmit();
    expect(comp.error()).toBe('Failed to create project');
  });

  it('onCancel closes the dialog with no result', () => {
    const comp = build(createProject, dialogClose);
    comp.onCancel();
    expect(dialogClose).toHaveBeenCalledWith();
  });
});
