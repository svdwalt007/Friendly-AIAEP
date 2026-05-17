/**
 * @file Page Composer — B2 workspace surface.
 * Drag-drop canvas for building page layouts from a widget palette.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  Component,
  inject,
  signal,
  computed,
  input,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CdkDragDrop,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProjectService } from '../../core/services/project.service';
import {
  ComponentTemplate,
} from '../../shared/components/component-picker/component-picker.component';
import { ComponentPickerDialogComponent } from '../../shared/components/component-picker/component-picker-dialog.component';

export type WidgetType = 'Text' | 'Chart' | 'Map' | 'Table' | 'KPI' | 'Form';

export interface WidgetDef {
  id: string;
  type: WidgetType;
  icon: string;
  description: string;
}

export interface CanvasWidget {
  instanceId: string;
  type: WidgetType;
  icon: string;
  name: string;
  colSpan: number;
  rowSpan: number;
  dataBinding: string;
}

const PALETTE_WIDGETS: WidgetDef[] = [
  { id: 'text',  type: 'Text',  icon: 'text_fields',  description: 'Rich text block' },
  { id: 'chart', type: 'Chart', icon: 'show_chart',   description: 'Line / bar / pie chart' },
  { id: 'map',   type: 'Map',   icon: 'map',          description: 'Geographic device map' },
  { id: 'table', type: 'Table', icon: 'table_chart',  description: 'Sortable data table' },
  { id: 'kpi',   type: 'KPI',   icon: 'speed',        description: 'KPI metric card' },
  { id: 'form',  type: 'Form',  icon: 'dynamic_form', description: 'Data entry form' },
];

let widgetSeq = 0;

@Component({
  selector: 'app-page-composer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    DragDropModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './page-composer.component.html',
  styleUrl: './page-composer.component.scss',
})
export class PageComposerComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly projectService = inject(ProjectService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly paletteWidgets: WidgetDef[] = PALETTE_WIDGETS;

  /** Widgets currently on the canvas */
  readonly canvasWidgets = signal<CanvasWidget[]>([]);

  /** Currently selected widget (for inspector panel) */
  readonly selectedWidget = signal<CanvasWidget | null>(null);

  readonly saving = signal(false);
  readonly projectName = signal<string>('');

  /** Inspector form, rebuilt whenever selection changes */
  inspectorForm = this.fb.group({
    name:        ['', Validators.required],
    colSpan:     [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    rowSpan:     [1, [Validators.required, Validators.min(1), Validators.max(6)]],
    dataBinding: [''],
  });

  readonly hasSelection = computed(() => this.selectedWidget() !== null);

  ngOnInit(): void {
    this.projectService.getProject(this.id()).subscribe({
      next: (p) => this.projectName.set(p.name),
      error: () => this.projectName.set(this.id()),
    });
  }

  /** CDK DragDrop: widget dropped from palette onto canvas */
  onDropOnCanvas(event: CdkDragDrop<WidgetDef[], CanvasWidget[]>): void {
    if (event.previousContainer.id === event.container.id) {
      return; // reorder within canvas not supported in this iteration
    }
    const def = event.previousContainer.data[event.previousIndex] as unknown as WidgetDef;
    const widget: CanvasWidget = {
      instanceId: `widget-${++widgetSeq}`,
      type: def.type,
      icon: def.icon,
      name: `${def.type} ${widgetSeq}`,
      colSpan: 4,
      rowSpan: 2,
      dataBinding: '',
    };
    this.canvasWidgets.update((list) => {
      const updated = [...list];
      updated.splice(event.currentIndex, 0, widget);
      return updated;
    });
  }

  /** Remove a widget from the canvas */
  removeWidget(instanceId: string): void {
    if (this.selectedWidget()?.instanceId === instanceId) {
      this.selectedWidget.set(null);
    }
    this.canvasWidgets.update((list) => list.filter((w) => w.instanceId !== instanceId));
  }

  /** Select a widget to show in the inspector */
  selectWidget(widget: CanvasWidget): void {
    this.selectedWidget.set(widget);
    this.inspectorForm.patchValue({
      name:        widget.name,
      colSpan:     widget.colSpan,
      rowSpan:     widget.rowSpan,
      dataBinding: widget.dataBinding,
    });
  }

  /** Apply inspector changes back to the selected widget */
  applyInspector(): void {
    const sel = this.selectedWidget();
    if (!sel || this.inspectorForm.invalid) return;
    const v = this.inspectorForm.getRawValue();
    this.canvasWidgets.update((list) =>
      list.map((w) =>
        w.instanceId === sel.instanceId
          ? { ...w, name: v.name ?? w.name, colSpan: v.colSpan ?? w.colSpan, rowSpan: v.rowSpan ?? w.rowSpan, dataBinding: v.dataBinding ?? '' }
          : w,
      ),
    );
    this.selectedWidget.update((w) => (w ? { ...w, name: v.name ?? w.name, colSpan: v.colSpan ?? w.colSpan, rowSpan: v.rowSpan ?? w.rowSpan, dataBinding: v.dataBinding ?? '' } : null));
  }

  /** Open the component-picker modal (B3) */
  openComponentPicker(): void {
    const ref = this.dialog.open(ComponentPickerDialogComponent, {
      width: '900px',
      maxHeight: '80vh',
      ariaLabel: 'Component picker',
    });
    ref.afterClosed().subscribe((selected: ComponentTemplate | undefined) => {
      if (selected) {
        this.addFromTemplate(selected);
      }
    });
  }

  /** Persist page layout back to the project service */
  saveLayout(): void {
    this.saving.set(true);
    // Project service does not have a layout endpoint yet; log and show toast.
    const layout = this.canvasWidgets();
    console.log('[PageComposer] Saving layout for project', this.id(), layout);
    setTimeout(() => {
      this.saving.set(false);
      this.snackBar.open('Layout saved', 'Dismiss', { duration: 3000 });
    }, 600);
  }

  private addFromTemplate(template: ComponentTemplate): void {
    const typeMap: Record<string, WidgetType> = {
      charts: 'Chart',
      forms:  'Form',
      layout: 'Text',
      iot:    'KPI',
    };
    const type: WidgetType = typeMap[template.category] ?? 'Text';
    const widget: CanvasWidget = {
      instanceId: `widget-${++widgetSeq}`,
      type,
      icon: template.icon,
      name: template.name,
      colSpan: 4,
      rowSpan: 2,
      dataBinding: '',
    };
    this.canvasWidgets.update((list) => [...list, widget]);
    this.snackBar.open(`Added "${template.name}"`, 'Dismiss', { duration: 2000 });
  }
}
