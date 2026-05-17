/**
 * @file LlmProvidersComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';

import { LlmProvidersComponent } from './llm-providers.component';

describe('LlmProvidersComponent', () => {
  let component: LlmProvidersComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmProvidersComponent, NoopAnimationsModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(LlmProvidersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('seeds five provider rows across five tenants', () => {
    expect(component.providers().length).toBe(5);
    expect(component.tenants.length).toBe(5);
    expect(component.providers().map((p) => p.id)).toEqual([
      'anthropic',
      'google',
      'openai',
      'ollama',
      'azure',
    ]);
  });

  it('builds the column list with provider + per-tenant + action columns', () => {
    const cols = component.columns();
    expect(cols[0]).toBe('provider');
    expect(cols[cols.length - 1]).toBe('action');
    expect(cols.length).toBe(2 + component.tenants.length);
  });

  it('starts with no provider selected and a null selected snapshot', () => {
    expect(component.selectedId()).toBeNull();
    expect(component.selected()).toBeNull();
  });

  it('edit() sets selectedId, and selected() returns the matching provider', () => {
    const target = component.providers()[2];
    component.edit(target);
    expect(component.selectedId()).toBe(target.id);
    expect(component.selected()?.id).toBe(target.id);
    expect(component.selected()?.name).toBe(target.name);
  });

  it('closePanel() resets the selection', () => {
    component.edit(component.providers()[0]);
    component.closePanel();
    expect(component.selectedId()).toBeNull();
    expect(component.selected()).toBeNull();
  });

  it('selected() returns null when the id no longer matches a row', () => {
    component.edit(component.providers()[0]);
    component.providers.set([]);
    expect(component.selected()).toBeNull();
  });

  it('masked() formats a last-4 fragment with the placeholder pattern', () => {
    expect(component.masked('a4F2')).toBe('••••••••••••[a4F2]');
    expect(component.masked('')).toBe('••••••••••••[]');
  });
});
