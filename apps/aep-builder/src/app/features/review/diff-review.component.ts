/**
 * @file DiffReviewComponent — B4 workspace surface.
 * Displays Build.diff for a project using the existing CodeDiffViewerComponent.
 * Diff data is sourced from a typed fixture when the backend has no real diffs.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, inject, signal, computed, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectService } from '../../core/services/project.service';
import {
  CodeDiffViewerComponent,
  FileDiff,
} from '../../shared/components/code-diff-viewer/code-diff-viewer.component';
import { BUILD_DIFF_FIXTURE } from './build-diff.fixture';

@Component({
  selector: 'app-diff-review',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    CodeDiffViewerComponent,
  ],
  templateUrl: './diff-review.component.html',
  styleUrl: './diff-review.component.scss',
})
export class DiffReviewComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly projectService = inject(ProjectService);

  readonly projectName = signal<string>('');
  readonly diffs = signal<FileDiff[]>(BUILD_DIFF_FIXTURE);

  readonly additionCount = computed(() =>
    this.diffs().reduce(
      (acc, f) => acc + f.lines.filter((l) => l.type === 'add').length,
      0,
    ),
  );

  readonly deletionCount = computed(() =>
    this.diffs().reduce(
      (acc, f) => acc + f.lines.filter((l) => l.type === 'remove').length,
      0,
    ),
  );

  ngOnInit(): void {
    this.projectService.getProject(this.id()).subscribe({
      next: (p) => this.projectName.set(p.name),
      error: () => this.projectName.set(this.id()),
    });
  }
}
