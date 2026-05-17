/**
 * @file ComponentPickerDialogComponent unit tests.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentPickerDialogComponent } from './component-picker-dialog.component';
import { ComponentTemplate } from './component-picker.component';

describe('ComponentPickerDialogComponent', () => {
  let component: ComponentPickerDialogComponent;
  let dialogClose: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogClose = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ComponentPickerDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close: dialogClose } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ComponentPickerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('closes the dialog with the selected template when onSelected is called', () => {
    const template: ComponentTemplate = {
      id: 'tpl-1',
      name: 'Test',
      category: 'layout',
      description: 'A test template',
      icon: 'widgets',
      tags: ['test'],
    } as ComponentTemplate;

    component.onSelected(template);
    expect(dialogClose).toHaveBeenCalledWith(template);
  });
});
