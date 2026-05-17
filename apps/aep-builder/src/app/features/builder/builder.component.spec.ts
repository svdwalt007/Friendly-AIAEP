/**
 * @file BuilderComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';

import { BuilderComponent } from './builder.component';
import {
  ProjectService,
  Project,
} from '../../core/services/project.service';
import {
  AgentStreamService,
  AgentMessage,
} from '../../core/services/agent-stream.service';
import { ComponentTemplate } from '../../shared/components/component-picker/component-picker.component';

type GetProjectFn = (id: string) => Observable<Project>;
type SendPromptFn = (
  projectId: string,
  prompt: string,
) => Observable<{ sessionId: string; status: string; message: string }>;

const baseProject: Project = {
  id: 'proj-9',
  name: 'Builder Demo',
  description: 'demo',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

interface MockAgentStream {
  messages: () => AgentMessage[];
  streaming: () => boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
}

function makeAgentStream(): MockAgentStream {
  return {
    messages: () => [],
    streaming: () => false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
  };
}

interface BuildContext {
  fixture: ComponentFixture<BuilderComponent>;
  component: BuilderComponent;
  agent: MockAgentStream;
  getProject: ReturnType<typeof vi.fn<GetProjectFn>>;
  sendPrompt: ReturnType<typeof vi.fn<SendPromptFn>>;
}

async function build(
  overrides: { getProject?: GetProjectFn; sendPrompt?: SendPromptFn } = {},
): Promise<BuildContext> {
  const getProject = vi
    .fn<GetProjectFn>()
    .mockImplementation(overrides.getProject ?? (() => of(baseProject)));
  const sendPrompt = vi
    .fn<SendPromptFn>()
    .mockImplementation(
      overrides.sendPrompt ??
        (() => of({ sessionId: 's-1', status: 'queued', message: 'ok' })),
    );
  const agent = makeAgentStream();

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [
      BuilderComponent,
      NoopAnimationsModule,
      RouterTestingModule,
      HttpClientTestingModule,
    ],
    providers: [
      { provide: ProjectService, useValue: { getProject, sendPrompt } },
      { provide: AgentStreamService, useValue: agent },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(BuilderComponent);
  fixture.componentRef.setInput('id', 'proj-9');
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    agent,
    getProject,
    sendPrompt,
  };
}

describe('BuilderComponent', () => {
  beforeEach(() => undefined);

  it('loads the project on init and clears the loading flag', async () => {
    const { component, getProject } = await build();
    expect(getProject).toHaveBeenCalledWith('proj-9');
    expect(component.project()?.name).toBe('Builder Demo');
    expect(component.loading()).toBe(false);
  });

  it('clears the loading flag even when project load fails', async () => {
    const { component } = await build({
      getProject: () => throwError(() => new Error('boom')),
    });
    expect(component.loading()).toBe(false);
    expect(component.project()).toBeNull();
  });

  it('initial state — split=40, activeView=0, no diffs, picker hidden', async () => {
    const { component } = await build();
    expect(component.splitPosition()).toBe(40);
    expect(component.activeView()).toBe(0);
    expect(component.sampleDiffs()).toEqual([]);
    expect(component.showComponentPicker()).toBe(false);
  });

  it('sendPrompt is a no-op when promptInput is empty / whitespace', async () => {
    const { component, sendPrompt, agent } = await build();
    component.promptInput = '';
    component.sendPrompt();
    expect(sendPrompt).not.toHaveBeenCalled();
    expect(agent.connect).not.toHaveBeenCalled();
  });

  it('sendPrompt POSTs, connects the agent stream, and clears the input', async () => {
    const { component, sendPrompt, agent } = await build();
    component.promptInput = '  Build me a dashboard  ';
    component.sendPrompt();

    expect(sendPrompt).toHaveBeenCalledWith('proj-9', 'Build me a dashboard');
    expect(agent.connect).toHaveBeenCalledWith('s-1');
    expect(agent.sendMessage).toHaveBeenCalledWith('Build me a dashboard');
    expect(component.promptInput).toBe('');
  });

  it('sendPrompt still forwards to agentStream even when the HTTP call fails', async () => {
    const { component, agent } = await build({
      sendPrompt: () => throwError(() => new Error('500')),
    });
    component.promptInput = 'hi';
    component.sendPrompt();
    expect(agent.sendMessage).toHaveBeenCalledWith('hi');
    expect(agent.connect).not.toHaveBeenCalled();
  });

  it('ngOnDestroy disconnects the agent stream', async () => {
    const { fixture, agent } = await build();
    fixture.destroy();
    expect(agent.disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    ['user', 'person'],
    ['agent_thinking', 'psychology'],
    ['agent_response', 'smart_toy'],
    ['agent_tool_call', 'build'],
    ['build_progress', 'engineering'],
    ['error', 'error'],
    ['complete', 'check_circle'],
  ] as const)('getMessageIcon(%s) → %s', async (type, icon) => {
    const { component } = await build();
    expect(component.getMessageIcon(type as AgentMessage['type'])).toBe(icon);
  });

  it('getMessageIcon falls back to chat for unknown types', async () => {
    const { component } = await build();
    expect(
      component.getMessageIcon('unknown' as unknown as AgentMessage['type']),
    ).toBe('chat');
  });

  it('onSplitChange writes through to splitPosition()', async () => {
    const { component } = await build();
    component.onSplitChange(65);
    expect(component.splitPosition()).toBe(65);
  });

  it('toggleComponentPicker flips show + sets activeView accordingly', async () => {
    const { component } = await build();
    component.toggleComponentPicker();
    expect(component.showComponentPicker()).toBe(true);
    expect(component.activeView()).toBe(1);

    component.toggleComponentPicker();
    expect(component.showComponentPicker()).toBe(false);
    expect(component.activeView()).toBe(0);
  });

  it('onComponentSelected sends a prompt + closes the picker + returns to preview', async () => {
    const { component, sendPrompt, agent } = await build();
    component.showComponentPicker.set(true);
    component.activeView.set(1);

    component.onComponentSelected({
      id: 'tpl',
      name: 'Hero Card',
    } as ComponentTemplate);

    expect(sendPrompt).toHaveBeenCalledWith(
      'proj-9',
      'Add a Hero Card component to my application',
    );
    expect(agent.connect).toHaveBeenCalledWith('s-1');
    expect(component.showComponentPicker()).toBe(false);
    expect(component.activeView()).toBe(0);
  });

  it('showCodeDiff sets activeView=2 and seeds sample diffs', async () => {
    const { component } = await build();
    component.showCodeDiff();
    expect(component.activeView()).toBe(2);
    expect(component.sampleDiffs().length).toBeGreaterThan(0);
    expect(component.sampleDiffs()[0].fileName).toBe(
      'src/app/components/dashboard.component.ts',
    );
  });

  it('showPreview snaps activeView back to 0', async () => {
    const { component } = await build();
    component.activeView.set(2);
    component.showPreview();
    expect(component.activeView()).toBe(0);
  });
});
