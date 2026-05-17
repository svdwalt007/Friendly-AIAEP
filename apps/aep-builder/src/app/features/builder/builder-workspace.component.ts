import { NO_ERRORS_SCHEMA } from "@angular/core";
/**
 * @file Builder workspace — A1/A2/A3 layout variants, canvas, palette, inspector.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,

  // type ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

/* Angular Material */
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/* CDK drag-drop */
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  DragDropModule,
  moveItemInArray,
  // transferArrayItem,
} from '@angular/cdk/drag-drop';



/* Local services */
import {
  ProjectService,
  type Project,
} from '../../core/services/project.service';
import { AgentStreamService } from '../../core/services/agent-stream.service';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Widget kind discriminates which primitive renders on canvas. */
export type WidgetKind = 'stat-card' | 'spark' | 'stream-chunk' | 'text';

/** Position on the 12×12 virtual grid. */
export interface GridPos {
  col: number; // 0–11
  row: number; // 0–11
}

/** Size in grid units. */
export interface GridSize {
  w: number; // 1–12
  h: number; // 1–12
}

/** One widget instance placed on the canvas. */
export interface CanvasWidget {
  id: string;
  kind: WidgetKind;
  pos: GridPos;
  size: GridSize;
  props: Record<string, unknown>;
}

/** Palette item — draggable source. */
export interface PaletteItem {
  kind: WidgetKind;
  label: string;
  icon: string;
  defaultSize: GridSize;
}

/**
 * Canonical workspace layout modes (A1 / A2 / A3 in design notation).
 */
export type LayoutMode = 'editorial' | 'ide-dense' | 'agent-stage';

/** Legacy layout names retained for backward compatibility. */
export type LegacyLayoutMode = 'A1' | 'A2' | 'A3';

/** Per-agent activity state used by the A3 S / P / I indicators. */
export type AgentActivity = 'spawning' | 'processing' | 'idle';

/** A snapshot of an agent's current activity, derived from the stream. */
export interface AgentStatus {
  /** Unique agent identifier (e.g. "supervisor", "planning"). */
  readonly agent: string;
  /** Computed activity bucket. */
  readonly activity: AgentActivity;
}

/** Mock IoT device telemetry record. */
export interface DeviceTelemetry {
  deviceId: string;
  label: string;
  value: number;
  unit: string;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/*  Mock fixtures                                                      */
/* ------------------------------------------------------------------ */

/** Deterministic device telemetry for the builder demo. */
const DEMO_DEVICES: DeviceTelemetry[] = [
  {
    deviceId: 'SM-001',
    label: 'Smart Meter A',
    value: 1247.5,
    unit: 'kWh',
    timestamp: Date.now(),
  },
  {
    deviceId: 'SM-002',
    label: 'Smart Meter B',
    value: 983.2,
    unit: 'kWh',
    timestamp: Date.now() - 3600000,
  },
  {
    deviceId: 'TH-001',
    label: 'Temp Sensor Lobby',
    value: 22.4,
    unit: '°C',
    timestamp: Date.now(),
  },
  {
    deviceId: 'TH-002',
    label: 'Temp Sensor Server',
    value: 28.1,
    unit: '°C',
    timestamp: Date.now() - 1800000,
  },
  {
    deviceId: 'GP-001',
    label: 'GPS Tracker 1',
    value: 14.2,
    unit: 'km/h',
    timestamp: Date.now(),
  },
  {
    deviceId: 'VL-001',
    label: 'Vibration Sensor',
    value: 0.03,
    unit: 'g',
    timestamp: Date.now() - 900000,
  },
];

const PALETTE_ITEMS: PaletteItem[] = [
  {
    kind: 'stat-card',
    label: 'Stat Card',
    icon: 'insert_chart',
    defaultSize: { w: 3, h: 2 },
  },
  {
    kind: 'spark',
    label: 'Spark Line',
    icon: 'show_chart',
    defaultSize: { w: 3, h: 2 },
  },
  {
    kind: 'stream-chunk',
    label: 'Stream Chunk',
    icon: 'chat',
    defaultSize: { w: 4, h: 3 },
  },
  {
    kind: 'text',
    label: 'Text Block',
    icon: 'text_fields',
    defaultSize: { w: 4, h: 2 },
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let _idSeq = 0;
const nextId = (): string => `widget-${++_idSeq}`;

/** Clamp n to [min, max]. */
const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

@Component({
  selector: 'app-builder-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatTabsModule,
    MatTooltipModule,
    MatProgressBarModule,
    DragDropModule,
    CdkDrag,
    CdkDragPreview,
    CdkDragPlaceholder,
    CdkDropList,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './builder-workspace.component.html',
  styleUrl: './builder-workspace.component.scss',
  schemas: [NO_ERRORS_SCHEMA],
})
export class BuilderWorkspaceComponent {
  /* ---------------------------------------------------------------- */
  /*  Injected services                                               */
  /* ---------------------------------------------------------------- */
  private projectService = inject(ProjectService);
  protected agentStream = inject(AgentStreamService);

  /* ---------------------------------------------------------------- */
  /*  Route / shell inputs                                            */
  /* ---------------------------------------------------------------- */
  readonly id = input.required<string>();

  /**
   * Layout variant.
   *
   * - `'editorial'` (A1): default 3-pane editorial layout.
   * - `'ide-dense'` (A2): compact IDE-style layout, monospace stream panel,
   *   left canvas pane shrinks to 40% / stream panel expands to 60%.
   * - `'agent-stage'` (A3): adds the S/P/I per-agent status column on the right.
   *
   * Bound from the `?layout=` query parameter via
   * `withComponentInputBinding()`. Legacy `'A1' | 'A2' | 'A3'` values are
   * accepted for backward compatibility and normalised internally.
   */
  readonly layout = input<LayoutMode | LegacyLayoutMode>('editorial');

  /* ---------------------------------------------------------------- */
  /*  UI state                                                        */
  /* ---------------------------------------------------------------- */
  protected readonly project = signal<Project | null>(null);
  protected readonly loading = signal(true);

  /** Edit vs Preview mode toggle. */
  protected readonly previewMode = signal(false);

  /** Inspector open/close. */
  protected readonly inspectorOpen = signal(true);

  /** Selected widget for property editing. */
  protected readonly selectedWidget = model<CanvasWidget | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Canvas grid state                                               */
  /* ---------------------------------------------------------------- */
  protected readonly gridCols = 12;
  protected readonly gridRows = 12;
  protected readonly cellPx = signal(80); // zoom level

  protected readonly widgets = signal<CanvasWidget[]>([
    {
      id: nextId(),
      kind: 'stat-card',
      pos: { col: 0, row: 0 },
      size: { w: 3, h: 2 },
      props: {
        label: 'Total Consumption',
        value: DEMO_DEVICES[0].value,
        unit: DEMO_DEVICES[0].unit,
        delta: +12.4,
        seed: 42,
      },
    },
    {
      id: nextId(),
      kind: 'stat-card',
      pos: { col: 3, row: 0 },
      size: { w: 3, h: 2 },
      props: {
        label: 'Active Devices',
        value: 6,
        unit: 'devices',
        delta: 0,
        seed: 17,
      },
    },
    {
      id: nextId(),
      kind: 'spark',
      pos: { col: 6, row: 0 },
      size: { w: 3, h: 2 },
      props: {
        seed: 99,
      },
    },
    {
      id: nextId(),
      kind: 'stream-chunk',
      pos: { col: 0, row: 2 },
      size: { w: 6, h: 3 },
      props: {
        kind: 'progress',
        payload: {
          content: 'Device SM-001 reported normal telemetry. Battery: 87%.',
        },
      },
    },
  ]);

  protected readonly paletteItems = signal<PaletteItem[]>(PALETTE_ITEMS);

  /* ---------------------------------------------------------------- */
  /*  Derived layout                                                  */
  /* ---------------------------------------------------------------- */

  /** Canonical mode normalised from the legacy A1/A2/A3 aliases. */
  protected readonly mode = computed<LayoutMode>(() => {
    const raw = this.layout();
    switch (raw) {
      case 'A2':
      case 'ide-dense':
        return 'ide-dense';
      case 'A3':
      case 'agent-stage':
        return 'agent-stage';
      case 'A1':
      case 'editorial':
      default:
        return 'editorial';
    }
  });

  /** Legacy A1/A2/A3 alias for the toolbar badge and tests. */
  protected readonly legacyLabel = computed<LegacyLayoutMode>(() => {
    switch (this.mode()) {
      case 'ide-dense':
        return 'A2';
      case 'agent-stage':
        return 'A3';
      default:
        return 'A1';
    }
  });

  protected readonly isA1 = computed(() => this.mode() === 'editorial');
  protected readonly isA2 = computed(() => this.mode() === 'ide-dense');
  protected readonly isA3 = computed(() => this.mode() === 'agent-stage');

  protected readonly layoutClass = computed(() => {
    switch (this.mode()) {
      case 'ide-dense':
        return 'layout-ide-dense';
      case 'agent-stage':
        return 'layout-agent-stage';
      default:
        return 'layout-editorial';
    }
  });

  /** `data-density` attribute value for the workspace host. */
  protected readonly density = computed<'compact' | 'comfortable'>(() =>
    this.mode() === 'ide-dense' ? 'compact' : 'comfortable',
  );

  /**
   * Derived per-agent status from the current stream messages.
   *
   * `spawning`  → most-recent message is `agent_handoff`
   * `processing`→ most-recent message is `tool_call` / `reasoning`
   * `idle`      → otherwise
   */
  protected readonly agentStatuses = computed<readonly AgentStatus[]>(() => {
    const msgs = this.agentStream.messages();
    const seen = new Map<string, AgentActivity>();
    for (const msg of msgs) {
      const agent = this.extractAgent(msg);
      if (!agent) continue;
      seen.set(agent, this.classifyActivity(msg));
    }
    return Array.from(seen, ([agent, activity]) => ({ agent, activity }));
  });

  /** Grid-template-columns CSS string. */
  protected readonly gridTemplateCols = computed(
    () => `repeat(${this.gridCols}, ${this.cellPx()}px)`,
  );

  /** Grid-template-rows CSS string. */
  protected readonly gridTemplateRows = computed(
    () => `repeat(${this.gridRows}, ${this.cellPx()}px)`,
  );

  /* ---------------------------------------------------------------- */
  /*  Construction / effects                                          */
  /* ---------------------------------------------------------------- */
  constructor() {
    effect(() => {
      const pid = this.id();
      if (!pid) return;
      this.loading.set(true);
      this.projectService.getProject(pid).subscribe({
        next: (p) => {
          this.project.set(p);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Drag-drop handlers                                              */
  /* ---------------------------------------------------------------- */

  /** Drop from palette → canvas. */
  protected onPaletteDrop(event: CdkDragDrop<any[]>): void {
    const item = event.item.data as PaletteItem;
    if (!item) return;

    // Snap drop position to grid
    const rect = (
      event.container.element.nativeElement as HTMLElement
    ).getBoundingClientRect();
    const x = event.dropPoint.x - rect.left;
    const y = event.dropPoint.y - rect.top;
    const col = clamp(
      Math.floor(x / this.cellPx()),
      0,
      this.gridCols - item.defaultSize.w,
    );
    const row = clamp(
      Math.floor(y / this.cellPx()),
      0,
      this.gridRows - item.defaultSize.h,
    );

    const newWidget: CanvasWidget = {
      id: nextId(),
      kind: item.kind,
      pos: { col, row },
      size: { ...item.defaultSize },
      props: this.makeDefaultProps(item.kind),
    };

    this.widgets.update((list) => [...list, newWidget]);
    this.selectedWidget.set(newWidget);
  }

  /** Reorder widgets within the canvas. */
  protected onWidgetDrop(event: CdkDragDrop<CanvasWidget[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    // Cross-container not supported for canvas widgets
  }

  /** Track widget by ID for @for. */
  protected trackById(_: number, w: CanvasWidget): string {
    return w.id;
  }

  /* ---------------------------------------------------------------- */
  /*  Widget selection / inspector                                    */
  /* ---------------------------------------------------------------- */

  protected selectWidget(widget: CanvasWidget): void {
    if (this.previewMode()) return; // No editing in preview mode
    this.selectedWidget.set(widget);
  }

  protected deselectWidget(event: MouseEvent): void {
    if (this.previewMode()) return;
    if ((event.target as HTMLElement).classList.contains('canvas-grid')) {
      this.selectedWidget.set(null);
    }
  }

  protected updateWidgetSize(
    w: CanvasWidget,
    axis: 'w' | 'h',
    delta: number,
  ): void {
    w.size = {
      ...w.size,
      [axis]: clamp(
        w.size[axis] + delta,
        1,
        axis === 'w' ? this.gridCols : this.gridRows,
      ),
    };
    this.widgets.update((list) => [...list]); // trigger reactivity
  }

  protected updateWidgetProp(
    w: CanvasWidget,
    key: string,
    value: unknown,
  ): void {
    w.props = { ...w.props, [key]: value };
    this.widgets.update((list) => [...list]);
  }

  protected deleteWidget(widget: CanvasWidget): void {
    this.widgets.update((list) => list.filter((w) => w.id !== widget.id));
    if (this.selectedWidget()?.id === widget.id) {
      this.selectedWidget.set(null);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Type guards for widget props                                    */
  /* ---------------------------------------------------------------- */
  protected isStringProp(value: unknown): value is string {
    return typeof value === 'string';
  }

  protected isNumberProp(value: unknown): value is number {
    return typeof value === 'number';
  }

  /* ---------------------------------------------------------------- */
  /*  Layout helpers                                                  */
  /* ---------------------------------------------------------------- */

  protected getWidgetGridArea(w: CanvasWidget): string {
    return `${w.pos.row + 1} / ${w.pos.col + 1} / span ${w.size.h} / span ${w.size.w}`;
  }

  /** Computes CSS grid-area for each widget. */
  protected getWidgetStyle(w: CanvasWidget): Record<string, string> {
    return {
      'grid-area': this.getWidgetGridArea(w),
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Preview toggle                                                  */
  /* ---------------------------------------------------------------- */

  protected togglePreview(): void {
    this.previewMode.update((v) => !v);
    if (this.previewMode()) {
      this.selectedWidget.set(null);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Zoom                                                            */
  /* ---------------------------------------------------------------- */

  protected zoomIn(): void {
    this.cellPx.update((v) => clamp(v + 10, 40, 160));
  }

  protected zoomOut(): void {
    this.cellPx.update((v) => clamp(v - 10, 40, 160));
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Extract an agent identifier from a stream message. Falls back to the
   * generic "agent" bucket when none is supplied (the legacy
   * {@link AgentMessage} contract carries no `agent` field).
   */
  private extractAgent(msg: { type: string }): string | null {
    if (!msg) return null;
    if (msg.type === 'user') return null;
    return 'agent';
  }

  /**
   * Bucket a stream message into one of the three S/P/I activities.
   */
  private classifyActivity(msg: { type: string; done?: boolean }): AgentActivity {
    switch (msg.type) {
      case 'agent_thinking':
      case 'agent_tool_call':
        return msg.done ? 'idle' : 'processing';
      case 'build_progress':
        return 'spawning';
      case 'complete':
      case 'error':
        return 'idle';
      case 'agent_response':
        return msg.done ? 'idle' : 'processing';
      default:
        return 'idle';
    }
  }

  /** Glyph used by the A3 S / P / I indicator strip. */
  protected activityGlyph(activity: AgentActivity): string {
    switch (activity) {
      case 'spawning':
        return 'S';
      case 'processing':
        return 'P';
      case 'idle':
        return 'I';
    }
  }

  private makeDefaultProps(kind: WidgetKind): Record<string, unknown> {
    switch (kind) {
      case 'stat-card':
        return {
          label: 'New Metric',
          value: 0,
          unit: '',
          delta: 0,
          seed: Math.floor(Math.random() * 1000),
        };
      case 'spark':
        return { seed: Math.floor(Math.random() * 1000) };
      case 'stream-chunk':
        return {
          kind: 'progress',
          payload: { content: 'New stream chunk' },
        };
      case 'text':
        return { content: 'Text block' };
      default:
        return {};
    }
  }
}
