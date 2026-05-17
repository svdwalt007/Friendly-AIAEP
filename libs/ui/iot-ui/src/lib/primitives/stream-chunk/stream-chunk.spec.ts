/**
 * @file Friendly Stream Chunk — unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FriendlyStreamChunk,
  StreamChunkKind,
  StreamChunkPayload,
} from './stream-chunk';

function getRoot(fixture: ComponentFixture<FriendlyStreamChunk>): HTMLElement {
  const el = fixture.nativeElement.querySelector(
    'section.friendly-stream-chunk',
  );
  expect(el).toBeTruthy();
  return el as HTMLElement;
}

const ALL_KINDS: StreamChunkKind[] = [
  'final',
  'reasoning',
  'tool_call',
  'tool_result',
  'code_block',
  'file_write',
  'error',
  'progress',
  'agent_handoff',
];

describe('FriendlyStreamChunk', () => {
  let fixture: ComponentFixture<FriendlyStreamChunk>;

  async function setKind(
    kind: StreamChunkKind,
    payload: StreamChunkPayload | null = null,
  ): Promise<void> {
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('payload', payload);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendlyStreamChunk],
    }).compileComponents();
    fixture = TestBed.createComponent(FriendlyStreamChunk);
    fixture.componentRef.setInput('kind', 'final');
    fixture.componentRef.setInput('payload', null);
    await fixture.whenStable();
  });

  it('exposes nine canonical chunk kinds', () => {
    expect(ALL_KINDS).toHaveLength(9);
  });

  it('renders every kind without throwing and stamps data-kind', async () => {
    for (const kind of ALL_KINDS) {
      await setKind(kind, {
        content: `body for ${kind}`,
        tool: 'demo.tool',
        language: 'typescript',
        src: 'https://example.test/img.png',
        alt: 'Example',
        source: 'Spec §1',
        href: 'https://example.test/spec',
        timestamp: '2026-05-10T01:23:45Z',
      });
      expect(getRoot(fixture).getAttribute('data-kind')).toBe(kind);
    }
  });

  it('final/reasoning/tool_call/tool_result render content as paragraph body', async () => {
    for (const kind of [
      'final',
      'reasoning',
      'tool_call',
      'tool_result',
    ] as StreamChunkKind[]) {
      await setKind(kind, { content: 'hello' });
      const body = getRoot(fixture).querySelector(
        'p.friendly-stream-chunk__body',
      );
      expect(body?.textContent).toContain('hello');
    }
  });

  it('renders code_block chunks inside <pre><code> with language hint', async () => {
    await setKind('code_block', {
      content: 'const x = 1;',
      language: 'typescript',
    });
    const code = getRoot(fixture).querySelector(
      'pre.friendly-stream-chunk__code code',
    );
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain('const x = 1;');
    expect(code?.getAttribute('data-language')).toBe('typescript');
  });

  it('renders file_write chunks inside <figure><img> with alt + caption', async () => {
    await setKind('file_write', {
      src: 'https://example.test/x.png',
      alt: 'A diagram',
    });
    const root = getRoot(fixture);
    const img = root.querySelector('img.friendly-stream-chunk__image');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.test/x.png');
    expect(img?.getAttribute('alt')).toBe('A diagram');
    expect(
      root.querySelector('figcaption.friendly-stream-chunk__caption')
        ?.textContent,
    ).toContain('A diagram');
  });

  it('renders agent_handoff chunks with link when href present', async () => {
    await setKind('agent_handoff', {
      source: 'planner-agent',
      href: 'agent://planner',
      content: 'Handing off to planner for task decomposition.',
    });
    const link = getRoot(fixture).querySelector(
      'a.friendly-stream-chunk__cite-link',
    );
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('agent://planner');
    expect(link?.textContent).toContain('planner-agent');
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__cite-quote')
        ?.textContent,
    ).toContain('Handing off');
  });

  it('renders agent_handoff chunks without link when href missing', async () => {
    await setKind('agent_handoff', {
      source: 'supervisor',
      content: 'Routing to IoT domain agent.',
    });
    expect(
      getRoot(fixture).querySelector('a.friendly-stream-chunk__cite-link'),
    ).toBeNull();
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__cite-source')
        ?.textContent,
    ).toContain('supervisor');
  });

  it('error chunks default to aria-live="assertive" and role="alert"', async () => {
    await setKind('error', { content: 'kaboom' });
    const root = getRoot(fixture);
    expect(root.getAttribute('aria-live')).toBe('assertive');
    expect(root.getAttribute('role')).toBe('alert');
  });

  it('progress chunks default to aria-live="polite" and role="status"', async () => {
    await setKind('progress', { content: 'ready' });
    const root = getRoot(fixture);
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.getAttribute('role')).toBe('status');
  });

  it('non-live kinds default to aria-live="off"', async () => {
    await setKind('final', { content: 'static' });
    expect(getRoot(fixture).getAttribute('aria-live')).toBe('off');
  });

  it('honours explicit ariaLiveOverride regardless of kind', async () => {
    await setKind('final', { content: 'static' });
    fixture.componentRef.setInput('ariaLiveOverride', 'assertive');
    await fixture.whenStable();
    expect(getRoot(fixture).getAttribute('aria-live')).toBe('assertive');
  });

  it('renders human-readable kind labels with spaces for multi-word kinds', async () => {
    await setKind('tool_call');
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__kind')
        ?.textContent,
    ).toContain('Tool call');

    await setKind('tool_result');
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__kind')
        ?.textContent,
    ).toContain('Tool result');

    await setKind('code_block');
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__kind')
        ?.textContent,
    ).toContain('Code block');

    await setKind('file_write');
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__kind')
        ?.textContent,
    ).toContain('File write');

    await setKind('agent_handoff');
    expect(
      getRoot(fixture).querySelector('.friendly-stream-chunk__kind')
        ?.textContent,
    ).toContain('Agent handoff');
  });

  it('renders timestamp as <time> element when present', async () => {
    await setKind('final', {
      content: 'note',
      timestamp: '2026-05-10T00:00:00Z',
    });
    const time = getRoot(fixture).querySelector(
      'time.friendly-stream-chunk__time',
    );
    expect(time?.getAttribute('datetime')).toBe('2026-05-10T00:00:00Z');
  });
});
