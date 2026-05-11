/**
 * @file Friendly Stat Card — unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FriendlyStatCard } from './stat-card';

function getCard(fixture: ComponentFixture<FriendlyStatCard>): HTMLElement {
  const el = fixture.nativeElement.querySelector('article.friendly-stat-card');
  expect(el).toBeTruthy();
  return el as HTMLElement;
}

describe('FriendlyStatCard', () => {
  let fixture: ComponentFixture<FriendlyStatCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FriendlyStatCard],
    }).compileComponents();
    fixture = TestBed.createComponent(FriendlyStatCard);
    fixture.componentRef.setInput('label', 'Active devices');
    fixture.componentRef.setInput('value', 1234);
    await fixture.whenStable();
  });

  it('renders label and value', () => {
    const card = getCard(fixture);
    expect(
      card.querySelector('.friendly-stat-card__label')?.textContent,
    ).toContain('Active devices');
    expect(
      card.querySelector('.friendly-stat-card__amount')?.textContent,
    ).toContain('1234');
  });

  it('omits delta block when delta is null', () => {
    expect(
      getCard(fixture).querySelector('.friendly-stat-card__delta'),
    ).toBeNull();
  });

  it('renders unit when provided', async () => {
    fixture.componentRef.setInput('unit', 'ms');
    await fixture.whenStable();
    expect(
      getCard(fixture).querySelector('.friendly-stat-card__unit')?.textContent,
    ).toContain('ms');
  });

  it('derives trend "up" from positive delta and renders +sign', async () => {
    fixture.componentRef.setInput('delta', 12);
    await fixture.whenStable();

    const card = getCard(fixture);
    expect(card.getAttribute('data-trend')).toBe('up');
    const delta = card.querySelector('.friendly-stat-card__delta');
    expect(delta?.classList.contains('friendly-stat-card__delta--up')).toBe(
      true,
    );
    expect(
      delta
        ?.querySelector('.friendly-stat-card__delta-value')
        ?.textContent?.trim(),
    ).toBe('+12');
    expect(
      delta
        ?.querySelector('.friendly-stat-card__delta-icon')
        ?.textContent?.trim(),
    ).toBe('▲');
  });

  it('derives trend "down" from negative delta', async () => {
    fixture.componentRef.setInput('delta', -3);
    await fixture.whenStable();
    const card = getCard(fixture);
    expect(card.getAttribute('data-trend')).toBe('down');
    expect(card.querySelector('.friendly-stat-card__delta--down')).toBeTruthy();
    expect(
      card
        .querySelector('.friendly-stat-card__delta-value')
        ?.textContent?.trim(),
    ).toBe('-3');
  });

  it('derives trend "flat" from zero delta', async () => {
    fixture.componentRef.setInput('delta', 0);
    await fixture.whenStable();
    expect(getCard(fixture).getAttribute('data-trend')).toBe('flat');
  });

  it('honours an explicit trend override regardless of delta sign', async () => {
    fixture.componentRef.setInput('delta', -5);
    fixture.componentRef.setInput('trend', 'up');
    await fixture.whenStable();
    expect(getCard(fixture).getAttribute('data-trend')).toBe('up');
  });

  it('embeds a <friendly-spark> by default and removes it when disabled', async () => {
    expect(getCard(fixture).querySelector('friendly-spark')).toBeTruthy();
    fixture.componentRef.setInput('showSpark', false);
    await fixture.whenStable();
    expect(getCard(fixture).querySelector('friendly-spark')).toBeNull();
  });

  it('forwards the spark seed deterministically', async () => {
    fixture.componentRef.setInput('sparkSeed', 42);
    await fixture.whenStable();
    const first = getCard(fixture)
      .querySelector('friendly-spark polyline')
      ?.getAttribute('points');
    expect(first).toBeTruthy();

    fixture.componentRef.setInput('sparkSeed', 9);
    await fixture.whenStable();
    const changed = getCard(fixture)
      .querySelector('friendly-spark polyline')
      ?.getAttribute('points');
    expect(changed).toBeTruthy();
    expect(changed).not.toBe(first);

    fixture.componentRef.setInput('sparkSeed', 42);
    await fixture.whenStable();
    const restored = getCard(fixture)
      .querySelector('friendly-spark polyline')
      ?.getAttribute('points');
    expect(restored).toBe(first);
  });

  it('forwards an aria-label when provided', async () => {
    fixture.componentRef.setInput('ariaLabel', 'Active devices KPI');
    await fixture.whenStable();
    expect(getCard(fixture).getAttribute('aria-label')).toBe(
      'Active devices KPI',
    );
  });
});
