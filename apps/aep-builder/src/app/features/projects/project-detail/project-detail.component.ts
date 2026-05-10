import { Component, inject, OnInit, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ProjectService,
  Project,
} from '../../../core/services/project.service';
import { ShellStateService } from '@friendly-tech/ui/iot-ui';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss',
})
export class ProjectDetailComponent implements OnInit {
  private projectService = inject(ProjectService);
  private shellState = inject(ShellStateService);

  id = input.required<string>();
  project = signal<Project | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.projectService.getProject(this.id()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loading.set(false);
        // Bind shell state to current project context
        this.shellState.setProject({
          id: project.id,
          name: project.name,
          tenantId: project.id, // Best effort; backend does not expose tenantId on Project yet
        });
        this.shellState.pushBreadcrumb({
          label: project.name,
          route: null,
          icon: null,
        });
      },
      error: () => this.loading.set(false),
    });
  }
}
