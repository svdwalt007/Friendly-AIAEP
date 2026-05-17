import { Component, inject, OnInit, OnDestroy, signal, input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { ProjectService, Project } from '../../core/services/project.service';
import { AgentStreamService, AgentMessage } from '../../core/services/agent-stream.service';
import { SplitPaneComponent } from '../../shared/components/split-pane/split-pane.component';
import { CodeDiffViewerComponent, FileDiff } from '../../shared/components/code-diff-viewer/code-diff-viewer.component';
import { ComponentPickerComponent, ComponentTemplate } from '../../shared/components/component-picker/component-picker.component';

@Component({
  selector: 'app-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatTabsModule,
    SplitPaneComponent,
    CodeDiffViewerComponent,
    ComponentPickerComponent,
  ],
  templateUrl: './builder.component.html',
  styleUrl: './builder.component.scss',
})
export class BuilderComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  agentStream = inject(AgentStreamService);

  @ViewChild('chatMessages') chatMessagesEl!: ElementRef;

  id = input.required<string>();
  project = signal<Project | null>(null);
  promptInput = '';
  loading = signal(true);

  // Split pane state
  splitPosition = signal(40); // 40% for chat, 60% for canvas

  // Active view in right pane (0 = preview, 1 = component-picker, 2 = code-diff)
  activeView = signal<number>(0);

  // Sample data for components (will be replaced with real data)
  sampleDiffs = signal<FileDiff[]>([]);
  showComponentPicker = signal(false);

  ngOnInit(): void {
    this.projectService.getProject(this.id()).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.agentStream.disconnect();
  }

  sendPrompt(): void {
    const prompt = this.promptInput.trim();
    if (!prompt) return;

    this.promptInput = '';

    this.projectService.sendPrompt(this.id(), prompt).subscribe({
      next: (response) => {
        this.agentStream.connect(response.sessionId);
        this.agentStream.sendMessage(prompt);
      },
      error: () => {
        this.agentStream.sendMessage(prompt);
      },
    });

    this.scrollToBottom();
  }

  getMessageIcon(type: AgentMessage['type']): string {
    switch (type) {
      case 'user': return 'person';
      case 'agent_thinking': return 'psychology';
      case 'agent_response': return 'smart_toy';
      case 'agent_tool_call': return 'build';
      case 'build_progress': return 'engineering';
      case 'error': return 'error';
      case 'complete': return 'check_circle';
      default: return 'chat';
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatMessagesEl) {
        const el = this.chatMessagesEl.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }

  onSplitChange(position: number): void {
    this.splitPosition.set(position);
  }

  onComponentSelected(component: ComponentTemplate): void {
    console.log('Component selected:', component);
    // Send to AI agent to generate the component
    this.promptInput = `Add a ${component.name} component to my application`;
    this.sendPrompt();
    this.showComponentPicker.set(false);
    this.activeView.set(0); // preview
  }

  onComponentPreviewed(component: ComponentTemplate): void {
    console.log('Component previewed:', component);
    // Could show a preview in the canvas
  }

  toggleComponentPicker(): void {
    this.showComponentPicker.update((value) => !value);
    if (this.showComponentPicker()) {
      this.activeView.set(1); // component-picker
    } else {
      this.activeView.set(0); // preview
    }
  }

  showCodeDiff(): void {
    this.activeView.set(2); // code-diff
    // Generate sample diff data (will be replaced with real data)
    this.sampleDiffs.set([
      {
        fileName: 'src/app/components/dashboard.component.ts',
        language: 'typescript',
        lines: [
          { type: 'unchanged', lineNumber: 1, content: 'import { Component } from \'@angular/core\';' },
          { type: 'add', lineNumber: 2, content: 'import { MatCardModule } from \'@angular/material/card\';' },
          { type: 'unchanged', lineNumber: 3, content: '' },
          { type: 'remove', lineNumber: 4, content: 'export class DashboardComponent {' },
          { type: 'add', lineNumber: 4, content: 'export class DashboardComponent implements OnInit {' },
          { type: 'add', lineNumber: 5, content: '  ngOnInit() {' },
          { type: 'add', lineNumber: 6, content: '    console.log(\'Dashboard initialized\');' },
          { type: 'add', lineNumber: 7, content: '  }' },
          { type: 'unchanged', lineNumber: 8, content: '}' },
        ],
      },
    ]);
  }

  showPreview(): void {
    this.activeView.set(0); // preview
  }
}
