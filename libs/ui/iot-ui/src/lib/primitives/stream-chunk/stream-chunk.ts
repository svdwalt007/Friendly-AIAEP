/**
 * @file Friendly Stream Chunk — agentic UX message-chunk renderer.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * Discriminator for one of the nine canonical AEP v2 stream chunk kinds.
 *
 * The agentic UX surface emits a typed, replayable stream of these chunks;
 * each `kind` selects a distinct visual treatment and accessibility role.
 */
export type StreamChunkKind =
  | 'text'
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'code'
  | 'image'
  | 'error'
  | 'status'
  | 'citation';

/**
 * Render-time payload accompanying a chunk. Optional fields are surfaced
 * only when the corresponding data is present, keeping the DOM minimal.
 */
export interface StreamChunkPayload {
  /** Free-form body text — used by every kind except `image`. */
  readonly content?: string | null;
  /** Tool/function name for `tool_call` and `tool_result` chunks. */
  readonly tool?: string | null;
  /** Programming language hint for `code` chunks (e.g. "typescript"). */
  readonly language?: string | null;
  /** Image source URL for `image` chunks. */
  readonly src?: string | null;
  /** Image alt text for `image` chunks. */
  readonly alt?: string | null;
  /** Citation source label (publication, file, URL). */
  readonly source?: string | null;
  /** Citation URL/anchor for `citation` chunks. */
  readonly href?: string | null;
  /** Optional ISO-8601 timestamp displayed as a tooltip. */
  readonly timestamp?: string | null;
}

/** Lookup-table glyphs keyed by chunk kind; used purely as visual cues. */
const GLYPH_BY_KIND: Readonly<Record<StreamChunkKind, string>> = {
  text: '✎',
  thought: '✦',
  tool_call: '⚙',
  tool_result: '↩',
  code: '⌨',
  image: '🖼',
  error: '⚠',
  status: '●',
  citation: '❝',
};

/** Accessible role per chunk kind — used for AT semantics. */
const ROLE_BY_KIND: Readonly<Record<StreamChunkKind, string>> = {
  text: 'article',
  thought: 'note',
  tool_call: 'note',
  tool_result: 'note',
  code: 'group',
  image: 'figure',
  error: 'alert',
  status: 'status',
  citation: 'note',
};

/**
 * <friendly-stream-chunk>
 *
 * Renders a single stream chunk emitted by the AEP v2 agent runtime.
 * Selects template & accent based on `kind`. Pure presentational; no I/O,
 * no timers; safe for SSR.
 */
@Component({
  selector: 'friendly-stream-chunk',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="friendly-stream-chunk"
      [class.friendly-stream-chunk--text]="kind() === 'text'"
      [class.friendly-stream-chunk--thought]="kind() === 'thought'"
      [class.friendly-stream-chunk--tool-call]="kind() === 'tool_call'"
      [class.friendly-stream-chunk--tool-result]="kind() === 'tool_result'"
      [class.friendly-stream-chunk--code]="kind() === 'code'"
      [class.friendly-stream-chunk--image]="kind() === 'image'"
      [class.friendly-stream-chunk--error]="kind() === 'error'"
      [class.friendly-stream-chunk--status]="kind() === 'status'"
      [class.friendly-stream-chunk--citation]="kind() === 'citation'"
      [attr.data-kind]="kind()"
      [attr.role]="role()"
      [attr.aria-live]="ariaLive()"
    >
      <header class="friendly-stream-chunk__header">
        <span class="friendly-stream-chunk__glyph" aria-hidden="true">{{
          glyph()
        }}</span>
        <span class="friendly-stream-chunk__kind">{{ humanKind() }}</span>
        @if (payload()?.tool) {
          <span class="friendly-stream-chunk__tool">{{ payload()?.tool }}</span>
        }
        @if (payload()?.timestamp) {
          <time
            class="friendly-stream-chunk__time"
            [attr.datetime]="payload()?.timestamp"
          >
            {{ payload()?.timestamp }}
          </time>
        }
      </header>

      @switch (kind()) {
        @case ('code') {
          <pre
            class="friendly-stream-chunk__code"
          ><code [attr.data-language]="payload()?.language">{{
            payload()?.content
          }}</code></pre>
        }
        @case ('image') {
          <figure class="friendly-stream-chunk__figure">
            <img
              class="friendly-stream-chunk__image"
              [attr.src]="payload()?.src"
              [attr.alt]="payload()?.alt ?? ''"
              loading="lazy"
            />
            @if (payload()?.alt) {
              <figcaption class="friendly-stream-chunk__caption">
                {{ payload()?.alt }}
              </figcaption>
            }
          </figure>
        }
        @case ('citation') {
          <p class="friendly-stream-chunk__body">
            @if (payload()?.href) {
              <a
                class="friendly-stream-chunk__cite-link"
                [attr.href]="payload()?.href"
              >
                {{ payload()?.source ?? payload()?.href }}
              </a>
            } @else if (payload()?.source) {
              <span class="friendly-stream-chunk__cite-source">{{
                payload()?.source
              }}</span>
            }
            @if (payload()?.content) {
              <span class="friendly-stream-chunk__cite-quote">{{
                payload()?.content
              }}</span>
            }
          </p>
        }
        @default {
          @if (payload()?.content) {
            <p class="friendly-stream-chunk__body">{{ payload()?.content }}</p>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .friendly-stream-chunk {
        display: flex;
        flex-direction: column;
        gap: var(--ft-density-spacing-xs, 4px);
        padding: var(--ft-density-spacing-md, 16px);
        border-left: 3px solid var(--ft-accent-current, var(--ft-accent));
        background-color: var(--ft-surface-primary);
        border-radius: var(--ft-radius-sm);
        font-size: var(--ft-density-font-base, 1rem);
        line-height: var(--ft-density-line-height, 1.5);
        color: var(--ft-text-primary);
      }

      .friendly-stream-chunk__header {
        display: flex;
        align-items: center;
        gap: var(--ft-density-spacing-sm, 8px);
        font-size: var(--ft-density-font-sm, 0.875rem);
        color: var(--ft-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .friendly-stream-chunk__glyph {
        font-size: 1rem;
        color: var(--ft-accent-current, var(--ft-accent));
      }

      .friendly-stream-chunk__kind {
        font-weight: var(--ft-font-weight-semibold);
      }

      .friendly-stream-chunk__tool,
      .friendly-stream-chunk__time {
        font-family: var(--ft-font-family-mono);
        font-size: 0.75em;
        color: var(--ft-text-secondary);
      }

      .friendly-stream-chunk__body {
        margin: 0;
      }

      .friendly-stream-chunk__code {
        margin: 0;
        padding: var(--ft-density-spacing-sm, 8px);
        background-color: var(--ft-surface-secondary);
        border-radius: var(--ft-radius-sm);
        font-family: var(--ft-font-family-mono);
        font-size: 0.875em;
        white-space: pre-wrap;
        overflow-x: auto;
      }

      .friendly-stream-chunk__figure {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--ft-density-spacing-xs, 4px);
      }

      .friendly-stream-chunk__image {
        max-width: 100%;
        height: auto;
        border-radius: var(--ft-radius-sm);
      }

      .friendly-stream-chunk__caption {
        font-size: var(--ft-density-font-sm, 0.875rem);
        color: var(--ft-text-secondary);
      }

      .friendly-stream-chunk__cite-link {
        color: var(--ft-accent-current, var(--ft-accent));
        text-decoration: underline;
      }

      .friendly-stream-chunk__cite-quote {
        display: block;
        font-style: italic;
        color: var(--ft-text-secondary);
        margin-top: var(--ft-density-spacing-xs, 4px);
      }

      /* Per-kind accent overrides — leave the surface neutral, change only
       * the accent rail and glyph so layouts stay visually quiet. */
      .friendly-stream-chunk--thought {
        border-left-color: var(--ft-secondary);
      }
      .friendly-stream-chunk--thought .friendly-stream-chunk__glyph {
        color: var(--ft-secondary);
      }
      .friendly-stream-chunk--tool-call,
      .friendly-stream-chunk--tool-result {
        border-left-color: var(--ft-info);
      }
      .friendly-stream-chunk--tool-call .friendly-stream-chunk__glyph,
      .friendly-stream-chunk--tool-result .friendly-stream-chunk__glyph {
        color: var(--ft-info);
      }
      .friendly-stream-chunk--error {
        border-left-color: var(--ft-error);
        background-color: color-mix(
          in srgb,
          var(--ft-error) 8%,
          var(--ft-surface-primary)
        );
      }
      .friendly-stream-chunk--error .friendly-stream-chunk__glyph {
        color: var(--ft-error);
      }
      .friendly-stream-chunk--status {
        border-left-color: var(--ft-success);
      }
      .friendly-stream-chunk--status .friendly-stream-chunk__glyph {
        color: var(--ft-success);
      }
    `,
  ],
})
export class FriendlyStreamChunk {
  /** Discriminator for the chunk; selects template branch and accent. */
  readonly kind = input.required<StreamChunkKind>();

  /** Render-time payload; optional fields are surfaced only when present. */
  readonly payload = input<StreamChunkPayload | null>(null);

  /**
   * Override the implicit ARIA live behaviour. Defaults to `polite` for
   * `status` chunks and `assertive` for `error` chunks; everything else is
   * `off`.
   */
  readonly ariaLiveOverride = input<'off' | 'polite' | 'assertive' | null>(
    null,
  );

  protected readonly glyph = computed<string>(() => GLYPH_BY_KIND[this.kind()]);

  protected readonly role = computed<string>(() => ROLE_BY_KIND[this.kind()]);

  protected readonly humanKind = computed<string>(() => {
    const k = this.kind();
    switch (k) {
      case 'tool_call':
        return 'Tool call';
      case 'tool_result':
        return 'Tool result';
      default:
        return k.charAt(0).toUpperCase() + k.slice(1);
    }
  });

  protected readonly ariaLive = computed<'off' | 'polite' | 'assertive'>(() => {
    const explicit = this.ariaLiveOverride();
    if (explicit) {
      return explicit;
    }
    switch (this.kind()) {
      case 'error':
        return 'assertive';
      case 'status':
        return 'polite';
      default:
        return 'off';
    }
  });
}
