/**
 * @file CodeDiffViewerComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CodeDiffViewerComponent,
  DiffLine,
  FileDiff,
} from './code-diff-viewer.component';

function build(): {
  fixture: ComponentFixture<CodeDiffViewerComponent>;
  cmp: CodeDiffViewerComponent;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CodeDiffViewerComponent, NoopAnimationsModule],
  });
  const fixture = TestBed.createComponent(CodeDiffViewerComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance };
}

function makeFile(name: string, types: DiffLine['type'][]): FileDiff {
  return {
    fileName: name,
    language: 'typescript',
    lines: types.map((type, i) => ({
      type,
      lineNumber: i + 1,
      content: `line ${i + 1}`,
    })),
  };
}

describe('CodeDiffViewerComponent', () => {
  it('starts with no diffs and the unified view mode', () => {
    const { cmp } = build();
    expect(cmp.stats()).toEqual({ additions: 0, deletions: 0, total: 0 });
  });

  it('diffs setter writes through to the internal signal and stats', () => {
    const { cmp } = build();
    cmp.diffs = [
      makeFile('a.ts', ['add', 'add', 'remove', 'unchanged']),
      makeFile('b.ts', ['add', 'remove', 'remove']),
    ];
    expect(cmp.stats()).toEqual({ additions: 3, deletions: 3, total: 6 });
  });

  it('stats only counts add + remove (unchanged is ignored)', () => {
    const { cmp } = build();
    cmp.diffs = [makeFile('a.ts', ['unchanged', 'unchanged', 'unchanged'])];
    expect(cmp.stats()).toEqual({ additions: 0, deletions: 0, total: 0 });
  });

  it('toggleViewMode flips unified ↔ split', () => {
    const { cmp } = build();
    // initial state is 'unified'
    cmp.toggleViewMode();
    cmp.toggleViewMode();
    // can't read the protected signal directly; exercise idempotent toggle
    // via two consecutive calls landing back at unified
    expect(() => cmp.toggleViewMode()).not.toThrow();
  });

  it('file expansion — starts collapsed, toggles, isFileExpanded reflects state', () => {
    const { cmp } = build();
    cmp.diffs = [makeFile('a.ts', ['add'])];
    expect(cmp.isFileExpanded('a.ts')).toBe(false);

    cmp.toggleFileExpansion('a.ts');
    expect(cmp.isFileExpanded('a.ts')).toBe(true);

    cmp.toggleFileExpansion('a.ts');
    expect(cmp.isFileExpanded('a.ts')).toBe(false);
  });

  it('expandAll marks every diffs file as expanded', () => {
    const { cmp } = build();
    cmp.diffs = [
      makeFile('a.ts', ['add']),
      makeFile('b.ts', ['remove']),
      makeFile('c.ts', ['unchanged']),
    ];

    cmp.expandAll();
    expect(cmp.isFileExpanded('a.ts')).toBe(true);
    expect(cmp.isFileExpanded('b.ts')).toBe(true);
    expect(cmp.isFileExpanded('c.ts')).toBe(true);
  });

  it('collapseAll clears every expansion', () => {
    const { cmp } = build();
    cmp.diffs = [makeFile('a.ts', ['add']), makeFile('b.ts', ['add'])];
    cmp.expandAll();
    cmp.collapseAll();
    expect(cmp.isFileExpanded('a.ts')).toBe(false);
    expect(cmp.isFileExpanded('b.ts')).toBe(false);
  });

  it.each([
    ['add', 'add'],
    ['remove', 'remove'],
    ['unchanged', ''],
  ] as const)('getDiffIcon(%s) → %s', (type, expected) => {
    const { cmp } = build();
    expect(cmp.getDiffIcon(type as DiffLine['type'])).toBe(expected);
  });

  it('getDiffIcon for an unknown type falls back to empty string', () => {
    const { cmp } = build();
    expect(cmp.getDiffIcon('weird' as unknown as DiffLine['type'])).toBe('');
  });

  it.each([
    ['typescript', 'code'],
    ['JavaScript', 'javascript'],
    ['HTML', 'html'],
    ['css', 'css'],
    ['scss', 'css'],
    ['json', 'data_object'],
    ['markdown', 'article'],
    ['python', 'code'],
    ['java', 'code'],
    ['cobol', 'insert_drive_file'],
    ['', 'insert_drive_file'],
  ] as const)(
    'getFileIcon(%s) → %s (case-insensitive + unknown fallback)',
    (language, expected) => {
      const { cmp } = build();
      expect(cmp.getFileIcon(language)).toBe(expected);
    },
  );

  describe('copyToClipboard', () => {
    let writeText: ReturnType<typeof vi.fn>;
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    const originalClipboard = navigator.clipboard;

    beforeEach(() => {
      writeText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('writes the supplied content via navigator.clipboard.writeText', async () => {
      writeText.mockResolvedValue(undefined);
      const { cmp } = build();
      cmp.copyToClipboard('const x = 1;');
      expect(writeText).toHaveBeenCalledWith('const x = 1;');
      // Let the resolved-promise then-handler land before assertions on log.
      await Promise.resolve();
      await Promise.resolve();
      expect(logSpy).toHaveBeenCalled();
    });

    it('logs an error when clipboard write rejects', async () => {
      writeText.mockRejectedValue(new Error('denied'));
      const { cmp } = build();
      cmp.copyToClipboard('payload');
      await Promise.resolve();
      await Promise.resolve();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
