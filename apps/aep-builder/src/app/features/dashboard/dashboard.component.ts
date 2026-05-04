import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectService, Project } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';

interface MetricCard {
  label: string;
  value: string;
  icon: string;
  change?: string;
  positive?: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  authService = inject(AuthService);

  projects = signal<Project[]>([]);
  loading = signal(true);

  metrics: MetricCard[] = [
    { label: 'Total Projects', value: '0', icon: 'folder', change: '+2 this week', positive: true },
    { label: 'Active Previews', value: '0', icon: 'visibility', change: 'None running', positive: true },
    { label: 'AI Sessions', value: '0', icon: 'smart_toy', change: 'This month', positive: true },
    { label: 'Devices Connected', value: '0', icon: 'devices_other', change: 'Online', positive: true },
  ];

  ngOnInit(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.projectService.listProjects(5, 0).subscribe({
      next: (response) => {
        this.projects.set(response.projects);
        this.metrics[0].value = String(response.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
