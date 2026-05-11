import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProjectService } from '../../../core/services/project.service';

@Component({
  selector: 'app-create-project-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressBarModule,
  ],
  templateUrl: './create-project-dialog.component.html',
  styleUrl: './create-project-dialog.component.scss',
})
export class CreateProjectDialogComponent {
  private dialogRef = inject(MatDialogRef<CreateProjectDialogComponent>);
  private projectService = inject(ProjectService);

  name = '';
  description = '';
  deploymentMode = 'saas';
  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.name.trim()) {
      this.error.set('Project name is required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.projectService
      .createProject({
        name: this.name.trim(),
        description: this.description.trim(),
        deploymentMode: this.deploymentMode,
      })
      .subscribe({
        next: (project) => {
          this.loading.set(false);
          this.dialogRef.close(project);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.message || 'Failed to create project');
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
