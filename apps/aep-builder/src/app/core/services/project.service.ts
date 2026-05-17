import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  deploymentMode?: string;
  createdAt: string;
  updatedAt: string;
  pages?: unknown[];
  dataSourceCount?: number;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private projectsSignal = signal<Project[]>([]);
  private loadingSignal = signal(false);

  readonly projects = this.projectsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  constructor(private http: HttpClient) {}

  listProjects(limit = 20, offset = 0): Observable<ProjectListResponse> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    this.loadingSignal.set(true);
    return this.http
      .get<ProjectListResponse>(`${environment.apiUrl}/api/v1/projects`, { params })
      .pipe(
        tap((response) => {
          this.projectsSignal.set(response.projects);
          this.loadingSignal.set(false);
        })
      );
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${environment.apiUrl}/api/v1/projects/${id}`);
  }

  createProject(data: { name: string; description?: string; templateId?: string; deploymentMode?: string }): Observable<Project> {
    return this.http.post<Project>(`${environment.apiUrl}/api/v1/projects`, data);
  }

  sendPrompt(projectId: string, prompt: string, context?: Record<string, unknown>): Observable<{ sessionId: string; status: string; message: string }> {
    return this.http.post<{ sessionId: string; status: string; message: string }>(
      `${environment.apiUrl}/api/v1/projects/${projectId}/agent`,
      { prompt, context }
    );
  }
}
