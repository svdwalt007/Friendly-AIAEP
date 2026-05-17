/**
 * @file AEP v2 LangGraph stream contract — canonical 9-kind taxonomy shared
 * by the agent runtime (producer) and the agentic UX surface (consumer).
 *
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */

/**
 * The nine canonical LangGraph chunk kinds emitted by the AEP v2 runtime.
 *
 * These values are authoritative; any UI binding (e.g.
 * `<friendly-stream-chunk [kind]>`) MUST accept exactly this set.
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

/** All nine canonical kinds, ordered for UI iteration. */
export const STREAM_CHUNK_KINDS: readonly StreamChunkKind[] = [
  'final',
  'reasoning',
  'tool_call',
  'tool_result',
  'code_block',
  'file_write',
  'error',
  'progress',
  'agent_handoff',
] as const;

/**
 * Render-time payload shape. All fields are optional; producers populate
 * only those relevant to the chunk's `kind`.
 */
export interface StreamChunkPayload {
  /** Free-form body text. */
  readonly content?: string | null;
  /** Tool / function name for `tool_call` and `tool_result`. */
  readonly tool?: string | null;
  /** Programming language hint for `code_block`. */
  readonly language?: string | null;
  /** File path or image URL for `file_write`. */
  readonly src?: string | null;
  /** Alt text or short file description for `file_write`. */
  readonly alt?: string | null;
  /** Originating agent name for `agent_handoff`. */
  readonly source?: string | null;
  /** Anchor / handoff URL for `agent_handoff`. */
  readonly href?: string | null;
  /** ISO-8601 timestamp surfaced as a tooltip. */
  readonly timestamp?: string | null;
  /** Originating agent identifier (used by A3 S/P/I indicators). */
  readonly agent?: string | null;
}

/**
 * Discriminated chunk envelope as transmitted over SSE / WebSocket.
 */
export interface StreamChunk {
  /** Discriminator. */
  readonly kind: StreamChunkKind;
  /** Render-time payload. */
  readonly payload: StreamChunkPayload;
  /** Stable, monotonically-increasing chunk identifier. */
  readonly id: string;
  /** ISO-8601 emission timestamp. */
  readonly timestamp: string;
}
