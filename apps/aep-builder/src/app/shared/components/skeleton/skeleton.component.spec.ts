/**
 * @file SkeletonComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SkeletonComponent } from './skeleton.component';

describe('SkeletonComponent', () => {
  let fixture: ComponentFixture<SkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SkeletonComponent);
  });

  it('renders with the documented defaults when no inputs are given', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('.skeleton') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('20px');
    expect(el.style.borderRadius).toBe('var(--ft-radius-sm)');
  });

  it('applies width / height / border-radius overrides verbatim', async () => {
    fixture.componentRef.setInput('width', '240px');
    fixture.componentRef.setInput('height', '40px');
    fixture.componentRef.setInput('borderRadius', '8px');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('.skeleton') as HTMLElement;
    expect(el.style.width).toBe('240px');
    expect(el.style.height).toBe('40px');
    expect(el.style.borderRadius).toBe('8px');
  });
});
