/**
 * @file Builder workspace unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Observable, of } from 'rxjs';

import { BuilderWorkspaceComponent } from './builder-workspace.component';
import {
  ProjectService,
  Project,
} from '../../core/services/project.service';
import { AgentStreamService } from '../../core/services/agent-stream.service';

type GetProjectFn = (id: string) => Observable<Project>;

const baseProject: Project = {
  id: 'proj-1',
  name: 'Test Project',
  description: 'A test project',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function mockAgentStream(): Partial<AgentStreamService> {
  return {
    messages: vi.fn(() => []) as unknown as AgentStreamService['messages'],
    streaming: vi.fn(
      () => false,
    ) as unknown as AgentStreamService['streaming'],
    connect: vi.fn() as unknown as AgentStreamService['connect'],
    disconnect: vi.fn() as unknown as AgentStreamService['disconnect'],
    sendMessage: vi.fn() as unknown as AgentStreamService['sendMessage'],
  };
}

describe('BuilderWorkspaceComponent', () => {
  let fixture: ComponentFixture<BuilderWorkspaceComponent>;
  // `protected` template-facing members are reached through this aliased view
  // so each test still binds against typed signals where possible.
  let view: Record<string, unknown> & { [key: string]: any };
  let getProjectSpy: ReturnType<typeof vi.fn<GetProjectFn>>;

  beforeEach(async () => {
    getProjectSpy = vi.fn<GetProjectFn>().mockReturnValue(of(baseProject));

    await TestBed.configureTestingModule({
      imports: [
        BuilderWorkspaceComponent,
        NoopAnimationsModule,
        RouterTestingModule,
        HttpClientTestingModule,
      ],
      providers: [
        { provide: ProjectService, useValue: { getProject: getProjectSpy } },
        { provide: AgentStreamService, useValue: mockAgentStream() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuilderWorkspaceComponent);
    view = fixture.componentInstance as unknown as Record<string, any>;
    fixture.componentRef.setInput('id', 'proj-1');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  /* ── Construction ─────────────────────────────────────────────── */

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads project on init', () => {
    expect(getProjectSpy).toHaveBeenCalledWith('proj-1');
    expect(view['project']()).toBeTruthy();
    expect(view['project']().name).toBe('Test Project');
  });

  /* ── Layout variants ──────────────────────────────────────────── */

  describe('layout variants', () => {
    it("defaults to 'editorial' (A1) mode", () => {
      expect(view['mode']()).toBe('editorial');
      expect(view['legacyLabel']()).toBe('A1');
      expect(view['isA1']()).toBe(true);
      expect(view['isA2']()).toBe(false);
      expect(view['isA3']()).toBe(false);
    });

    it("'ide-dense' (A2) sets ide-dense class and compact density", () => {
      fixture.componentRef.setInput('layout', 'ide-dense');
      fixture.detectChanges();
      expect(view['mode']()).toBe('ide-dense');
      expect(view['legacyLabel']()).toBe('A2');
      expect(view['layoutClass']()).toContain('layout-ide-dense');
      expect(view['density']()).toBe('compact');
    });

    it("'agent-stage' (A3) sets agent-stage class", () => {
      fixture.componentRef.setInput('layout', 'agent-stage');
      fixture.detectChanges();
      expect(view['mode']()).toBe('agent-stage');
      expect(view['legacyLabel']()).toBe('A3');
      expect(view['layoutClass']()).toContain('layout-agent-stage');
    });

    it('accepts legacy A1/A2/A3 aliases', () => {
      fixture.componentRef.setInput('layout', 'A2');
      fixture.detectChanges();
      expect(view['mode']()).toBe('ide-dense');
      fixture.componentRef.setInput('layout', 'A3');
      fixture.detectChanges();
      expect(view['mode']()).toBe('agent-stage');
      fixture.componentRef.setInput('layout', 'A1');
      fixture.detectChanges();
      expect(view['mode']()).toBe('editorial');
    });
  });

  /* ── Preview mode ───────────────────────────────────────────── */

  describe('preview mode', () => {
    it('defaults to edit mode', () => {
      expect(view['previewMode']()).toBe(false);
    });

    it('toggles to preview mode', () => {
      view['togglePreview']();
      expect(view['previewMode']()).toBe(true);
    });

    it('deselects widget when entering preview mode', () => {
      view['selectedWidget'].set(view['widgets']()[0]);
      view['togglePreview']();
      expect(view['selectedWidget']()).toBeNull();
    });

    it('prevents widget selection in preview mode', () => {
      view['previewMode'].set(true);
      const widget = view['widgets']()[0];
      view['selectWidget'](widget);
      expect(view['selectedWidget']()).toBeNull();
    });
  });

  /* ── Widget management ────────────────────────────────────────── */

  describe('widget CRUD', () => {
    it('has default widgets', () => {
      expect(view['widgets']().length).toBeGreaterThan(0);
    });

    it('selects a widget', () => {
      const widget = view['widgets']()[0];
      view['selectWidget'](widget);
      expect(view['selectedWidget']()?.id).toBe(widget.id);
    });

    it('updates widget property', () => {
      const widget = view['widgets']()[0];
      view['selectWidget'](widget);
      view['updateWidgetProp'](widget, 'label', 'Updated Label');
      expect(widget.props['label']).toBe('Updated Label');
    });

    it('deletes a widget', () => {
      const initialCount = view['widgets']().length;
      const widget = view['widgets']()[0];
      view['deleteWidget'](widget);
      expect(view['widgets']().length).toBe(initialCount - 1);
    });
  });

  /* ── Zoom ───────────────────────────────────────────────────────── */

  describe('zoom controls', () => {
    it('zooms in', () => {
      const before = view['cellPx']();
      view['zoomIn']();
      expect(view['cellPx']()).toBe(before + 10);
    });

    it('zooms out', () => {
      const before = view['cellPx']();
      view['zoomOut']();
      expect(view['cellPx']()).toBe(before - 10);
    });

    it('clamps zoom to minimum', () => {
      view['cellPx'].set(40);
      view['zoomOut']();
      expect(view['cellPx']()).toBe(40);
    });

    it('clamps zoom to maximum', () => {
      view['cellPx'].set(160);
      view['zoomIn']();
      expect(view['cellPx']()).toBe(160);
    });
  });

  /* ── Grid calculations ────────────────────────────────────────── */

  describe('grid layout', () => {
    it('generates grid-template-columns', () => {
      view['cellPx'].set(80);
      expect(view['gridTemplateCols']()).toBe('repeat(12, 80px)');
    });

    it('generates grid-template-rows', () => {
      view['cellPx'].set(80);
      expect(view['gridTemplateRows']()).toBe('repeat(12, 80px)');
    });
  });

  /* ── Palette items ────────────────────────────────────────────── */

  describe('palette', () => {
    it('has 4 palette items', () => {
      expect(view['paletteItems']().length).toBe(4);
    });

    it('includes stat-card widget', () => {
      const item = view['paletteItems']().find(
        (i: { kind: string }) => i.kind === 'stat-card',
      );
      expect(item).toBeTruthy();
      expect(item?.defaultSize).toEqual({ w: 3, h: 2 });
    });

    it('includes spark widget', () => {
      const item = view['paletteItems']().find(
        (i: { kind: string }) => i.kind === 'spark',
      );
      expect(item).toBeTruthy();
    });

    it('includes stream-chunk widget', () => {
      const item = view['paletteItems']().find(
        (i: { kind: string }) => i.kind === 'stream-chunk',
      );
      expect(item).toBeTruthy();
    });
  });

  /* ── Inspector ──────────────────────────────────────────────────── */

  describe('property inspector', () => {
    it('is open by default', () => {
      expect(view['inspectorOpen']()).toBe(true);
    });

    it('toggles inspector', () => {
      view['inspectorOpen'].set(false);
      expect(view['inspectorOpen']()).toBe(false);
    });
  });
});
