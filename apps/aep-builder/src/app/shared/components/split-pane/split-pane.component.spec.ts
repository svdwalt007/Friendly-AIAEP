/**
 * @file SplitPaneComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SplitPaneComponent } from './split-pane.component';

function build(
  overrides: Partial<{
    direction: 'horizontal' | 'vertical';
    initialSplit: number;
    minSize: number;
    maxSize: number;
    resizable: boolean;
  }> = {},
): {
  fixture: ComponentFixture<SplitPaneComponent>;
  cmp: SplitPaneComponent;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [SplitPaneComponent] });
  const fixture = TestBed.createComponent(SplitPaneComponent);
  const cmp = fixture.componentInstance;
  Object.assign(cmp, overrides);
  fixture.detectChanges();
  return { fixture, cmp };
}

describe('SplitPaneComponent', () => {
  beforeEach(() => undefined);

  it('ngOnInit clamps initialSplit into [minSize, maxSize]', () => {
    const { cmp } = build({ initialSplit: 90, minSize: 20, maxSize: 80 });
    expect(cmp.splitPosition()).toBe(80);
  });

  it('ngOnInit clamps to minSize when initialSplit < minSize', () => {
    const { cmp } = build({ initialSplit: 5, minSize: 20, maxSize: 80 });
    expect(cmp.splitPosition()).toBe(20);
  });

  it('isHorizontal reflects the direction input', () => {
    const { cmp: h } = build({ direction: 'horizontal' });
    expect(h.isHorizontal()).toBe(true);

    const { cmp: v } = build({ direction: 'vertical' });
    expect(v.isHorizontal()).toBe(false);
  });

  it('leftPaneStyle uses width for horizontal and height for vertical', () => {
    const { cmp: h } = build({ direction: 'horizontal', initialSplit: 30 });
    expect(h.leftPaneStyle()).toEqual({ width: '30%' });

    const { cmp: v } = build({ direction: 'vertical', initialSplit: 40 });
    expect(v.leftPaneStyle()).toEqual({ height: '40%' });
  });

  it('rightPaneStyle is the complement (100 - split)', () => {
    const { cmp } = build({ direction: 'horizontal', initialSplit: 30 });
    expect(cmp.rightPaneStyle()).toEqual({ width: '70%' });
  });

  it('keyboard ArrowRight increments split by 5%, clamped to maxSize', () => {
    const { cmp } = build({ initialSplit: 50, minSize: 20, maxSize: 80 });
    const emits: number[] = [];
    cmp.splitChange.subscribe((v) => emits.push(v));

    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(cmp.splitPosition()).toBe(55);
    expect(emits).toEqual([55]);
  });

  it('keyboard ArrowLeft decrements split by 5%, clamped to minSize', () => {
    const { cmp } = build({ initialSplit: 50 });
    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(cmp.splitPosition()).toBe(45);
  });

  it('keyboard ArrowUp / ArrowDown also drive the split (vertical-friendly)', () => {
    const { cmp } = build({ initialSplit: 50 });
    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(cmp.splitPosition()).toBe(45);
    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(cmp.splitPosition()).toBe(50);
  });

  it('Home snaps to minSize, End snaps to maxSize', () => {
    const { cmp } = build({ initialSplit: 50, minSize: 25, maxSize: 75 });
    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(cmp.splitPosition()).toBe(25);
    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'End' }));
    expect(cmp.splitPosition()).toBe(75);
  });

  it('unknown keys do not change the split', () => {
    const { cmp } = build({ initialSplit: 50 });
    cmp.onDividerKeyDown(new KeyboardEvent('keydown', { key: 'a' }));
    expect(cmp.splitPosition()).toBe(50);
  });

  it('disabling resizable makes keyboard / mouse handlers no-op', () => {
    const { cmp } = build({ initialSplit: 50, resizable: false });
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    cmp.onDividerKeyDown(ev);
    expect(cmp.splitPosition()).toBe(50);

    cmp.onDividerMouseDown(new MouseEvent('mousedown'));
    expect(cmp.getDraggingClass()).toBe('');
  });

  it('onDividerMouseDown starts dragging when resizable', () => {
    const { cmp } = build({ resizable: true });
    const startSpy = vi.fn();
    cmp.resizeStart.subscribe(startSpy);

    cmp.onDividerMouseDown(new MouseEvent('mousedown'));
    expect(startSpy).toHaveBeenCalledOnce();
    expect(cmp.getDraggingClass()).toBe('dragging');

    // Cleanup global listeners by simulating mouseup
    document.dispatchEvent(
      Object.assign(new MouseEvent('mouseup'), {
        preventDefault: () => undefined,
      }),
    );
  });

  it('ngOnDestroy removes the active document listeners (no leaks)', () => {
    const { cmp, fixture } = build({ resizable: true });
    cmp.onDividerMouseDown(new MouseEvent('mousedown'));
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    fixture.destroy();
    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('getDraggingClass reflects the dragging state', () => {
    const { cmp } = build({ resizable: true });
    expect(cmp.getDraggingClass()).toBe('');
    cmp.onDividerMouseDown(new MouseEvent('mousedown'));
    expect(cmp.getDraggingClass()).toBe('dragging');
  });
});
