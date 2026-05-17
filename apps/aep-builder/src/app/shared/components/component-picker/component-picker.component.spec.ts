/**
 * @file ComponentPickerComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentPickerComponent,
  ComponentTemplate,
} from './component-picker.component';

function build(): {
  fixture: ComponentFixture<ComponentPickerComponent>;
  cmp: ComponentPickerComponent;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ComponentPickerComponent, NoopAnimationsModule],
  });
  const fixture = TestBed.createComponent(ComponentPickerComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance };
}

const sample: ComponentTemplate[] = [
  {
    id: 'card',
    name: 'Hero Card',
    description: 'A large hero card',
    category: 'layout',
    icon: 'view_quilt',
    tags: ['hero', 'card', 'banner'],
  },
  {
    id: 'table',
    name: 'Data Table',
    description: 'Sortable data table',
    category: 'data-display',
    icon: 'table_chart',
    tags: ['table', 'grid'],
  },
  {
    id: 'chart',
    name: 'Line Chart',
    description: 'Time-series chart',
    category: 'charts',
    icon: 'show_chart',
    tags: ['chart', 'line', 'time'],
  },
];

describe('ComponentPickerComponent', () => {
  beforeEach(() => undefined);

  it('seeds with a non-empty default component catalog', () => {
    const { cmp } = build();
    expect(cmp.filteredComponents().length).toBeGreaterThan(0);
  });

  it('components setter writes through to the internal signal', () => {
    const { cmp } = build();
    cmp.components = sample;
    expect(cmp.filteredComponents().length).toBe(3);
  });

  it('exposes 9 categories including the All entry', () => {
    const { cmp } = build();
    expect(cmp.categories.length).toBe(9);
    expect(cmp.categories[0].id).toBe('all');
  });

  it('filteredComponents starts with "all" selected and no search', () => {
    const { cmp } = build();
    cmp.components = sample;
    expect(cmp.filteredComponents().map((c) => c.id).sort()).toEqual([
      'card',
      'chart',
      'table',
    ]);
  });

  it('onSearchChange filters by name (case-insensitive)', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onSearchChange('CHART');
    const results = cmp.filteredComponents();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('chart');
  });

  it('onSearchChange also matches description', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onSearchChange('sortable');
    expect(cmp.filteredComponents().map((c) => c.id)).toEqual(['table']);
  });

  it('onSearchChange also matches tags', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onSearchChange('banner');
    expect(cmp.filteredComponents().map((c) => c.id)).toEqual(['card']);
  });

  it('empty query restores the full filtered list', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onSearchChange('chart');
    cmp.onSearchChange('');
    expect(cmp.filteredComponents().length).toBe(3);
  });

  it('onCategorySelect narrows the list to a single category', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onCategorySelect('charts');
    expect(cmp.filteredComponents().map((c) => c.id)).toEqual(['chart']);
  });

  it('onCategorySelect("all") restores everything', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onCategorySelect('layout');
    cmp.onCategorySelect('all');
    expect(cmp.filteredComponents().length).toBe(3);
  });

  it('search + category compose (AND, not OR)', () => {
    const { cmp } = build();
    cmp.components = sample;
    cmp.onCategorySelect('layout');
    cmp.onSearchChange('hero');
    expect(cmp.filteredComponents().map((c) => c.id)).toEqual(['card']);

    cmp.onSearchChange('chart');
    expect(cmp.filteredComponents()).toEqual([]);
  });

  it('isSelectedCategory reflects the active category', () => {
    const { cmp } = build();
    expect(cmp.isSelectedCategory('all')).toBe(true);
    cmp.onCategorySelect('charts');
    expect(cmp.isSelectedCategory('charts')).toBe(true);
    expect(cmp.isSelectedCategory('all')).toBe(false);
  });

  it('onComponentClick emits componentSelected with the supplied template', () => {
    const { cmp } = build();
    const spy = vi.fn();
    cmp.componentSelected.subscribe(spy);
    cmp.onComponentClick(sample[0]);
    expect(spy).toHaveBeenCalledWith(sample[0]);
  });

  it('onComponentHover emits componentPreviewed with the supplied template', () => {
    const { cmp } = build();
    const spy = vi.fn();
    cmp.componentPreviewed.subscribe(spy);
    cmp.onComponentHover(sample[1]);
    expect(spy).toHaveBeenCalledWith(sample[1]);
  });

  it('getCategoryIcon returns the catalogued icon for known categories', () => {
    const { cmp } = build();
    expect(cmp.getCategoryIcon('charts')).toBe('show_chart');
    expect(cmp.getCategoryIcon('layout')).toBe('view_quilt');
    expect(cmp.getCategoryIcon('iot')).toBe('sensors');
  });

  it('getCategoryIcon falls back to extension for an unknown category', () => {
    const { cmp } = build();
    expect(cmp.getCategoryIcon('not-a-category')).toBe('extension');
  });
});
