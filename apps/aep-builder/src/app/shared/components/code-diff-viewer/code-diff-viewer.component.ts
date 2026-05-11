import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';

export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  lineNumber: number;
  content: string;
}

export interface FileDiff {
  fileName: string;
  language: string;
  oldContent?: string;
  newContent?: string;
  lines: DiffLine[];
}

export type DiffViewMode = 'split' | 'unified';

@Component({
  selector: 'app-code-diff-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
  ],
  templateUrl: './code-diff-viewer.component.html',
  styleUrl: './code-diff-viewer.component.scss',
})
export class CodeDiffViewerComponent {
  @Input() set diffs(value: FileDiff[]) {
    this.diffsSignal.set(value);
  }

  @Input() set viewMode(value: DiffViewMode) {
    this.viewModeSignal.set(value);
  }

  @Input() showLineNumbers: boolean = true;
  @Input() highlightSyntax: boolean = true;
  @Input() collapsible: boolean = true;

  // Signals with different names to avoid conflicts with setters
  protected readonly diffsSignal = signal<FileDiff[]>([]);
  protected readonly viewModeSignal = signal<DiffViewMode>('unified');
  private expandedFiles = signal<Set<string>>(new Set());

  readonly stats = computed(() => {
    const allDiffs = this.diffsSignal();
    let additions = 0;
    let deletions = 0;

    allDiffs.forEach((diff) => {
      diff.lines.forEach((line) => {
        if (line.type === 'add') additions++;
        if (line.type === 'remove') deletions++;
      });
    });

    return { additions, deletions, total: additions + deletions };
  });

  toggleViewMode(): void {
    this.viewModeSignal.update((mode) => (mode === 'split' ? 'unified' : 'split'));
  }

  toggleFileExpansion(fileName: string): void {
    this.expandedFiles.update((expanded) => {
      const newSet = new Set(expanded);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  }

  isFileExpanded(fileName: string): boolean {
    return this.expandedFiles().has(fileName);
  }

  expandAll(): void {
    const allFileNames = this.diffsSignal().map((d) => d.fileName);
    this.expandedFiles.set(new Set(allFileNames));
  }

  collapseAll(): void {
    this.expandedFiles.set(new Set());
  }

  copyToClipboard(content: string): void {
    navigator.clipboard.writeText(content).then(
      () => {
        // Could emit an event or show a toast notification
        console.log('Code copied to clipboard');
      },
      (err) => {
        console.error('Failed to copy code:', err);
      }
    );
  }

  getDiffIcon(type: DiffLine['type']): string {
    switch (type) {
      case 'add':
        return 'add';
      case 'remove':
        return 'remove';
      case 'unchanged':
        return '';
      default:
        return '';
    }
  }

  getFileIcon(language: string): string {
    const iconMap: Record<string, string> = {
      typescript: 'code',
      javascript: 'javascript',
      html: 'html',
      css: 'css',
      scss: 'css',
      json: 'data_object',
      markdown: 'article',
      python: 'code',
      java: 'code',
      default: 'insert_drive_file',
    };

    return iconMap[language.toLowerCase()] || iconMap['default'];
  }
}
