/**
 * @file Builder workspace unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { importProvidersFrom } from '@angular/core';
import { of } from 'rxjs';

import {
  BuilderWorkspaceComponent,
  type CanvasWidget,
  type PaletteItem,
} from './builder-workspace.component';
import { ProjectService } from '../../core/services/project.service';
import { AgentStreamService } from '../../core/services/agent-stream.service';

/* Mock services */
const mockProjectService = {
  getProject: jasmine.createSpy('getProject').and.returnValue(
    of({
      id: 'proj-1',
      name: 'Test Project',
      description: 'A test project',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  ),
};

const mockAgentStream = {
  messages: jasmine.createSpy('messages').and.returnValue([]),
  streaming: jasmine.createSpy('streaming').and.returnValue(false),
  connect: jasmine.createSpy('connect'),
  disconnect: jasmine.createSpy('disconnect'),
  sendMessage: jasmine.createSpy('sendMessage'),
};

describe('BuilderWorkspaceComponent', () => {
  let fixture: ComponentFixture<BuilderWorkspaceComponent>;
  let component: BuilderWorkspaceComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BuilderWorkspaceComponent,
        BrowserAnimationsModule,
        RouterTestingModule,
        HttpClientTestingModule,
      ],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
        { provide: AgentStreamService, useValue: mockAgentStream },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuilderWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'proj-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  /* ── Construction ─────────────────────────────────────────────── */

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load project on init', () => {
    expect(mockProjectService.getProject).toHaveBeenCalledWith('proj-1');
    expect(component.project()).toBeTruthy();
    expect(component.project()?.name).toBe('Test Project');
  });

  /* ── Layout variants ──────────────────────────────────────────── */

  describe('layout variants', () => {
    it('defaults to A1 (editorial)', () => {
      expect(component.layout()).toBe('A1');
      expect(component.isA1()).toBeTrue();
      expect(component.isA2()).toBeFalse();
      expect(component.isA3()).toBeFalse();
    });

    it('A2 layout sets ide-dense class', () => {
      fixture.componentRef.setInput('layout', 'A2');
      fixture.detectChanges();
      expect(component.layout()).toBe('A2');
      expect(component.layoutClass()).toContain('layout-ide-dense');
    });

    it('A3 layout sets agent-stage class', () => {
      fixture.componentRef.setInput('layout', 'A3');
      fixture.detectChanges();
      expect(component.layout()).toBe('A3');
      expect(component.layoutClass()).toContain('layout-agent-stage');
    });
  });

  /* ── Preview mode ───────────────────────────────────────────── */

  describe('preview mode', () => {
    it('defaults to edit mode', () => {
      expect(component.previewMode()).toBeFalse();
    });

    it('toggles to preview mode', () => {
      component.togglePreview();
      expect(component.previewMode()).toBeTrue();
    });

    it('deselects widget when entering preview mode', () => {
      component.selectedWidget.set(component.widgets()[0]);
      component.togglePreview();
      expect(component.selectedWidget()).toBeNull();
    });

    it('prevents widget selection in preview mode', () => {
      component.previewMode.set(true);
      const widget = component.widgets()[0];
      component.selectWidget(widget);
      expect(component.selectedWidget()).toBeNull();
    });
  });

  /* ── Widget management ────────────────────────────────────────── */

  describe('widget CRUD', () => {
    it('has default widgets', () => {
      expect(component.widgets().length).toBeGreaterThan(0);
    });

    it('selects a widget', () => {
      const widget = component.widgets()[0];
      component.selectWidget(widget);
      expect(component.selectedWidget()?.id).toBe(widget.id);
    });

    it('updates widget property', () => {
      const widget = component.widgets()[0];
      component.selectWidget(widget);
      component.updateWidgetProp(widget, 'label', 'Updated Label');
      expect(widget.props['label']).toBe('Updated Label');
    });

    it('deletes a widget', () => {
      const initialCount = component.widgets().length;
      const widget = component.widgets()[0];
      component.deleteWidget(widget);
      expect(component.widgets().length).toBe(initialCount - 1);
    });
  });

  /* ── Zoom ───────────────────────────────────────────────────────── */

  describe('zoom controls', () => {
    it('zooms in', () => {
      const before = component.cellPx();
      component.zoomIn();
      expect(component.cellPx()).toBe(before + 10);
    });

    it('zooms out', () => {
      const before = component.cellPx();
      component.zoomOut();
      expect(component.cellPx()).toBe(before - 10);
    });

    it('clamps zoom to minimum', () => {
      component.cellPx.set(40);
      component.zoomOut();
      expect(component.cellPx()).toBe(40);
    });

    it('clamps zoom to maximum', () => {
      component.cellPx.set(160);
      component.zoomIn();
      expect(component.cellPx()).toBe(160);
    });
  });

  /* ── Grid calculations ────────────────────────────────────────── */

  describe('grid layout', () => {
    it('generates grid-template-columns', () => {
      component.cellPx.set(80);
      const cols = component.gridTemplateCols();
      expect(cols).toBe('repeat(12, 80px)');
    });

    it('generates grid-template-rows', () => {
      component.cellPx.set(80);
      const rows = component.gridTemplateRows();
      expect(rows).toBe('repeat(12, 80px)');
    });
  });

  /* ── Palette items ────────────────────────────────────────────── */

  describe('palette', () => {
    it('has 4 palette items', () => {
      expect(component.paletteItems().length).toBe(4);
    });

    it('includes stat-card widget', () => {
      const item = component.paletteItems().find((i) => i.kind === 'stat-card');
      expect(item).toBeTruthy();
      expect(item?.defaultSize).toEqual({ w: 3, h: 2 });
    });

    it('includes spark widget', () => {
      const item = component.paletteItems().find((i) => i.kind === 'spark');
      expect(item).toBeTruthy();
    });

    it('includes stream-chunk widget', () => {
      const item = component
        .paletteItems()
        .find((i) => i.kind === 'stream-chunk');
      expect(item).toBeTruthy();
    });
  });

  /* ── Inspector ──────────────────────────────────────────────────── */

  describe('property inspector', () => {
    it('is open by default', () => {
      expect(component.inspectorOpen()).toBeTrue();
    });

    it('toggles inspector', () => {
      component.inspectorOpen.set(false);
      expect(component.inspectorOpen()).toBeFalse();
    });
  });
});
