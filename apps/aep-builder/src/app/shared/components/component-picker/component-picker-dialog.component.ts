/**
 * @file ComponentPickerDialogComponent — wraps ComponentPickerComponent in a
 * Material dialog so the Page Composer (B2) can open it as a modal (B3).
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  ComponentPickerComponent,
  ComponentTemplate,
} from './component-picker.component';

@Component({
  selector: 'app-component-picker-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    ComponentPickerComponent,
  ],
  template: `
    <div mat-dialog-title class="picker-dialog-title">
      <mat-icon>extension</mat-icon>
      <span>Component Library</span>
    </div>
    <mat-dialog-content class="picker-dialog-content">
      <app-component-picker
        (componentSelected)="onSelected($event)"
      ></app-component-picker>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close aria-label="Cancel and close component picker">
        Cancel
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .picker-dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--ft-font-size-lg);
      font-weight: var(--ft-font-weight-semibold);
    }
    .picker-dialog-content {
      padding: 0;
      min-height: 400px;
    }
  `],
})
export class ComponentPickerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ComponentPickerDialogComponent>);

  onSelected(template: ComponentTemplate): void {
    this.dialogRef.close(template);
  }
}
