/**
 * @file DiffReviewComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';

import { DiffReviewComponent } from './diff-review.component';
import { ProjectService, Project } from '../../core/services/project.service';
import { BUILD_DIFF_FIXTURE } from './build-diff.fixture';

type GetProjectFn = (id: string) => Observable<Project>;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-9',
    name: 'Helios Energy',
    description: 'IoT energy fleet',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function createFixture(
  getProject: GetProjectFn,
  id = 'proj-9',
): ComponentFixture<DiffReviewComponent> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiffReviewComponent, NoopAnimationsModule, RouterTestingModule],
    providers: [{ provide: ProjectService, useValue: { getProject } }],
  });
  const fixture = TestBed.createComponent(DiffReviewComponent);
  fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  return fixture;
}

describe('DiffReviewComponent', () => {
  let getProjectSpy: ReturnType<typeof vi.fn<GetProjectFn>>;

  beforeEach(() => {
    getProjectSpy = vi.fn<GetProjectFn>();
  });

  it('initialises diffs from the fixture', () => {
    getProjectSpy.mockReturnValue(of(makeProject()));
    const fixture = createFixture(getProjectSpy);
    expect(fixture.componentInstance.diffs()).toBe(BUILD_DIFF_FIXTURE);
  });

  it('loads the project name on init when the service resolves', () => {
    getProjectSpy.mockReturnValue(of(makeProject({ name: 'Helios Energy' })));
    const fixture = createFixture(getProjectSpy, 'proj-9');

    expect(getProjectSpy).toHaveBeenCalledWith('proj-9');
    expect(fixture.componentInstance.projectName()).toBe('Helios Energy');
  });

  it('falls back to the id when the project lookup fails', () => {
    getProjectSpy.mockReturnValue(throwError(() => new Error('boom')));
    const fixture = createFixture(getProjectSpy, 'proj-404');

    expect(fixture.componentInstance.projectName()).toBe('proj-404');
  });

  it('counts additions across all files in the fixture', () => {
    getProjectSpy.mockReturnValue(of(makeProject()));
    const fixture = createFixture(getProjectSpy);

    const expected = BUILD_DIFF_FIXTURE.reduce(
      (acc, f) => acc + f.lines.filter((l) => l.type === 'add').length,
      0,
    );
    expect(fixture.componentInstance.additionCount()).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('counts deletions across all files in the fixture', () => {
    getProjectSpy.mockReturnValue(of(makeProject()));
    const fixture = createFixture(getProjectSpy);

    const expected = BUILD_DIFF_FIXTURE.reduce(
      (acc, f) => acc + f.lines.filter((l) => l.type === 'remove').length,
      0,
    );
    expect(fixture.componentInstance.deletionCount()).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('reports zero additions and deletions when diffs are empty', () => {
    getProjectSpy.mockReturnValue(of(makeProject()));
    const fixture = createFixture(getProjectSpy);

    fixture.componentInstance.diffs.set([]);
    expect(fixture.componentInstance.additionCount()).toBe(0);
    expect(fixture.componentInstance.deletionCount()).toBe(0);
  });

  it('renders the header with stat counts in the DOM', () => {
    getProjectSpy.mockReturnValue(of(makeProject({ name: 'Helios Energy' })));
    const fixture = createFixture(getProjectSpy);

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.review-header')).toBeTruthy();
    const additions = host.querySelector('.stat.additions')?.textContent ?? '';
    expect(additions).toContain(`+${fixture.componentInstance.additionCount()}`);
    const deletions = host.querySelector('.stat.deletions')?.textContent ?? '';
    expect(deletions).toContain(`${fixture.componentInstance.deletionCount()}`);
    expect(host.querySelector('.header-project')?.textContent).toContain(
      'Helios Energy',
    );
  });
});
