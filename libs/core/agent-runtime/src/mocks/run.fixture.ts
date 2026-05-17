/**
 * @file Deterministic LangGraph stream fixture — exercises all nine
 * canonical {@link StreamChunkKind}s in a 60-second loop, used by the
 * dev-mode SSE mock and component tests.
 *
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */

import type { StreamChunk } from '../lib/contracts';

/**
 * One full 60-second cycle of canonical stream chunks. Each entry is
 * spaced ~6.6s apart by the consuming mock so the full loop completes in
 * ~60 seconds.
 */
export const RUN_FIXTURE: readonly StreamChunk[] = [
  {
    id: 'fx-01',
    kind: 'progress',
    timestamp: '1970-01-01T00:00:00.000Z',
    payload: {
      content: 'Bootstrapping AEP supervisor for project demo-001.',
      agent: 'supervisor',
    },
  },
  {
    id: 'fx-02',
    kind: 'reasoning',
    timestamp: '1970-01-01T00:00:06.667Z',
    payload: {
      content:
        'Inspecting requested deliverables — three IoT widgets and a stream view.',
      agent: 'supervisor',
    },
  },
  {
    id: 'fx-03',
    kind: 'agent_handoff',
    timestamp: '1970-01-01T00:00:13.333Z',
    payload: {
      source: 'supervisor → planning-agent',
      href: 'agent://planning',
      content: 'Routing decomposition to planning-agent.',
      agent: 'planning-agent',
    },
  },
  {
    id: 'fx-04',
    kind: 'tool_call',
    timestamp: '1970-01-01T00:00:20.000Z',
    payload: {
      tool: 'iot.devices.list',
      content: '{ "limit": 10, "status": "online" }',
      agent: 'planning-agent',
    },
  },
  {
    id: 'fx-05',
    kind: 'tool_result',
    timestamp: '1970-01-01T00:00:26.667Z',
    payload: {
      tool: 'iot.devices.list',
      content: '6 devices returned (latency 84 ms).',
      agent: 'planning-agent',
    },
  },
  {
    id: 'fx-06',
    kind: 'code_block',
    timestamp: '1970-01-01T00:00:33.333Z',
    payload: {
      language: 'typescript',
      content:
        "export const widget = { kind: 'stat-card', label: 'Active', value: 6 };",
      agent: 'codegen-agent',
    },
  },
  {
    id: 'fx-07',
    kind: 'file_write',
    timestamp: '1970-01-01T00:00:40.000Z',
    payload: {
      src: 'workspace/widgets/active.ts',
      alt: 'Generated active-devices stat-card widget.',
      content: 'workspace/widgets/active.ts',
      agent: 'codegen-agent',
    },
  },
  {
    id: 'fx-08',
    kind: 'error',
    timestamp: '1970-01-01T00:00:46.667Z',
    payload: {
      content: 'Mock validation warning: device SM-002 reported stale telemetry.',
      agent: 'iot-domain-agent',
    },
  },
  {
    id: 'fx-09',
    kind: 'final',
    timestamp: '1970-01-01T00:00:53.333Z',
    payload: {
      content:
        'Build complete — 4 widgets generated, preview ready at /preview/demo-001.',
      agent: 'supervisor',
    },
  },
];

/** Cycle length in milliseconds (60 s). */
export const RUN_FIXTURE_CYCLE_MS = 60_000;

/** Time between successive fixture chunks (≈ 6.667 s). */
export const RUN_FIXTURE_STEP_MS = Math.floor(
  RUN_FIXTURE_CYCLE_MS / RUN_FIXTURE.length,
);
