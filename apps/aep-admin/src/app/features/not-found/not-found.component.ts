import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  template: `
    <section class="nf">
      <mat-icon class="nf-icon">block</mat-icon>
      <h1>403 — Forbidden</h1>
      <p>You don't have the required <code>sysadmin</code> role to view this area.</p>
      <a mat-flat-button color="primary" routerLink="/tenants">
        <mat-icon>home</mat-icon>
        Back to Tenants
      </a>
    </section>
  `,
  styles: [
    `
      .nf {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 60vh;
        gap: 16px;
        text-align: center;
        padding: 24px;
      }
      .nf-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: var(--ft-error-700, #d32f2f);
      }
      h1 { margin: 0; }
      p { color: var(--ft-text-secondary, #616161); max-width: 480px; }
    `,
  ],
})
export class NotFoundComponent {}
