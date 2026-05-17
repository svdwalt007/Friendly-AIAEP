/**
 * @file DeployPipelineComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { DeployPipelineComponent } from './deploy-pipeline.component';

const STAGE_DELAY_MS = 1500;
const TOTAL_STAGES = 4;

async function createFixture(
  id = 'proj-7',
): Promise<ComponentFixture<DeployPipelineComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [DeployPipelineComponent, NoopAnimationsModule],
  }).compileComponents();
  const fixture = TestBed.createComponent(DeployPipelineComponent);
  fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  return fixture;
}

describe('DeployPipelineComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with four pending stages and an idle placeholder log', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;
    expect(cmp.stages()).toHaveLength(TOTAL_STAGES);
    expect(cmp.stages().every((s) => s.status === 'pending')).toBe(true);
    expect(cmp.running()).toBe(false);
    expect(cmp.visibleLogs()).toEqual([]);
    expect(cmp.logText()).toContain('[idle]');
  });

  it('moves the first stage to running on trigger and disables re-entry', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.trigger();
    expect(cmp.running()).toBe(true);
    expect(cmp.stages()[0].status).toBe('running');
    expect(cmp.stages()[1].status).toBe('pending');

    // Re-entry must be a no-op (does not reset stages or restart).
    cmp.trigger();
    expect(cmp.stages()[0].status).toBe('running');
  });

  it('advances through every stage to done with recorded durations', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.trigger();
    for (let i = 0; i < TOTAL_STAGES; i++) {
      vi.advanceTimersByTime(STAGE_DELAY_MS);
    }

    const stages = cmp.stages();
    expect(stages.every((s) => s.status === 'done')).toBe(true);
    expect(stages.every((s) => s.durationMs === STAGE_DELAY_MS)).toBe(true);
    expect(cmp.running()).toBe(false);
  });

  it('accumulates logs as stages complete', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.trigger();
    expect(cmp.visibleLogs().some((line) => line.startsWith('[generate]'))).toBe(
      true,
    );

    vi.advanceTimersByTime(STAGE_DELAY_MS);
    expect(cmp.visibleLogs().some((line) => line.startsWith('[build]'))).toBe(
      true,
    );

    vi.advanceTimersByTime(STAGE_DELAY_MS);
    expect(cmp.visibleLogs().some((line) => line.startsWith('[deploy]'))).toBe(
      true,
    );

    vi.advanceTimersByTime(STAGE_DELAY_MS);
    expect(cmp.visibleLogs().some((line) => line.startsWith('[verify]'))).toBe(
      true,
    );

    vi.advanceTimersByTime(STAGE_DELAY_MS);
    expect(cmp.logText()).toContain('[verify]');
    expect(cmp.logText().split('\n').length).toBeGreaterThan(15);
  });

  it('resets stage state when trigger is called after completion', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;

    cmp.trigger();
    for (let i = 0; i < TOTAL_STAGES; i++) {
      vi.advanceTimersByTime(STAGE_DELAY_MS);
    }
    expect(cmp.running()).toBe(false);

    cmp.trigger();
    expect(cmp.running()).toBe(true);
    expect(cmp.stages()[0].status).toBe('running');
    expect(cmp.stages()[1].status).toBe('pending');
    expect(cmp.stages()[1].durationMs).toBe(0);
  });

  it('exposes the project id input on the rendered header', async () => {
    const fixture = await createFixture('proj-xyz');
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.deploy-sub code')?.textContent).toContain(
      'proj-xyz',
    );
  });

  it('flips the trigger button label while running', async () => {
    const fixture = await createFixture();
    const cmp = fixture.componentInstance;
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector('button[mat-flat-button]')?.textContent).toContain(
      'Trigger Deploy',
    );

    cmp.trigger();
    fixture.detectChanges();
    expect(host.querySelector('button[mat-flat-button]')?.textContent).toContain(
      'Deploying',
    );
  });
});
