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
 * Discriminator for one of the nine canonical AEP v2 LangGraph stream
 * chunk kinds. The agentic UX surface emits a typed, replayable stream of
 * these chunks; each `kind` selects a distinct visual treatment and
 * accessibility role.
 */
export type StreamChunkKind =
  | 'final'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'code_block'
  | 'file_write'
  | 'error'
  | 'progress'
  | 'agent_handoff';

/**
 * Render-time payload accompanying a chunk. Optional fields are surfaced
 * only when the corresponding data is present, keeping the DOM minimal.
 */
export interface StreamChunkPayload {
  /** Free-form body text — used by every kind except `file_write`. */
  readonly content?: string | null;
  /** Tool/function name for `tool_call` and `tool_result` chunks. */
  readonly tool?: string | null;
  /** Programming language hint for `code_block` chunks (e.g. "typescript"). */
  readonly language?: string | null;
  /** File path or image URL for `file_write` chunks. */
  readonly src?: string | null;
  /** Alt text or file description for `file_write` chunks. */
  readonly alt?: string | null;
  /** Source label for `agent_handoff` (originating agent / publication). */
  readonly source?: string | null;
  /** Anchor / URL for `agent_handoff` chunks. */
  readonly href?: string | null;
  /** Optional ISO-8601 timestamp displayed as a tooltip. */
  readonly timestamp?: string | null;
  /** Originating agent identifier (used by A3 agent-stage indicators). */
  readonly agent?: string | null;
}

/** Lookup-table glyphs keyed by chunk kind; used purely as visual cues. */
const GLYPH_BY_KIND: Readonly<Record<StreamChunkKind, string>> = {
  final: '✎',
  reasoning: '✦',
  tool_call: '⚙',
  tool_result: '↩',
  code_block: '⌨',
  file_write: '🖼',
  error: '⚠',
  progress: '●',
  agent_handoff: '❝',
};

/** Accessible role per chunk kind — used for AT semantics. */
const ROLE_BY_KIND: Readonly<Record<StreamChunkKind, string>> = {
  final: 'article',
  reasoning: 'note',
  tool_call: 'note',
  tool_result: 'note',
  code_block: 'group',
  file_write: 'figure',
  error: 'alert',
  progress: 'status',
  agent_handoff: 'note',
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
      [class.friendly-stream-chunk--final]="kind() === 'final'"
      [class.friendly-stream-chunk--reasoning]="kind() === 'reasoning'"
      [class.friendly-stream-chunk--tool-call]="kind() === 'tool_call'"
      [class.friendly-stream-chunk--tool-result]="kind() === 'tool_result'"
      [class.friendly-stream-chunk--code-block]="kind() === 'code_block'"
      [class.friendly-stream-chunk--file-write]="kind() === 'file_write'"
      [class.friendly-stream-chunk--error]="kind() === 'error'"
      [class.friendly-stream-chunk--progress]="kind() === 'progress'"
      [class.friendly-stream-chunk--agent-handoff]="kind() === 'agent_handoff'"
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
        @case ('code_block') {
          <pre
            class="friendly-stream-chunk__code"
          ><code [attr.data-language]="payload()?.language">{{
            payload()?.content
          }}</code></pre>
        }
        @case ('file_write') {
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
        @case ('agent_handoff') {
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
      .friendly-stream-chunk--reasoning {
        border-left-color: var(--ft-secondary);
      }
      .friendly-stream-chunk--reasoning .friendly-stream-chunk__glyph {
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
      .friendly-stream-chunk--progress {
        border-left-color: var(--ft-success);
      }
      .friendly-stream-chunk--progress .friendly-stream-chunk__glyph {
        color: var(--ft-success);
      }
      .friendly-stream-chunk--agent-handoff {
        border-left-color: var(--ft-secondary);
      }
      .friendly-stream-chunk--agent-handoff .friendly-stream-chunk__glyph {
        color: var(--ft-secondary);
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
   * `progress` chunks and `assertive` for `error` chunks; everything else
   * is `off`.
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
      case 'code_block':
        return 'Code block';
      case 'file_write':
        return 'File write';
      case 'agent_handoff':
        return 'Agent handoff';
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
      case 'progress':
        return 'polite';
      default:
        return 'off';
    }
  });
}
