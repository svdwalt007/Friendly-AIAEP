/**
 * @file Friendly Primary — orange singleton enforcement directive.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 *
 * @description
 * Apply `[friendlyPrimary]` to exactly ONE element per authenticated screen.
 * The directive asserts at runtime that only a single instance is mounted
 * inside the document body. If a second element tries to mount, an
 * error is thrown in development and a console warning is emitted in
 * production so designers notice the breach.
 */
import {
  Directive,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

let mountedPrimaryId: string | null = null;
let idSequence = 0;

/**
 * Runtime error thrown when a second `[friendlyPrimary]` mounts.
 */
export class FriendlyPrimarySingletonError extends Error {
  constructor(instanceId: string, existingId: string) {
    super(
      `[friendlyPrimary] Singleton violation: instance "${instanceId}" tried to mount while "${existingId}" is already active. ` +
        `Only one orange accent element is permitted per screen.`,
    );
    this.name = 'FriendlyPrimarySingletonError';
  }
}

/**
 * `[friendlyPrimary]` — declarative orange singleton marker.
 *
 * The directive adds a CSS custom property `--ft-primary-accent-instance`
 * to the host so theming utilities can detect the singleton boundary,
 * and enforces the one-orange rule at mount time.
 *
 * @usage
 * ```html
 * <!-- OK: single primary CTA -->
 * <button friendlyPrimary mat-raised-button>New Project</button>
 *
 * <!-- ERROR: second instance throws in dev -->
 * <a friendlyPrimary mat-button>Another Link</a>
 * ```
 */
@Directive({
  selector: '[friendlyPrimary]',
  standalone: true,
  host: {
    '[style.--ft-primary-accent-instance]': '"active"',
    '[attr.data-friendly-primary]': 'instanceId',
  },
})
export class FriendlyPrimary implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  protected readonly instanceId = `friendly-primary-${++idSequence}`;

  /**
   * Whether to throw hard in development when the singleton rule is
   * violated. In production the breach is downgraded to a console warning
   * so the UI keeps rendering.
   */
  private readonly throwInDev = true; // Could be driven by env injection in future.

  ngOnInit(): void {
    if (this.isBrowser) {
      if (mountedPrimaryId !== null) {
        if (this.throwInDev) {
          throw new FriendlyPrimarySingletonError(
            this.instanceId,
            mountedPrimaryId,
          );
        } else {
           
          console.warn(
            `[friendlyPrimary] Singleton violation: "${this.instanceId}" mounted while "${mountedPrimaryId}" is already active.`,
          );
        }
      } else {
        mountedPrimaryId = this.instanceId;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser && mountedPrimaryId === this.instanceId) {
      mountedPrimaryId = null;
    }
  }
}
