import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="skeleton"
      [style.width]="width()"
      [style.height]="height()"
      [style.border-radius]="borderRadius()"
    ></div>
  `,
  styles: [`
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--ft-surface-secondary) 25%,
        var(--ft-surface-hover) 50%,
        var(--ft-surface-secondary) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  width = input('100%');
  height = input('20px');
  borderRadius = input('var(--ft-radius-sm)');
}
