/**
 * @file TokenSpendComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';

import { TokenSpendComponent } from './token-spend.component';

describe('TokenSpendComponent', () => {
  let component: TokenSpendComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenSpendComponent, NoopAnimationsModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(TokenSpendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('seeds the usage table with five rolling-30d model rows', () => {
    expect(component.usage().length).toBe(5);
    expect(component.usage().map((u) => u.model)).toContain('claude-sonnet-4.7');
  });

  it('computes the total cost as the sum of all model costs', () => {
    const sum = component.usage().reduce((a, u) => a + u.costUsd, 0);
    expect(component.total()).toBeCloseTo(sum, 2);
    expect(component.total()).toBeGreaterThan(0);
  });

  it('appends a TOTAL row to the table data with summed columns', () => {
    const rows = component.rows();
    const total = rows[rows.length - 1];
    expect(total.model).toBe('TOTAL');
    expect(total.isTotal).toBe(true);

    const inputs = component
      .usage()
      .reduce((a, u) => a + u.inputTokens, 0);
    expect(total.inputTokens).toBe(inputs);
  });

  it('barHeight scales the value against the daily maximum', () => {
    const daily = [10, 20, 40];
    expect(component.barHeight(40, daily)).toBe(64);
    expect(component.barHeight(20, daily)).toBe(32);
    expect(component.barHeight(0, daily)).toBe(2);
  });

  it('barHeight clamps to a minimum visible bar of 4 for tiny positives', () => {
    expect(component.barHeight(1, [100])).toBe(4);
  });

  it.each([
    ['Anthropic', '#d97706'],
    ['Google', '#1976d2'],
    ['Ollama (self-host)', '#388e3c'],
    ['Cohere', '#616161'],
  ] as const)('barColor for %s returns %s', (provider, hex) => {
    expect(component.barColor(provider)).toBe(hex);
  });
});
