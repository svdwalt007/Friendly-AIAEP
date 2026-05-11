/**
 * @file Friendly Primary directive tests — orange singleton enforcement.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FriendlyPrimary,
  FriendlyPrimarySingletonError,
} from './friendly-primary';

@Component({
  template: `<button friendlyPrimary>Primary</button>`,
  standalone: true,
  imports: [FriendlyPrimary],
})
class SinglePrimary {}

@Component({
  template: `
    <button friendlyPrimary>First</button>
    <button friendlyPrimary>Second</button>
  `,
  standalone: true,
  imports: [FriendlyPrimary],
})
class DoublePrimary {}

describe('FriendlyPrimary', () => {
  afterEach(() => {
    // Reset module-level singleton state between tests
    TestBed.resetTestingModule();
  });

  it('mounts without error when it is the only instance', () => {
    expect(() => {
      TestBed.configureTestingModule({ imports: [SinglePrimary] });
      const fixture = TestBed.createComponent(SinglePrimary);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('throws FriendlyPrimarySingletonError when a second instance mounts', () => {
    TestBed.configureTestingModule({ imports: [DoublePrimary] });
    const fixture = TestBed.createComponent(DoublePrimary);
    expect(() => fixture.detectChanges()).toThrow(
      FriendlyPrimarySingletonError,
    );
  });

  it('adds the data-friendly-primary attribute to the host', () => {
    TestBed.configureTestingModule({ imports: [SinglePrimary] });
    const fixture = TestBed.createComponent(SinglePrimary);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.hasAttribute('data-friendly-primary')).toBe(true);
  });

  it('sets --ft-primary-accent-instance custom property on host', () => {
    TestBed.configureTestingModule({ imports: [SinglePrimary] });
    const fixture = TestBed.createComponent(SinglePrimary);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.style.getPropertyValue('--ft-primary-accent-instance')).toBe(
      'active',
    );
  });
});
