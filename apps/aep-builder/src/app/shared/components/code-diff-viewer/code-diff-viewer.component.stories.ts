import type { Meta, StoryObj } from '@storybook/angular';
import { CodeDiffViewerComponent, FileDiff } from './code-diff-viewer.component';

const sampleDiffs: FileDiff[] = [
  {
    fileName: 'src/app/components/dashboard.component.ts',
    language: 'typescript',
    lines: [
      { type: 'unchanged', lineNumber: 1, content: "import { Component } from '@angular/core';" },
      { type: 'add', lineNumber: 2, content: "import { MatCardModule } from '@angular/material/card';" },
      { type: 'add', lineNumber: 3, content: "import { ChartModule } from './chart/chart.module';" },
      { type: 'unchanged', lineNumber: 4, content: '' },
      { type: 'unchanged', lineNumber: 5, content: '@Component({' },
      { type: 'unchanged', lineNumber: 6, content: "  selector: 'app-dashboard'," },
      { type: 'remove', lineNumber: 7, content: "  templateUrl: './dashboard.component.html'" },
      { type: 'add', lineNumber: 7, content: "  templateUrl: './dashboard.component.html'," },
      { type: 'add', lineNumber: 8, content: "  styleUrls: ['./dashboard.component.scss']" },
      { type: 'unchanged', lineNumber: 9, content: '})' },
      { type: 'remove', lineNumber: 10, content: 'export class DashboardComponent {' },
      { type: 'add', lineNumber: 10, content: 'export class DashboardComponent implements OnInit {' },
      { type: 'add', lineNumber: 11, content: '  constructor(private dataService: DataService) {}' },
      { type: 'add', lineNumber: 12, content: '' },
      { type: 'add', lineNumber: 13, content: '  ngOnInit(): void {' },
      { type: 'add', lineNumber: 14, content: "    console.log('Dashboard initialized');" },
      { type: 'add', lineNumber: 15, content: '  }' },
      { type: 'unchanged', lineNumber: 16, content: '}' },
    ],
  },
  {
    fileName: 'src/app/components/dashboard.component.html',
    language: 'html',
    lines: [
      { type: 'unchanged', lineNumber: 1, content: '<div class="dashboard">' },
      { type: 'remove', lineNumber: 2, content: '  <h1>Dashboard</h1>' },
      { type: 'add', lineNumber: 2, content: '  <mat-card>' },
      { type: 'add', lineNumber: 3, content: '    <mat-card-header>' },
      { type: 'add', lineNumber: 4, content: '      <mat-card-title>Dashboard</mat-card-title>' },
      { type: 'add', lineNumber: 5, content: '    </mat-card-header>' },
      { type: 'add', lineNumber: 6, content: '    <mat-card-content>' },
      { type: 'add', lineNumber: 7, content: '      <app-chart></app-chart>' },
      { type: 'add', lineNumber: 8, content: '    </mat-card-content>' },
      { type: 'add', lineNumber: 9, content: '  </mat-card>' },
      { type: 'unchanged', lineNumber: 10, content: '</div>' },
    ],
  },
];

const meta: Meta<CodeDiffViewerComponent> = {
  title: 'Components/Code Diff Viewer',
  component: CodeDiffViewerComponent,
  tags: ['autodocs'],
  argTypes: {
    diffs: {
      description: 'Array of file diffs to display',
    },
    viewMode: {
      control: 'radio',
      options: ['unified', 'split'],
      description: 'View mode for displaying diffs',
    },
    showLineNumbers: {
      control: 'boolean',
      description: 'Show line numbers in the diff',
    },
    highlightSyntax: {
      control: 'boolean',
      description: 'Enable syntax highlighting',
    },
    collapsible: {
      control: 'boolean',
      description: 'Allow collapsing file diffs',
    },
  },
};

export default meta;
type Story = StoryObj<CodeDiffViewerComponent>;

export const UnifiedView: Story = {
  args: {
    diffs: sampleDiffs,
    viewMode: 'unified',
    showLineNumbers: true,
    highlightSyntax: true,
    collapsible: true,
  },
};

export const SplitView: Story = {
  args: {
    diffs: sampleDiffs,
    viewMode: 'split',
    showLineNumbers: true,
    highlightSyntax: true,
    collapsible: true,
  },
};

export const WithoutLineNumbers: Story = {
  args: {
    diffs: sampleDiffs,
    viewMode: 'unified',
    showLineNumbers: false,
    highlightSyntax: true,
    collapsible: true,
  },
};

export const NonCollapsible: Story = {
  args: {
    diffs: sampleDiffs,
    viewMode: 'unified',
    showLineNumbers: true,
    highlightSyntax: true,
    collapsible: false,
  },
};

export const EmptyState: Story = {
  args: {
    diffs: [],
    viewMode: 'unified',
    showLineNumbers: true,
    highlightSyntax: true,
    collapsible: true,
  },
};

export const SingleFile: Story = {
  args: {
    diffs: [sampleDiffs[0]],
    viewMode: 'unified',
    showLineNumbers: true,
    highlightSyntax: true,
    collapsible: true,
  },
};
