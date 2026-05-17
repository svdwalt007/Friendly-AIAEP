/**
 * Typed fixture providing mock Build.diff data for the diff review screen (B4).
 * Replace with real API data when the backend diff endpoint is available.
 */
import { FileDiff } from '../../shared/components/code-diff-viewer/code-diff-viewer.component';

export const BUILD_DIFF_FIXTURE: FileDiff[] = [
  {
    fileName: 'src/app/components/dashboard/dashboard.component.ts',
    language: 'typescript',
    lines: [
      { type: 'unchanged', lineNumber: 1,  content: "import { Component, OnInit } from '@angular/core';" },
      { type: 'add',       lineNumber: 2,  content: "import { MatCardModule } from '@angular/material/card';" },
      { type: 'add',       lineNumber: 3,  content: "import { DeviceMetricsService } from '../../core/services/device-metrics.service';" },
      { type: 'unchanged', lineNumber: 4,  content: '' },
      { type: 'remove',    lineNumber: 5,  content: 'export class DashboardComponent {' },
      { type: 'add',       lineNumber: 5,  content: 'export class DashboardComponent implements OnInit {' },
      { type: 'unchanged', lineNumber: 6,  content: '  title = "IoT Dashboard";' },
      { type: 'add',       lineNumber: 7,  content: '  readonly metrics = inject(DeviceMetricsService);' },
      { type: 'add',       lineNumber: 8,  content: '' },
      { type: 'add',       lineNumber: 9,  content: '  ngOnInit(): void {' },
      { type: 'add',       lineNumber: 10, content: "    this.metrics.load();" },
      { type: 'add',       lineNumber: 11, content: '  }' },
      { type: 'unchanged', lineNumber: 12, content: '}' },
    ],
  },
  {
    fileName: 'src/app/components/dashboard/dashboard.component.html',
    language: 'html',
    lines: [
      { type: 'remove',    lineNumber: 1, content: '<div class="dashboard">' },
      { type: 'add',       lineNumber: 1, content: '<div class="dashboard" role="main" aria-label="IoT Dashboard">' },
      { type: 'unchanged', lineNumber: 2, content: '  <h1>Dashboard</h1>' },
      { type: 'remove',    lineNumber: 3, content: '  <p>No devices connected.</p>' },
      { type: 'add',       lineNumber: 3, content: '  @if (metrics.loading()) {' },
      { type: 'add',       lineNumber: 4, content: '    <mat-progress-bar mode="indeterminate"></mat-progress-bar>' },
      { type: 'add',       lineNumber: 5, content: '  } @else {' },
      { type: 'add',       lineNumber: 6, content: '    <app-device-grid [devices]="metrics.devices()"></app-device-grid>' },
      { type: 'add',       lineNumber: 7, content: '  }' },
      { type: 'unchanged', lineNumber: 8, content: '</div>' },
    ],
  },
  {
    fileName: 'src/app/core/services/device-metrics.service.ts',
    language: 'typescript',
    lines: [
      { type: 'add', lineNumber: 1,  content: "import { Injectable, signal } from '@angular/core';" },
      { type: 'add', lineNumber: 2,  content: "import { HttpClient } from '@angular/common/http';" },
      { type: 'add', lineNumber: 3,  content: "import { Device } from '../models/device.model';" },
      { type: 'add', lineNumber: 4,  content: '' },
      { type: 'add', lineNumber: 5,  content: "@Injectable({ providedIn: 'root' })" },
      { type: 'add', lineNumber: 6,  content: 'export class DeviceMetricsService {' },
      { type: 'add', lineNumber: 7,  content: '  readonly devices = signal<Device[]>([]);' },
      { type: 'add', lineNumber: 8,  content: '  readonly loading = signal(false);' },
      { type: 'add', lineNumber: 9,  content: '' },
      { type: 'add', lineNumber: 10, content: '  constructor(private http: HttpClient) {}' },
      { type: 'add', lineNumber: 11, content: '' },
      { type: 'add', lineNumber: 12, content: '  load(): void {' },
      { type: 'add', lineNumber: 13, content: "    this.loading.set(true);" },
      { type: 'add', lineNumber: 14, content: "    this.http.get<Device[]>('/api/v1/devices').subscribe({" },
      { type: 'add', lineNumber: 15, content: '      next: (d) => { this.devices.set(d); this.loading.set(false); },' },
      { type: 'add', lineNumber: 16, content: '      error: () => this.loading.set(false),' },
      { type: 'add', lineNumber: 17, content: '    });' },
      { type: 'add', lineNumber: 18, content: '  }' },
      { type: 'add', lineNumber: 19, content: '}' },
    ],
  },
  {
    fileName: 'src/styles/dashboard.scss',
    language: 'scss',
    lines: [
      { type: 'unchanged', lineNumber: 1, content: '.dashboard {' },
      { type: 'unchanged', lineNumber: 2, content: '  padding: var(--ft-spacing-lg);' },
      { type: 'add',       lineNumber: 3, content: '  display: grid;' },
      { type: 'add',       lineNumber: 4, content: '  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));' },
      { type: 'add',       lineNumber: 5, content: '  gap: var(--ft-spacing-md);' },
      { type: 'remove',    lineNumber: 3, content: '  max-width: 960px;' },
      { type: 'unchanged', lineNumber: 6, content: '}' },
    ],
  },
];
